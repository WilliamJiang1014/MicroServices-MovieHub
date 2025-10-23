import { Movie } from './movie';

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  rateLimitPerSecond?: number;
}

export interface ProviderResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  source: string;
}

export interface MovieSearchParams {
  query: string;
  year?: number;
  page?: number;
  limit?: number;
  sort?: string;
}

export interface IMovieProvider {
  search(params: MovieSearchParams): Promise<ProviderResponse<Movie[]>>;
  getById(id: string): Promise<ProviderResponse<Movie>>;
  getByExternalId(externalId: string, type: 'imdb' | 'tmdb'): Promise<ProviderResponse<Movie>>;
}

