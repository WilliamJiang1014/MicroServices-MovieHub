import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import https from 'https';
import { Logger, Movie, Rating, ProviderResponse, MovieSearchParams } from '@moviehub/shared';

interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  release_date: string;
  runtime?: number;
  genre_ids?: number[];
  genres?: Array<{ id: number; name: string }>;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  imdb_id?: string;
}

interface TMDBMovieWithExternalIds extends TMDBMovie {
  external_ids?: {
    imdb_id?: string;
    facebook_id?: string;
    instagram_id?: string;
    twitter_id?: string;
  };
}

interface TMDBSearchResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

interface TMDBCredits {
  cast: Array<{ name: string }>;
  crew: Array<{ name: string; job: string }>;
}

export class TMDBClient {
  private client: AxiosInstance;
  private logger: Logger;
  private apiKey: string;
  private baseImageUrl = 'https://image.tmdb.org/t/p/w500';
  private maxRetries = 3;
  private backoffBaseMs = 300;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.logger = new Logger('TMDBClient');

    this.client = axios.create({
      baseURL: 'https://api.themoviedb.org/3',
      timeout: 20000,
      params: {
        api_key: apiKey,
      },
      httpAgent: new https.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true }),
    });
  }

  private async getWithRetry<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    let attempt = 0;
    // Retry on common transient network issues and 5xx/429 responses
    const shouldRetry = (error: any): boolean => {
      const code = error?.code as string | undefined;
      const status = error?.response?.status as number | undefined;
      if (status && (status >= 500 || status === 429)) return true;
      if (!code) return false;
      return [
        'ECONNRESET',
        'ECONNABORTED', // axios timeout
        'ETIMEDOUT',
        'EAI_AGAIN',
        'ENOTFOUND',
        'EPIPE',
      ].includes(code);
    };

    while (true) {
      try {
        const response = await this.client.get<T>(url, config);
        return response.data as T;
      } catch (error: any) {
        attempt += 1;
        if (attempt > this.maxRetries || !shouldRetry(error)) {
          throw error;
        }
        const delay = this.backoffBaseMs * Math.pow(2, attempt - 1);
        this.logger.warn(
          `Transient error on TMDB request (attempt ${attempt}/${this.maxRetries}). Retrying in ${delay}ms: ${error.message}`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  async search(params: MovieSearchParams): Promise<ProviderResponse<Movie[]>> {
    try {
      this.logger.info(`Searching TMDB for: ${params.query}`);

      const desiredLimit = params.limit || 10;
      const startPage = params.page || 1;
      const collected: TMDBMovie[] = [];

      // Fetch first page to know total pages
      const firstResponse = await this.client.get<TMDBSearchResponse>('/search/movie', {
        params: {
          query: params.query,
          year: params.year,
          page: startPage,
        },
      });

      collected.push(...firstResponse.data.results);

      let currentPage = startPage;
      const totalPages = firstResponse.data.total_pages || 1;

      // Pull additional pages until we reach desiredLimit or run out of pages
      while (collected.length < desiredLimit && currentPage < totalPages) {
        currentPage += 1;
        const resp = await this.client.get<TMDBSearchResponse>('/search/movie', {
          params: {
            query: params.query,
            year: params.year,
            page: currentPage,
          },
        });
        collected.push(...resp.data.results);
      }

      const movies = collected
        .slice(0, desiredLimit)
        .map(movie => this.transformMovie(movie));

      this.logger.info(`Found ${movies.length} movies from TMDB (aggregated across pages)`);

      return {
        success: true,
        data: movies,
        source: 'tmdb',
      };
    } catch (error: any) {
      this.logger.error('Error searching TMDB:', error.message);
      return {
        success: false,
        error: error.message,
        source: 'tmdb',
      };
    }
  }

  async getById(id: string): Promise<ProviderResponse<Movie>> {
    try {
      this.logger.info(`Fetching TMDB movie by ID: ${id}`);

      const [movieResponse, creditsResponse] = await Promise.all([
        this.client.get<TMDBMovieWithExternalIds>(`/movie/${id}`, {
          params: { append_to_response: 'external_ids' },
        }),
        this.client.get<TMDBCredits>(`/movie/${id}/credits`),
      ]);

      const movie = movieResponse.data;
      const credits = creditsResponse.data;

      const transformedMovie = this.transformMovie(movie);
      
      // Add cast and crew
      transformedMovie.cast = credits.cast.slice(0, 10).map(actor => actor.name);
      transformedMovie.directors = credits.crew
        .filter(crew => crew.job === 'Director')
        .map(director => director.name);

      this.logger.info(`Successfully fetched TMDB movie: ${movie.title}`);

      return {
        success: true,
        data: transformedMovie,
        source: 'tmdb',
      };
    } catch (error: any) {
      this.logger.error('Error fetching TMDB movie:', error.message);
      return {
        success: false,
        error: error.message,
        source: 'tmdb',
      };
    }
  }

  async getByExternalId(externalId: string, type: 'imdb' | 'tmdb'): Promise<ProviderResponse<Movie>> {
    try {
      if (type === 'tmdb') {
        return this.getById(externalId);
      }

      // For IMDB ID
      this.logger.info(`Searching TMDB by IMDB ID: ${externalId}`);
      
      const response = await this.client.get<{ movie_results: TMDBMovie[] }>(`/find/${externalId}`, {
        params: { external_source: 'imdb_id' },
      });

      if (response.data.movie_results.length === 0) {
        return {
          success: false,
          error: 'Movie not found',
          source: 'tmdb',
        };
      }

      return this.getById(response.data.movie_results[0].id.toString());
    } catch (error: any) {
      this.logger.error('Error finding TMDB movie by external ID:', error.message);
      return {
        success: false,
        error: error.message,
        source: 'tmdb',
      };
    }
  }

  private transformMovie(tmdbMovie: TMDBMovie | TMDBMovieWithExternalIds): Movie {
    const rating: Rating = {
      source: 'tmdb',
      value: tmdbMovie.vote_average,
      maxValue: 10,
      votes: tmdbMovie.vote_count,
    };

    // Get IMDB ID from external_ids if available, otherwise use imdb_id field
    const imdbId = (tmdbMovie as TMDBMovieWithExternalIds).external_ids?.imdb_id || tmdbMovie.imdb_id;

    const posterUrl = tmdbMovie.poster_path
      ? `${this.baseImageUrl}${tmdbMovie.poster_path}`
      : (tmdbMovie.backdrop_path ? `${this.baseImageUrl}${tmdbMovie.backdrop_path}` : undefined);

    const backdropUrl = tmdbMovie.backdrop_path
      ? `${this.baseImageUrl}${tmdbMovie.backdrop_path}`
      : (tmdbMovie.poster_path ? `${this.baseImageUrl}${tmdbMovie.poster_path}` : undefined);

    return {
      id: `tmdb-${tmdbMovie.id}`,
      title: tmdbMovie.title,
      originalTitle: tmdbMovie.original_title,
      year: tmdbMovie.release_date ? parseInt(tmdbMovie.release_date.substring(0, 4)) : undefined,
      releaseDate: tmdbMovie.release_date,
      runtime: tmdbMovie.runtime,
      genres: tmdbMovie.genres?.map(g => g.name),
      plot: tmdbMovie.overview,
      poster: posterUrl,
      backdrop: backdropUrl,
      ratings: [rating],
      externalIds: {
        tmdb: tmdbMovie.id,
        imdb: imdbId,
      },
      sources: ['tmdb'],
    };
  }
}

