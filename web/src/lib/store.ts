import { inferRoomItems } from "@/lib/inference";
import { generateItinerary } from "@/lib/itinerary";
import { Detection, Item, ItineraryTask, RelocationProject, Room } from "@/lib/domain";

interface DetectionSeen {
  key: string;
  itemId: string;
  lastSeenAt: number;
}

interface ProjectState {
  project: RelocationProject;
  detectionSeen: DetectionSeen[];
}

type EventPayload =
  | { type: "project_created"; project: RelocationProject }
  | { type: "scan_updated"; project: RelocationProject; detections: Detection[] }
  | { type: "task_updated"; project: RelocationProject; task: ItineraryTask };

type Listener = (payload: EventPayload) => void;

const projects = new Map<string, ProjectState>();
const listeners = new Map<string, Set<Listener>>();

function nowIso(): string {
  return new Date().toISOString();
}

function emit(projectId: string, payload: EventPayload): void {
  const subs = listeners.get(projectId);
  if (!subs) return;
  for (const listener of subs) listener(payload);
}

export function subscribeToProject(projectId: string, listener: Listener): () => void {
  const current = listeners.get(projectId) ?? new Set<Listener>();
  current.add(listener);
  listeners.set(projectId, current);
  return () => {
    current.delete(listener);
    if (current.size === 0) listeners.delete(projectId);
  };
}

export function createProject(
  name: string,
  moveDate?: string,
  preferences?: { retentionMode?: "standard" | "ephemeral"; confidenceReviewThreshold?: number },
): RelocationProject {
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  const project: RelocationProject = {
    id,
    name,
    moveDate,
    preferences: {
      retentionMode: preferences?.retentionMode ?? "standard",
      confidenceReviewThreshold: preferences?.confidenceReviewThreshold ?? 0.75,
    },
    createdAt,
    updatedAt: createdAt,
    rooms: [],
    items: [],
    itineraryTasks: [],
  };

  projects.set(id, { project, detectionSeen: [] });
  emit(id, { type: "project_created", project });
  return project;
}

export function getProject(projectId: string): RelocationProject | null {
  return projects.get(projectId)?.project ?? null;
}

export function ensureRoom(projectId: string, roomName: string): Room {
  const state = projects.get(projectId);
  if (!state) throw new Error("Project not found");
  const existing = state.project.rooms.find(
    (room) => room.name.toLowerCase() === roomName.toLowerCase(),
  );
  if (existing) return existing;

  const room: Room = {
    id: crypto.randomUUID(),
    name: roomName,
    scanStatus: "idle",
    confidence: 0.6,
  };
  state.project.rooms.push(room);
  state.project.updatedAt = nowIso();
  return room;
}

function detectionKey(roomId: string, detection: Detection): string {
  const cellX = Math.round(detection.bbox.x * 10);
  const cellY = Math.round(detection.bbox.y * 10);
  return `${roomId}:${detection.label}:${cellX}:${cellY}`;
}

function upsertDetectedItem(state: ProjectState, roomId: string, detection: Detection): Item {
  const key = detectionKey(roomId, detection);
  const now = Date.now();
  const found = state.detectionSeen.find((entry) => entry.key === key && now - entry.lastSeenAt < 180_000);

  if (found) {
    found.lastSeenAt = now;
    const existing = state.project.items.find((item) => item.id === found.itemId);
    if (!existing) throw new Error("Detected item index is inconsistent");
    existing.lastSeenAt = nowIso();
    existing.confidence = Math.max(existing.confidence, detection.confidence);
    existing.dimensions = detection.estimatedDimensionsCm;
    return existing;
  }

  const item: Item = {
    id: crypto.randomUUID(),
    label: detection.label,
    roomId,
    quantity: 1,
    fragile: detection.fragile,
    confidence: detection.confidence,
    lastSeenAt: nowIso(),
    dimensions: detection.estimatedDimensionsCm,
  };

  state.project.items.push(item);
  state.detectionSeen.push({ key, itemId: item.id, lastSeenAt: now });
  return item;
}

export function startScanSession(projectId: string, roomName: string): { room: Room; project: RelocationProject } {
  const state = projects.get(projectId);
  if (!state) throw new Error("Project not found");
  const room = ensureRoom(projectId, roomName);
  room.scanStatus = "scanning";
  state.project.updatedAt = nowIso();
  return { room, project: state.project };
}

export function ingestFrame(params: {
  projectId: string;
  roomId: string;
  frameDataUrl: string;
  roomHint?: string;
}): { project: RelocationProject; detections: Detection[]; newItems: Item[] } {
  const state = projects.get(params.projectId);
  if (!state) throw new Error("Project not found");
  const room = state.project.rooms.find((entry) => entry.id === params.roomId);
  if (!room) throw new Error("Room not found");

  const detections = inferRoomItems(params.frameDataUrl, params.roomHint);
  const newItems = detections.map((d) => upsertDetectedItem(state, params.roomId, d));

  room.scanStatus = "scanning";
  room.confidence = Math.max(room.confidence, average(detections.map((d) => d.confidence)));
  state.project.itineraryTasks = mergeWithExistingTaskState(
    generateItinerary(state.project),
    state.project.itineraryTasks,
  );
  state.project.updatedAt = nowIso();

  emit(params.projectId, { type: "scan_updated", project: state.project, detections });
  return { project: state.project, detections, newItems };
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

export function regenerateItinerary(projectId: string): RelocationProject {
  const state = projects.get(projectId);
  if (!state) throw new Error("Project not found");
  state.project.itineraryTasks = mergeWithExistingTaskState(
    generateItinerary(state.project),
    state.project.itineraryTasks,
  );
  state.project.updatedAt = nowIso();
  return state.project;
}

export function updateTask(
  projectId: string,
  taskId: string,
  patch: Partial<Pick<ItineraryTask, "status" | "priority" | "notes" | "title">>,
): { project: RelocationProject; task: ItineraryTask } {
  const state = projects.get(projectId);
  if (!state) throw new Error("Project not found");

  const task = state.project.itineraryTasks.find((entry) => entry.id === taskId);
  if (!task) throw new Error("Task not found");

  if (patch.status) task.status = patch.status;
  if (patch.priority) task.priority = patch.priority;
  if (typeof patch.notes === "string") task.notes = patch.notes;
  if (patch.title !== undefined) task.title = patch.title;
  state.project.updatedAt = nowIso();

  emit(projectId, { type: "task_updated", project: state.project, task });
  return { project: state.project, task };
}

export function endRoomScan(projectId: string, roomId: string): RelocationProject {
  const state = projects.get(projectId);
  if (!state) throw new Error("Project not found");
  const room = state.project.rooms.find((entry) => entry.id === roomId);
  if (!room) throw new Error("Room not found");
  room.scanStatus = "completed";
  state.project.updatedAt = nowIso();
  return state.project;
}

function mergeWithExistingTaskState(
  nextTasks: ItineraryTask[],
  existingTasks: ItineraryTask[],
): ItineraryTask[] {
  const existingById = new Map(existingTasks.map((task) => [task.id, task]));
  return nextTasks.map((task) => {
    const existing = existingById.get(task.id);
    if (!existing) return task;
    return {
      ...task,
      status: existing.status,
      priority: existing.priority,
      notes: existing.notes,
      title: existing.title,
    };
  });
}
