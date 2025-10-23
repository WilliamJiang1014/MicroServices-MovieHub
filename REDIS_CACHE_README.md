# Redis 缓存使用说明

## 📋 快速启动

### 前置要求

- ✅ Redis 已安装并运行
- ✅ Node.js 18+
- ✅ pnpm

### 启动步骤

```bash
# 1. 确保 Redis 正在运行
redis-cli ping
# 应返回: PONG

# 如果未运行，启动 Redis
brew services start redis

# 2. 进入项目目录
cd /Users/jiang/Desktop/微服务架构/moviehub

# 3. 一键启动（推荐）
./scripts/start-with-cache.sh

# 或手动启动
pnpm install
pnpm --filter @moviehub/shared build
pnpm dev
```

### 测试缓存

```bash
# 运行自动化测试
./scripts/test-cache.sh

# 或手动测试
curl "http://localhost:3000/api/search?query=dune"
```

## 🎯 缓存功能

### 已集成缓存的服务

- **API Gateway** - 搜索结果缓存 (30分钟) + 电影详情缓存 (2小时)
- **Aggregation Service** - 聚合结果缓存
- **LLM Service** - AI摘要缓存 (24小时)
- **TMDB Provider** - API响应缓存

### 缓存管理 API

```bash
# 查看热门搜索
curl "http://localhost:3000/api/analytics/popular-searches"

# 查看缓存统计
curl "http://localhost:3000/api/cache/stats"

# 清除搜索缓存
curl -X DELETE "http://localhost:3000/api/cache/clear?type=search"

# 清除所有缓存
curl -X DELETE "http://localhost:3000/api/cache/clear?type=all"
```

## 📊 性能提升

| 操作 | 无缓存 | 有缓存 | 提升 |
|-----|--------|--------|------|
| 搜索 | 2-3秒 | ~50ms | **50倍** |
| 详情 | 1-2秒 | ~30ms | **50倍** |
| LLM摘要 | 5-10秒 | ~40ms | **200倍** |

## 🔧 Redis 管理

### 常用命令

```bash
# 查看 Redis 状态
brew services list | grep redis

# 启动/停止/重启
brew services start redis
brew services stop redis
brew services restart redis

# 进入 Redis CLI
redis-cli

# 在 CLI 中查看缓存
> KEYS moviehub:*
> GET "moviehub:search:dune:any"
> TTL "moviehub:search:dune:any"
> FLUSHALL  # 清空所有缓存（慎用）
```

### 监控

```bash
# 实时监控所有 Redis 操作
redis-cli MONITOR

# 查看内存使用
redis-cli INFO memory
```

## 🐛 故障排查

### Redis 未运行

```bash
# 检查状态
brew services list | grep redis

# 启动 Redis
brew services start redis

# 测试连接
redis-cli ping
```

### 缓存未生效

```bash
# 查看服务日志，应该看到：
# [RedisClient] Redis client connected and ready

# 检查 Redis 中的键
redis-cli KEYS "moviehub:*"
```

### 清空缓存重新测试

```bash
# 方法1: 通过 API
curl -X DELETE "http://localhost:3000/api/cache/clear?type=all"

# 方法2: Redis CLI
redis-cli FLUSHALL
```

## 📝 环境变量

项目会自动连接本地 Redis，默认配置：

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # 留空
```

无需修改！代码已自动配置。

## 🎓 缓存策略

| 数据类型 | TTL | 键前缀 |
|---------|-----|--------|
| 搜索结果 | 30分钟 | `moviehub:gateway:search:*` |
| 电影详情 | 2小时 | `moviehub:gateway:movie:*` |
| 聚合结果 | 30分钟 | `moviehub:aggregation:*` |
| LLM摘要 | 24小时 | `moviehub:llm:*` |
| Provider响应 | 1-2小时 | `moviehub:provider:*` |

## 📚 项目文件

```
moviehub/
├── packages/shared/src/utils/
│   ├── redis-client.ts      # Redis 客户端
│   └── cache-manager.ts     # 缓存管理器
├── scripts/
│   ├── start-with-cache.sh  # 启动脚本
│   └── test-cache.sh        # 测试脚本
└── services/
    ├── api-gateway/         # ✅ 已集成缓存
    ├── aggregation-service/ # ✅ 已集成缓存
    ├── llm-service/         # ✅ 已集成缓存
    └── provider-tmdb/       # ✅ 已集成缓存
```

## ✅ 完整启动流程

```bash
# 1. 确保 Redis 运行
brew services start redis

# 2. 启动项目
cd /Users/jiang/Desktop/微服务架构/moviehub
./scripts/start-with-cache.sh

# 3. 测试
./scripts/test-cache.sh

# 完成！访问 http://localhost:3000
```

---

**需要帮助？**
- Redis 连接问题：运行 `redis-cli ping`
- 缓存未生效：运行 `redis-cli KEYS "moviehub:*"`
- 性能测试：运行 `./scripts/test-cache.sh`

