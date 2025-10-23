import axios, { AxiosInstance } from 'axios';
import { Logger, Movie, Rating, ProviderResponse, MovieSearchParams } from '@moviehub/shared';

interface OMDBMovie {
  Title: string;
  Year: string;
  Rated?: string;
  Released?: string;
  Runtime?: string;
  Genre?: string;
  Director?: string;
  Writer?: string;
  Actors?: string;
  Plot?: string;
  Language?: string;
  Country?: string;
  Awards?: string;
  Poster?: string;
  Ratings?: Array<{ Source: string; Value: string }>;
  Metascore?: string;
  imdbRating?: string;
  imdbVotes?: string;
  imdbID: string;
  Type: string;
}

interface OMDBSearchResponse {
  Search?: OMDBMovie[];
  totalResults?: string;
  Response: string;
  Error?: string;
}

export class OMDBClient {
  private client: AxiosInstance;
  private logger: Logger;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.logger = new Logger('OMDBClient');

    this.client = axios.create({
      baseURL: 'http://www.omdbapi.com',
      timeout: 10000,
    });
  }

  async search(params: MovieSearchParams): Promise<ProviderResponse<Movie[]>> {
    try {
      this.logger.info(`Searching OMDb for: ${params.query}`);

      const desiredLimit = params.limit || 10;
      const startPage = params.page || 1;
      const collected: OMDBMovie[] = [];

      // Fetch first page to know total results
      const firstResponse = await this.client.get<OMDBSearchResponse>('', {
        params: {
          apikey: this.apiKey,
          s: params.query,
          y: params.year,
          type: 'movie',
          page: startPage,
        },
      });

      if (firstResponse.data.Response === 'False') {
        return {
          success: false,
          error: firstResponse.data.Error || 'No results found',
          source: 'omdb',
        };
      }

      collected.push(...(firstResponse.data.Search || []));

      // OMDb returns totalResults as string; 10 items per page
      const totalResults = firstResponse.data.totalResults ? parseInt(firstResponse.data.totalResults) : collected.length;
      const totalPages = Math.ceil(totalResults / 10);
      let currentPage = startPage;

      while (collected.length < desiredLimit && currentPage < totalPages) {
        currentPage += 1;
        const resp = await this.client.get<OMDBSearchResponse>('', {
          params: {
            apikey: this.apiKey,
            s: params.query,
            y: params.year,
            type: 'movie',
            page: currentPage,
          },
        });
        if (resp.data.Response === 'False') break;
        collected.push(...(resp.data.Search || []));
      }

      // Transform movies and enrich with detailed data including ratings
      const movies = await Promise.all(
        collected
          .slice(0, desiredLimit)
          .map(async (movie) => {
            try {
              // Get detailed movie info to include ratings
              const detailedResponse = await this.client.get<OMDBMovie>('', {
                params: {
                  apikey: this.apiKey,
                  i: movie.imdbID,
                  plot: 'short', // Use short plot to reduce response size
                },
              });
              
              if (detailedResponse.data && detailedResponse.data.Title) {
                return this.transformMovie(detailedResponse.data, true);
              }
            } catch (error) {
              this.logger.warn(`Failed to get detailed info for ${movie.imdbID}: ${error}`);
            }
            
            // Fallback to basic transformation if detailed fetch fails
            return this.transformMovie(movie);
          })
      );

      this.logger.info(`Found ${movies.length} movies from OMDb (with detailed ratings)`);

      return {
        success: true,
        data: movies,
        source: 'omdb',
      };
    } catch (error: any) {
      this.logger.error('Error searching OMDb:', error.message);
      return {
        success: false,
        error: error.message,
        source: 'omdb',
      };
    }
  }

  async getById(id: string): Promise<ProviderResponse<Movie>> {
    try {
      this.logger.info(`Fetching OMDb movie by ID: ${id}`);

      const response = await this.client.get<OMDBMovie>('', {
        params: {
          apikey: this.apiKey,
          i: id,
          plot: 'full',
        },
      });

      if (!response.data || !response.data.Title) {
        return {
          success: false,
          error: 'Movie not found',
          source: 'omdb',
        };
      }

      const movie = this.transformMovie(response.data, true);

      this.logger.info(`Successfully fetched OMDb movie: ${movie.title}`);

      return {
        success: true,
        data: movie,
        source: 'omdb',
      };
    } catch (error: any) {
      this.logger.error('Error fetching OMDb movie:', error.message);
      return {
        success: false,
        error: error.message,
        source: 'omdb',
      };
    }
  }

  async getByExternalId(externalId: string, type: 'imdb' | 'tmdb'): Promise<ProviderResponse<Movie>> {
    if (type === 'imdb') {
      return this.getById(externalId);
    }

    return {
      success: false,
      error: 'OMDb only supports IMDB IDs',
      source: 'omdb',
    };
  }

  private transformMovie(omdbMovie: OMDBMovie, detailed: boolean = false): Movie {
    const ratings: Rating[] = [];

    // Add IMDB rating
    if (omdbMovie.imdbRating && omdbMovie.imdbRating !== 'N/A') {
      ratings.push({
        source: 'imdb',
        value: parseFloat(omdbMovie.imdbRating),
        maxValue: 10,
        votes: omdbMovie.imdbVotes 
          ? parseInt(omdbMovie.imdbVotes.replace(/,/g, ''))
          : undefined,
      });
    }

    // Add other ratings if detailed
    if (detailed && omdbMovie.Ratings) {
      omdbMovie.Ratings.forEach(rating => {
        if (rating.Source === 'Rotten Tomatoes') {
          const value = parseInt(rating.Value.replace('%', ''));
          ratings.push({
            source: 'rotten_tomatoes',
            value,
            maxValue: 100,
          });
        } else if (rating.Source === 'Metacritic') {
          const value = parseInt(rating.Value.split('/')[0]);
          ratings.push({
            source: 'metacritic',
            value,
            maxValue: 100,
          });
        }
      });
    }

    const movie: Movie = {
      id: `omdb-${omdbMovie.imdbID}`,
      title: omdbMovie.Title,
      year: omdbMovie.Year ? parseInt(omdbMovie.Year.substring(0, 4)) : undefined,
      ratings,
      externalIds: {
        imdb: omdbMovie.imdbID,
      },
      sources: ['omdb'],
    };

    // Include poster when available for both search and detailed responses
    if (omdbMovie.Poster && omdbMovie.Poster !== 'N/A') {
      movie.poster = omdbMovie.Poster;
    }

    if (detailed) {
      movie.runtime = omdbMovie.Runtime 
        ? parseInt(omdbMovie.Runtime.replace(' min', ''))
        : undefined;
      movie.genres = omdbMovie.Genre?.split(', ');
      movie.directors = omdbMovie.Director?.split(', ').filter(d => d !== 'N/A');
      movie.cast = omdbMovie.Actors?.split(', ').filter(a => a !== 'N/A');
      movie.plot = omdbMovie.Plot !== 'N/A' ? omdbMovie.Plot : undefined;
      movie.releaseDate = omdbMovie.Released !== 'N/A' ? omdbMovie.Released : undefined;
    }

    return movie;
  }
}

