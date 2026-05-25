import { RelocationProject } from "@/lib/domain";

export interface CalibrationInput {
  referenceObject: "credit_card" | "a4_paper" | "standard_box";
  observedPixelWidth: number;
}

export interface CalibrationResult {
  scaleCmPerPixel: number;
  confidence: number;
}

export interface LoadOptimizationResult {
  truckUtilizationPercent: number;
  loadingOrder: string[];
  packingEfficiencyScore: number;
  cartonRecommendations: Array<{
    itemId: string;
    label: string;
    recommendedCartonSize: "small" | "medium" | "large";
  }>;
  warnings: string[];
}

const REFERENCE_WIDTH_CM: Record<CalibrationInput["referenceObject"], number> = {
  credit_card: 8.56,
  a4_paper: 21.0,
  standard_box: 55.0,
};

export function calibrateScale(input: CalibrationInput): CalibrationResult {
  const widthCm = REFERENCE_WIDTH_CM[input.referenceObject];
  const scaleCmPerPixel = widthCm / Math.max(input.observedPixelWidth, 1);
  const confidence = input.observedPixelWidth > 80 ? 0.85 : 0.65;
  return {
    scaleCmPerPixel: Number(scaleCmPerPixel.toFixed(4)),
    confidence,
  };
}

export function optimizeLoad(project: RelocationProject): LoadOptimizationResult {
  const itemsWithVolume = project.items.map((item) => {
    const volumeCm3 = item.dimensions
      ? item.dimensions.widthCm * item.dimensions.heightCm * item.dimensions.depthCm
      : 0;
    return {
      itemId: item.id,
      label: item.label,
      fragile: item.fragile,
      volumeM3: volumeCm3 / 1_000_000,
    };
  });

  const sorted = [...itemsWithVolume].sort((a, b) => b.volumeM3 - a.volumeM3);
  const totalM3 = sorted.reduce((sum, item) => sum + item.volumeM3, 0);
  const truckCapacity = 28;
  const utilization = Math.min(100, (totalM3 / truckCapacity) * 100);
  const packingEfficiencyScore = Math.max(
    30,
    Math.min(99, Number((100 - Math.abs(72 - utilization) * 1.1).toFixed(1))),
  );

  const cartonRecommendations = sorted.map((item) => {
    let recommendedCartonSize: "small" | "medium" | "large" = "small";
    if (item.volumeM3 > 0.18) recommendedCartonSize = "large";
    else if (item.volumeM3 > 0.065) recommendedCartonSize = "medium";
    return {
      itemId: item.itemId,
      label: item.label,
      recommendedCartonSize,
    };
  });

  const warnings: string[] = [];
  if (utilization > 95) warnings.push("Estimated load exceeds safe capacity threshold.");
  if (sorted.some((item) => item.fragile)) warnings.push("Load fragile items in final sequence window.");

  return {
    truckUtilizationPercent: Number(utilization.toFixed(1)),
    loadingOrder: sorted.map((item) => item.itemId),
    packingEfficiencyScore,
    cartonRecommendations,
    warnings,
  };
}
