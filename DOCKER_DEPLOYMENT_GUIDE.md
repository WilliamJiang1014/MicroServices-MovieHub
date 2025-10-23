# MovieHub Docker部署指南

## 概述

本指南将帮助您使用Docker容器化技术部署MovieHub微服务架构。Docker部署提供了以下优势：

- 🚀 **快速部署**：一键启动所有服务
- 🔒 **环境隔离**：每个服务运行在独立容器中
- 📦 **一致性**：开发、测试、生产环境完全一致
- 🔄 **易于扩展**：支持水平扩展和负载均衡
- 🛠️ **易于维护**：统一的容器管理

## 系统要求

### 硬件要求
- **CPU**: 2核心以上
- **内存**: 4GB以上
- **磁盘**: 10GB可用空间

### 软件要求
- **Docker**: >= 20.10.0
- **Docker Compose**: >= 2.0.0
- **操作系统**: Linux, macOS, Windows

## 快速开始

### 1. 环境准备

```bash
# 检查Docker版本
docker --version
docker-compose --version

# 如果未安装，请参考官方文档：
# https://docs.docker.com/get-docker/
# https://docs.docker.com/compose/install/
```

### 2. 克隆项目

```bash
git clone <repository-url>
cd moviehub
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp env.docker.example .env

# 编辑环境变量文件
nano .env
```

在`.env`文件中填入您的API密钥：

```env
# TMDB API配置
TMDB_API_KEY=your_tmdb_api_key_here

# OMDb API配置
OMDB_API_KEY=your_omdb_api_key_here

# 通义千问API配置
QWEN_API_KEY=your_qwen_api_key_here

# Redis配置
REDIS_URL=redis://redis:6379

# 生产环境配置
NODE_ENV=production
```

### 4. 使用部署脚本（推荐）

```bash
# 运行部署脚本
./scripts/docker-deploy.sh
```

脚本提供以下功能：
- ✅ 环境检查
- 🔧 自动构建镜像
- 🚀 一键启动服务
- 📊 健康检查
- 📋 服务状态显示

### 5. 手动部署

#### 基础服务部署

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

#### 完整服务部署（包含MCP）

```bash
# 构建镜像
docker-compose -f docker-compose.full.yml build

# 启动完整服务
docker-compose -f docker-compose.full.yml up -d

# 查看服务状态
docker-compose -f docker-compose.full.yml ps
```

## 服务架构

### 基础服务

| 服务名称 | 端口 | 容器名 | 功能描述 |
|---------|------|--------|----------|
| API Gateway | 3000 | moviehub-api-gateway | 统一API入口 |
| LLM Service | 3001 | moviehub-llm | AI功能服务 |
| TMDB Provider | 3002 | moviehub-tmdb | TMDB数据源 |
| OMDb Provider | 3003 | moviehub-omdb | OMDb数据源 |
| Aggregation Service | 3004 | moviehub-aggregation | 数据聚合 |
| User Service | 3005 | moviehub-user | 用户管理 |
| TVMaze Provider | 3006 | moviehub-tvmaze | TVMaze数据源 |
| Web Client | 80 | moviehub-web-client | 前端应用 |
| Redis | 6379 | moviehub-redis | 缓存服务 |

### MCP服务（可选）

| 服务名称 | 端口 | 容器名 | 功能描述 |
|---------|------|--------|----------|
| MCP Gateway | 3007 | moviehub-mcp-gateway | MCP服务注册中心 |
| TMDB MCP Provider | 3008 | moviehub-mcp-tmdb | TMDB MCP工具 |
| OMDb MCP Provider | 3009 | moviehub-mcp-omdb | OMDb MCP工具 |
| Graph Orchestrator | 3010 | moviehub-graph-orchestrator | LangGraph工作流 |

## 访问地址

### 基础服务
- **Web前端**: http://localhost
- **API Gateway**: http://localhost:3000
- **健康检查**: http://localhost:3000/health

### MCP服务（如果启用）
- **MCP Gateway**: http://localhost:3007
- **Graph Orchestrator**: http://localhost:3010

## 常用命令

### 服务管理

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 查看服务状态
docker-compose ps

# 查看服务日志
docker-compose logs -f [service-name]
```

### 镜像管理

```bash
# 重新构建镜像
docker-compose build --no-cache

# 拉取最新镜像
docker-compose pull

# 查看镜像
docker images
```

### 数据管理

```bash
# 查看数据卷
docker volume ls

# 备份Redis数据
docker exec moviehub-redis redis-cli BGSAVE

# 清理数据卷
docker-compose down -v
```

## 健康检查

### 自动健康检查

所有服务都配置了健康检查，Docker会自动监控服务状态：

```bash
# 查看健康状态
docker-compose ps

# 查看特定服务健康状态
docker inspect moviehub-api-gateway | grep -A 10 Health
```

### 手动健康检查

```bash
# API Gateway
curl http://localhost:3000/health

# Web Client
curl http://localhost/health

# Redis
docker exec moviehub-redis redis-cli ping

# 所有服务健康检查
curl http://localhost:3000/health | jq
```

## 故障排查

### 常见问题

#### 1. 服务启动失败

```bash
# 查看服务日志
docker-compose logs [service-name]

# 检查端口占用
netstat -tulpn | grep :3000

# 检查环境变量
docker-compose config
```

#### 2. API密钥错误

```bash
# 检查环境变量
docker-compose exec api-gateway env | grep API_KEY

# 重新设置环境变量
docker-compose down
# 编辑.env文件
docker-compose up -d
```

#### 3. 网络连接问题

```bash
# 检查容器网络
docker network ls
docker network inspect moviehub-network

# 测试容器间通信
docker-compose exec api-gateway ping aggregation
```

#### 4. 内存不足

```bash
# 查看资源使用
docker stats

# 限制容器资源
# 在docker-compose.yml中添加：
# deploy:
#   resources:
#     limits:
#       memory: 512M
```

### 调试模式

```bash
# 以调试模式启动
docker-compose -f docker-compose.yml -f docker-compose.debug.yml up

# 进入容器调试
docker-compose exec api-gateway sh
```

## 生产环境部署

### 安全配置

1. **更改默认端口**
```yaml
# 在docker-compose.yml中修改端口映射
ports:
  - "8080:3000"  # 使用非标准端口
```

2. **使用HTTPS**
```yaml
# 添加nginx反向代理
nginx:
  image: nginx:alpine
  ports:
    - "443:443"
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf
    - ./ssl:/etc/nginx/ssl
```

3. **环境变量安全**
```bash
# 使用Docker Secrets
echo "your_api_key" | docker secret create tmdb_api_key -
```

### 性能优化

1. **资源限制**
```yaml
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '0.5'
    reservations:
      memory: 256M
      cpus: '0.25'
```

2. **多实例部署**
```yaml
# 使用Docker Swarm或Kubernetes
deploy:
  replicas: 3
  update_config:
    parallelism: 1
    delay: 10s
```

### 监控和日志

1. **日志管理**
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

2. **监控集成**
```yaml
# 添加Prometheus监控
prometheus:
  image: prom/prometheus
  ports:
    - "9090:9090"
```

## 扩展部署

### Docker Swarm

```bash
# 初始化Swarm
docker swarm init

# 部署服务栈
docker stack deploy -c docker-compose.yml moviehub

# 查看服务
docker service ls
```

### Kubernetes

```bash
# 生成Kubernetes配置
kompose convert -f docker-compose.yml

# 部署到Kubernetes
kubectl apply -f .
```

## 备份和恢复

### 数据备份

```bash
# 备份Redis数据
docker exec moviehub-redis redis-cli BGSAVE
docker cp moviehub-redis:/data/dump.rdb ./backup/

# 备份配置文件
tar -czf config-backup.tar.gz .env docker-compose*.yml
```

### 数据恢复

```bash
# 恢复Redis数据
docker cp ./backup/dump.rdb moviehub-redis:/data/
docker-compose restart redis
```

## 更新和维护

### 服务更新

```bash
# 拉取最新代码
git pull

# 重新构建镜像
docker-compose build --no-cache

# 滚动更新
docker-compose up -d --no-deps api-gateway
```

### 定期维护

```bash
# 清理未使用的镜像
docker image prune -f

# 清理未使用的容器
docker container prune -f

# 清理未使用的网络
docker network prune -f

# 清理未使用的数据卷
docker volume prune -f
```

## 性能调优

### 容器优化

1. **多阶段构建**：减少镜像大小
2. **Alpine Linux**：使用轻量级基础镜像
3. **非root用户**：提高安全性
4. **健康检查**：确保服务可用性

### 网络优化

1. **自定义网络**：隔离服务通信
2. **负载均衡**：分发请求负载
3. **服务发现**：自动服务注册

## 总结

Docker部署为MovieHub提供了：

- ✅ **简化部署**：一键启动所有服务
- ✅ **环境一致性**：开发生产环境统一
- ✅ **易于扩展**：支持水平扩展
- ✅ **资源隔离**：服务间相互独立
- ✅ **易于维护**：统一的管理界面

通过本指南，您可以快速部署和运维MovieHub微服务架构，享受容器化带来的便利和优势。

---

**文档版本**: 1.0.0  
**最后更新**: 2025年1月22日  
**作者**: 姜政言 (2353594)  
**项目**: MovieHub 微服务架构
