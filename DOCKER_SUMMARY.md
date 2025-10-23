# MovieHub Docker部署方案总结

## 🎯 部署方案概述

为MovieHub微服务架构项目创建了完整的Docker容器化部署方案，支持从开发环境到生产环境的一键部署。

## 📁 文件结构

```
moviehub/
├── .dockerignore                    # Docker忽略文件
├── docker-compose.yml               # 基础服务Docker Compose配置
├── docker-compose.full.yml          # 完整服务Docker Compose配置（包含MCP）
├── env.docker.example               # Docker环境变量模板
├── DOCKER_DEPLOYMENT_GUIDE.md       # Docker部署详细指南
├── scripts/
│   ├── docker-deploy.sh             # 完整部署脚本（交互式）
│   └── quick-deploy.sh              # 快速部署脚本
├── k8s/
│   └── moviehub.yaml                # Kubernetes部署配置
└── services/
    ├── api-gateway/Dockerfile       # API网关Dockerfile
    ├── llm-service/Dockerfile       # LLM服务Dockerfile
    ├── provider-tmdb/Dockerfile     # TMDB数据源Dockerfile
    ├── provider-omdb/Dockerfile      # OMDb数据源Dockerfile
    ├── provider-tvmaze/Dockerfile   # TVMaze数据源Dockerfile
    ├── aggregation-service/Dockerfile # 数据聚合服务Dockerfile
    ├── user-service/Dockerfile      # 用户服务Dockerfile
    ├── mcp-gateway/Dockerfile       # MCP网关Dockerfile
    ├── mcp-provider-tmdb/Dockerfile # TMDB MCP Provider Dockerfile
    ├── mcp-provider-omdb/Dockerfile # OMDb MCP Provider Dockerfile
    └── graph-orchestrator/Dockerfile # Graph编排器Dockerfile
└── apps/
    └── web-client/
        ├── Dockerfile               # Web前端Dockerfile
        └── nginx.conf               # Nginx配置文件
```

## 🚀 快速开始

### 1. 环境准备
```bash
# 确保Docker和Docker Compose已安装
docker --version
docker-compose --version
```

### 2. 配置环境变量
```bash
# 复制环境变量模板
cp env.docker.example .env

# 编辑.env文件，填入API密钥
nano .env
```

### 3. 一键部署
```bash
# 使用快速部署脚本
./scripts/quick-deploy.sh

# 或使用完整部署脚本
./scripts/docker-deploy.sh
```

## 🏗️ 架构设计

### 多阶段构建优化
- **基础阶段**: 安装依赖和构建工具
- **构建阶段**: 编译TypeScript代码
- **生产阶段**: 仅包含运行时依赖，减小镜像大小

### 服务编排
- **Redis**: 缓存服务，支持数据持久化
- **API Gateway**: 统一入口，负载均衡
- **数据源服务**: TMDB、OMDb、TVMaze独立容器
- **聚合服务**: 数据融合和去重
- **AI服务**: LLM和MCP功能
- **前端服务**: Nginx提供静态文件服务

### 网络设计
- **自定义网络**: `moviehub-network`
- **服务发现**: 容器间通过服务名通信
- **端口映射**: 外部访问通过宿主机端口

## 📊 服务端口映射

| 服务 | 容器端口 | 宿主机端口 | 访问地址 |
|------|----------|------------|----------|
| Web Client | 80 | 80 | http://localhost |
| API Gateway | 3000 | 3000 | http://localhost:3000 |
| LLM Service | 3001 | 3001 | http://localhost:3001 |
| TMDB Provider | 3002 | 3002 | http://localhost:3002 |
| OMDb Provider | 3003 | 3003 | http://localhost:3003 |
| Aggregation Service | 3004 | 3004 | http://localhost:3004 |
| User Service | 3005 | 3005 | http://localhost:3005 |
| TVMaze Provider | 3006 | 3006 | http://localhost:3006 |
| MCP Gateway | 3007 | 3007 | http://localhost:3007 |
| TMDB MCP Provider | 3008 | 3008 | http://localhost:3008 |
| OMDb MCP Provider | 3009 | 3009 | http://localhost:3009 |
| Graph Orchestrator | 3010 | 3010 | http://localhost:3010 |
| Redis | 6379 | 6379 | localhost:6379 |

## 🔧 部署选项

### 1. 基础服务部署
```bash
docker-compose up -d
```
包含：API Gateway、数据源服务、聚合服务、用户服务、Web前端、Redis

### 2. 完整服务部署
```bash
docker-compose -f docker-compose.full.yml up -d
```
包含：基础服务 + MCP服务 + Graph编排器

### 3. Kubernetes部署
```bash
kubectl apply -f k8s/moviehub.yaml
```
适用于生产环境的Kubernetes集群部署

## 🛡️ 安全特性

### 容器安全
- **非root用户**: 所有容器以非特权用户运行
- **最小权限**: 仅安装必要的运行时依赖
- **镜像扫描**: 使用Alpine Linux基础镜像

### 网络安全
- **服务隔离**: 自定义网络隔离服务通信
- **端口控制**: 仅暴露必要的端口
- **环境变量**: 敏感信息通过环境变量传递

### 数据安全
- **数据卷**: Redis数据持久化存储
- **备份策略**: 支持数据备份和恢复
- **访问控制**: 容器间通信限制

## 📈 性能优化

### 镜像优化
- **多阶段构建**: 减小最终镜像大小
- **Alpine Linux**: 轻量级基础镜像
- **依赖优化**: 仅安装生产依赖

### 资源管理
- **健康检查**: 自动监控服务状态
- **重启策略**: 服务异常自动重启
- **资源限制**: 支持CPU和内存限制

### 缓存策略
- **Redis缓存**: 提高数据访问性能
- **静态资源**: Nginx缓存静态文件
- **构建缓存**: Docker层缓存优化

## 🔍 监控和运维

### 健康检查
```bash
# 检查所有服务状态
docker-compose ps

# 查看服务日志
docker-compose logs -f

# 手动健康检查
curl http://localhost:3000/health
```

### 日志管理
- **统一日志**: 所有服务日志统一收集
- **日志轮转**: 防止日志文件过大
- **实时监控**: 支持实时日志查看

### 故障排查
- **服务状态**: 快速定位问题服务
- **日志分析**: 详细的错误日志
- **网络诊断**: 容器间通信检查

## 🚀 扩展性

### 水平扩展
```bash
# 扩展API Gateway实例
docker-compose up -d --scale api-gateway=3
```

### 负载均衡
- **Nginx**: 前端负载均衡
- **Docker Swarm**: 容器编排
- **Kubernetes**: 生产级编排

### 微服务扩展
- **新服务**: 轻松添加新的微服务
- **服务发现**: 自动服务注册和发现
- **配置管理**: 统一配置管理

## 📋 最佳实践

### 开发环境
1. 使用`docker-compose.yml`进行本地开发
2. 启用热重载和调试模式
3. 使用开发环境的环境变量

### 测试环境
1. 使用与生产环境相同的配置
2. 进行完整的集成测试
3. 验证所有服务健康状态

### 生产环境
1. 使用`docker-compose.full.yml`部署完整服务
2. 配置资源限制和监控
3. 实施备份和恢复策略

## 🎯 总结

MovieHub Docker部署方案提供了：

✅ **完整的容器化**: 所有服务都容器化部署  
✅ **一键部署**: 支持快速部署和启动  
✅ **环境一致性**: 开发、测试、生产环境统一  
✅ **易于扩展**: 支持水平扩展和负载均衡  
✅ **安全可靠**: 多层安全防护和健康检查  
✅ **易于维护**: 统一的日志和监控管理  
✅ **生产就绪**: 支持Kubernetes等生产级部署  

通过这套Docker部署方案，您可以：
- 🚀 快速部署MovieHub微服务架构
- 🔧 轻松管理和维护各个服务
- 📈 根据需要扩展服务规模
- 🛡️ 确保服务的安全和可靠性
- 🔍 实时监控服务状态和性能

---

**文档版本**: 1.0.0  
**最后更新**: 2025年1月22日  
**作者**: 姜政言 (2353594)  
**项目**: MovieHub 微服务架构
