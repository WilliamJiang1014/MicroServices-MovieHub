import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';
import { Logger } from '@moviehub/shared';

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const port = process.env.MCP_OMDB_PORT || 3009;
const logger = new Logger('MCP-OMDb-Provider');

app.use(cors());
app.use(express.json());

// OMDb API配置
const OMDB_API_KEY = process.env.OMDB_API_KEY;
const OMDB_BASE_URL = 'http://www.omdbapi.com';

interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

class OMDbMCPServer {
  private tools: MCPTool[] = [
    {
      name: 'search_movies',
      description: 'Search movies in OMDb database',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Movie title to search' },
          year: { type: 'number', description: 'Release year (optional)' },
          type: { type: 'string', description: 'Type (movie, series, episode)' }
        },
        required: ['query']
      }
    },
    {
      name: 'get_movie_by_title',
      description: 'Get movie details by title',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Movie title' },
          year: { type: 'number', description: 'Release year (optional)' },
          plot: { type: 'string', description: 'Plot length (short, full)' }
        },
        required: ['title']
      }
    },
    {
      name: 'get_movie_by_id',
      description: 'Get movie details by IMDB ID',
      inputSchema: {
        type: 'object',
        properties: {
          imdbId: { type: 'string', description: 'IMDB ID (e.g., tt0111161)' },
          plot: { type: 'string', description: 'Plot length (short, full)' }
        },
        required: ['imdbId']
      }
    },
    {
      name: 'get_ratings',
      description: 'Get ratings from multiple sources (IMDB, Rotten Tomatoes, Metacritic)',
      inputSchema: {
        type: 'object',
        properties: {
          imdbId: { type: 'string', description: 'IMDB ID' }
        },
        required: ['imdbId']
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
        service: 'mcp-omdb-provider',
        tools: this.tools.length,
        apiKey: OMDB_API_KEY ? 'configured' : 'missing'
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
        return await this.searchMovies(args.query, args.year, args.type);
      case 'get_movie_by_title':
        return await this.getMovieByTitle(args.title, args.year, args.plot);
      case 'get_movie_by_id':
        return await this.getMovieById(args.imdbId, args.plot);
      case 'get_ratings':
        return await this.getRatings(args.imdbId);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private async searchMovies(query: string, year?: number, type?: string): Promise<any> {
    try {
      const params = new URLSearchParams({
        apikey: OMDB_API_KEY!,
        s: query,
        type: type || 'movie'
      });

      if (year) {
        params.append('y', year.toString());
      }

      const response = await axios.get(`${OMDB_BASE_URL}?${params}`);
      
      if (response.data.Response === 'False') {
        throw new Error(response.data.Error || 'OMDb search failed');
      }

      return {
        results: response.data.Search.map((movie: any) => ({
          title: movie.Title,
          year: movie.Year,
          imdbId: movie.imdbID,
          type: movie.Type,
          poster: movie.Poster
        })),
        totalResults: response.data.totalResults,
        response: response.data.Response
      };
    } catch (error) {
      logger.error('OMDb search failed:', error);
      throw new Error(`OMDb search failed: ${(error as Error).message}`);
    }
  }

  private async getMovieByTitle(title: string, year?: number, plot: string = 'short'): Promise<any> {
    try {
      const params = new URLSearchParams({
        apikey: OMDB_API_KEY!,
        t: title,
        plot: plot
      });

      if (year) {
        params.append('y', year.toString());
      }

      const response = await axios.get(`${OMDB_BASE_URL}?${params}`);
      
      if (response.data.Response === 'False') {
        throw new Error(response.data.Error || 'OMDb movie lookup failed');
      }

      return this.formatMovieData(response.data);
    } catch (error) {
      logger.error('OMDb movie lookup failed:', error);
      throw new Error(`OMDb movie lookup failed: ${(error as Error).message}`);
    }
  }

  private async getMovieById(imdbId: string, plot: string = 'short'): Promise<any> {
    try {
      const params = new URLSearchParams({
        apikey: OMDB_API_KEY!,
        i: imdbId,
        plot: plot
      });

      const response = await axios.get(`${OMDB_BASE_URL}?${params}`);
      
      if (response.data.Response === 'False') {
        throw new Error(response.data.Error || 'OMDb movie lookup failed');
      }

      return this.formatMovieData(response.data);
    } catch (error) {
      logger.error('OMDb movie lookup failed:', error);
      throw new Error(`OMDb movie lookup failed: ${(error as Error).message}`);
    }
  }

  private async getRatings(imdbId: string): Promise<any> {
    try {
      const params = new URLSearchParams({
        apikey: OMDB_API_KEY!,
        i: imdbId
      });

      const response = await axios.get(`${OMDB_BASE_URL}?${params}`);
      
      if (response.data.Response === 'False') {
        throw new Error(response.data.Error || 'OMDb ratings lookup failed');
      }

      const ratings = response.data.Ratings || [];
      
      return {
        imdbId: response.data.imdbID,
        title: response.data.Title,
        ratings: ratings.map((rating: any) => ({
          source: rating.Source,
          value: rating.Value
        })),
        imdbRating: response.data.imdbRating,
        imdbVotes: response.data.imdbVotes,
        metascore: response.data.Metascore
      };
    } catch (error) {
      logger.error('OMDb ratings lookup failed:', error);
      throw new Error(`OMDb ratings lookup failed: ${(error as Error).message}`);
    }
  }

  private formatMovieData(data: any): any {
    return {
      title: data.Title,
      year: data.Year,
      rated: data.Rated,
      released: data.Released,
      runtime: data.Runtime,
      genre: data.Genre,
      director: data.Director,
      writer: data.Writer,
      actors: data.Actors,
      plot: data.Plot,
      language: data.Language,
      country: data.Country,
      awards: data.Awards,
      poster: data.Poster,
      ratings: data.Ratings?.map((rating: any) => ({
        source: rating.Source,
        value: rating.Value
      })) || [],
      metascore: data.Metascore,
      imdbRating: data.imdbRating,
      imdbVotes: data.imdbVotes,
      imdbId: data.imdbID,
      type: data.Type,
      dvd: data.DVD,
      boxOffice: data.BoxOffice,
      production: data.Production,
      website: data.Website,
      response: data.Response
    };
  }

  private async registerToGateway(): Promise<void> {
    const gatewayUrl = process.env.MCP_GATEWAY_URL || 'http://localhost:3007';
    
    const serverInfo = {
      name: 'omdb-provider',
      version: '1.0.0',
      description: 'OMDb Movie Database Provider',
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
      logger.info(`OMDb MCP Server started on port ${port}`);
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

// 启动OMDb MCP Server
const server = new OMDbMCPServer();
server.start();

export default OMDbMCPServer;
