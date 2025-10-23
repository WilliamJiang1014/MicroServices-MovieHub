import axios, { AxiosInstance } from 'axios';
import { Logger, Movie, Rating, ProviderResponse, MovieSearchParams } from '@moviehub/shared';

interface TVMazeShow {
  id: number;
  name: string;
  type: string;
  language: string;
  genres: string[];
  status: string;
  premiered?: string;
  ended?: string;
  rating: {
    average: number | null;
  };
  runtime?: number;
  image?: {
    medium: string;
    original: string;
  };
  summary: string;
  externals: {
    tvrage?: number;
    thetvdb?: number;
    imdb?: string;
  };
  _embedded?: {
    cast?: Array<{
      person: { name: string };
    }>;
  };
}

interface TVMazeSearchResult {
  score: number;
  show: TVMazeShow;
}

export class TVMazeClient {
  private client: AxiosInstance;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('TVMazeClient');

    this.client = axios.create({
      baseURL: 'https://api.tvmaze.com',
      timeout: 10000,
    });
  }

  async search(params: MovieSearchParams): Promise<ProviderResponse<Movie[]>> {
    try {
      this.logger.info(`Searching TVMaze for: ${params.query}`);

      const response = await this.client.get<TVMazeSearchResult[]>('/search/shows', {
        params: {
          q: params.query,
        },
      });

      const movies = response.data
        .slice(0, params.limit || 10)
        .map(result => this.transformShow(result.show));

      this.logger.info(`Found ${movies.length} shows from TVMaze`);

      return {
        success: true,
        data: movies,
        source: 'tvmaze',
      };
    } catch (error: any) {
      this.logger.error('Error searching TVMaze:', error.message);
      return {
        success: false,
        error: error.message,
        source: 'tvmaze',
      };
    }
  }

  async getById(id: string): Promise<ProviderResponse<Movie>> {
    try {
      this.logger.info(`Fetching TVMaze show by ID: ${id}`);

      const [showResponse, castResponse] = await Promise.all([
        this.client.get<TVMazeShow>(`/shows/${id}`),
        this.client.get(`/shows/${id}/cast`).catch(() => null),
      ]);

      const show = showResponse.data;
      
      if (castResponse) {
        show._embedded = { cast: castResponse.data };
      }

      const movie = this.transformShow(show, true);

      this.logger.info(`Successfully fetched TVMaze show: ${show.name}`);

      return {
        success: true,
        data: movie,
        source: 'tvmaze',
      };
    } catch (error: any) {
      this.logger.error('Error fetching TVMaze show:', error.message);
      return {
        success: false,
        error: error.message,
        source: 'tvmaze',
      };
    }
  }

  async getByExternalId(externalId: string, type: 'imdb' | 'tmdb'): Promise<ProviderResponse<Movie>> {
    try {
      if (type === 'imdb') {
        this.logger.info(`Searching TVMaze by IMDB ID: ${externalId}`);
        
        // TVMaze lookup API returns a 301 redirect, so we need to follow it
        const response = await this.client.get<TVMazeShow>('/lookup/shows', {
          params: { imdb: externalId },
          maxRedirects: 5, // Allow following redirects
        });

        return {
          success: true,
          data: this.transformShow(response.data, true),
          source: 'tvmaze',
        };
      }

      return {
        success: false,
        error: 'TVMaze only supports IMDB lookups',
        source: 'tvmaze',
      };
    } catch (error: any) {
      this.logger.error('Error finding TVMaze show by external ID:', error.message);
      return {
        success: false,
        error: error.message,
        source: 'tvmaze',
      };
    }
  }

  private transformShow(show: TVMazeShow, detailed: boolean = false): Movie {
    const ratings: Rating[] = [];

    if (show.rating.average) {
      ratings.push({
        source: 'tvmaze',
        value: show.rating.average,
        maxValue: 10,
      });
    }

    const year = show.premiered ? parseInt(show.premiered.substring(0, 4)) : undefined;

    // 清理HTML标签
    const cleanSummary = show.summary 
      ? show.summary.replace(/<[^>]*>/g, '').trim()
      : undefined;

    const posterUrl = show.image?.medium || show.image?.original;
    const backdropUrl = show.image?.original || show.image?.medium;

    const movie: Movie = {
      id: `tvmaze-${show.id}`,
      title: show.name,
      year,
      releaseDate: show.premiered,
      runtime: show.runtime,
      genres: show.genres,
      plot: cleanSummary,
      poster: posterUrl,
      backdrop: backdropUrl,
      ratings,
      externalIds: {
        imdb: show.externals.imdb,
        tvmaze: show.id,
      },
      sources: ['tvmaze'],
    };

    if (detailed && show._embedded?.cast) {
      movie.cast = show._embedded.cast
        .slice(0, 10)
        .map(c => c.person.name);
    }

    return movie;
  }
}


