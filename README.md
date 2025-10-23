# MovieHub - 电影与剧集聚合平台

一个基于微服务架构的电影信息聚合平台，整合多个数据源（TMDB、OMDb），提供搜索、评分对比、AI增强的影评和观影清单管理功能。

## 项目特点

- 🎬 **多数据源聚合**：整合TMDB、OMDb、TVMaze等多个影视数据源
- 🤖 **AI增强**：集成通义千问API，提供智能影评、推荐和亮点提取
- 🧠 **智能搜索**：AI驱动的意图分析，支持自然语言查询
- 🔄 **MCP集成**：Model Context Protocol实现服务编排和工具调用
- 📊 **评分融合**：综合多个来源的评分，计算加权评分
- 📈 **数据可视化**：评分对比图表、来源分布统计、**评分雷达图**、**相似作品网络图**
- 📝 **观影清单**：支持想看/在看/看过状态管理
- 🏗️ **微服务架构**：清晰的服务边界，易于扩展和维护
- 🎨 **现代化UI**：React + Vite 构建的响应式界面

## 系统架构

```
moviehub/
├── packages/
│   └── shared/              # 共享类型和工具库
├── services/
│   ├── api-gateway/         # API网关 (端口: 3000)
│   ├── llm-service/         # LLM服务，集成通义千问 (端口: 3001)
│   ├── provider-tmdb/       # TMDB数据源服务 (端口: 3002)
│   ├── provider-omdb/       # OMDb数据源服务 (端口: 3003)
│   ├── provider-tvmaze/     # TVMaze数据源服务 (端口: 3006)
│   ├── aggregation-service/ # 数据聚合服务 (端口: 3004)
│   ├── user-service/        # 用户和观影清单服务 (端口: 3005)
│   ├── mcp-gateway/         # MCP网关服务 (端口: 3007)
│   ├── mcp-provider-tmdb/   # TMDB MCP Provider (端口: 3008)
│   ├── mcp-provider-omdb/   # OMDb MCP Provider (端口: 3009)
│   └── graph-orchestrator/  # LangGraph编排器 (端口: 3010)
└── apps/
    └── web-client/          # Web前端应用 (端口: 5173)
```

## 🎨 新增可视化功能

### 📊 评分雷达图
- **多维度展示**：将TMDB、IMDB、TVMaze等不同数据源的评分以雷达图形式展示
- **直观对比**：用户可以一眼看出各数据源的评分差异和分布
- **交互式设计**：鼠标悬停显示具体数值，支持深色模式
- **响应式布局**：自动适配桌面端和移动端

### 🕸️ 相似作品网络图
- **中心节点设计**：当前电影作为中心，相似电影围绕分布
- **相似度可视化**：连线粗细和透明度表示相似程度
- **动态布局**：最多支持8个相似作品，自动计算最佳位置
- **交互式节点**：点击节点可查看详细信息

### 技术特点
- **零依赖实现**：纯SVG + CSS，无需外部图表库
- **高性能**：轻量级实现，加载速度快
- **类型安全**：完整的TypeScript类型定义
- **主题适配**：自动适配明暗主题切换

## 技术栈

### 后端
- **运行时**：Node.js 18+
- **语言**：TypeScript
- **框架**：Express.js
- **包管理**：pnpm (Monorepo)
- **API客户端**：Axios

### 前端
- **框架**：React 18
- **构建工具**：Vite
- **语言**：TypeScript

### AI服务
- **LLM**：通义千问 API（阿里云DashScope）
- **MCP**：Model Context Protocol 服务编排
- **LangGraph**：工作流编排和状态管理

### 数据源
- **TMDB**：The Movie Database API
- **OMDb**：Open Movie Database API
- **TVMaze**：TV Maze API（无需API Key）

## 前置要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0

安装pnpm（如果还没有安装）：
```bash
npm install -g pnpm
```

## API密钥申请

在开始之前，你需要申请以下API密钥：

1. **TMDB API Key**
   - 访问：https://www.themoviedb.org/settings/api
   - 注册账号后申请API密钥（免费）

2. **OMDb API Key**
   - 访问：http://www.omdbapi.com/apikey.aspx
   - 免费层提供1000次/天的请求限制

3. **TVMaze API**
   - 无需API Key，完全免费使用
   - 提供电视剧和电影数据

4. **通义千问 API Key**
   - 访问：https://dashscope.console.aliyun.com/
   - 注册阿里云账号并开通DashScope服务
   - 创建API Key

## 快速开始

> 💡 **提示**: 查看 [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) 获取所有常用命令的速查手册

### 1. 安装依赖

```bash
cd moviehub
pnpm install
```

### 2. 配置环境变量

为每个服务创建`.env`文件：

#### API Gateway (.env)
```bash
cd services/api-gateway
cat > .env << EOF
PORT=3000
AGGREGATION_URL=http://localhost:3004
LLM_URL=http://localhost:3001
USER_URL=http://localhost:3005
TMDB_URL=http://localhost:3002
OMDB_URL=http://localhost:3003
NODE_ENV=development
EOF
```

#### LLM Service (.env)
```bash
cd services/llm-service
cat > .env << EOF
PORT=3001
QWEN_API_KEY=你的通义千问API密钥
QWEN_API_URL=https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation
NODE_ENV=development
EOF
```

#### TMDB Provider (.env)
```bash
cd services/provider-tmdb
cat > .env << EOF
PORT=3002
TMDB_API_KEY=你的TMDB_API密钥
NODE_ENV=development
EOF
```

#### OMDb Provider (.env)
```bash
cd services/provider-omdb
cat > .env << EOF
PORT=3003
OMDB_API_KEY=你的OMDb_API密钥
NODE_ENV=development
EOF
```

#### Aggregation Service (.env)
```bash
cd services/aggregation-service
cat > .env << EOF
PORT=3004
TMDB_PROVIDER_URL=http://localhost:3002
OMDB_PROVIDER_URL=http://localhost:3003
NODE_ENV=development
EOF
```

#### User Service (.env)
```bash
cd services/user-service
cat > .env << EOF
PORT=3005
NODE_ENV=development
EOF
```

### 3. 构建共享包

```bash
cd packages/shared
pnpm build
```

### 4. 启动所有服务

**推荐方式：使用启动脚本**

```bash
# 一键启动所有服务（包括前端和后端）
./scripts/start-with-cache.sh
```

**启动MCP服务（AI增强功能）**

```bash
# 启动MCP服务
./scripts/start-mcp.sh

# 测试MCP服务
./scripts/test-mcp.sh
```

**手动启动方式：**

在项目根目录下，打开多个终端窗口，分别启动各个服务：

```bash
# 终端1: API Gateway
pnpm dev:gateway

# 终端2: LLM Service
pnpm dev:llm

# 终端3: TMDB Provider
pnpm dev:tmdb

# 终端4: OMDb Provider
pnpm dev:omdb

# 终端5: Aggregation Service
pnpm dev:aggregation

# 终端6: User Service
pnpm dev:user

# 终端7: Web Client
pnpm dev:web
```

**启动MCP服务（手动方式）：**

```bash
# 终端8: MCP Gateway
pnpm dev:mcp-gateway

# 终端9: TMDB MCP Provider
pnpm dev:mcp-tmdb

# 终端10: OMDb MCP Provider
pnpm dev:mcp-omdb

# 终端11: Graph Orchestrator
pnpm dev:graph-orchestrator
```

**一键启动所有服务（包括MCP）：**

```bash
# 启动传统服务
pnpm dev

# 启动MCP服务
pnpm dev:mcp

# 启动所有服务（传统+MCP）
pnpm dev:all
```

### 5. 访问应用

- **前端界面**：http://localhost:5173
- **API网关**：http://localhost:3000
- **健康检查**：http://localhost:3000/health

**MCP服务访问地址：**
- **MCP Gateway**：http://localhost:3007
- **Graph Orchestrator**：http://localhost:3010
- **TMDB MCP Provider**：http://localhost:3008
- **OMDb MCP Provider**：http://localhost:3009

## 服务管理

### 使用启动脚本（推荐）

```bash
# 一键启动所有服务
./scripts/start-with-cache.sh

# 启动MCP服务
./scripts/start-mcp.sh
```

### 服务重启和停止

```bash
# 一键重启所有服务（推荐）
./scripts/restart-all.sh

# 一键停止所有服务
./scripts/stop-all.sh
```

启动脚本会自动：
- 检查 Redis 是否运行
- 检查 .env 文件是否存在
- 安装依赖
- 构建共享包
- 启动所有服务

### 测试服务

```bash
# 测试 API 功能
./scripts/test-api.sh

# 测试缓存功能
./scripts/test-cache.sh

# 测试MCP服务
./scripts/test-mcp.sh
```

### 停止服务

在运行服务的终端按 `Ctrl+C` 停止所有服务。

### 服务端口映射

| 服务名 | 端口 | 地址 |
|--------|------|------|
| API Gateway | 3000 | http://localhost:3000 |
| LLM Service | 3001 | http://localhost:3001 |
| TMDB Provider | 3002 | http://localhost:3002 |
| OMDb Provider | 3003 | http://localhost:3003 |
| TVMaze Provider | 3006 | http://localhost:3006 |
| Aggregation Service | 3004 | http://localhost:3004 |
| User Service | 3005 | http://localhost:3005 |
| **MCP Gateway** | **3007** | **http://localhost:3007** |
| **TMDB MCP Provider** | **3008** | **http://localhost:3008** |
| **OMDb MCP Provider** | **3009** | **http://localhost:3009** |
| **Graph Orchestrator** | **3010** | **http://localhost:3010** |
| Web Client | 5173 | http://localhost:5173 |

## API文档

### 传统API

#### 搜索电影
```bash
GET /api/search?query=Dune&limit=10
```

#### 获取电影详情
```bash
GET /api/movie/{movieId}
```

#### 获取AI增强的电影摘要
```bash
GET /api/movie/{movieId}/summary
```

#### 添加到观影清单
```bash
POST /api/users/{userId}/watchlist
Content-Type: application/json

{
  "movieId": "tmdb-438631",
  "status": "want_to_watch"
}
```

#### 获取观影清单
```bash
GET /api/users/{userId}/watchlist?status=want_to_watch
```

#### 观影清单统计
```bash
GET /api/users/{userId}/watchlist/stats
```

### MCP API（AI增强功能）

#### 执行智能工作流
```bash
POST http://localhost:3010/execute
Content-Type: application/json

{
  "query": "帮我找Christopher Nolan导演的电影",
  "userId": "user123"
}
```

#### 获取MCP服务列表
```bash
GET http://localhost:3007/servers
```

#### 获取可用工具列表
```bash
GET http://localhost:3007/tools
```

#### 调用MCP工具
```bash
POST http://localhost:3007/call-tool
Content-Type: application/json

{
  "toolName": "tmdb-provider.search_movies",
  "args": {
    "query": "Inception"
  }
}
```

#### AI意图分析
```bash
POST http://localhost:3001/analyze-intent
Content-Type: application/json

{
  "query": "我想看一些科幻电影",
  "context": "movie_search"
}
```

## 使用示例

### 1. 传统搜索

在Web界面的搜索框中输入电影名称，例如"Dune"或"盗梦空间"，系统会：
- 同时查询TMDB、OMDb和TVMaze三个数据源
- 自动去重和合并数据
- 计算综合评分
- 展示电影海报、评分、类型等信息

### 2. AI智能搜索（MCP功能）

在前端界面开启"AI-Powered Search (MCP)"开关，支持自然语言查询：

#### 类型搜索
```
"我想看一些科幻电影"
"找一些2020年以后的科幻片"
```

#### 导演搜索
```
"帮我找Christopher Nolan导演的电影"
"Steven Spielberg执导的影片"
```

#### 电影比较
```
"比较一下Dune和Inception"
"对比《盗梦空间》和《星际穿越》"
```

#### 热门推荐
```
"推荐一些热门电影"
"有什么好看的经典电影"
```

### 3. 查看电影详情

点击任意电影卡片，会打开详情页面，显示：
- 完整的剧情简介
- 演员和导演信息
- **多源评分对比可视化图表**（柱状图展示不同来源评分）
- **数据来源统计**（来源数量、加权评分等）
- **AI生成的影评摘要**（由通义千问生成）
- **电影亮点提取**
- **相似电影推荐**

### 4. 管理观影清单

点击"Add to Watchlist"按钮，将电影添加到你的观影清单中。支持三种状态：
- `want_to_watch`：想看
- `watching`：在看
- `watched`：看过

## 项目结构说明

### 共享包 (packages/shared)
- `types/`：共享的TypeScript类型定义
- `utils/`：通用工具函数（日志、HTTP客户端等）

### API Gateway (services/api-gateway)
- 统一的API入口
- 请求路由和转发
- 服务健康检查
- 聚合多个服务的响应

### LLM Service (services/llm-service)
- 集成通义千问API
- 生成电影摘要和推荐
- 提取电影亮点
- 推荐相似电影
- **AI意图分析**：理解用户查询意图

### Provider Services
- **TMDB Provider**：封装TMDB API调用
- **OMDb Provider**：封装OMDb API调用
- 标准化的数据格式输出

### MCP Services（新增）
- **MCP Gateway**：MCP服务注册中心和工具发现
- **TMDB MCP Provider**：将TMDB服务封装为MCP工具
- **OMDb MCP Provider**：将OMDb服务封装为MCP工具
- **Graph Orchestrator**：基于LangGraph的工作流编排器

### Aggregation Service
- 数据去重和合并
- 评分加权计算
- 跨数据源的数据融合

### User Service
- 用户管理（内存存储）
- 观影清单CRUD操作
- 观影统计

### Web Client
- React + Vite 构建
- 响应式设计
- 电影搜索和浏览
- 观影清单管理
- AI增强的电影详情展示
- **MCP集成**：支持AI智能搜索和执行轨迹显示

## 开发说明

### 添加新的数据源

1. 在`services/`下创建新的provider服务
2. 实现`IMovieProvider`接口
3. 在`aggregation-service`中添加对新数据源的调用
4. 更新API Gateway的路由配置

### 扩展LLM功能

在`llm-service/src/qwen-client.ts`中添加新的方法，例如：
- 生成影评
- 分析情感
- 提取关键词

### 数据持久化

当前User Service使用内存存储（`InMemoryStorage`），生产环境应替换为：
- PostgreSQL + Prisma
- MongoDB + Mongoose
- 或其他数据库方案

## 故障排查

### 服务无法启动
- 检查端口是否被占用
- 确认环境变量配置正确
- 查看服务日志输出

### API调用失败
- 验证API密钥是否正确
- 检查API配额是否用尽
- 查看网络连接是否正常

### 前端无法访问后端
- 确认API Gateway正在运行（http://localhost:3000）
- 检查Vite的proxy配置
- 查看浏览器控制台错误信息

## 性能优化建议

1. **缓存**：添加Redis缓存热门搜索结果
2. **批处理**：使用消息队列处理批量请求
3. **CDN**：静态资源使用CDN加速
4. **数据库索引**：为常用查询添加索引
5. **限流**：实现API限流保护

## 后续扩展方向

- [x] 添加更多数据源（Trakt、TVMaze等）
- [x] 实现用户认证和授权
- [x] 添加Redis缓存层
- [x] 集成MCP (Model Context Protocol)
- [x] 实现LangGraph工作流编排
- [x] 实现AI驱动的智能搜索
- [x] 支持自然语言查询和意图分析
- [ ] 添加Docker容器化支持
- [ ] 实现数据库持久化
- [ ] 添加单元测试和集成测试
- [ ] 实现观测性（OpenTelemetry + Jaeger）
- [ ] 添加更多MCP Provider（TVMaze、Aggregation Service）
- [ ] 实现更复杂的AI工作流（推荐系统、个性化搜索）

## 课程要求达成

本项目满足微服务架构课程的约束条件：

✅ **约束1**：围绕"影视信息"单一领域，集成了**至少4个不同提供方**的数据：
  - TMDB (The Movie Database)
  - OMDb (Open Movie Database)
  - 通义千问 LLM API
  - 本地用户服务（观影清单）

✅ **约束3**：在对话/查询场景中：
  - **本地知识库**：用户观影清单和偏好
  - **外部信息源**：TMDB、OMDb等影视数据源
  - **多个外部工具**：数据聚合、LLM生成、评分融合等
  - **MCP服务编排**：通过Model Context Protocol实现工具发现和调用
  - **AI工作流**：基于LangGraph的智能搜索和意图分析

## 许可证

MIT License

## 作者

姜政言 - 2353594 - 同济大学软件学院

## 致谢

- TMDB for providing comprehensive movie data
- OMDb for additional movie information
- 阿里云DashScope for AI capabilities

