const LOCATION_ALIAS_GROUPS = [
  { canonical: "seoul", aliases: ["seoul", "서울", "서울특별시"] },
  { canonical: "south-korea", aliases: ["south korea", "republic of korea", "대한민국", "한국"] },
] as const;

const BACKEND_TERMS = ["backend", "back end", "back-end", "백엔드"] as const;
const SERVER_TERMS = ["server", "서버"] as const;
const DEVELOPER_TERMS = ["developer", "engineer", "개발자", "엔지니어", "programmer", "프로그래머"] as const;
const FRONTEND_TERMS = ["frontend", "front end", "front-end", "프론트엔드"] as const;

const SKILL_ALIASES: Readonly<Record<string, string>> = {
  node: "nodejs",
  nodejs: "nodejs",
  express: "express",
  expressjs: "express",
  postgres: "postgresql",
  postgresql: "postgresql",
  prisma: "prisma",
  prismaorm: "prisma",
  restfulapi: "restapi",
  restapi: "restapi",
  jsonwebtoken: "jwt",
  jwt: "jwt",
  swagger: "openapi",
  openapi: "openapi",
  swaggeropenapi: "openapi",
  k8s: "kubernetes",
  kubernetes: "kubernetes",
  amazonec2: "awsec2",
  amazonwebservices: "aws",
  githubactions: "githubactions",
  gitlabci: "gitlabci",
};

const SQL_FAMILY = new Set(["sql", "postgresql", "mysql", "mariadb", "sqlite", "mssql", "sqlserver", "oracle"]);
const CI_CD_FAMILY = new Set(["cicd", "githubactions", "gitlabci", "jenkins", "circleci", "travisci"]);
const CLOUD_FAMILY_PREFIXES = ["aws", "gcp", "azure"] as const;

export function normalizeMatchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}+#.]+/gu, " ")
    .trim();
}

function compact(value: string): string {
  return normalizeMatchText(value).replace(/[^\p{L}\p{N}+#]+/gu, "");
}

function canonicalSkill(value: string): string {
  const normalized = compact(value);
  return SKILL_ALIASES[normalized] ?? normalized;
}

function hasAny(text: string, terms: readonly string[]): boolean {
  const normalized = normalizeMatchText(text);
  return terms.some((term) => normalized.includes(normalizeMatchText(term)));
}

export function skillMatchesRequirement(requirement: string, candidateSkill: string): boolean {
  const required = canonicalSkill(requirement);
  const candidate = canonicalSkill(candidateSkill);
  if (!required || !candidate) return false;
  if (required === candidate) return true;

  // Generic requirements may be satisfied by a more specific evidenced skill.
  // The reverse is intentionally not true: generic SQL must not satisfy MySQL.
  if (required === "sql" || required === "rdbms") return SQL_FAMILY.has(candidate);
  if (required === "cicd") return CI_CD_FAMILY.has(candidate);
  if (required === "cloud") return CLOUD_FAMILY_PREFIXES.some((prefix) => candidate.startsWith(prefix));
  if (required === "aws") return candidate.startsWith("aws");

  return false;
}

export function skillCoverage(requirements: string[], candidateSkills: string[]): number {
  const uniqueRequirements = [...new Map(
    requirements
      .map((value) => [canonicalSkill(value), value] as const)
      .filter(([canonical]) => canonical.length > 0),
  ).values()];
  if (uniqueRequirements.length === 0) return 100;
  const matched = uniqueRequirements.filter((requirement) =>
    candidateSkills.some((candidateSkill) => skillMatchesRequirement(requirement, candidateSkill)),
  ).length;
  return Math.round((matched / uniqueRequirements.length) * 100);
}

export function roleMatchScore(title: string, targetRoles: string[]): number {
  const normalizedTitle = normalizeMatchText(title);
  const normalizedTargets = targetRoles.map(normalizeMatchText);
  if (normalizedTargets.some((role) => normalizedTitle.includes(role) || role.includes(normalizedTitle))) return 100;

  const targetWantsBackend = targetRoles.some((role) => hasAny(role, BACKEND_TERMS) || hasAny(role, SERVER_TERMS));
  const explicitBackend = hasAny(title, BACKEND_TERMS);
  const serverRole = hasAny(title, SERVER_TERMS);
  const developerRole = hasAny(title, DEVELOPER_TERMS);

  if (targetWantsBackend && hasAny(title, FRONTEND_TERMS) && !explicitBackend) return 20;
  if (targetWantsBackend && explicitBackend && developerRole) return 95;
  if (targetWantsBackend && serverRole && developerRole) return 90;
  if (targetWantsBackend && (explicitBackend || serverRole)) return 85;

  const matchedGenericToken = normalizedTargets.some((role) =>
    role.split(" ").some((token) => token.length > 2 && normalizedTitle.includes(token)),
  );
  return matchedGenericToken ? 60 : 35;
}

function canonicalLocation(value: string): string {
  const normalized = normalizeMatchText(value);
  for (const group of LOCATION_ALIAS_GROUPS) {
    if (group.aliases.some((alias) => normalized.includes(normalizeMatchText(alias)))) return group.canonical;
  }
  return normalized;
}

export function locationMatchScore(jobLocations: string[], preferredLocations: string[]): number {
  if (preferredLocations.length === 0 || jobLocations.length === 0) return 70;
  const jobKeys = jobLocations.map(canonicalLocation);
  const preferredKeys = preferredLocations.map(canonicalLocation);
  return jobKeys.some((job) => preferredKeys.some((preferred) => job === preferred || job.includes(preferred) || preferred.includes(job)))
    ? 100
    : 50;
}
