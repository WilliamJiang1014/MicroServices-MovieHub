# 🐳 Docker快速启动指南

## 📋 前置要求

- Docker >= 20.10
- Docker Compose >= 2.0

## 🚀 快速开始

### 1. 配置API密钥

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
QWEN_API_KEY=your_qwen_api_key_here  # 可选，用于AI功能
```

### 2. 一键启动

```bash
docker-compose up -d
```

这个命令会自动：
- 构建所有微服务镜像
- 启动Redis缓存
- 配置服务间网络通信
- 设置健康检查和依赖关系
- 自动注册MCP服务

### 3. 访问应用

- **前端界面**: http://localhost
- **API网关**: http://localhost:3000
- **健康检查**: http://localhost:3000/health

## 🔧 管理命令

### 查看服务状态
```bash
docker-compose ps
```

### 查看日志
```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f api-gateway
docker-compose logs -f web-client
```

### 停止服务
```bash
docker-compose down
```

### 重启服务
```bash
docker-compose restart
```

### 重新构建并启动
```bash
docker-compose up -d --build
```

### 停止并删除所有数据
```bash
docker-compose down -v
```

## 📊 服务架构

Docker Compose会启动以下服务：

| 服务 | 端口 | 说明 |
|------|------|------|
| **redis** | 6379 | 缓存服务 |
| **api-gateway** | 3000 | API统一入口 |
| **llm** | 3001 | AI摘要服务 |
| **tmdb** | 3002 | TMDB数据源 |
| **omdb** | 3003 | OMDb数据源 |
| **aggregation** | 3004 | 数据聚合服务 |
| **user** | 3005 | 用户管理 |
| **tvmaze** | 3006 | TVMaze数据源 |
| **mcp-gateway** | 3007 | MCP协议网关 |
| **mcp-tmdb** | 3008 | TMDB MCP服务 |
| **mcp-omdb** | 3009 | OMDb MCP服务 |
| **graph-orchestrator** | 3010 | AI智能搜索 |
| **web-client** | 80 | 前端界面 |

## 🎯 核心功能

- ✅ 多数据源电影搜索
- ✅ AI智能搜索（自然语言查询）
- ✅ 电影详情和评分对比
- ✅ AI生成的影评摘要
- ✅ 观影清单管理
- ✅ 评分雷达图可视化
- ✅ 相似作品网络图

## 🐛 故障排查

### 查看服务是否正常运行
```bash
docker-compose ps
```

所有服务的状态应该显示为 `Up` 或 `healthy`。

### 查看特定服务的日志
```bash
# 查看API网关日志
docker-compose logs -f api-gateway

# 查看前端日志
docker-compose logs -f web-client

# 查看AI服务日志
docker-compose logs -f graph-orchestrator
```

### Redis连接问题
```bash
# 检查Redis是否运行
docker-compose ps redis

# 查看Redis日志
docker-compose logs redis
```

### 重新构建特定服务
```bash
# 重新构建API网关
docker-compose build api-gateway

# 重新构建并启动
docker-compose up -d api-gateway
```

### 清理并重新开始
```bash
# 停止并删除所有容器和卷
docker-compose down -v

# 重新启动
docker-compose up -d --build
```

## 📝 API测试

### 测试搜索功能
```bash
curl "http://localhost:3000/api/search?query=Dune"
```

### 测试健康检查
```bash
curl http://localhost:3000/health
```

### 测试AI智能搜索
```bash
curl -X POST http://localhost:3010/execute \
  -H "Content-Type: application/json" \
  -d '{"query": "Find sci-fi movies from 2020", "userId": "demo-user-1"}'
```

## 🔄 更新服务

当代码有更新时：

```bash
# 1. 停止服务
docker-compose down

# 2. 拉取最新代码
git pull

# 3. 重新构建并启动
docker-compose up -d --build
```

## 💡 提示

- 首次启动可能需要几分钟来构建所有镜像
- 确保 `.env` 文件中的API密钥正确配置
- 使用 `docker-compose logs -f` 可以实时查看所有服务的日志
- 如果遇到端口冲突，可以修改 `docker-compose.yml` 中的端口映射

## 📚 更多信息

查看主README文档了解更多详细信息：[README.md](./README.md)
