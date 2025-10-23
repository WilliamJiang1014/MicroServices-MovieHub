import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';
import { Logger } from '@moviehub/shared';

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const port = process.env.MCP_TMDB_PORT || 3008;
const logger = new Logger('MCP-TMDB-Provider');

app.use(cors());
app.use(express.json());

// TMDB API配置
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

class TMDBMCPServer {
  private tools: MCPTool[] = [
    {
      name: 'search_movies',
      description: 'Search movies in TMDB database',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Movie title to search' },
          year: { type: 'number', description: 'Release year (optional)' },
          page: { type: 'number', description: 'Page number (default: 1)' }
        },
        required: ['query']
      }
    },
    {
      name: 'get_movie_details',
      description: 'Get detailed information about a specific movie',
      inputSchema: {
        type: 'object',
        properties: {
          movieId: { type: 'string', description: 'TMDB movie ID' }
        },
        required: ['movieId']
      }
    },
    {
      name: 'get_movie_by_external_id',
      description: 'Get movie by external ID (IMDB, TVDB, etc.)',
      inputSchema: {
        type: 'object',
        properties: {
          externalId: { type: 'string', description: 'External ID (IMDB, TVDB, etc.)' },
          source: { type: 'string', description: 'Source (imdb_id, tvdb_id, etc.)' }
        },
        required: ['externalId', 'source']
      }
    },
    {
      name: 'get_popular_movies',
      description: 'Get popular movies from TMDB',
      inputSchema: {
        type: 'object',
        properties: {
          page: { type: 'number', description: 'Page number (default: 1)' },
          language: { type: 'string', description: 'Language code (default: en-US)' }
        }
      }
    },
    {
      name: 'discover_movies',
      description: 'Discover movies by genre, year, rating, etc.',
      inputSchema: {
        type: 'object',
        properties: {
          genreId: { type: 'number', description: 'Genre ID (e.g., 878 for Science Fiction)' },
          sortBy: { type: 'string', description: 'Sort by (popularity.desc, vote_average.desc, etc.)' },
          page: { type: 'number', description: 'Page number (default: 1)' },
          year: { type: 'number', description: 'Release year' },
          language: { type: 'string', description: 'Language code (default: en-US)' }
        }
      }
    },
    {
      name: 'search_movies_by_director',
      description: 'Search movies by director name',
      inputSchema: {
        type: 'object',
        properties: {
          directorName: { type: 'string', description: 'Director name' },
          page: { type: 'number', description: 'Page number (default: 1)' }
        },
        required: ['directorName']
      }
    },
    {
      name: 'get_movie_credits',
      description: 'Get cast and crew information for a movie',
      inputSchema: {
        type: 'object',
        properties: {
          movieId: { type: 'string', description: 'TMDB movie ID' }
        },
        required: ['movieId']
      }
    }
  ];

  constructor() {
    this.setupRoutes();
  }

  private setupRoutes() {
    // 健康检查
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        service: 'mcp-tmdb-provider',
        tools: this.tools.length,
        apiKey: TMDB_API_KEY ? 'configured' : 'missing'
      });
    });

    // 获取工具列表
    app.get('/tools', (req, res) => {
      res.json({ tools: this.tools });
    });

    // 调用工具
    app.post('/call-tool', async (req, res) => {
      try {
        const { toolName, args } = req.body;
        const result = await this.executeTool(toolName, args);
        res.json({ success: true, result });
      } catch (error) {
        logger.error('Tool execution failed:', error);
        res.status(500).json({ success: false, error: (error as Error).message });
      }
    });

    // 注册到MCP Gateway
    app.post('/register', async (req, res) => {
      try {
        await this.registerToGateway();
        res.json({ success: true, message: 'Registered to MCP Gateway' });
      } catch (error) {
        logger.error('Registration failed:', error);
        res.status(500).json({ success: false, error: (error as Error).message });
      }
    });
  }

  private async executeTool(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case 'search_movies':
        return await this.searchMovies(args.query, args.year, args.page);
      case 'get_movie_details':
        return await this.getMovieDetails(args.movieId);
      case 'get_movie_by_external_id':
        return await this.getMovieByExternalId(args.externalId, args.source);
      case 'get_popular_movies':
        return await this.getPopularMovies(args.page, args.language);
      case 'discover_movies':
        return await this.discoverMovies(args.genreId, args.sortBy, args.page, args.year, args.language);
      case 'search_movies_by_director':
        return await this.searchMoviesByDirector(args.directorName, args.page);
      case 'get_movie_credits':
        return await this.getMovieCredits(args.movieId);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private async searchMovies(query: string, year?: number, page: number = 1): Promise<any> {
    try {
      const params = new URLSearchParams({
        api_key: TMDB_API_KEY!,
        query: query,
        page: page.toString(),
        include_adult: 'false'
      });

      if (year) {
        params.append('year', year.toString());
      }

      const response = await axios.get(`${TMDB_BASE_URL}/search/movie?${params}`);
      
      return {
        results: response.data.results.map((movie: any) => ({
          id: movie.id,
          title: movie.title,
          originalTitle: movie.original_title,
          overview: movie.overview,
          releaseDate: movie.release_date,
          posterPath: movie.poster_path,
          backdropPath: movie.backdrop_path,
          voteAverage: movie.vote_average,
          voteCount: movie.vote_count,
          popularity: movie.popularity,
          adult: movie.adult,
          genreIds: movie.genre_ids
        })),
        totalPages: response.data.total_pages,
        totalResults: response.data.total_results,
        page: response.data.page
      };
    } catch (error) {
      logger.error('TMDB search failed:', error);
      throw new Error(`TMDB search failed: ${(error as Error).message}`);
    }
  }

  private async getMovieDetails(movieId: string): Promise<any> {
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/movie/${movieId}`, {
        params: {
          api_key: TMDB_API_KEY!,
          append_to_response: 'credits,videos,images,reviews'
        }
      });

      const movie = response.data;
      return {
        id: movie.id,
        title: movie.title,
        originalTitle: movie.original_title,
        overview: movie.overview,
        releaseDate: movie.release_date,
        runtime: movie.runtime,
        budget: movie.budget,
        revenue: movie.revenue,
        posterPath: movie.poster_path,
        backdropPath: movie.backdrop_path,
        voteAverage: movie.vote_average,
        voteCount: movie.vote_count,
        popularity: movie.popularity,
        genres: movie.genres,
        productionCompanies: movie.production_companies,
        productionCountries: movie.production_countries,
        spokenLanguages: movie.spoken_languages,
        status: movie.status,
        tagline: movie.tagline,
        imdbId: movie.imdb_id,
        credits: movie.credits,
        videos: movie.videos,
        images: movie.images,
        reviews: movie.reviews
      };
    } catch (error) {
      logger.error('TMDB movie details failed:', error);
      throw new Error(`TMDB movie details failed: ${(error as Error).message}`);
    }
  }

  private async getMovieByExternalId(externalId: string, source: string): Promise<any> {
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/find/${externalId}`, {
        params: {
          api_key: TMDB_API_KEY!,
          external_source: source
        }
      });

      return {
        movieResults: response.data.movie_results || [],
        personResults: response.data.person_results || [],
        tvResults: response.data.tv_results || [],
        tvEpisodeResults: response.data.tv_episode_results || [],
        tvSeasonResults: response.data.tv_season_results || []
      };
    } catch (error) {
      logger.error('TMDB external ID lookup failed:', error);
      throw new Error(`TMDB external ID lookup failed: ${(error as Error).message}`);
    }
  }

  private async getPopularMovies(page: number = 1, language: string = 'en-US'): Promise<any> {
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/movie/popular`, {
        params: {
          api_key: TMDB_API_KEY!,
          page: page,
          language: language
        }
      });

      return {
        results: response.data.results.map((movie: any) => ({
          id: movie.id,
          title: movie.title,
          originalTitle: movie.original_title,
          overview: movie.overview,
          releaseDate: movie.release_date,
          posterPath: movie.poster_path,
          backdropPath: movie.backdrop_path,
          voteAverage: movie.vote_average,
          voteCount: movie.vote_count,
          popularity: movie.popularity,
          adult: movie.adult,
          genreIds: movie.genre_ids
        })),
        totalPages: response.data.total_pages,
        totalResults: response.data.total_results,
        page: response.data.page
      };
    } catch (error) {
      logger.error('TMDB popular movies failed:', error);
      throw new Error(`TMDB popular movies failed: ${(error as Error).message}`);
    }
  }

  private async discoverMovies(genreId?: number, sortBy: string = 'popularity.desc', page: number = 1, year?: number, language: string = 'en-US'): Promise<any> {
    try {
      const params: any = {
        api_key: TMDB_API_KEY!,
        page: page,
        language: language,
        sort_by: sortBy,
        include_adult: 'false'
      };

      if (genreId) {
        params.with_genres = genreId;
      }

      if (year) {
        params.primary_release_year = year;
      }

      const response = await axios.get(`${TMDB_BASE_URL}/discover/movie`, {
        params
      });

      return {
        results: response.data.results.map((movie: any) => ({
          id: movie.id,
          title: movie.title,
          originalTitle: movie.original_title,
          overview: movie.overview,
          releaseDate: movie.release_date,
          posterPath: movie.poster_path,
          backdropPath: movie.backdrop_path,
          voteAverage: movie.vote_average,
          voteCount: movie.vote_count,
          popularity: movie.popularity,
          adult: movie.adult,
          genreIds: movie.genre_ids
        })),
        totalPages: response.data.total_pages,
        totalResults: response.data.total_results,
        page: response.data.page
      };
    } catch (error) {
      logger.error('TMDB discover movies failed:', error);
      throw new Error(`TMDB discover movies failed: ${(error as Error).message}`);
    }
  }

  private async searchMoviesByDirector(directorName: string, page: number = 1): Promise<any> {
    try {
      // 首先搜索导演
      const personResponse = await axios.get(`${TMDB_BASE_URL}/search/person`, {
        params: {
          api_key: TMDB_API_KEY!,
          query: directorName,
          page: 1
        }
      });

      if (!personResponse.data.results || personResponse.data.results.length === 0) {
        return {
          results: [],
          totalPages: 0,
          totalResults: 0,
          page: 1
        };
      }

      // 获取第一个匹配的导演
      const director = personResponse.data.results[0];
      
      // 获取该导演的电影作品
      const moviesResponse = await axios.get(`${TMDB_BASE_URL}/person/${director.id}/movie_credits`, {
        params: {
          api_key: TMDB_API_KEY!
        }
      });

      // 筛选出导演的作品（crew中job为Director）
      const directedMovies = moviesResponse.data.crew
        .filter((credit: any) => 
          credit.job === 'Director' && 
          credit.release_date && // 有发布日期
          !credit.adult && // 排除成人内容
          credit.vote_count > 10 // 至少有10个评分（过滤掉短片和纪录片）
        )
        .map((credit: any) => ({
          id: credit.id,
          title: credit.title,
          originalTitle: credit.original_title,
          overview: credit.overview,
          releaseDate: credit.release_date,
          posterPath: credit.poster_path,
          backdropPath: credit.backdrop_path,
          voteAverage: credit.vote_average,
          voteCount: credit.vote_count,
          popularity: credit.popularity,
          adult: credit.adult,
          genreIds: credit.genre_ids
        }))
        .sort((a: any, b: any) => (b.voteAverage || 0) - (a.voteAverage || 0)); // 按评分排序

      return {
        results: directedMovies,
        totalPages: 1,
        totalResults: directedMovies.length,
        page: 1,
        director: {
          id: director.id,
          name: director.name,
          profilePath: director.profile_path
        }
      };
    } catch (error) {
      logger.error('TMDB search movies by director failed:', error);
      throw new Error(`TMDB search movies by director failed: ${(error as Error).message}`);
    }
  }

  private async getMovieCredits(movieId: string): Promise<any> {
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/movie/${movieId}/credits`, {
        params: {
          api_key: TMDB_API_KEY!
        }
      });

      return {
        id: response.data.id,
        cast: response.data.cast.map((actor: any) => ({
          id: actor.id,
          name: actor.name,
          character: actor.character,
          order: actor.order,
          profilePath: actor.profile_path,
          knownForDepartment: actor.known_for_department
        })),
        crew: response.data.crew.map((member: any) => ({
          id: member.id,
          name: member.name,
          job: member.job,
          department: member.department,
          profilePath: member.profile_path
        }))
      };
    } catch (error) {
      logger.error('TMDB movie credits failed:', error);
      throw new Error(`TMDB movie credits failed: ${(error as Error).message}`);
    }
  }

  private async registerToGateway(): Promise<void> {
    const gatewayUrl = process.env.MCP_GATEWAY_URL || 'http://localhost:3007';
    
    const serverInfo = {
      name: 'tmdb-provider',
      version: '1.0.0',
      description: 'TMDB Movie Database Provider',
      endpoint: `http://localhost:${port}`,
      tools: this.tools
    };

    const maxRetries = 5;
    const retryDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.post(`${gatewayUrl}/register`, serverInfo, {
          timeout: 5000 // 5 second timeout
        });
        logger.info('Successfully registered with MCP Gateway');
        return;
      } catch (error) {
        logger.warn(`Registration attempt ${attempt}/${maxRetries} failed:`, (error as Error).message);
        
        if (attempt === maxRetries) {
          logger.error('Failed to register with MCP Gateway after all retries:', error);
          throw error;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  public start() {
    app.listen(port, async () => {
      logger.info(`TMDB MCP Server started on port ${port}`);
      logger.info(`Available tools: ${this.tools.map(t => t.name).join(', ')}`);
      
      // 延迟3秒后自动注册到Gateway，确保Gateway已完全启动
      setTimeout(async () => {
        try {
          await this.registerToGateway();
        } catch (error) {
          logger.warn('Failed to auto-register with Gateway:', error);
        }
      }, 3000);
    });
  }
}

// 启动TMDB MCP Server
const server = new TMDBMCPServer();
server.start();

export default TMDBMCPServer;
