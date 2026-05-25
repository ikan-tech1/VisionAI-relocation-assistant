export type Priority = "low" | "medium" | "high";
export type TaskStatus = "pending" | "in_progress" | "done";
export type ScanStatus = "idle" | "scanning" | "completed";

export interface Dimensions {
  widthCm: number;
  heightCm: number;
  depthCm: number;
  confidence: number;
}

export interface Room {
  id: string;
  name: string;
  scanStatus: ScanStatus;
  confidence: number;
}

export interface Item {
  id: string;
  label: string;
  roomId: string;
  quantity: number;
  fragile: boolean;
  confidence: number;
  lastSeenAt: string;
  dimensions?: Dimensions;
}

export interface ItineraryTask {
  id: string;
  projectId: string;
  roomId: string;
  title: string;
  type: "pack" | "label" | "protect" | "move";
  status: TaskStatus;
  priority: Priority;
  dependencies: string[];
  notes?: string;
}

export interface RelocationProject {
  id: string;
  name: string;
  moveDate?: string;
  preferences: {
    retentionMode: "standard" | "ephemeral";
    confidenceReviewThreshold: number;
  };
  createdAt: string;
  updatedAt: string;
  rooms: Room[];
  items: Item[];
  itineraryTasks: ItineraryTask[];
}

export interface Detection {
  label: string;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number };
  estimatedDimensionsCm: {
    widthCm: number;
    heightCm: number;
    depthCm: number;
    confidence: number;
  };
  fragile: boolean;
}
