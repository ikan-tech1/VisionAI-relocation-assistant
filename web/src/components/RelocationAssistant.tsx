'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Priority, RelocationProject, TaskStatus } from "@/lib/domain";

interface ScanSessionResponse {
  room: { id: string; name: string };
  project: RelocationProject;
}

export default function RelocationAssistant() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const samplingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const inFlightSampleRef = useRef(false);
  const projectRef = useRef<RelocationProject | null>(null);

  const [projectName, setProjectName] = useState("My Home Relocation");
  const [roomName, setRoomName] = useState("Living Room");
  const [moveDate, setMoveDate] = useState("");
  const [retentionMode, setRetentionMode] = useState<"standard" | "ephemeral">("standard");
  const [confidenceReviewThreshold, setConfidenceReviewThreshold] = useState(0.75);
  const [sampleIntervalMs, setSampleIntervalMs] = useState(2200);
  const [taskFilter, setTaskFilter] = useState<TaskStatus | "all">("all");

  const [project, setProject] = useState<RelocationProject | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [status, setStatus] = useState("Create a project to start scanning.");
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isSampling, setIsSampling] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [phase2Output, setPhase2Output] = useState<string>("");

  useEffect(() => {
    return () => {
      stopSampling();
      teardownStream();
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  const itemCount = project?.items.length ?? 0;
  const taskCount = project?.itineraryTasks.length ?? 0;
  const doneTaskCount = useMemo(
    () => project?.itineraryTasks.filter((task) => task.status === "done").length ?? 0,
    [project],
  );

  async function createProject(event: FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    setStatus("Creating relocation project...");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          moveDate: moveDate || undefined,
          retentionMode,
          confidenceReviewThreshold,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to create project");
      setProject(data.project as RelocationProject);
      setStatus("Project created. Start camera and begin scanning.");
      connectEvents(data.project.id);
    } catch (error) {
      setStatus(`Create project failed: ${String(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  function connectEvents(projectId: string) {
    if (eventSourceRef.current) eventSourceRef.current.close();
    const source = new EventSource(`/api/projects/${projectId}/events`);
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          type: string;
          project?: RelocationProject;
        };
        if (payload.project) setProject(payload.project);
      } catch {
        // Keep stream resilient if one event is malformed.
      }
    };
    source.onerror = () => {
      setStatus("Live stream disconnected. You can continue and refresh state.");
    };
    eventSourceRef.current = source;
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setIsCameraOn(true);
      setStatus("Camera ready. Start scanning to build the itinerary live.");
    } catch (error) {
      setStatus(`Unable to access camera: ${String(error)}`);
    }
  }

  function teardownStream() {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraOn(false);
  }

  async function beginScanning() {
    if (!project) {
      setStatus("Create a project first.");
      return;
    }
    if (!roomName.trim()) {
      setStatus("Room name is required.");
      return;
    }
    setIsBusy(true);
    try {
      const response = await fetch("/api/scan/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, roomName }),
      });
      const data = (await response.json()) as ScanSessionResponse | { error: string };
      if (!response.ok || !("room" in data)) {
        throw new Error("error" in data ? data.error : "Unable to start scan session");
      }
      setProject(data.project);
      setCurrentRoomId(data.room.id);
      startSampling(data.room.id);
      setStatus(`Scanning ${data.room.name}. Inventory and itinerary are updating.`);
    } catch (error) {
      setStatus(`Could not start scanning: ${String(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  function startSampling(roomId: string) {
    stopSampling();
    void sampleAndSend(roomId);
    samplingTimerRef.current = setInterval(() => {
      void sampleAndSend(roomId);
    }, sampleIntervalMs);
    setIsSampling(true);
  }

  function stopSampling() {
    if (samplingTimerRef.current) {
      clearInterval(samplingTimerRef.current);
      samplingTimerRef.current = null;
    }
    setIsSampling(false);
  }

  async function sampleAndSend(roomId: string) {
    if (!projectRef.current || !videoRef.current || !canvasRef.current || inFlightSampleRef.current) return;
    const currentProject = projectRef.current;
    inFlightSampleRef.current = true;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      inFlightSampleRef.current = false;
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    try {
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frameDataUrl = canvas.toDataURL("image/jpeg", 0.72);
      const response = await fetch("/api/scan/frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: currentProject.id,
          roomId,
          roomHint: roomName,
          frameDataUrl,
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setStatus(`Scan frame failed: ${data.error ?? response.statusText}`);
        return;
      }
      const data = (await response.json()) as { project: RelocationProject };
      setProject(data.project);
    } catch (error) {
      setStatus(`Scan frame failed: ${String(error)}`);
    } finally {
      inFlightSampleRef.current = false;
    }
  }

  async function updateTask(
    taskId: string,
    patch: { status?: TaskStatus; priority?: Priority; notes?: string; title?: string },
  ) {
    if (!project) return;
    try {
      const response = await fetch(`/api/itinerary/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, ...patch }),
      });
      const data = (await response.json()) as { project?: RelocationProject; error?: string };
      if (response.ok && data.project) {
        setProject(data.project);
      } else {
        setStatus(`Task update failed: ${data.error ?? "Unknown error"}`);
      }
    } catch (error) {
      setStatus(`Task update failed: ${String(error)}`);
    }
  }

  async function runLoadOptimization() {
    if (!project) return;
    try {
      const response = await fetch("/api/itinerary/optimize-load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = (await response.json()) as {
        recommendation?: {
          truckUtilizationPercent: number;
          packingEfficiencyScore: number;
          cartonRecommendations: Array<{ label: string; recommendedCartonSize: string }>;
          warnings: string[];
        };
        error?: string;
      };
      if (!response.ok || !data.recommendation) {
        setPhase2Output(data.error ?? "Unable to optimize load.");
        return;
      }
      setPhase2Output(
        [
          `Truck utilization: ${data.recommendation.truckUtilizationPercent}%`,
          `Packing efficiency score: ${data.recommendation.packingEfficiencyScore}/100`,
          `Cartons: ${data.recommendation.cartonRecommendations
            .slice(0, 6)
            .map((entry) => `${entry.label}→${entry.recommendedCartonSize}`)
            .join(", ")}`,
          `Warnings: ${data.recommendation.warnings.join("; ") || "None"}`,
        ].join("\n"),
      );
    } catch (error) {
      setPhase2Output(`Unable to optimize load: ${String(error)}`);
    }
  }

  async function runCalibration() {
    try {
      const response = await fetch("/api/measurements/calibrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceObject: "a4_paper",
          observedPixelWidth: 210,
        }),
      });
      const data = (await response.json()) as {
        calibration?: { scaleCmPerPixel: number; confidence: number };
        error?: string;
      };
      if (!response.ok || !data.calibration) {
        setPhase2Output(data.error ?? "Calibration failed.");
        return;
      }
      setPhase2Output(
        `Calibration scale: ${data.calibration.scaleCmPerPixel} cm/pixel (confidence ${Math.round(
          data.calibration.confidence * 100,
        )}%)`,
      );
    } catch (error) {
      setPhase2Output(`Calibration failed: ${String(error)}`);
    }
  }

  const groupedTasks = useMemo(() => {
    if (!project) return [];
    const roomNameById = new Map(project.rooms.map((room) => [room.id, room.name]));
    return [...project.itineraryTasks].sort((a, b) => {
      if (a.roomId === b.roomId) return a.title.localeCompare(b.title);
      return (roomNameById.get(a.roomId) ?? "").localeCompare(roomNameById.get(b.roomId) ?? "");
    });
  }, [project]);

  const filteredTasks = useMemo(
    () =>
      groupedTasks.filter((task) => {
        if (taskFilter === "all") return true;
        return task.status === taskFilter;
      }),
    [groupedTasks, taskFilter],
  );

  const needsReviewItems = useMemo(() => {
    if (!project) return [];
    const threshold = project.preferences.confidenceReviewThreshold;
    return project.items.filter((item) => item.confidence < threshold);
  }, [project]);

  const completionPercent = useMemo(() => {
    if (!project || project.itineraryTasks.length === 0) return 0;
    return Math.round((doneTaskCount / project.itineraryTasks.length) * 100);
  }, [doneTaskCount, project]);

  async function copyShareLink() {
    if (!project) return;
    try {
      const shareUrl = `${window.location.origin}/api/projects/${project.id}/live-state`;
      await navigator.clipboard.writeText(shareUrl);
      setStatus("Share link copied to clipboard.");
    } catch (error) {
      setStatus(`Could not copy share link: ${String(error)}`);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:p-6">
      <section className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-5 shadow-2xl">
        <p className="text-xs uppercase tracking-wider text-cyan-300">Vision AI relocation assistant</p>
        <h1 className="mt-1 text-3xl font-semibold">Turn live room scans into a packing itinerary</h1>
        <p className="mt-2 text-sm text-slate-300">
          Scan each room with your camera, review low-confidence detections, and execute a live move-day checklist.
        </p>
        <p className="mt-3 rounded bg-slate-950/60 px-3 py-2 text-sm text-slate-200">{status}</p>
      </section>

      <form
        onSubmit={createProject}
        className="grid gap-2 rounded-xl border border-slate-700 bg-slate-900/70 p-4 md:grid-cols-6"
      >
        <input
          className="rounded border border-slate-700 bg-slate-950 px-3 py-2"
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          placeholder="Project name"
          required
        />
        <input
          className="rounded border border-slate-700 bg-slate-950 px-3 py-2"
          value={roomName}
          onChange={(event) => setRoomName(event.target.value)}
          placeholder="Current room"
          required
        />
        <input
          className="rounded border border-slate-700 bg-slate-950 px-3 py-2"
          type="date"
          value={moveDate}
          onChange={(event) => setMoveDate(event.target.value)}
        />
        <select
          className="rounded border border-slate-700 bg-slate-950 px-3 py-2"
          value={retentionMode}
          onChange={(event) => setRetentionMode(event.target.value as "standard" | "ephemeral")}
        >
          <option value="standard">Standard retention</option>
          <option value="ephemeral">Ephemeral mode</option>
        </select>
        <label className="flex items-center gap-2 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs">
          Review threshold
          <input
            type="range"
            min={0.5}
            max={0.95}
            step={0.05}
            value={confidenceReviewThreshold}
            onChange={(event) => setConfidenceReviewThreshold(Number(event.target.value))}
          />
          {Math.round(confidenceReviewThreshold * 100)}%
        </label>
        <button
          type="submit"
          disabled={isBusy}
          className="rounded bg-blue-600 px-3 py-2 font-medium hover:bg-blue-500 disabled:opacity-50"
        >
          {project ? "Create new project" : "Create project"}
        </button>
      </form>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
          <h2 className="mb-3 text-lg font-semibold">Live Scan</h2>
          <video ref={videoRef} className="aspect-video w-full rounded bg-black" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startCamera}
              disabled={isCameraOn}
              className="rounded bg-emerald-700 px-3 py-2 text-sm hover:bg-emerald-600 disabled:opacity-50"
            >
              Start camera
            </button>
            <button
              type="button"
              onClick={beginScanning}
              disabled={!isCameraOn || !project || isSampling}
              className="rounded bg-indigo-700 px-3 py-2 text-sm hover:bg-indigo-600 disabled:opacity-50"
            >
              Start room scan
            </button>
            <label className="flex items-center gap-2 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs">
              Sample interval
              <select
                value={sampleIntervalMs}
                onChange={(event) => setSampleIntervalMs(Number(event.target.value))}
                className="rounded bg-slate-900 px-2 py-1 text-xs"
              >
                <option value={1200}>1.2s (high detail)</option>
                <option value={2200}>2.2s (balanced)</option>
                <option value={3500}>3.5s (low cost)</option>
              </select>
            </label>
            <button
              type="button"
              onClick={stopSampling}
              disabled={!isSampling}
              className="rounded bg-amber-700 px-3 py-2 text-sm hover:bg-amber-600 disabled:opacity-50"
            >
              Pause scan
            </button>
            <button
              type="button"
              onClick={teardownStream}
              disabled={!isCameraOn}
              className="rounded bg-rose-700 px-3 py-2 text-sm hover:bg-rose-600 disabled:opacity-50"
            >
              Stop camera
            </button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <MetricCard title="Detected items" value={String(itemCount)} />
            <MetricCard title="Itinerary tasks" value={String(taskCount)} />
            <MetricCard title="Completed" value={`${doneTaskCount} (${completionPercent}%)`} />
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded bg-slate-800">
            <div className="h-full rounded bg-emerald-500 transition-all" style={{ width: `${completionPercent}%` }} />
          </div>
          <div className="mt-4 flex gap-2">
            {project && (
              <>
                <a
                  className="rounded bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600"
                  href={`/api/projects/${project.id}/export?format=csv`}
                >
                  Export CSV
                </a>
                <a
                  className="rounded bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600"
                  href={`/api/projects/${project.id}/export?format=json`}
                >
                  Share JSON
                </a>
                <button
                  type="button"
                  onClick={copyShareLink}
                  className="rounded bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600"
                >
                  Copy share link
                </button>
              </>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Active room id: {currentRoomId ?? "Not scanning yet"}
          </p>
        </section>

        <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
          <h2 className="mb-2 text-lg font-semibold">Phase 2 Preview</h2>
          <p className="mb-3 text-sm text-slate-300">
            Calibrate size scale and run a first-pass truck-load optimization.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runCalibration}
              className="rounded bg-purple-700 px-3 py-2 text-sm hover:bg-purple-600"
            >
              Run calibration
            </button>
            <button
              type="button"
              onClick={runLoadOptimization}
              disabled={!project}
              className="rounded bg-cyan-700 px-3 py-2 text-sm hover:bg-cyan-600 disabled:opacity-50"
            >
              Optimize load
            </button>
          </div>
          <pre className="mt-3 min-h-32 whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs text-slate-200">
            {phase2Output || "No phase 2 output yet."}
          </pre>
          {project && (
            <p className="mt-2 text-xs text-slate-400">
              Active retention policy: <strong>{project.preferences.retentionMode}</strong>
            </p>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-amber-700/50 bg-amber-950/30 p-4">
        <h2 className="mb-2 text-lg font-semibold text-amber-200">Needs Review (low confidence detections)</h2>
        {needsReviewItems.length === 0 ? (
          <p className="text-sm text-amber-100/80">No low-confidence items currently need review.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {needsReviewItems.map((item) => (
              <li key={item.id} className="rounded border border-amber-700/50 bg-slate-950 p-3 text-sm">
                <p className="font-medium">{item.label.replaceAll("_", " ")}</p>
                <p className="text-xs text-amber-200">Confidence: {Math.round(item.confidence * 100)}%</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Live Packing Itinerary</h2>
          <select
            value={taskFilter}
            onChange={(event) => setTaskFilter(event.target.value as TaskStatus | "all")}
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs"
          >
            <option value="all">All tasks</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
          </select>
        </div>
        {!project && <p className="text-sm text-slate-300">Create a project to see itinerary tasks.</p>}
        <ul className="space-y-2">
          {filteredTasks.map((task) => (
            <li
              key={task.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-700 bg-slate-950 p-3"
            >
              <div className="min-w-56 flex-1">
                <p className="font-medium">{task.title}</p>
                <p className="text-xs uppercase text-slate-400">
                  {task.type} • {task.priority}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                  value={task.status}
                  onChange={(event) =>
                    updateTask(task.id, { status: event.target.value as "pending" | "in_progress" | "done" })
                  }
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                </select>
                <select
                  className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                  value={task.priority}
                  onChange={(event) =>
                    updateTask(task.id, { priority: event.target.value as "low" | "medium" | "high" })
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded border border-slate-700 bg-slate-950 p-3">
      <p className="text-xs uppercase text-slate-400">{title}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
