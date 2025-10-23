# 🚀 MovieHub Docker 一键启动指南

## 📋 快速开始

### 1. 克隆项目
```bash
git clone https://github.com/WilliamJiang1014/MicroServices-MovieHub.git
cd MicroServices-MovieHub
```

### 2. 配置API密钥（可选）
```bash
# 复制环境变量模板
cp env.docker.example .env

# 编辑.env文件，填入您的API密钥
# TMDB_API_KEY=your_tmdb_api_key_here
# OMDB_API_KEY=your_omdb_api_key_here  
# QWEN_API_KEY=your_qwen_api_key_here
```

### 3. 一键启动
```bash
docker-compose up -d
```

### 4. 访问应用
- **前端界面**: http://localhost
- **API网关**: http://localhost:3000
- **健康检查**: http://localhost:3000/health

## 🎯 就这么简单！

不需要任何脚本，不需要复杂配置，Docker Compose会自动：
- 构建所有微服务镜像
- 启动Redis缓存
- 配置服务间网络通信
- 设置健康检查和依赖关系
- 确保所有服务正常运行

## 🔧 管理命令

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 重新构建并启动
docker-compose up -d --build
```

## 📊 服务架构

- **API Gateway** (3000): 统一API入口
- **LLM Service** (3001): AI摘要服务
- **TMDB Provider** (3002): TMDB数据源
- **OMDb Provider** (3003): OMDb数据源
- **Aggregation** (3004): 数据聚合服务
- **User Service** (3005): 用户管理
- **TVMaze Provider** (3006): TVMaze数据源
- **MCP Gateway** (3007): MCP协议网关
- **Web Client** (80): 前端界面
- **Redis** (6379): 缓存服务

## 🎉 享受您的微服务架构！

所有服务都已配置好健康检查和依赖关系，确保启动顺序正确。
