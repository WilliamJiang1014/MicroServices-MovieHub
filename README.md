# MovieHub - 电影与剧集聚合平台

一个基于微服务架构的电影信息聚合平台，整合多个数据源（TMDB、OMDb、TVMaze），提供搜索、评分对比、AI增强的影评和观影清单管理功能。

**GitHub 仓库**: https://github.com/WilliamJiang1014/MicroServices-MovieHub

## 🎯 项目特点

- 🎬 **多数据源聚合**：整合TMDB、OMDb、TVMaze等多个影视数据源
- 🤖 **AI增强**：集成通义千问API，提供智能影评、推荐和亮点提取
- 🧠 **智能搜索**：AI驱动的意图分析，支持自然语言查询
- 🔄 **MCP集成**：Model Context Protocol实现服务编排和工具调用
- 📊 **评分融合**：综合多个来源的评分，计算加权评分
- 📈 **数据可视化**：评分雷达图、相似作品网络图
- 📝 **观影清单**：支持想看/在看/看过状态管理
- 🏗️ **微服务架构**：清晰的服务边界，易于扩展和维护

## 🏗️ 系统架构

```
moviehub/
├── packages/
│   └── shared/              # 共享类型和工具库
├── services/
│   ├── api-gateway/         # API网关 (3000)
│   ├── llm-service/         # LLM服务 (3001)
│   ├── provider-tmdb/       # TMDB数据源 (3002)
│   ├── provider-omdb/       # OMDb数据源 (3003)
│   ├── provider-tvmaze/     # TVMaze数据源 (3006)
│   ├── aggregation-service/ # 数据聚合 (3004)
│   ├── user-service/        # 用户服务 (3005)
│   ├── mcp-gateway/         # MCP网关 (3007)
│   ├── mcp-provider-tmdb/   # TMDB MCP (3008)
│   ├── mcp-provider-omdb/   # OMDb MCP (3009)
│   └── graph-orchestrator/  # AI编排器 (3010)
└── apps/
    └── web-client/          # Web前端 (5173/80)
```

## 📋 前置要求

### 本地开发
- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Redis (用于缓存)

### Docker部署
- Docker >= 20.10
- Docker Compose >= 2.0

## 🔑 API密钥申请

在开始之前，你需要申请以下API密钥：

1. **TMDB API Key** (必需)
   - 访问：https://www.themoviedb.org/settings/api
   - 注册账号后申请API密钥（免费）

2. **OMDb API Key** (必需)
   - 访问：http://www.omdbapi.com/apikey.aspx
   - 免费层提供1000次/天的请求限制

3. **通义千问 API Key** (可选，用于AI功能)
   - 访问：https://dashscope.console.aliyun.com/
   - 注册阿里云账号并开通DashScope服务

4. **TVMaze API**
   - 无需API Key，完全免费使用

---

## 🚀 方式一：Docker部署（推荐）

### 1. 克隆项目

```bash
# 克隆项目仓库
git clone https://github.com/WilliamJiang1014/MicroServices-MovieHub.git

# 进入项目目录
cd MicroServices-MovieHub
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp env.docker.example .env

# 编辑.env文件，填入您的API密钥
nano .env
```

在 `.env` 文件中填入：
```bash
TMDB_API_KEY=your_tmdb_api_key_here
OMDB_API_KEY=your_omdb_api_key_here
QWEN_API_KEY=your_qwen_api_key_here  # 可选
```

### 3. 启动所有服务

```bash
# 一键启动（包括所有微服务、MCP服务、Redis、前端）
docker-compose up -d
```

### 4. 访问应用

- **前端界面**: http://localhost
- **API网关**: http://localhost:3000
- **健康检查**: http://localhost:3000/health

### Docker管理命令

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f api-gateway

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 重新构建并启动
docker-compose up -d --build
```

---

## 💻 方式二：本地开发

⚠️ **重要提示**: 本地开发需要先构建必需的包，建议使用提供的启动脚本。

### 快速开始（推荐）

```bash
# 1. 克隆项目并安装依赖
git clone https://github.com/WilliamJiang1014/MicroServices-MovieHub.git
cd MicroServices-MovieHub
pnpm install

# 2. 构建必需的包
pnpm --filter @moviehub/shared build
pnpm --filter @moviehub/mcp-gateway build
pnpm --filter @moviehub/mcp-provider-tmdb build
pnpm --filter @moviehub/mcp-provider-omdb build
pnpm --filter @moviehub/graph-orchestrator build

# 3. 配置环境变量
cp env.example .env
# 编辑 .env 文件，填入您的 API 密钥

# 4. 使用启动脚本（推荐，避免 macOS 文件描述符限制）
./scripts/local-dev.sh
```

访问 http://localhost:5173 查看应用。

停止服务：
```bash
pkill -f 'pnpm.*dev' && pkill -f 'tsx watch' && pkill -f 'vite'
docker stop moviehub-redis-local && docker rm moviehub-redis-local
```

---

### 详细配置（高级用户）

### 1. 克隆项目并安装依赖

```bash
# 克隆项目仓库
git clone https://github.com/WilliamJiang1014/MicroServices-MovieHub.git

# 进入项目目录
cd MicroServices-MovieHub

# 安装pnpm（如果还没有）
npm install -g pnpm

# 安装项目依赖
pnpm install
```

### 2. 启动Redis

```bash
# macOS (使用Homebrew)
brew install redis
brew services start redis

# Linux
sudo apt-get install redis-server
sudo systemctl start redis

# 或使用Docker运行Redis
docker run -d -p 6379:6379 redis:7-alpine
```

### 3. 配置环境变量

为每个服务创建 `.env` 文件：

#### API Gateway
```bash
cd services/api-gateway
cat > .env << EOF
PORT=3000
AGGREGATION_URL=http://localhost:3004
LLM_URL=http://localhost:3001
USER_URL=http://localhost:3005
TMDB_URL=http://localhost:3002
OMDB_URL=http://localhost:3003
TVMAZE_URL=http://localhost:3006
REDIS_HOST=localhost
REDIS_PORT=6379
NODE_ENV=development
EOF
cd ../..
```

#### LLM Service
```bash
cd services/llm-service
cat > .env << EOF
PORT=3001
QWEN_API_KEY=你的通义千问API密钥
QWEN_API_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
REDIS_HOST=localhost
REDIS_PORT=6379
NODE_ENV=development
EOF
cd ../..
```

#### TMDB Provider
```bash
cd services/provider-tmdb
cat > .env << EOF
PORT=3002
TMDB_API_KEY=你的TMDB_API密钥
REDIS_HOST=localhost
REDIS_PORT=6379
NODE_ENV=development
EOF
cd ../..
```

#### OMDb Provider
```bash
cd services/provider-omdb
cat > .env << EOF
PORT=3003
OMDB_API_KEY=你的OMDb_API密钥
REDIS_HOST=localhost
REDIS_PORT=6379
NODE_ENV=development
EOF
cd ../..
```

#### TVMaze Provider
```bash
cd services/provider-tvmaze
cat > .env << EOF
PORT=3006
REDIS_HOST=localhost
REDIS_PORT=6379
NODE_ENV=development
EOF
cd ../..
```

#### Aggregation Service
```bash
cd services/aggregation-service
cat > .env << EOF
PORT=3004
TMDB_PROVIDER_URL=http://localhost:3002
OMDB_PROVIDER_URL=http://localhost:3003
TVMAZE_PROVIDER_URL=http://localhost:3006
REDIS_HOST=localhost
REDIS_PORT=6379
NODE_ENV=development
EOF
cd ../..
```

#### User Service
```bash
cd services/user-service
cat > .env << EOF
PORT=3005
REDIS_HOST=localhost
REDIS_PORT=6379
NODE_ENV=development
EOF
cd ../..
```

#### MCP Gateway
```bash
cd services/mcp-gateway
cat > .env << EOF
PORT=3007
REDIS_HOST=localhost
REDIS_PORT=6379
NODE_ENV=development
EOF
cd ../..
```

#### MCP Provider TMDB
```bash
cd services/mcp-provider-tmdb
cat > .env << EOF
PORT=3008
TMDB_API_KEY=你的TMDB_API密钥
REDIS_HOST=localhost
REDIS_PORT=6379
NODE_ENV=development
EOF
cd ../..
```

#### MCP Provider OMDb
```bash
cd services/mcp-provider-omdb
cat > .env << EOF
PORT=3009
OMDB_API_KEY=你的OMDb_API密钥
REDIS_HOST=localhost
REDIS_PORT=6379
NODE_ENV=development
EOF
cd ../..
```

#### Graph Orchestrator
```bash
cd services/graph-orchestrator
cat > .env << EOF
PORT=3010
MCP_GATEWAY_URL=http://localhost:3007
REDIS_HOST=localhost
REDIS_PORT=6379
NODE_ENV=development
EOF
cd ../..
```

### 4. 构建共享包

```bash
cd packages/shared
pnpm build
cd ../..
```

### 5. 启动服务

**方式1：使用启动脚本（推荐）**

```bash
# 一键启动所有服务
./scripts/start-with-cache.sh
```

**方式2：手动启动**

在项目根目录下，打开多个终端窗口：

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

# 终端8: MCP Gateway
pnpm dev:mcp-gateway

# 终端9: MCP TMDB Provider
pnpm dev:mcp-tmdb

# 终端10: MCP OMDb Provider
pnpm dev:mcp-omdb

# 终端11: Graph Orchestrator
pnpm dev:graph-orchestrator

# 终端12: Web Client
pnpm dev:web
```

### 6. 访问应用

- **前端界面**：http://localhost:5173
- **API网关**：http://localhost:3000
- **健康检查**：http://localhost:3000/health

### 停止服务

```bash
# 使用停止脚本
./scripts/stop-all.sh

# 或在每个终端按 Ctrl+C
```

---

## 📊 服务端口映射

| 服务名 | 端口 | 说明 |
|--------|------|------|
| API Gateway | 3000 | 统一API入口 |
| LLM Service | 3001 | AI摘要服务 |
| TMDB Provider | 3002 | TMDB数据源 |
| OMDb Provider | 3003 | OMDb数据源 |
| Aggregation Service | 3004 | 数据聚合 |
| User Service | 3005 | 用户管理 |
| TVMaze Provider | 3006 | TVMaze数据源 |
| MCP Gateway | 3007 | MCP协议网关 |
| MCP TMDB Provider | 3008 | TMDB MCP服务 |
| MCP OMDb Provider | 3009 | OMDb MCP服务 |
| Graph Orchestrator | 3010 | AI智能搜索 |
| Web Client | 5173/80 | 前端界面 |
| Redis | 6379 | 缓存服务 |

## 🎨 核心功能

### 1. 多数据源搜索
- 同时搜索TMDB、OMDb、TVMaze
- 自动去重和数据融合
- 加权评分计算

### 2. AI智能搜索
- 自然语言查询（如："找一些科幻电影"）
- 意图识别和分析
- 智能推荐

### 3. 电影详情
- 综合多个数据源的信息
- AI生成的影评摘要
- 评分雷达图可视化
- 相似作品网络图

### 4. 观影清单
- 想看/在看/看过状态管理
- 个人评分和笔记
- 观看进度跟踪

## 🛠️ 技术栈

### 后端
- **运行时**: Node.js 18+
- **语言**: TypeScript
- **框架**: Express.js
- **包管理**: pnpm (Monorepo)
- **缓存**: Redis

### 前端
- **框架**: React 18
- **构建工具**: Vite
- **语言**: TypeScript
- **可视化**: 原生SVG

### AI服务
- **LLM**: 通义千问 API
- **MCP**: Model Context Protocol
- **编排**: LangGraph

## 📝 API示例

### 搜索电影
```bash
curl "http://localhost:3000/api/search?query=Dune"
```

### 获取电影详情
```bash
curl "http://localhost:3000/api/movie/438631"
```

### AI智能搜索
```bash
curl -X POST http://localhost:3010/execute \
  -H "Content-Type: application/json" \
  -d '{"query": "Find sci-fi movies from 2020", "userId": "demo-user-1"}'
```

### 添加到观影清单
```bash
curl -X POST http://localhost:3000/api/users/demo-user-1/watchlist \
  -H "Content-Type: application/json" \
  -d '{"movieId": "438631", "status": "want_to_watch"}'
```

## 🐛 常见问题

### Redis连接失败
确保Redis服务正在运行：
```bash
# 检查Redis状态
redis-cli ping
# 应该返回 PONG
```

### API密钥错误
检查 `.env` 文件中的API密钥是否正确配置。

### 端口被占用
修改对应服务的 `.env` 文件中的 `PORT` 配置。

### Docker容器无法启动
```bash
# 查看日志
docker-compose logs -f

# 重新构建
docker-compose up -d --build
```

## 📄 许可证

MIT License

## 👨‍💻 作者

Jiang Zhengyan

## 📦 项目仓库

GitHub: https://github.com/WilliamJiang1014/MicroServices-MovieHub

## 🙏 致谢

- [TMDB](https://www.themoviedb.org/) - 电影数据库
- [OMDb](http://www.omdbapi.com/) - 开放电影数据库
- [TVMaze](https://www.tvmaze.com/) - 电视剧数据库
- [通义千问](https://tongyi.aliyun.com/) - AI服务
