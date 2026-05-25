import { Item, ItineraryTask, Priority, RelocationProject, Room } from "@/lib/domain";

function stableId(parts: string[]): string {
  return parts.join("_").replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
}

function getPriority(item: Item): Priority {
  if (item.fragile) return "high";
  if (item.label.includes("box")) return "low";
  return "medium";
}

function groupItemsByRoom(items: Item[]): Record<string, Item[]> {
  return items.reduce<Record<string, Item[]>>((acc, item) => {
    acc[item.roomId] ??= [];
    acc[item.roomId].push(item);
    return acc;
  }, {});
}

function taskTitle(room: Room | undefined, type: ItineraryTask["type"], item: Item): string {
  const roomLabel = room?.name ?? "room";
  if (type === "protect") return `Protect ${item.label} in ${roomLabel}`;
  if (type === "label") return `Label ${item.label} boxes for ${roomLabel}`;
  if (type === "move") return `Move ${item.label} from ${roomLabel}`;
  return `Pack ${item.label} from ${roomLabel}`;
}

export function generateItinerary(project: RelocationProject): ItineraryTask[] {
  const grouped = groupItemsByRoom(project.items);
  const tasks: ItineraryTask[] = [];

  for (const roomId of Object.keys(grouped)) {
    const room = project.rooms.find((entry) => entry.id === roomId);
    const roomItems = grouped[roomId];

    for (const item of roomItems) {
      const packTaskId = stableId([project.id, roomId, item.id, "pack"]);
      const labelTaskId = stableId([project.id, roomId, item.id, "label"]);
      const protectTaskId = stableId([project.id, roomId, item.id, "protect"]);
      const moveTaskId = stableId([project.id, roomId, item.id, "move"]);

      tasks.push({
        id: packTaskId,
        projectId: project.id,
        roomId,
        title: taskTitle(room, "pack", item),
        type: "pack",
        status: "pending",
        priority: getPriority(item),
        dependencies: [],
      });

      tasks.push({
        id: labelTaskId,
        projectId: project.id,
        roomId,
        title: taskTitle(room, "label", item),
        type: "label",
        status: "pending",
        priority: "medium",
        dependencies: [packTaskId],
      });

      if (item.fragile) {
        tasks.push({
          id: protectTaskId,
          projectId: project.id,
          roomId,
          title: taskTitle(room, "protect", item),
          type: "protect",
          status: "pending",
          priority: "high",
          dependencies: [packTaskId],
        });
      }

      tasks.push({
        id: moveTaskId,
        projectId: project.id,
        roomId,
        title: taskTitle(room, "move", item),
        type: "move",
        status: "pending",
        priority: item.fragile ? "high" : "medium",
        dependencies: item.fragile ? [labelTaskId, protectTaskId] : [labelTaskId],
      });
    }
  }

  return tasks;
}
