import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';
import { Logger } from '@moviehub/shared';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const port = process.env.GRAPH_ORCHESTRATOR_PORT || 3010;
const logger = new Logger('Graph-Orchestrator');

app.use(cors());
app.use(express.json());

const MCP_GATEWAY_URL = process.env.MCP_GATEWAY_URL || 'http://localhost:3007';
const TVMAZE_PROVIDER_URL = process.env.TVMAZE_PROVIDER_URL || 'http://localhost:3006';

interface WorkflowState {
  userQuery: string;
  intent: string;
  searchResults: any[];
  aggregatedResults: any[];
  finalResponse: any;
  executionTrace: ExecutionStep[];
  error?: string;
}

interface ExecutionStep {
  step: string;
  tool: string;
  input: any;
  output: any;
  duration: number;
  success: boolean;
  timestamp: Date;
}

class MovieSearchOrchestrator {
  private mcpGatewayUrl: string;

  constructor() {
    this.mcpGatewayUrl = MCP_GATEWAY_URL;
    this.setupRoutes();
  }

  private setupRoutes() {
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        service: 'graph-orchestrator',
        mcpGateway: this.mcpGatewayUrl
      });
    });

    app.post('/execute', async (req, res) => {
      try {
        const { query, userId } = req.body;
        const result = await this.executeWorkflow(query, userId);
        res.json({ success: true, result });
      } catch (error) {
        logger.error('Workflow execution failed:', error);
        res.status(500).json({ success: false, error: (error as Error).message });
      }
    });

    // 获取可用工具
    app.get('/tools', async (req, res) => {
      try {
        const tools = await this.getAvailableTools();
        res.json({ tools });
      } catch (error) {
        logger.error('Failed to get tools:', error);
        res.status(500).json({ success: false, error: (error as Error).message });
      }
    });
  }

  /** 执行工作流 */
  private async executeWorkflow(query: string, userId?: string): Promise<any> {
    const startTime = Date.now();
    const executionTrace: ExecutionStep[] = [];

    try {
      const intent = await this.analyzeIntent(query);
      executionTrace.push({
        step: 'analyze_intent',
        tool: 'intent_analyzer',
        input: { query },
        output: { intent },
        duration: Date.now() - startTime,
        success: true,
        timestamp: new Date()
      });

      let result: any;
      switch (intent.type) {
        case 'search_movies':
          result = await this.executeMovieSearchWorkflow(query, executionTrace);
          break;
        case 'get_movie_details':
          result = await this.executeMovieDetailsWorkflow(query, executionTrace);
          break;
        case 'compare_movies':
          result = await this.executeMovieComparisonWorkflow(query, executionTrace);
          break;
        case 'recommend_movies':
          result = await this.executeRecommendationWorkflow(query, userId, executionTrace);
          break;
        default:
          result = await this.executeMovieSearchWorkflow(query, executionTrace);
      }

      return {
        query,
        intent,
        result,
        executionTrace,
        totalDuration: Date.now() - startTime,
        success: true
      };
    } catch (error) {
      logger.error('Workflow execution failed:', error);
      return {
        query,
        error: (error as Error).message,
        executionTrace,
        totalDuration: Date.now() - startTime,
        success: false
      };
    }
  }

  /** 分析用户意图 */
  private async analyzeIntent(query: string): Promise<any> {
    try {
      const llmResponse = await this.callLLMForIntentAnalysis(query);
      return llmResponse;
    } catch (error) {
      logger.warn('LLM intent analysis failed, falling back to rule-based:', error);
      return this.ruleBasedIntentAnalysis(query);
    }
  }

  /** 调用LLM进行意图分析 */
  private async callLLMForIntentAnalysis(query: string): Promise<any> {
    try {
      const response = await axios.post('http://llm:3001/analyze-intent', {
        query: query,
        context: 'movie_search'
      });

      if (response.data.success) {
        return response.data.result;
      } else {
        throw new Error('LLM analysis failed');
      }
    } catch (error) {
      logger.error('LLM intent analysis error:', error);
      throw error;
    }
  }

  /** 基于规则的意图分析（回退方案） */
  private ruleBasedIntentAnalysis(query: string): any {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('详情') || lowerQuery.includes('details') || lowerQuery.includes('信息')) {
      return { type: 'get_movie_details', confidence: 0.9 };
    }
    
    if ((lowerQuery.includes('对比') || lowerQuery.includes('compare')) && 
        (lowerQuery.includes('和') || lowerQuery.includes('vs') || lowerQuery.includes('与'))) {
      return { type: 'compare_movies', confidence: 0.8 };
    }
    
    if (lowerQuery.includes('推荐') || lowerQuery.includes('recommend') || lowerQuery.includes('类似')) {
      return { type: 'recommend_movies', confidence: 0.8 };
    }
    
    return { type: 'search_movies', confidence: 0.7 };
  }

  /** 分析搜索策略 */
  private analyzeSearchStrategy(query: string, aiIntent?: any): any {
    if (aiIntent && aiIntent.searchStrategy) {
      const strategy = aiIntent.searchStrategy;
      
      if (strategy.type === 'genre_search') {
        const genreId = this.getGenreIdFromAI(aiIntent.extractedEntities?.genres);
        if (genreId) {
          return { type: 'genre_search', genre: genreId, keyword: aiIntent.extractedEntities?.genres?.[0] };
        }
      }
      
      if (strategy.type === 'popular_search') {
        return { type: 'popular_search', category: 'popular' };
      }
      
      if (strategy.type === 'director_search') {
        const directorName = aiIntent.extractedEntities?.directors?.[0];
        if (directorName) {
          return { type: 'director_search', directorName };
        }
      }
      
      return { type: 'direct_search', query };
    }
    
    return this.ruleBasedSearchStrategy(query);
  }

  private getGenreIdFromAI(genres?: string[]): number | null {
    if (!genres || genres.length === 0) return null;
    
    const genreMap: Record<string, number> = {
      '科幻': 878, 'science fiction': 878, 'sci-fi': 878,
      '动作': 28, 'action': 28,
      '喜剧': 35, 'comedy': 35,
      '恐怖': 27, 'horror': 27,
      '爱情': 10749, 'romance': 10749,
      '剧情': 18, 'drama': 18,
      '惊悚': 53, 'thriller': 53,
      '冒险': 12, 'adventure': 12,
      '动画': 16, 'animation': 16,
      '犯罪': 80, 'crime': 80,
      '悬疑': 9648, 'mystery': 9648
    };
    
    for (const genre of genres) {
      const genreId = genreMap[genre.toLowerCase()];
      if (genreId) return genreId;
    }
    
    return null;
  }

  /** 基于规则的搜索策略分析 */
  private ruleBasedSearchStrategy(query: string): any {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('导演') || lowerQuery.includes('director') || 
        lowerQuery.includes('执导') || lowerQuery.includes('执导的')) {
      const directorName = this.extractDirectorName(query);
      if (directorName) {
        return { type: 'director_search', directorName };
      }
    }
    
    const genreMap: Record<string, number> = {
      '科幻': 878, 'science fiction': 878, 'sci-fi': 878, '科幻电影': 878,
      '动作': 28, 'action': 28, '动作片': 28,
      '喜剧': 35, 'comedy': 35, '喜剧片': 35,
      '恐怖': 27, 'horror': 27, '恐怖片': 27,
      '爱情': 10749, 'romance': 10749, '爱情片': 10749,
      '剧情': 18, 'drama': 18, '剧情片': 18,
      '惊悚': 53, 'thriller': 53, '惊悚片': 53,
      '冒险': 12, 'adventure': 12, '冒险片': 12,
      '动画': 16, 'animation': 16, '动画片': 16,
      '犯罪': 80, 'crime': 80, '犯罪片': 80,
      '悬疑': 9648, 'mystery': 9648, '悬疑片': 9648
    };
    
    for (const [keyword, genreId] of Object.entries(genreMap)) {
      if (lowerQuery.includes(keyword)) {
        return { type: 'genre_search', genre: genreId, keyword };
      }
    }
    
    if (lowerQuery.includes('热门') || lowerQuery.includes('popular') || 
        lowerQuery.includes('推荐') || lowerQuery.includes('recommend') ||
        lowerQuery.includes('经典') || lowerQuery.includes('classic')) {
      return { type: 'popular_search', category: 'popular' };
    }
    
    return { type: 'direct_search', query };
  }

  /** 提取导演名称 */
  private extractDirectorName(query: string): string | null {
    const patterns = [
      /(.+?)导演的电影/,
      /(.+?)执导的电影/,
      /(.+?)director/,
      /(.+?)执导/,
      /(.+?)导演/
    ];
    
    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  /** 执行电影搜索工作流 */
  private async executeMovieSearchWorkflow(query: string, executionTrace: ExecutionStep[]): Promise<any> {
    const startTime = Date.now();
    
    try {
      let aiIntent;
      try {
        aiIntent = await this.callLLMForIntentAnalysis(query);
        executionTrace.push({
          step: 'ai_intent_analysis',
          tool: 'llm_service',
          input: { query },
          output: aiIntent,
          duration: Date.now() - startTime,
          success: true,
          timestamp: new Date()
        });
      } catch (error) {
        logger.warn('AI intent analysis failed, using rule-based:', error);
        executionTrace.push({
          step: 'ai_intent_analysis',
          tool: 'llm_service',
          input: { query },
          output: null,
          duration: Date.now() - startTime,
          success: false,
          timestamp: new Date()
        });
      }
      
      const searchStrategy = this.analyzeSearchStrategy(query, aiIntent);
      
      let searchResults;
      
      if (searchStrategy.type === 'genre_search') {
        searchResults = await this.executeGenreSearch(searchStrategy.genre, executionTrace);
      } else if (searchStrategy.type === 'popular_search') {
        searchResults = await this.executePopularSearch(searchStrategy.category, executionTrace);
      } else if (searchStrategy.type === 'director_search') {
        searchResults = await this.executeDirectorSearch(searchStrategy.directorName, executionTrace);
      } else {
        searchResults = await this.executeDirectSearch(query, executionTrace);
      }

      executionTrace.push({
        step: 'search_sources',
        tool: 'multi_source_search',
        input: { query, strategy: searchStrategy },
        output: searchResults,
        duration: Date.now() - startTime,
        success: true,
        timestamp: new Date()
      });

      const aggregatedResults = await this.aggregateSearchResults(searchResults);
      
      executionTrace.push({
        step: 'aggregate_results',
        tool: 'aggregation_service',
        input: searchResults,
        output: aggregatedResults,
        duration: Date.now() - startTime,
        success: true,
        timestamp: new Date()
      });

      return {
        type: 'search_results',
        results: aggregatedResults,
        sources: Object.keys(searchResults).filter(key => (searchResults as any)[key] !== null)
      };
    } catch (error) {
      executionTrace.push({
        step: 'search_movies',
        tool: 'movie_search_workflow',
        input: { query },
        output: null,
        duration: Date.now() - startTime,
        success: false,
        timestamp: new Date()
      });
      throw error;
    }
  }

  /** 执行电影详情工作流 */
  private async executeMovieDetailsWorkflow(query: string, executionTrace: ExecutionStep[]): Promise<any> {
    const startTime = Date.now();
    
    try {
      const searchResults = await this.executeMovieSearchWorkflow(query, executionTrace);
      
      if (!searchResults.results || searchResults.results.length === 0) {
        throw new Error('No movies found');
      }

      const firstMovie = searchResults.results[0];
      const movieId = firstMovie.tmdbId || firstMovie.imdbId;
      
      if (!movieId) {
        throw new Error('No valid movie ID found');
      }

      const details = await this.callTool('tmdb-provider', 'get_movie_details', { movieId });
      
      executionTrace.push({
        step: 'get_movie_details',
        tool: 'tmdb-provider',
        input: { movieId },
        output: details,
        duration: Date.now() - startTime,
        success: true,
        timestamp: new Date()
      });

      return {
        type: 'movie_details',
        movie: details,
        searchQuery: query
      };
    } catch (error) {
      executionTrace.push({
        step: 'get_movie_details',
        tool: 'movie_details_workflow',
        input: { query },
        output: null,
        duration: Date.now() - startTime,
        success: false,
        timestamp: new Date()
      });
      throw error;
    }
  }

  private async executeMovieComparisonWorkflow(query: string, executionTrace: ExecutionStep[]): Promise<any> {
    const startTime = Date.now();
    
    try {
      // 从查询中提取电影名称进行直接搜索
      let movieTitles: string[] = [];
      
      // 尝试从查询中提取电影名称
      const lowerQuery = query.toLowerCase();
      if (lowerQuery.includes('dune') && lowerQuery.includes('inception')) {
        movieTitles = ['Dune', 'Inception'];
      } else if (lowerQuery.includes('dune')) {
        movieTitles = ['Dune'];
      } else if (lowerQuery.includes('inception')) {
        movieTitles = ['Inception'];
      } else {
        // 回退到搜索工作流
        const searchResults = await this.executeMovieSearchWorkflow(query, executionTrace);
        if (searchResults.results && searchResults.results.length >= 2) {
          movieTitles = searchResults.results.slice(0, 2).map((movie: any) => movie.title);
        }
      }
      
      if (movieTitles.length === 0) {
        return {
          type: 'comparison_results',
          message: 'No movies found to compare',
          results: [],
          sources: []
        };
      }
      
      // 搜索指定的电影
      const movieDetails = [];
      for (const title of movieTitles) {
        try {
          const searchResult = await this.executeDirectSearch(title, executionTrace);
          if (searchResult.tmdb && searchResult.tmdb.success && searchResult.tmdb.result && searchResult.tmdb.result.results) {
            const movie = searchResult.tmdb.result.results[0];
            if (movie) {
              // 获取详细信息
              const details = await this.callTool('tmdb-provider', 'get_movie_details', { movieId: movie.id });
              if (details.success && details.result) {
                movieDetails.push(details.result);
              }
            }
          }
        } catch (error) {
          logger.warn(`Failed to get details for ${title}:`, error);
        }
      }
      
      if (movieDetails.length === 0) {
        return {
          type: 'comparison_results',
          message: 'No movie details found for comparison',
          results: [],
          sources: []
        };
      }
      
      executionTrace.push({
        step: 'compare_movies',
        tool: 'movie_comparison',
        input: { movies: movieTitles },
        output: movieDetails,
        duration: Date.now() - startTime,
        success: true,
        timestamp: new Date()
      });

      return {
        type: 'comparison_results',
        results: movieDetails,
        sources: ['tmdb']
      };
    } catch (error) {
      executionTrace.push({
        step: 'compare_movies',
        tool: 'movie_comparison_workflow',
        input: { query },
        output: null,
        duration: Date.now() - startTime,
        success: false,
        timestamp: new Date()
      });
      throw error;
    }
  }

  private async executeRecommendationWorkflow(query: string, userId: string | undefined, executionTrace: ExecutionStep[]): Promise<any> {
    const startTime = Date.now();
    
    try {
      // 获取用户观影历史（如果有）
      let userHistory = [];
      if (userId) {
        try {
          const history = await this.callTool('user-service', 'get_watchlist', { userId });
          userHistory = history.movies || [];
        } catch (error) {
          logger.warn('Failed to get user history:', error);
        }
      }

      // 基于查询和用户历史生成推荐
      const recommendations = await this.generateRecommendations(query, userHistory);
      
      executionTrace.push({
        step: 'generate_recommendations',
        tool: 'recommendation_engine',
        input: { query, userHistory: userHistory.length },
        output: recommendations,
        duration: Date.now() - startTime,
        success: true,
        timestamp: new Date()
      });

      return {
        type: 'recommendations',
        recommendations,
        basedOn: query,
        userHistory: userHistory.length > 0
      };
    } catch (error) {
      executionTrace.push({
        step: 'recommend_movies',
        tool: 'recommendation_workflow',
        input: { query, userId },
        output: null,
        duration: Date.now() - startTime,
        success: false,
        timestamp: new Date()
      });
      throw error;
    }
  }

  private async callTool(serverName: string, toolName: string, args: any): Promise<any> {
    try {
      const response = await axios.post(`${this.mcpGatewayUrl}/call-tool`, {
        toolName: `${serverName}.${toolName}`,
        args
      });
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Tool call failed');
      }
      
      return response.data.result;
    } catch (error) {
      logger.error(`Tool call failed: ${serverName}.${toolName}`, error);
      throw error;
    }
  }

  private async getAvailableTools(): Promise<any[]> {
    try {
      const response = await axios.get(`${this.mcpGatewayUrl}/tools`);
      return response.data.tools;
    } catch (error) {
      logger.error('Failed to get available tools:', error);
      return [];
    }
  }

  private async searchTVMazeByGenre(genreId: number): Promise<any> {
    try {
      // 将TMDB类型ID映射到TVMaze搜索关键词
      const genreKeywords: { [key: number]: string } = {
        878: 'sci-fi', // Science Fiction
        28: 'action',  // Action
        12: 'adventure', // Adventure
        16: 'animation', // Animation
        35: 'comedy',   // Comedy
        80: 'crime',    // Crime
        18: 'drama',    // Drama
        10751: 'family', // Family
        14: 'fantasy',  // Fantasy
        36: 'history',  // History
        27: 'horror',   // Horror
        10402: 'music', // Music
        9648: 'mystery', // Mystery
        10749: 'romance', // Romance
        53: 'thriller', // Thriller
        10752: 'war',   // War
        37: 'western'   // Western
      };

      const keyword = genreKeywords[genreId] || 'sci-fi';
      
      // 调用TVMaze服务
      const response = await axios.get(`${TVMAZE_PROVIDER_URL}/api/search`, {
        params: { query: keyword, page: 1 }
      });

      return {
        success: true,
        data: response.data.data || [],
        totalResults: response.data.totalResults || 0
      };
    } catch (error) {
      logger.warn('TVMaze genre search failed:', error);
      return {
        success: false,
        data: [],
        totalResults: 0,
        error: (error as Error).message
      };
    }
  }

  private async executeGenreSearch(genreId: number, executionTrace: ExecutionStep[]): Promise<any> {
    try {
      // 并行搜索多个数据源
      const [tmdbResults, omdbResults, tvmazeResults] = await Promise.allSettled([
        // TMDB类型发现API
        this.callTool('tmdb-provider', 'discover_movies', { 
          genreId, 
          sortBy: 'popularity.desc',
          page: 1
        }),
        // OMDb关键词搜索（因为OMDb不支持类型搜索）
        this.callTool('omdb-provider', 'search_movies', { 
          query: 'sci-fi',
          type: 'movie'
        }),
        // TVMaze通过传统API搜索
        this.searchTVMazeByGenre(genreId)
      ]);
      
      return {
        tmdb: tmdbResults.status === 'fulfilled' ? tmdbResults.value : null,
        omdb: omdbResults.status === 'fulfilled' ? omdbResults.value : null,
        tvmaze: tvmazeResults.status === 'fulfilled' ? tvmazeResults.value : null
      };
    } catch (error) {
      logger.error('Genre search failed:', error);
      throw error;
    }
  }

  private async executePopularSearch(category: string, executionTrace: ExecutionStep[]): Promise<any> {
    try {
      // 获取热门电影
      const tmdbResults = await this.callTool('tmdb-provider', 'get_popular_movies', { page: 1 });
      
      return {
        tmdb: tmdbResults,
        omdb: null
      };
    } catch (error) {
      logger.error('Popular search failed:', error);
      throw error;
    }
  }

  private async executeDirectorSearch(directorName: string, executionTrace: ExecutionStep[]): Promise<any> {
    try {
      // 使用TMDB搜索导演的电影
      const tmdbResults = await this.callTool('tmdb-provider', 'search_movies_by_director', { directorName });
      
      return {
        tmdb: tmdbResults,
        omdb: null // OMDb不支持导演搜索
      };
    } catch (error) {
      logger.error('Director search failed:', error);
      throw error;
    }
  }

  private async searchTVMazeDirect(query: string): Promise<any> {
    try {
      // 调用TVMaze服务进行直接搜索
      const response = await axios.get(`${TVMAZE_PROVIDER_URL}/api/search`, {
        params: { query, page: 1 }
      });

      return {
        success: true,
        data: response.data.data || [],
        totalResults: response.data.totalResults || 0
      };
    } catch (error) {
      logger.warn('TVMaze direct search failed:', error);
      return {
        success: false,
        data: [],
        totalResults: 0,
        error: (error as Error).message
      };
    }
  }

  private async executeDirectSearch(query: string, executionTrace: ExecutionStep[]): Promise<any> {
    try {
      // 并行搜索多个数据源
      const [tmdbResults, omdbResults, tvmazeResults] = await Promise.allSettled([
        this.callTool('tmdb-provider', 'search_movies', { query }),
        this.callTool('omdb-provider', 'search_movies', { query }),
        this.searchTVMazeDirect(query)
      ]);

      return {
        tmdb: tmdbResults.status === 'fulfilled' ? tmdbResults.value : null,
        omdb: omdbResults.status === 'fulfilled' ? omdbResults.value : null,
        tvmaze: tvmazeResults.status === 'fulfilled' ? tvmazeResults.value : null
      };
    } catch (error) {
      logger.error('Direct search failed:', error);
      throw error;
    }
  }

  private async aggregateSearchResults(searchResults: any): Promise<any[]> {
    // 简单的聚合逻辑（实际项目中可以使用专门的聚合服务）
    const allResults = [];
    
    logger.info('Starting aggregation with search results:', {
      tmdb: searchResults.tmdb ? 'present' : 'missing',
      omdb: searchResults.omdb ? 'present' : 'missing',
      tvmaze: searchResults.tvmaze ? 'present' : 'missing'
    });
    
    // 处理TMDB结果
    if (searchResults.tmdb && searchResults.tmdb.success && searchResults.tmdb.result && searchResults.tmdb.result.results) {
      logger.info(`Processing ${searchResults.tmdb.result.results.length} TMDB results`);
      allResults.push(...searchResults.tmdb.result.results.map((movie: any) => ({
        ...movie,
        source: 'tmdb',
        sources: ['tmdb'],
        tmdbId: movie.id,
        poster: movie.posterPath ? `https://image.tmdb.org/t/p/w500${movie.posterPath}` : null,
        backdrop: movie.backdropPath ? `https://image.tmdb.org/t/p/w1280${movie.backdropPath}` : null,
        genres: movie.genreIds || [],
        plot: movie.overview,
        year: movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : null,
        ratings: [{
          source: 'TMDB',
          value: movie.voteAverage,
          maxValue: 10
        }]
      })));
    } else {
      logger.warn('TMDB results not processed:', {
        hasTmdb: !!searchResults.tmdb,
        success: searchResults.tmdb?.success,
        hasResult: !!searchResults.tmdb?.result,
        hasResults: !!searchResults.tmdb?.result?.results
      });
    }
    
    // 处理OMDb结果
    if (searchResults.omdb && searchResults.omdb.success && searchResults.omdb.result && searchResults.omdb.result.results) {
      logger.info(`Processing ${searchResults.omdb.result.results.length} OMDb results`);
      allResults.push(...searchResults.omdb.result.results.map((movie: any) => ({
        ...movie,
        source: 'omdb',
        sources: ['omdb'],
        imdbId: movie.imdbId,
        poster: movie.poster,
        year: movie.year ? parseInt(movie.year) : null,
        ratings: [{
          source: 'IMDb',
          value: movie.imdbRating ? parseFloat(movie.imdbRating) : null,
          maxValue: 10
        }]
      })));
    } else {
      logger.warn('OMDb results not processed:', {
        hasOmdb: !!searchResults.omdb,
        success: searchResults.omdb?.success,
        hasResult: !!searchResults.omdb?.result,
        hasResults: !!searchResults.omdb?.result?.results
      });
    }

    // 处理TVMaze结果
    if (searchResults.tvmaze && searchResults.tvmaze.success && searchResults.tvmaze.data) {
      logger.info(`Processing ${searchResults.tvmaze.data.length} TVMaze results`);
      allResults.push(...searchResults.tvmaze.data.map((show: any) => ({
        ...show,
        source: 'tvmaze',
        sources: ['tvmaze'],
        tvmazeId: show.id,
        poster: show.image?.medium || show.image?.original || null,
        year: show.premiered ? new Date(show.premiered).getFullYear() : null,
        plot: show.summary ? show.summary.replace(/<[^>]*>/g, '') : null, // 移除HTML标签
        ratings: show.rating?.average ? [{
          source: 'TVMaze',
          value: show.rating.average,
          maxValue: 10
        }] : []
      })));
    } else {
      logger.warn('TVMaze results not processed:', {
        hasTvmaze: !!searchResults.tvmaze,
        success: searchResults.tvmaze?.success,
        hasData: !!searchResults.tvmaze?.data
      });
    }

    logger.info(`Total aggregated results: ${allResults.length}`);

    // 去重，但保持原始顺序（按数据源相关度排序：TMDB > OMDb > TVMaze）
    // 这样和关键词搜索保持一致，都是按相关度而不是评分排序
    const uniqueResults = this.deduplicateResults(allResults);
    logger.info(`After deduplication: ${uniqueResults.length} results`);
    return uniqueResults;
  }

  private deduplicateResults(results: any[]): any[] {
    const seen = new Set();
    return results.filter(movie => {
      const key = `${movie.title}-${movie.year}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private generateComparison(movies: any[]): any {
    if (movies.length < 2) return null;
    
    const [movie1, movie2] = movies;
    
    return {
      titles: [movie1.title, movie2.title],
      ratings: [movie1.voteAverage, movie2.voteAverage],
      years: [movie1.releaseDate, movie2.releaseDate],
      genres: [movie1.genres, movie2.genres],
      runtime: [movie1.runtime, movie2.runtime]
    };
  }

  private async generateRecommendations(query: string, userHistory: any[]): Promise<any[]> {
    // 简单的推荐逻辑（实际项目中可以使用机器学习模型）
    try {
      const searchResults = await this.executeMovieSearchWorkflow(query, []);
      return searchResults.results.slice(0, 5);
    } catch (error) {
      logger.error('Failed to generate recommendations:', error);
      return [];
    }
  }

  public start() {
    app.listen(port, () => {
      logger.info(`Graph Orchestrator started on port ${port}`);
      logger.info(`MCP Gateway URL: ${this.mcpGatewayUrl}`);
      logger.info(`Available endpoints:`);
      logger.info(`  GET  /health - Health check`);
      logger.info(`  POST /execute - Execute workflow`);
      logger.info(`  GET  /tools - Get available tools`);
    });
  }
}

// 启动Graph Orchestrator
const orchestrator = new MovieSearchOrchestrator();
orchestrator.start();

export default MovieSearchOrchestrator;
