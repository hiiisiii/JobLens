export interface SaraminRuntimeConfig {
  enabled: boolean;
  accessKey?: string;
}

export interface JobLensRuntimeConfig {
  workspaceDir: string;
  sourceTimeoutMs: number;
  sources: {
    saramin: SaraminRuntimeConfig;
  };
}

export interface RuntimeConfigInput {
  workspaceDir?: string;
  sourceTimeoutMs?: number;
  sources?: {
    saramin?: {
      enabled?: boolean;
      accessKey?: string;
    };
  };
}

export interface RuntimeEnvironment {
  JOBLENS_WORKSPACE?: string;
  JOBLENS_SOURCE_TIMEOUT_MS?: string;
  SARAMIN_ACCESS_KEY?: string;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && (value ?? 0) > 0 ? value as number : fallback;
}

function envPositiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function clean(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function resolveRuntimeConfig(
  input: RuntimeConfigInput = {},
  env: RuntimeEnvironment = {},
): JobLensRuntimeConfig {
  const accessKey = clean(input.sources?.saramin?.accessKey) ?? clean(env.SARAMIN_ACCESS_KEY);
  const workspaceDir = clean(input.workspaceDir) ?? clean(env.JOBLENS_WORKSPACE) ?? ".joblens";
  const timeoutFromEnv = envPositiveInteger(env.JOBLENS_SOURCE_TIMEOUT_MS);
  const sourceTimeoutMs = positiveInteger(input.sourceTimeoutMs ?? timeoutFromEnv, 10_000);
  const enabled = input.sources?.saramin?.enabled ?? Boolean(accessKey);

  return {
    workspaceDir,
    sourceTimeoutMs,
    sources: {
      saramin: {
        enabled,
        ...(accessKey ? { accessKey } : {}),
      },
    },
  };
}
