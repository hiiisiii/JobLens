import type {
  SearchProvider,
  WebSearchProviderResult,
  WebSearchRequest,
  WebSearchResultItem,
} from "./search-provider.js";

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateItem(item: WebSearchResultItem, index: number): void {
  if (!item.title?.trim()) throw new Error(`web search result ${index} requires a non-empty title`);
  if (!item.url?.trim() || !isHttpUrl(item.url)) throw new Error(`web search result ${index} requires an http(s) URL`);
}

export class ProvidedSearchProvider implements SearchProvider {
  readonly id: string;
  private readonly items: WebSearchResultItem[];

  constructor(input: { providerId: string; items: WebSearchResultItem[] }) {
    const providerId = input.providerId.trim();
    if (!providerId) throw new Error("providerId must not be empty");
    input.items.forEach(validateItem);
    this.id = `provided:${providerId.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    this.items = input.items.map((item) => ({ ...item }));
  }

  async search(request: WebSearchRequest): Promise<WebSearchProviderResult> {
    if (!request.query.trim()) throw new Error("web search request query must not be empty");
    const limit = request.limit ?? this.items.length;
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("web search limit must be an integer between 1 and 500");
    return {
      items: this.items.slice(0, limit),
      warnings: [{
        code: "CLIENT_PROVIDED_RESULTS",
        message: "Search results were supplied by the calling client and remain unmaterialized until a posting source verifies them.",
      }],
    };
  }
}
