# MovieHub 配置与部署说明

## 项目概述

MovieHub是一个基于微服务架构的电影信息聚合平台，整合多个数据源（TMDB、OMDb、TVMaze），提供搜索、评分对比、AI增强的影评和观影清单管理功能。项目采用TypeScript + Node.js技术栈，使用pnpm monorepo管理，支持MCP (Model Context Protocol)和LangGraph工作流编排。

## 系统架构

### 微服务组件

| 服务名称 | 端口 | 功能描述 | 技术栈 |
|---------|------|----------|--------|
| API Gateway | 3000 | 统一API入口，路由转发，健康检查 | Express.js + TypeScript |
| LLM Service | 3001 | AI摘要生成，通义千问API集成 | Express.js + DashScope SDK |
| TMDB Provider | 3002 | TMDB数据源封装 | Express.js + Axios |
| OMDb Provider | 3003 | OMDb数据源封装 | Express.js + Axios |
| Aggregation Service | 3004 | 多源数据聚合，去重，评分融合 | Express.js + TypeScript |
| User Service | 3005 | 用户管理，观影清单CRUD | Express.js + 内存存储 |
| TVMaze Provider | 3006 | TVMaze数据源封装 | Express.js + Axios |
| MCP Gateway | 3007 | MCP服务注册中心 | Express.js + MCP SDK |
| TMDB MCP Provider | 3008 | TMDB MCP工具封装 | MCP Server |
| OMDb MCP Provider | 3009 | OMDb MCP工具封装 | MCP Server |
| Graph Orchestrator | 3010 | LangGraph工作流编排 | LangGraph + MCP Client |
| Web Client | 5173 | React前端应用 | React + Vite + TypeScript |

### 数据流架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │   API Gateway   │    │  MCP Gateway    │
│   (React)       │◄──►│   (Port 3000)   │◄──►│  (Port 3007)    │
│   Port 5173     │    │                 │    │                 │
└─────────────────┘    └─────────┬───────┘    └─────────────────┘
                           │                    │
                    ┌──────┼──────┐    ┌────────┼────────┐
                    ▼             ▼    ▼                 ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │Aggregation  │ │LLM Service  │ │TMDB MCP     │ │OMDb MCP     │
            │Service      │ │(Port 3001)  │ │Provider     │ │Provider     │
            │(Port 3004)  │ │             │ │(Port 3008)  │ │(Port 3009)  │
            └──────┬──────┘ └─────────────┘ └─────────────┘ └─────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│TMDB Provider│ │OMDb Provider│ │TVMaze       │
│(Port 3002)  │ │(Port 3003)  │ │Provider     │
└─────────────┘ └─────────────┘ │(Port 3006)  │
                                └─────────────┘
```

## 环境要求

### 系统要求
- **操作系统**: macOS 10.15+, Linux (Ubuntu 18.04+), Windows 10+
- **Node.js**: >= 18.0.0
- **包管理器**: pnpm >= 8.0.0
- **Redis**: >= 6.0 (用于缓存，可选)

### 开发工具
- **代码编辑器**: VS Code (推荐) 或 Cursor
- **终端**: 支持tmux的终端 (用于多服务管理)
- **API测试**: curl, Postman, 或 Insomnia

## API密钥配置

### 必需的API密钥

1. **TMDB API Key**
   - 申请地址: https://www.themoviedb.org/settings/api
   - 免费额度: 40次/10秒
   - 用途: 电影数据获取

2. **OMDb API Key**
   - 申请地址: http://www.omdbapi.com/apikey.aspx
   - 免费额度: 1000次/天
   - 用途: IMDB评分和Rotten Tomatoes数据

3. **通义千问 API Key**
   - 申请地址: https://dashscope.console.aliyun.com/
   - 用途: AI摘要生成和推荐

4. **TVMaze API**
   - 无需API Key
   - 完全免费使用
   - 用途: 电视剧数据

### 环境变量配置

项目使用自动配置脚本 `configure-env.sh` 生成所有服务的环境变量：

```bash
# 运行配置脚本
./configure-env.sh
```

脚本会为每个服务创建 `.env` 文件：

#### API Gateway (.env)
```env
PORT=3000
AGGREGATION_URL=http://localhost:3004
LLM_URL=http://localhost:3001
USER_URL=http://localhost:3005
TMDB_URL=http://localhost:3002
OMDB_URL=http://localhost:3003
TVMAZE_URL=http://localhost:3006
NODE_ENV=development
```

#### LLM Service (.env)
```env
PORT=3001
QWEN_API_KEY=你的通义千问API密钥
QWEN_API_URL=https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation
NODE_ENV=development
```

#### TMDB Provider (.env)
```env
PORT=3002
TMDB_API_KEY=你的TMDB_API密钥
NODE_ENV=development
```

#### OMDb Provider (.env)
```env
PORT=3003
OMDB_API_KEY=你的OMDb_API密钥
NODE_ENV=development
```

#### Aggregation Service (.env)
```env
PORT=3004
TMDB_PROVIDER_URL=http://localhost:3002
OMDB_PROVIDER_URL=http://localhost:3003
TVMAZE_PROVIDER_URL=http://localhost:3006
NODE_ENV=development
```

#### User Service (.env)
```env
PORT=3005
NODE_ENV=development
```

#### TVMaze Provider (.env)
```env
PORT=3006
NODE_ENV=development
```

## 部署方式

### 1. 本地开发部署

#### 快速启动（推荐）
```bash
# 克隆项目
git clone <repository-url>
cd moviehub

# 安装依赖
pnpm install

# 配置环境变量
./configure-env.sh

# 构建共享包
cd packages/shared && pnpm build && cd ../..

# 启动所有服务
./scripts/start-with-cache.sh
```

#### 手动启动
```bash
# 终端1: API Gateway
pnpm dev:gateway

# 终端2: LLM Service
pnpm dev:llm

# 终端3: TMDB Provider
pnpm dev:tmdb

# 终端4: OMDb Provider
pnpm dev:omdb

# 终端5: TVMaze Provider
pnpm dev:tvmaze

# 终端6: Aggregation Service
pnpm dev:aggregation

# 终端7: User Service
pnpm dev:user

# 终端8: Web Client
pnpm dev:web
```

#### MCP服务启动
```bash
# 启动MCP服务
./scripts/start-mcp.sh

# 或手动启动
pnpm dev:mcp-gateway      # MCP Gateway
pnpm dev:mcp-tmdb         # TMDB MCP Provider
pnpm dev:mcp-omdb         # OMDb MCP Provider
pnpm dev:graph-orchestrator # Graph Orchestrator
```

### 2. 生产环境部署

#### Docker部署（推荐）

创建 `docker-compose.yml`:
```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  api-gateway:
    build: ./services/api-gateway
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - AGGREGATION_URL=http://aggregation:3004
      - LLM_URL=http://llm:3001
      - USER_URL=http://user:3005
      - TMDB_URL=http://tmdb:3002
      - OMDB_URL=http://omdb:3003
      - TVMAZE_URL=http://tvmaze:3006
    depends_on:
      - aggregation
      - llm
      - user
      - tmdb
      - omdb
      - tvmaze

  llm:
    build: ./services/llm-service
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - QWEN_API_KEY=${QWEN_API_KEY}
      - QWEN_API_URL=https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation

  tmdb:
    build: ./services/provider-tmdb
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - TMDB_API_KEY=${TMDB_API_KEY}

  omdb:
    build: ./services/provider-omdb
    ports:
      - "3003:3003"
    environment:
      - NODE_ENV=production
      - OMDB_API_KEY=${OMDB_API_KEY}

  aggregation:
    build: ./services/aggregation-service
    ports:
      - "3004:3004"
    environment:
      - NODE_ENV=production
      - TMDB_PROVIDER_URL=http://tmdb:3002
      - OMDB_PROVIDER_URL=http://omdb:3003
      - TVMAZE_PROVIDER_URL=http://tvmaze:3006
    depends_on:
      - tmdb
      - omdb
      - tvmaze

  user:
    build: ./services/user-service
    ports:
      - "3005:3005"
    environment:
      - NODE_ENV=production

  tvmaze:
    build: ./services/provider-tvmaze
    ports:
      - "3006:3006"
    environment:
      - NODE_ENV=production

  web-client:
    build: ./apps/web-client
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://localhost:3000

volumes:
  redis_data:
```

#### Kubernetes部署

创建 `k8s/namespace.yaml`:
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: moviehub
```

创建 `k8s/configmap.yaml`:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: moviehub-config
  namespace: moviehub
data:
  NODE_ENV: "production"
  AGGREGATION_URL: "http://aggregation-service:3004"
  LLM_URL: "http://llm-service:3001"
  USER_URL: "http://user-service:3005"
  TMDB_URL: "http://tmdb-service:3002"
  OMDB_URL: "http://omdb-service:3003"
  TVMAZE_URL: "http://tvmaze-service:3006"
```

创建 `k8s/secrets.yaml`:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: moviehub-secrets
  namespace: moviehub
type: Opaque
data:
  TMDB_API_KEY: <base64-encoded-key>
  OMDB_API_KEY: <base64-encoded-key>
  QWEN_API_KEY: <base64-encoded-key>
```

### 3. 云平台部署

#### AWS ECS部署
```bash
# 构建Docker镜像
docker build -t moviehub-api-gateway ./services/api-gateway
docker build -t moviehub-llm ./services/llm-service
# ... 其他服务

# 推送到ECR
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-west-2.amazonaws.com
docker tag moviehub-api-gateway:latest <account>.dkr.ecr.us-west-2.amazonaws.com/moviehub-api-gateway:latest
docker push <account>.dkr.ecr.us-west-2.amazonaws.com/moviehub-api-gateway:latest

# 创建ECS任务定义和服务
aws ecs create-service --cluster moviehub-cluster --service-name api-gateway --task-definition moviehub-api-gateway:1 --desired-count 2
```

#### Google Cloud Run部署
```bash
# 构建并推送镜像
gcloud builds submit --tag gcr.io/PROJECT_ID/moviehub-api-gateway ./services/api-gateway

# 部署到Cloud Run
gcloud run deploy moviehub-api-gateway --image gcr.io/PROJECT_ID/moviehub-api-gateway --platform managed --region us-central1 --allow-unauthenticated
```

## 服务管理

### 启动脚本

#### 一键启动所有服务
```bash
./scripts/start-with-cache.sh
```

#### 启动MCP服务
```bash
./scripts/start-mcp.sh
```

#### 重启所有服务
```bash
./scripts/restart-all.sh
```

#### 停止所有服务
```bash
./scripts/stop-all.sh
```

### 健康检查

#### 检查所有服务状态
```bash
curl http://localhost:3000/health | jq
```

预期响应：
```json
{
  "status": "healthy",
  "services": {
    "gateway": "healthy",
    "aggregation": "healthy",
    "llm": "healthy",
    "user": "healthy",
    "tmdb": "healthy",
    "omdb": "healthy",
    "tvmaze": "healthy"
  }
}
```

#### 检查MCP服务状态
```bash
curl http://localhost:3007/servers | jq
curl http://localhost:3007/tools | jq
```

### 日志管理

#### 查看服务日志
```bash
# 使用tmux查看实时日志
tmux attach -t moviehub

# 或查看特定服务日志
tail -f services/api-gateway/logs/app.log
```

#### 日志级别配置
```env
# 在.env文件中设置
LOG_LEVEL=info  # debug, info, warn, error
```

## 监控与观测

### 应用监控

#### 健康检查端点
- `GET /health` - 服务健康状态
- `GET /metrics` - Prometheus指标（待实现）

#### 性能监控
```bash
# 检查服务响应时间
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/search?query=test

# curl-format.txt内容：
#      time_namelookup:  %{time_namelookup}\n
#         time_connect:  %{time_connect}\n
#      time_appconnect:  %{time_appconnect}\n
#     time_pretransfer:  %{time_pretransfer}\n
#        time_redirect:  %{time_redirect}\n
#   time_starttransfer:  %{time_starttransfer}\n
#                      ----------\n
#           time_total:  %{time_total}\n
```

### 错误处理

#### 服务降级策略
- API限流时自动切换到缓存数据
- 外部API失败时返回部分数据
- LLM服务不可用时跳过AI功能

#### 重试机制
```typescript
// 示例：指数退避重试
const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
};
```

## 安全配置

### API安全

#### 限流配置
```typescript
// 在API Gateway中实现
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制每个IP 100次请求
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
```

#### CORS配置
```typescript
const cors = require('cors');

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
```

### 环境变量安全

#### 敏感信息管理
```bash
# 使用.env文件（不提交到版本控制）
echo "QWEN_API_KEY=your-secret-key" >> .env
echo "TMDB_API_KEY=your-secret-key" >> .env

# 生产环境使用密钥管理服务
# AWS Secrets Manager, Azure Key Vault, 或 HashiCorp Vault
```

## 性能优化

### 缓存策略

#### Redis缓存配置
```typescript
// 缓存热门搜索结果
const cacheKey = `search:${query}:${page}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const results = await searchMovies(query, page);
await redis.setex(cacheKey, 300, JSON.stringify(results)); // 5分钟缓存
```

#### 内存缓存
```typescript
// 使用Node.js内存缓存
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 }); // 10分钟TTL
```

### 数据库优化

#### 连接池配置
```typescript
// PostgreSQL连接池
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // 最大连接数
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

## 故障排查

### 常见问题

#### 1. 服务无法启动
```bash
# 检查端口占用
lsof -i :3000

# 杀死占用进程
kill -9 <PID>

# 检查环境变量
cat services/api-gateway/.env
```

#### 2. API调用失败
```bash
# 检查API密钥
curl -H "Authorization: Bearer $TMDB_API_KEY" https://api.themoviedb.org/3/movie/550

# 检查网络连接
ping api.themoviedb.org
```

#### 3. 前端无法访问后端
```bash
# 检查API Gateway状态
curl http://localhost:3000/health

# 检查CORS配置
curl -H "Origin: http://localhost:5173" http://localhost:3000/api/search?query=test
```

### 调试工具

#### 日志分析
```bash
# 实时查看错误日志
tail -f logs/error.log | grep ERROR

# 分析API响应时间
grep "response_time" logs/access.log | awk '{print $NF}' | sort -n
```

#### 性能分析
```bash
# 使用clinic.js进行性能分析
npm install -g clinic
clinic doctor -- node services/api-gateway/src/index.js
```

## 扩展指南

### 添加新数据源

1. **创建Provider服务**
```bash
mkdir services/provider-new-source
cd services/provider-new-source
npm init -y
npm install express axios
```

2. **实现IMovieProvider接口**
```typescript
import { IMovieProvider } from '@moviehub/shared';

export class NewSourceProvider implements IMovieProvider {
  async searchMovies(query: string, page = 1): Promise<Movie[]> {
    // 实现搜索逻辑
  }
  
  async getMovieById(id: string): Promise<Movie | null> {
    // 实现详情获取
  }
}
```

3. **更新Aggregation Service**
```typescript
// 在aggregation-service中添加新源
const newSourceProvider = new NewSourceProvider();
const results = await Promise.allSettled([
  tmdbProvider.searchMovies(query),
  omdbProvider.searchMovies(query),
  tvmazeProvider.searchMovies(query),
  newSourceProvider.searchMovies(query) // 新增
]);
```

### 添加新功能

#### 实现用户认证
```typescript
// 使用JWT进行身份验证
import jwt from 'jsonwebtoken';

const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, process.env.JWT_SECRET!, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};
```

#### 实现数据库持久化
```typescript
// 使用Prisma ORM
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class DatabaseUserService {
  async createUser(userData: CreateUserDto) {
    return await prisma.user.create({ data: userData });
  }
  
  async getUserWatchlist(userId: string) {
    return await prisma.watchlistItem.findMany({
      where: { userId },
      include: { movie: true }
    });
  }
}
```

## 维护指南

### 定期维护任务

#### 1. 依赖更新
```bash
# 检查过时的依赖
pnpm outdated

# 更新依赖
pnpm update

# 安全审计
pnpm audit
```

#### 2. 日志清理
```bash
# 清理旧日志文件
find logs/ -name "*.log" -mtime +30 -delete

# 压缩日志文件
gzip logs/access.log.2023-10-01
```

#### 3. 性能监控
```bash
# 检查内存使用
ps aux | grep node | awk '{sum+=$6} END {print "Total Memory: " sum/1024 " MB"}'

# 检查磁盘空间
df -h
```

### 备份策略

#### 数据库备份
```bash
# PostgreSQL备份
pg_dump -h localhost -U username -d moviehub > backup_$(date +%Y%m%d).sql

# Redis备份
redis-cli BGSAVE
cp /var/lib/redis/dump.rdb backup_redis_$(date +%Y%m%d).rdb
```

#### 配置文件备份
```bash
# 备份环境配置
tar -czf config_backup_$(date +%Y%m%d).tar.gz .env* services/*/.env
```

## 总结

MovieHub项目采用现代化的微服务架构，具有良好的可扩展性和可维护性。通过详细的配置和部署说明，可以快速在不同环境中部署和运行项目。项目支持多种部署方式，从本地开发到生产环境，从Docker容器到Kubernetes集群，满足不同规模和需求的部署场景。

---

**文档版本**: 1.0.0  
**最后更新**: 2025年10月22日  
**作者**: 姜政言 (2353594)  
**项目**: MovieHub 微服务架构

