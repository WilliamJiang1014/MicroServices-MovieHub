export interface Movie {
  id: string;
  title: string;
  originalTitle?: string;
  year?: number;
  releaseDate?: string;
  runtime?: number;
  genres?: string[];
  directors?: string[];
  cast?: string[];
  plot?: string;
  poster?: string;
  backdrop?: string;
  ratings: Rating[];
  externalIds: ExternalIds;
  sources: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Rating {
  source: string;
  value: number;
  maxValue: number;
  votes?: number;
}

export interface ExternalIds {
  imdb?: string;
  tmdb?: number;
  trakt?: number;
  tvmaze?: number;
}

export interface SearchResult {
  movies: Movie[];
  totalResults: number;
  page: number;
  totalPages: number;
}

export interface MovieDetail extends Movie {
  tagline?: string;
  budget?: number;
  revenue?: number;
  productionCountries?: string[];
  spokenLanguages?: string[];
  homepage?: string;
  streamingAvailability?: StreamingPlatform[];
}

export interface StreamingPlatform {
  name: string;
  url?: string;
  region?: string;
}

