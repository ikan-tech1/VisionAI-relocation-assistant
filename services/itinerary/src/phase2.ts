export interface TruckLoadItem {
  itemId: string;
  volumeCubicMeters: number;
  fragile: boolean;
}

export interface LoadOptimizationResult {
  truckUtilizationPercent: number;
  loadingOrder: string[];
  warnings: string[];
}

export function recommendCartonSize(volumeCm3: number): "small" | "medium" | "large" {
  if (volumeCm3 < 30_000) return "small";
  if (volumeCm3 < 90_000) return "medium";
  return "large";
}

export function optimizeTruckLoad(items: TruckLoadItem[]): LoadOptimizationResult {
  const sorted = [...items].sort((a, b) => b.volumeCubicMeters - a.volumeCubicMeters);
  const totalVolume = sorted.reduce((sum, item) => sum + item.volumeCubicMeters, 0);
  const truckCapacityM3 = 28;
  const utilization = Math.min(100, (totalVolume / truckCapacityM3) * 100);

  const warnings: string[] = [];
  if (utilization > 95) warnings.push("Truck likely over capacity. Split into two loads.");
  if (sorted.some((item) => item.fragile)) warnings.push("Load fragile items last and unload first.");

  return {
    truckUtilizationPercent: Math.round(utilization * 10) / 10,
    loadingOrder: sorted.map((item) => item.itemId),
    warnings,
  };
}
