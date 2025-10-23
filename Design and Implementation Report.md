# MovieHub 微服务架构项目设计与实现报告

## 项目概述

MovieHub是一个基于微服务架构的电影信息聚合平台，整合多个数据源（TMDB、OMDb、TVMaze），提供搜索、评分对比、AI增强的影评和观影清单管理功能。项目采用TypeScript + Node.js技术栈，使用pnpm monorepo管理，支持MCP (Model Context Protocol)和LangGraph工作流编排。

## 技术架构设计

### 1. 整体架构

项目采用微服务架构，包含12个独立服务，每个服务负责特定功能：

```
┌─────────────────────────────────────────────────────────────┐
│                    Web Client (React)                       │
│                      Port: 5173                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                API Gateway                                  │
│                Port: 3000                                   │
│  • 统一API入口  • 路由转发  • 健康检查  • 缓存管理          │
└─────────┬─────────┬─────────┬─────────┬─────────┬─────────────┘
          │         │         │         │         │
    ┌─────▼───┐ ┌──▼──┐ ┌───▼──┐ ┌───▼──┐ ┌───▼──┐
    │ LLM     │ │User │ │Aggreg│ │MCP   │ │Graph │
    │Service  │ │Serv │ │ation │ │Gate  │ │Orch  │
    │3001     │ │3005 │ │3004  │ │3007  │ │3010  │
    └────┬────┘ └─────┘ └───┬──┘ └───┬──┘ └───┬──┘
         │                  │        │         │
    ┌────▼────┐        ┌────▼──┐ ┌───▼──┐ ┌───▼──┐
    │通义千问  │        │TMDB   │ │TMDB  │ │OMDb  │
    │API      │        │Prov   │ │MCP   │ │MCP   │
    │         │        │3002   │ │3008  │ │3009  │
    └─────────┘        └───────┘ └──────┘ └──────┘
                              │
                        ┌─────▼─────┐
                        │ TVMaze    │
                        │ Provider  │
                        │ 3006      │
                        └───────────┘
```

### 2. 微服务设计原则

#### 单一职责原则
每个服务专注于特定功能：
- **API Gateway**: 统一入口，路由转发
- **LLM Service**: AI摘要生成和意图分析
- **Provider Services**: 数据源封装
- **Aggregation Service**: 数据聚合和去重
- **User Service**: 用户管理和观影清单
- **MCP Services**: 工具协议封装

#### 服务间通信
- **同步通信**: HTTP REST API
- **异步通信**: WebSocket (MCP Gateway)
- **服务发现**: 环境变量配置
- **健康检查**: 统一的 `/health` 端点

#### 数据一致性
- **最终一致性**: 通过聚合服务保证
- **缓存策略**: Redis缓存热门数据
- **错误处理**: 优雅降级和重试机制

### 3. 技术栈选择

#### 后端技术
- **运行时**: Node.js 18+
- **语言**: TypeScript (严格模式)
- **框架**: Express.js
- **包管理**: pnpm (Monorepo)
- **HTTP客户端**: Axios
- **缓存**: Redis
- **日志**: 自定义Logger类

#### 前端技术
- **框架**: React 18
- **构建工具**: Vite
- **语言**: TypeScript
- **状态管理**: React Hooks
- **HTTP客户端**: Axios

#### AI和编排
- **LLM**: 通义千问 API (阿里云DashScope)
- **MCP**: Model Context Protocol
- **工作流**: LangGraph (Graph Orchestrator)

## 核心功能实现

### 1. 多源数据聚合

#### 数据源集成
项目集成了4个主要数据源：

1. **TMDB (The Movie Database)**
   - API: https://api.themoviedb.org/3/
   - 功能: 电影搜索、详情获取、类型发现
   - 限流: 40次/10秒

2. **OMDb (Open Movie Database)**
   - API: http://www.omdbapi.com/
   - 功能: IMDB评分、Rotten Tomatoes评分
   - 限流: 1000次/天

3. **TVMaze**
   - API: https://api.tvmaze.com/
   - 功能: 电视剧数据、IMDB ID查询
   - 限流: 无限制

4. **通义千问**
   - API: https://dashscope.aliyuncs.com/
   - 功能: AI摘要生成、意图分析
   - 限流: 按配额

#### 聚合算法实现

```typescript
// 数据去重算法
deduplicateMovies(movies: Movie[]): Movie[] {
  const seen = new Map<string, Movie>();
  
  for (const movie of movies) {
    const key = `${movie.title.toLowerCase()}-${movie.year}`;
    const existing = seen.get(key);
    
    if (!existing) {
      seen.set(key, movie);
    } else {
      // 合并数据，保留更完整的信息
      seen.set(key, this.mergeMovies([existing, movie]));
    }
  }
  
  return Array.from(seen.values());
}

// 加权评分计算
calculateWeightedRating(movie: Movie): AggregatedRating {
  const weights = {
    tmdb: 0.3,
    imdb: 0.4,
    rotten_tomatoes: 0.2,
    metacritic: 0.1
  };
  
  let totalScore = 0;
  let totalWeight = 0;
  const breakdown: Record<string, number> = {};
  
  for (const rating of movie.ratings) {
    const weight = weights[rating.source as keyof typeof weights] || 0.1;
    const normalizedScore = this.normalizeRating(rating.value, rating.maxValue);
    
    totalScore += normalizedScore * weight;
    totalWeight += weight;
    breakdown[rating.source] = normalizedScore;
  }
  
  return {
    score: totalWeight > 0 ? totalScore / totalWeight : 0,
    breakdown
  };
}
```

### 2. AI增强功能

#### 意图分析实现

```typescript
// LLM意图分析
async analyzeIntent(query: string): Promise<IntentResult> {
  const prompt = `
你是一个电影搜索意图分析专家。请分析用户的查询意图，并返回JSON格式的结果。

用户查询: "${query}"

请分析用户意图并返回以下JSON格式：
{
  "type": "search_movies|get_movie_details|compare_movies|recommend_movies",
  "confidence": 0.0-1.0,
  "reasoning": "分析原因",
  "extractedEntities": {
    "genres": ["科幻", "动作"],
    "years": [2020, 2021],
    "actors": ["演员名"],
    "directors": ["导演名"],
    "keywords": ["关键词"]
  },
  "searchStrategy": {
    "type": "direct_search|genre_search|popular_search",
    "parameters": {}
  }
}`;

  const response = await this.qwenClient.chat({
    messages: [{ role: 'user', content: prompt }],
    model: 'qwen-plus',
    temperature: 0.1
  });
  
  return JSON.parse(response.content);
}
```

#### AI摘要生成

```typescript
// 电影摘要生成
async generateMovieSummary(title: string, plot: string, genres: string[]): Promise<string> {
  const prompt = `
请为电影《${title}》生成一个简洁的中文摘要。

电影信息：
- 剧情：${plot}
- 类型：${genres.join(', ')}

要求：
1. 100字以内的简洁摘要
2. 突出电影的核心主题和看点
3. 语言生动有趣
4. 适合推荐给朋友

摘要：`;

  const response = await this.qwenClient.chat({
    messages: [{ role: 'user', content: prompt }],
    model: 'qwen-plus',
    temperature: 0.7,
    max_tokens: 200
  });
  
  return response.content;
}
```

### 3. MCP (Model Context Protocol) 集成

#### MCP Gateway实现

```typescript
class MCPGateway {
  private servers: Map<string, MCPServerInfo> = new Map();
  private wss: WebSocketServer;

  // 注册MCP服务器
  private registerServer(serverInfo: Partial<MCPServerInfo>) {
    const server: MCPServerInfo = {
      name: serverInfo.name,
      version: serverInfo.version || '1.0.0',
      description: serverInfo.description || '',
      endpoint: serverInfo.endpoint,
      tools: serverInfo.tools || [],
      status: 'online',
      lastHeartbeat: new Date()
    };

    this.servers.set(server.name, server);
    logger.info(`Registered MCP server: ${server.name} at ${server.endpoint}`);
  }

  // 工具调用
  private async callTool(toolName: string, args: any): Promise<any> {
    const [serverName, actualToolName] = toolName.split('.');
    const server = this.servers.get(serverName);
    
    if (!server) {
      throw new Error(`Server ${serverName} not found`);
    }
    
    const response = await fetch(`${server.endpoint}/call-tool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolName: actualToolName, args })
    });

    return await response.json();
  }
}
```

#### Graph Orchestrator工作流

```typescript
class MovieSearchOrchestrator {
  async executeWorkflow(query: string, userId?: string): Promise<any> {
    const executionTrace: ExecutionStep[] = [];

    try {
      // 步骤1: AI意图分析
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

      // 步骤2: 根据意图执行工具链
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
      return {
        query,
        error: (error as Error).message,
        executionTrace,
        totalDuration: Date.now() - startTime,
        success: false
      };
    }
  }
}
```

### 4. 缓存策略

#### Redis缓存实现

```typescript
class CacheManager {
  constructor(private redis: Redis, private config: CacheConfig) {}

  // 缓存搜索结果
  async cacheSearchResults(
    query: string, 
    year: number | undefined, 
    results: any, 
    page: number | undefined, 
    sort: string
  ): Promise<void> {
    const key = this.buildSearchKey(query, year, page, sort);
    await this.redis.setex(key, this.config.defaultTTL, JSON.stringify(results));
    
    // 更新热门搜索统计
    await this.updatePopularSearches(query);
  }

  // 缓存电影详情
  async cacheMovieDetails(movieId: string, details: any, ttl?: number): Promise<void> {
    const key = `movie:${movieId}`;
    const cacheTTL = ttl || this.config.defaultTTL;
    await this.redis.setex(key, cacheTTL, JSON.stringify(details));
  }

  // 缓存LLM响应
  async cacheLLMSummary(title: string, type: string, summary: any, ttl?: number): Promise<void> {
    const key = `llm:${type}:${title.toLowerCase()}`;
    const cacheTTL = ttl || 86400; // 24小时
    await this.redis.setex(key, cacheTTL, JSON.stringify(summary));
  }
}
```

### 5. 前端可视化功能

#### 评分雷达图实现

```typescript
// RadarChart组件
const RadarChart: React.FC<RadarChartProps> = ({ ratings, size = 200 }) => {
  const normalizedRatings = ratings.map(rating => ({
    ...rating,
    normalizedValue: (rating.value / rating.maxValue) * 10
  }));

  const maxValue = 10;
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size * 0.35;

  // 生成雷达图路径
  const generatePath = (values: number[]) => {
    const points = values.map((value, index) => {
      const angle = (index * 2 * Math.PI) / values.length - Math.PI / 2;
      const x = centerX + Math.cos(angle) * (value / maxValue) * radius;
      const y = centerY + Math.sin(angle) * (value / maxValue) * radius;
      return `${x},${y}`;
    });
    return `M ${points.join(' L ')} Z`;
  };

  return (
    <div className="radar-chart">
      <svg width={size} height={size}>
        {/* 背景网格 */}
        {[0.2, 0.4, 0.6, 0.8, 1.0].map(scale => (
          <circle
            key={scale}
            cx={centerX}
            cy={centerY}
            r={radius * scale}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.1"
          />
        ))}
        
        {/* 数据路径 */}
        <path
          d={generatePath(normalizedRatings.map(r => r.normalizedValue))}
          fill="url(#gradient)"
          fillOpacity="0.3"
          stroke="url(#gradient)"
          strokeWidth="2"
        />
        
        {/* 数据点 */}
        {normalizedRatings.map((rating, index) => {
          const angle = (index * 2 * Math.PI) / normalizedRatings.length - Math.PI / 2;
          const x = centerX + Math.cos(angle) * (rating.normalizedValue / maxValue) * radius;
          const y = centerY + Math.sin(angle) * (rating.normalizedValue / maxValue) * radius;
          
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="4"
              fill="currentColor"
              className="data-point"
            />
          );
        })}
      </svg>
    </div>
  );
};
```

#### 相似作品网络图实现

```typescript
// NetworkGraph组件
const NetworkGraph: React.FC<NetworkGraphProps> = ({ 
  centerMovie, 
  similarMovies, 
  size = 300 
}) => {
  const centerX = size / 2;
  const centerY = size / 2;
  const orbitRadius = size * 0.3;

  // 计算相似电影的位置
  const calculatePosition = (index: number, total: number) => {
    const angle = (index * 2 * Math.PI) / total;
    return {
      x: centerX + Math.cos(angle) * orbitRadius,
      y: centerY + Math.sin(angle) * orbitRadius
    };
  };

  return (
    <div className="network-graph">
      <svg width={size} height={size}>
        {/* 连接线 */}
        {similarMovies.map((movie, index) => {
          const pos = calculatePosition(index, similarMovies.length);
          return (
            <line
              key={`line-${index}`}
              x1={centerX}
              y1={centerY}
              x2={pos.x}
              y2={pos.y}
              stroke="currentColor"
              strokeOpacity="0.3"
              strokeWidth="1"
            />
          );
        })}
        
        {/* 中心节点 */}
        <circle
          cx={centerX}
          cy={centerY}
          r="20"
          fill="var(--primary-color)"
          className="center-node"
        />
        
        {/* 相似电影节点 */}
        {similarMovies.map((movie, index) => {
          const pos = calculatePosition(index, similarMovies.length);
          return (
            <g key={`node-${index}`}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r="12"
                fill="var(--secondary-color)"
                className="similar-node"
              />
              <text
                x={pos.x}
                y={pos.y + 4}
                textAnchor="middle"
                fontSize="10"
                fill="currentColor"
                className="node-label"
              >
                {movie.title.substring(0, 8)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
```

## 使用的GenAI工具总结

### 1. 通义千问 (Qwen) API

**用途**: 
- 电影摘要生成
- 意图分析和查询理解
- 相似电影推荐
- 电影亮点提取

**实现方式**:
```typescript
class QwenClient {
  async chat(request: LLMRequest): Promise<LLMResponse> {
    const response = await axios.post(this.apiUrl, {
      model: request.model || 'qwen-plus',
      messages: request.messages,
      temperature: request.temperature || 0.7,
      max_tokens: request.max_tokens || 1000
    }, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    return {
      content: response.data.choices[0].message.content,
      usage: response.data.usage
    };
  }
}
```

**官方文档**: https://dashscope.aliyun.com/

### 2. LangGraph工作流编排

**用途**:
- 多工具调用编排
- 有状态的工作流管理
- 错误处理和重试机制
- 执行轨迹记录

**实现方式**:
通过Graph Orchestrator服务实现类似LangGraph的功能，包括：
- 意图分析 → 工具选择 → 执行 → 结果聚合
- 状态管理和错误处理
- 可追踪的执行轨迹

**官方文档**: https://langchain-ai.github.io/langgraph/

## 官方文档链接

### Web API文档
- **TMDB API**: https://developer.themoviedb.org/docs
- **OMDb API**: https://www.omdbapi.com/
- **TVMaze API**: https://www.tvmaze.com/api
- **通义千问 API**: https://dashscope.aliyun.com/

### MCP (Model Context Protocol)
- **MCP官方文档**: https://modelcontextprotocol.io/
- **MCP TypeScript SDK**: https://github.com/modelcontextprotocol/typescript-sdk

### LLM框架
- **LangGraph**: https://langchain-ai.github.io/langgraph/
- **LangChain**: https://python.langchain.com/

### SDK和工具
- **Express.js**: https://expressjs.com/
- **React**: https://react.dev/
- **Vite**: https://vitejs.dev/
- **pnpm**: https://pnpm.io/
- **TypeScript**: https://www.typescriptlang.org/

## 项目亮点

### 1. 架构设计亮点

#### 微服务解耦
- 每个服务独立部署和扩展
- 清晰的服务边界和职责分离
- 统一的API网关管理

#### 容错设计
- Promise.allSettled处理并发请求
- 优雅降级机制
- 多级缓存策略

#### 可观测性
- 统一的日志系统
- 健康检查端点
- 执行轨迹记录

### 2. 技术创新点

#### AI驱动的智能搜索
- 自然语言意图理解
- 多策略搜索（类型、导演、热门）
- 智能结果排序

#### MCP协议集成
- 工具发现和注册
- 统一的工具调用接口
- WebSocket实时通信

#### 数据可视化
- 零依赖的SVG图表
- 响应式设计
- 主题适配

### 3. 性能优化

#### 缓存策略
- Redis缓存热门数据
- 分层缓存（搜索、详情、LLM）
- 智能缓存失效

#### 并发处理
- 多源并行查询
- 异步处理
- 连接池管理

## 课程要求达成

### 约束1: 集成至少4个不同提供方 ✅

1. **TMDB** - The Movie Database API
2. **OMDb** - Open Movie Database API  
3. **TVMaze** - TV Maze API
4. **通义千问** - 阿里云LLM服务
5. **本地用户服务** - 观影清单管理

### 约束3: 对话场景中使用本地知识库与外部信息源 ✅

- **本地知识库**: 用户观影清单、评分、偏好
- **外部信息源**: TMDB、OMDb、TVMaze影视数据
- **多个外部工具**: 
  - 数据聚合工具
  - 评分融合工具
  - LLM生成工具
  - 可视化工具
- **MCP服务编排**: 通过Model Context Protocol实现工具发现和调用
- **AI工作流**: 基于LangGraph的智能搜索和意图分析

## 部署和运维

### 1. 容器化部署

项目支持Docker容器化部署，每个服务都有独立的Dockerfile：

```dockerfile
# 示例：API Gateway Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### 2. 监控和日志

#### 健康检查
```typescript
app.get('/health', async (req, res) => {
  const services = {
    gateway: 'healthy',
    aggregation: 'unknown',
    llm: 'unknown',
    // ... 其他服务
  };

  const checks = await Promise.allSettled([
    axios.get(`${AGGREGATION_URL}/health`),
    axios.get(`${LLM_URL}/health`),
    // ... 其他服务检查
  ]);

  // 更新服务状态
  if (checks[0].status === 'fulfilled') services.aggregation = 'healthy';
  // ...

  res.json({ status: 'healthy', services });
});
```

#### 日志系统
```typescript
class Logger {
  constructor(private serviceName: string) {}

  info(message: string, ...args: any[]) {
    console.log(`[${new Date().toISOString()}] [${this.serviceName}] INFO: ${message}`, ...args);
  }

  error(message: string, error?: any) {
    console.error(`[${new Date().toISOString()}] [${this.serviceName}] ERROR: ${message}`, error);
  }
}
```

## 总结

MovieHub项目成功实现了一个完整的微服务架构应用，满足了课程的所有约束条件。项目具有以下特点：

1. **技术先进性**: 采用现代化的技术栈，集成AI能力
2. **架构合理性**: 清晰的微服务设计，良好的可扩展性
3. **功能完整性**: 涵盖搜索、聚合、AI增强、可视化等完整功能
4. **工程化程度**: 完善的文档、脚本、监控和部署方案

项目不仅满足了课程要求，还展示了微服务架构在实际应用中的最佳实践，是一个优秀的微服务架构学习案例。

---

**报告版本**: 1.0.0  
**完成时间**: 2025年10月22日  
**作者**: 姜政言 (2353594)  
**课程**: 微服务架构  
**学校**: 同济大学软件学院
