# MovieHub 快速参考手册

## 🚀 启动服务

### 一键启动所有服务（推荐）
```bash
./scripts/start-with-cache.sh
```

### 启动MCP服务（AI增强功能）
```bash
./scripts/start-mcp.sh
```

### 手动启动单个服务
```bash
pnpm dev:gateway      # API Gateway (3000)
pnpm dev:llm          # LLM Service (3001)
pnpm dev:tmdb         # TMDB Provider (3002)
pnpm dev:omdb         # OMDb Provider (3003)
pnpm dev:tvmaze       # TVMaze Provider (3006)
pnpm dev:aggregation  # Aggregation Service (3004)
pnpm dev:user         # User Service (3005)
pnpm dev:web          # Web Client (5173)
```

### 手动启动MCP服务
```bash
pnpm dev:mcp-gateway      # MCP Gateway (3007)
pnpm dev:mcp-tmdb         # TMDB MCP Provider (3008)
pnpm dev:mcp-omdb         # OMDb MCP Provider (3009)
pnpm dev:graph-orchestrator # Graph Orchestrator (3010)
```

### 一键启动所有服务（包括MCP）
```bash
pnpm dev:all          # 启动所有服务（传统+MCP）
```

## 🔄 重启服务

### 一键重启所有服务（推荐）
```bash
./scripts/restart-all.sh
```
> 自动停止所有服务并重新启动传统服务+MCP服务

### 手动重启单个服务
```bash
# 停止当前服务（Ctrl+C）
# 手动启动单个服务
pnpm dev:gateway      # 或其他服务
```

## 🛑 停止服务

### 一键停止所有服务
```bash
./scripts/stop-all.sh
```
> 自动停止所有相关进程（pnpm、tsx、vite）

### 手动停止服务
```bash
# 在运行服务的终端按 Ctrl+C
```

## 📍 服务端口

| 服务 | 端口 | 地址 | 说明 |
|------|------|------|------|
| API Gateway | 3000 | http://localhost:3000 | 统一入口 |
| LLM Service | 3001 | http://localhost:3001 | AI摘要生成 |
| TMDB Provider | 3002 | http://localhost:3002 | TMDB数据源 |
| OMDb Provider | 3003 | http://localhost:3003 | OMDb数据源 |
| TVMaze Provider | 3006 | http://localhost:3006 | TVMaze数据源 |
| Aggregation | 3004 | http://localhost:3004 | 数据聚合 |
| User Service | 3005 | http://localhost:3005 | 用户和清单 |
| **MCP Gateway** | **3007** | **http://localhost:3007** | **MCP服务注册中心** |
| **TMDB MCP Provider** | **3008** | **http://localhost:3008** | **TMDB MCP工具** |
| **OMDb MCP Provider** | **3009** | **http://localhost:3009** | **OMDb MCP工具** |
| **Graph Orchestrator** | **3010** | **http://localhost:3010** | **AI工作流编排** |
| Web Client | 5173 | http://localhost:5173 | 前端界面 |

## 🌐 访问地址

- **前端**: http://localhost:5173
- **API网关**: http://localhost:3000
- **健康检查**: http://localhost:3000/health

### MCP服务访问地址
- **MCP Gateway**: http://localhost:3007
- **Graph Orchestrator**: http://localhost:3010
- **TMDB MCP Provider**: http://localhost:3008
- **OMDb MCP Provider**: http://localhost:3009

## 🔧 故障排查

### 服务无法启动
```bash
# 1. 检查端口占用
lsof -i :3000  # 替换为对应端口

# 2. 杀死占用进程
kill -9 <PID>

# 3. 重新启动
./scripts/restart-service.sh <service-name>
```

### 查看服务日志
```bash
# 方法1: 在tmux中查看
tmux attach -t moviehub
# 切换到对应窗口

# 方法2: 滚动查看历史日志
# Ctrl+B + [  进入滚动模式
# 上下箭头或 Page Up/Down 滚动
# Q 退出滚动模式
```

### 检查所有服务状态
```bash
curl http://localhost:3000/health | jq
```

### 重建项目
```bash
# 1. 停止所有服务
tmux kill-session -t moviehub

# 2. 清理依赖
pnpm clean

# 3. 重新安装
pnpm install

# 4. 重新构建共享包
cd packages/shared && pnpm build && cd ../..

# 5. 重新启动
./scripts/start-all.sh
```

## 📝 常用API测试

### 搜索电影
```bash
curl "http://localhost:3000/api/search?query=Dune&limit=5" | jq
```

### 获取电影详情
```bash
curl "http://localhost:3000/api/movie/tmdb-438631" | jq
```

### 获取AI摘要
```bash
curl "http://localhost:3000/api/movie/tmdb-438631/summary" | jq
```

### 健康检查
```bash
curl "http://localhost:3000/health" | jq
```

### 添加到观影清单
```bash
curl -X POST "http://localhost:3000/api/users/demo-user-1/watchlist" \
  -H "Content-Type: application/json" \
  -d '{"movieId":"tmdb-438631","status":"want_to_watch"}' | jq
```

### 查看观影清单
```bash
curl "http://localhost:3000/api/users/demo-user-1/watchlist" | jq
```

## 🤖 MCP API测试（AI增强功能）

### 执行智能工作流
```bash
# 导演搜索
curl -X POST "http://localhost:3010/execute" \
  -H "Content-Type: application/json" \
  -d '{"query": "帮我找Christopher Nolan导演的电影", "userId": "demo-user-1"}' | jq

# 类型搜索
curl -X POST "http://localhost:3010/execute" \
  -H "Content-Type: application/json" \
  -d '{"query": "我想看一些科幻电影", "userId": "demo-user-1"}' | jq

# 电影比较
curl -X POST "http://localhost:3010/execute" \
  -H "Content-Type: application/json" \
  -d '{"query": "比较一下Dune和Inception", "userId": "demo-user-1"}' | jq
```

### 获取MCP服务列表
```bash
curl "http://localhost:3007/servers" | jq
```

### 获取可用工具列表
```bash
curl "http://localhost:3007/tools" | jq
```

### 调用MCP工具
```bash
# 搜索电影
curl -X POST "http://localhost:3007/call-tool" \
  -H "Content-Type: application/json" \
  -d '{"toolName": "tmdb-provider.search_movies", "args": {"query": "Inception"}}' | jq

# 导演搜索
curl -X POST "http://localhost:3007/call-tool" \
  -H "Content-Type: application/json" \
  -d '{"toolName": "tmdb-provider.search_movies_by_director", "args": {"directorName": "Christopher Nolan"}}' | jq
```

### AI意图分析
```bash
curl -X POST "http://localhost:3001/analyze-intent" \
  -H "Content-Type: application/json" \
  -d '{"query": "我想看一些科幻电影", "context": "movie_search"}' | jq
```

### 测试MCP服务
```bash
./scripts/test-mcp.sh
```

## 🎯 开发工作流

### 修改代码后重启对应服务
```bash
# 1. 修改代码
# 2. 重启对应服务
./scripts/restart-service.sh <service-name>

# 3. 验证修改
curl http://localhost:3000/health
```

### 添加新功能的流程
1. 修改 `packages/shared` 类型定义
2. 重新构建共享包：`cd packages/shared && pnpm build`
3. 修改对应的服务代码
4. 重启服务：`./scripts/restart-service.sh <service-name>`
5. 测试验证

### 调试技巧
```bash
# 1. 查看实时日志
tmux attach -t moviehub
# 切换到对应窗口查看日志

# 2. 使用curl测试API
curl -v http://localhost:3000/api/search?query=test

# 3. 检查环境变量
cat services/<service-name>/.env

# 4. 查看进程状态
ps aux | grep node
```

## 🔐 环境变量配置

### 快速配置所有环境变量
```bash
./configure-env.sh
```

### 手动检查配置
```bash
# 检查API密钥
cat services/llm-service/.env | grep QWEN_API_KEY
cat services/provider-tmdb/.env | grep TMDB_API_KEY
cat services/provider-omdb/.env | grep OMDB_API_KEY

# 检查服务URL配置
cat services/aggregation-service/.env
cat services/api-gateway/.env
```

## 🆘 紧急情况

### 完全重置
```bash
# 1. 停止所有服务
tmux kill-session -t moviehub

# 2. 清理所有
pnpm clean
rm -rf node_modules packages/*/node_modules services/*/node_modules apps/*/node_modules

# 3. 重新开始
pnpm install
cd packages/shared && pnpm build && cd ../..
./configure-env.sh
./scripts/start-all.sh
```

### 端口冲突解决
```bash
# 查找占用端口的进程
lsof -i :3000
lsof -i :3001
lsof -i :3002
# ... 其他端口

# 杀死进程
kill -9 <PID>

# 或修改端口配置
# 编辑对应服务的 .env 文件中的 PORT 值
```

## 📚 相关文档

- **README.md** - 完整项目文档
- **SETUP.md** - 详细部署指南
- **QUICKSTART.md** - 5分钟快速开始
- **NEW_FEATURES.md** - 新功能说明
- **PROJECT_OVERVIEW.md** - 项目概览

## 💡 提示

- 🔥 热重载：前端和所有服务都支持热重载，修改代码后自动重启
- 📊 日志：所有日志都实时显示在tmux窗口中
- 🎯 专注：使用tmux窗口分离功能，可以让服务在后台运行
- 🔍 调试：进入tmux滚动模式查看完整日志历史

---

**快捷命令速查**
```bash
./scripts/start-with-cache.sh      # 启动传统服务
./scripts/start-mcp.sh            # 启动MCP服务
./scripts/restart-all.sh          # 一键重启所有服务（推荐）
./scripts/stop-all.sh             # 一键停止所有服务
./scripts/test-mcp.sh             # 测试MCP服务
pnpm dev:all                      # 启动所有服务
tmux attach -t moviehub-mcp       # 连接MCP服务
tmux kill-session -t moviehub-mcp # 停止MCP服务
```

**项目路径**: `/Users/jiang/Desktop/微服务架构/moviehub`

**作者**: 姜政言 (2353594)

