export interface WebSearchRequest {
  query: string;
  limit?: number;
  recencyDays?: number;
}

export interface WebSearchResultItem {
  title: string;
  url: string;
  snippet?: string;
  publishedAt?: string;
}

export interface WebSearchProviderResult {
  items: WebSearchResultItem[];
  warnings: Array<{ code: string; message: string }>;
}

export interface SearchProvider {
  readonly id: string;
  search(request: WebSearchRequest): Promise<WebSearchProviderResult>;
}
