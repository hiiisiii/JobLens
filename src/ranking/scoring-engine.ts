import type { Confidence, HardGateResult } from "../core/domain/common.js";

export interface HardGateCheck {
  id: string;
  result: HardGateResult;
  reason: string;
  evidenceIds: string[];
}

export interface FitDimensionInput {
  id: string;
  label: string;
  weight: number;
  score: number;
  evidenceConfidence: Confidence;
  evidenceIds: string[];
  rationale?: string;
}

export interface FitDimensionResult extends FitDimensionInput {
  weightedPoints: number;
}

export interface FitAssessmentResult {
  policyVersion: string;
  hardGate: HardGateResult;
  hardGates: HardGateCheck[];
  fitScore?: number;
  confidence: Confidence;
  dimensions: FitDimensionResult[];
}

const confidenceValue: Record<Confidence, number> = {
  HIGH: 1,
  MEDIUM: 0.6,
  LOW: 0.25,
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function aggregateHardGate(checks: HardGateCheck[]): HardGateResult {
  if (checks.some((check) => check.result === "FAIL")) return "FAIL";
  if (checks.some((check) => check.result === "FLAG")) return "FLAG";
  return "PASS";
}

function aggregateConfidence(dimensions: FitDimensionInput[]): Confidence {
  const totalWeight = dimensions.reduce((sum, dimension) => sum + Math.max(0, dimension.weight), 0);
  if (totalWeight <= 0) return "LOW";

  const weightedConfidence = dimensions.reduce(
    (sum, dimension) =>
      sum + Math.max(0, dimension.weight) * confidenceValue[dimension.evidenceConfidence],
    0,
  ) / totalWeight;

  if (weightedConfidence >= 0.8) return "HIGH";
  if (weightedConfidence >= 0.5) return "MEDIUM";
  return "LOW";
}

export function evaluateFit(input: {
  policyVersion: string;
  hardGates: HardGateCheck[];
  dimensions: FitDimensionInput[];
}): FitAssessmentResult {
  const hardGate = aggregateHardGate(input.hardGates);
  const positiveDimensions = input.dimensions.filter((dimension) => dimension.weight > 0);
  const totalWeight = positiveDimensions.reduce((sum, dimension) => sum + dimension.weight, 0);

  const dimensions: FitDimensionResult[] = input.dimensions.map((dimension) => {
    const normalizedScore = clampScore(dimension.score);
    const weightedPoints = totalWeight > 0
      ? (Math.max(0, dimension.weight) / totalWeight) * normalizedScore
      : 0;
    return {
      ...dimension,
      score: normalizedScore,
      weightedPoints: Math.round(weightedPoints * 100) / 100,
    };
  });

  const fitScore = hardGate === "FAIL" || totalWeight <= 0
    ? undefined
    : Math.round(dimensions.reduce((sum, dimension) => sum + dimension.weightedPoints, 0));

  return {
    policyVersion: input.policyVersion,
    hardGate,
    hardGates: input.hardGates,
    ...(fitScore === undefined ? {} : { fitScore }),
    confidence: aggregateConfidence(positiveDimensions),
    dimensions,
  };
}
