export const DEFAULT_RANKING_POLICY_VERSION = "v0.4";

export const DEFAULT_FIT_WEIGHTS = {
  roleAndLevel: 25,
  requiredSkills: 25,
  relevantExperience: 20,
  evidenceStrength: 15,
  careerAlignment: 10,
  adjacencyAndLearning: 5,
} as const;

export type DefaultFitDimension = keyof typeof DEFAULT_FIT_WEIGHTS;
