import type { SearchProvider } from "../../search/search-provider.js";
import type {
  SearchableJobSource,
  SearchPage,
  SearchQuery,
  SourceContext,
  SourceHealth,
  SourceMetadata,
  SourceResult,
} from "../source-adapter.js";

function canonicalizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || key === "ref" || key === "source") {
        url.searchParams.delete(key);
      }
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw;
  }
}

function buildQuery(query: SearchQuery): string {
  const parts = [
    ...query.keywords,
    ...(query.targetRoles ?? []),
    ...(query.locations ?? []),
  ].map((value) => value.trim()).filter(Boolean);
  return [...new Set(parts)].join(" ");
}

export class WebSearchSource implements SearchableJobSource {
  readonly metadata: SourceMetadata;

  constructor(private readonly provider: SearchProvider) {
    this.metadata = {
      id: `web-search:${provider.id}`,
      kind: "web_search",
      displayName: `Web search (${provider.id})`,
      capabilities: ["HEALTH", "SEARCH"],
    };
  }

  async healthCheck(ctx: SourceContext): Promise<SourceResult<SourceHealth>> {
    return {
      ok: true,
      data: { status: "healthy", checkedAt: ctx.now },
      warnings: [],
    };
  }

  async search(query: SearchQuery, ctx: SourceContext): Promise<SourceResult<SearchPage>> {
    const searchText = buildQuery(query);
    if (!searchText) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_FAILED",
          sourceId: this.metadata.id,
          operation: "search",
          retryable: false,
          message: "web search requires at least one keyword, target role or location",
          occurredAt: ctx.now,
        },
      };
    }

    try {
      const result = await this.provider.search({
        query: searchText,
        ...(query.pageSize ? { limit: query.pageSize } : {}),
      });
      return {
        ok: true,
        data: {
          items: result.items.map((item) => ({
            ref: {
              sourceId: this.metadata.id,
              url: item.url,
              canonicalUrl: canonicalizeUrl(item.url),
            },
            title: item.title,
            ...(item.snippet ? { snippet: item.snippet } : {}),
            ...(item.publishedAt ? { postedAt: item.publishedAt } : {}),
          })),
          fetchedAt: ctx.now,
        },
        warnings: result.warnings,
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "NETWORK_ERROR",
          sourceId: this.metadata.id,
          operation: "search",
          retryable: true,
          message: `web search provider failed: ${error instanceof Error ? error.message : "unknown error"}`,
          occurredAt: ctx.now,
        },
      };
    }
  }
}
