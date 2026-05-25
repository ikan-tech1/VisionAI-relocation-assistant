import { Detection } from "@/lib/domain";

const CATALOG = [
  { label: "bookshelf", fragile: false, dims: [90, 180, 35] },
  { label: "sofa", fragile: false, dims: [210, 95, 95] },
  { label: "dining_chair", fragile: false, dims: [45, 95, 50] },
  { label: "lamp", fragile: true, dims: [40, 160, 40] },
  { label: "tv", fragile: true, dims: [130, 75, 12] },
  { label: "monitor", fragile: true, dims: [60, 38, 10] },
  { label: "wardrobe", fragile: false, dims: [120, 210, 60] },
  { label: "box_small", fragile: false, dims: [40, 35, 30] },
  { label: "box_medium", fragile: false, dims: [55, 45, 40] },
  { label: "box_large", fragile: false, dims: [70, 55, 50] },
  { label: "mattress", fragile: false, dims: [200, 30, 150] },
  { label: "coffee_table", fragile: false, dims: [100, 45, 60] },
] as const;

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function pseudoRandom(seed: number, salt: number): number {
  const x = Math.sin(seed * 9301 + salt * 49297) * 233280;
  return x - Math.floor(x);
}

export function inferRoomItems(frameDataUrl: string, roomHint?: string): Detection[] {
  const seed = hashSeed(`${roomHint ?? "room"}|${frameDataUrl.slice(0, 96)}`);
  const count = 2 + Math.floor(pseudoRandom(seed, 1) * 4);

  return Array.from({ length: count }).map((_, idx) => {
    const itemSeed = seed + idx * 17;
    const catalogIndex = Math.floor(pseudoRandom(itemSeed, 2) * CATALOG.length);
    const base = CATALOG[catalogIndex];
    const scale = 0.85 + pseudoRandom(itemSeed, 3) * 0.3;

    const widthCm = Math.round(base.dims[0] * scale);
    const heightCm = Math.round(base.dims[1] * scale);
    const depthCm = Math.round(base.dims[2] * scale);

    return {
      label: base.label,
      confidence: Number((0.65 + pseudoRandom(itemSeed, 4) * 0.3).toFixed(2)),
      bbox: {
        x: Number((pseudoRandom(itemSeed, 5) * 0.7).toFixed(2)),
        y: Number((pseudoRandom(itemSeed, 6) * 0.7).toFixed(2)),
        w: Number((0.2 + pseudoRandom(itemSeed, 7) * 0.3).toFixed(2)),
        h: Number((0.2 + pseudoRandom(itemSeed, 8) * 0.3).toFixed(2)),
      },
      estimatedDimensionsCm: {
        widthCm,
        heightCm,
        depthCm,
        confidence: Number((0.55 + pseudoRandom(itemSeed, 9) * 0.35).toFixed(2)),
      },
      fragile: base.fragile,
    };
  });
}
