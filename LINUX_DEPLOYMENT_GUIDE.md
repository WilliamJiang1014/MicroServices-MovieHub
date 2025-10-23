# MovieHub Linux部署指南

## 🐧 Linux系统部署完整指南

本指南将帮助您在Linux系统上成功克隆、配置和部署MovieHub微服务架构项目。

## 📋 系统要求

### 硬件要求
- **CPU**: 2核心以上
- **内存**: 4GB以上
- **磁盘**: 10GB可用空间
- **网络**: 稳定的互联网连接

### 软件要求
- **操作系统**: Ubuntu 18.04+, CentOS 7+, Debian 9+
- **Node.js**: >= 18.0.0
- **pnpm**: >= 8.0.0
- **Docker**: >= 20.10.0
- **Docker Compose**: >= 2.0.0
- **Git**: >= 2.0.0

## 🚀 快速部署（推荐）

### 1. 系统环境准备

```bash
# 更新系统包
sudo apt update && sudo apt upgrade -y

# 安装基础工具
sudo apt install -y curl wget git vim

# 安装Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装pnpm
npm install -g pnpm

# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 重新登录以应用Docker组权限
# 或者运行: newgrp docker
```

### 2. 克隆项目

```bash
# 克隆项目
git clone https://github.com/WilliamJiang1014/MicroServices-MovieHub.git
cd MicroServices-MovieHub

# 检查项目结构
ls -la
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp env.docker.example .env

# 编辑环境变量文件
vim .env
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

### 4. Docker部署（推荐）

```bash
# 给脚本添加执行权限
chmod +x scripts/*.sh

# 使用快速部署脚本
./scripts/quick-deploy.sh
```

### 5. 验证部署

```bash
# 检查服务状态
docker-compose ps

# 检查API Gateway健康状态
curl http://localhost:3000/health

# 检查Web前端
curl http://localhost/health

# 查看服务日志
docker-compose logs -f
```

## 🔧 手动部署步骤

如果快速部署遇到问题，可以按照以下步骤手动部署：

### 1. 安装依赖

```bash
# 安装项目依赖
pnpm install

# 构建共享包
cd packages/shared
pnpm build
cd ../..
```

### 2. 配置各服务环境变量

```bash
# 为每个服务创建.env文件
./configure-env.sh
```

### 3. 启动服务

#### 方式一：使用Docker Compose

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看服务状态
docker-compose ps
```

#### 方式二：本地开发模式

```bash
# 启动所有服务
pnpm dev

# 或分别启动各个服务
pnpm dev:gateway &
pnpm dev:llm &
pnpm dev:tmdb &
pnpm dev:omdb &
pnpm dev:tvmaze &
pnpm dev:aggregation &
pnpm dev:user &
pnpm dev:web &
```

## 🌐 访问应用

部署成功后，您可以通过以下地址访问：

- **Web前端**: http://localhost 或 http://your-server-ip
- **API Gateway**: http://localhost:3000
- **健康检查**: http://localhost:3000/health
- **MCP Gateway**: http://localhost:3007 (如果启用MCP服务)

## 🔍 故障排查

### 常见问题及解决方案

#### 1. 端口占用问题

```bash
# 检查端口占用
sudo netstat -tulpn | grep :3000

# 杀死占用进程
sudo kill -9 <PID>

# 或更改端口配置
vim docker-compose.yml
```

#### 2. 权限问题

```bash
# 修复Docker权限
sudo usermod -aG docker $USER
newgrp docker

# 修复脚本权限
chmod +x scripts/*.sh
```

#### 3. 网络连接问题

```bash
# 检查网络连接
ping github.com
ping api.themoviedb.org

# 检查防火墙
sudo ufw status
sudo ufw allow 3000
sudo ufw allow 80
```

#### 4. 内存不足

```bash
# 检查内存使用
free -h
docker stats

# 清理Docker资源
docker system prune -f
```

#### 5. API密钥问题

```bash
# 检查环境变量
docker-compose exec api-gateway env | grep API_KEY

# 重新设置环境变量
docker-compose down
vim .env
docker-compose up -d
```

### 调试模式

```bash
# 查看详细日志
docker-compose logs -f [service-name]

# 进入容器调试
docker-compose exec api-gateway sh

# 检查服务健康状态
curl -v http://localhost:3000/health
```

## 📊 监控和维护

### 服务监控

```bash
# 查看服务状态
docker-compose ps

# 查看资源使用
docker stats

# 查看服务日志
docker-compose logs -f
```

### 日志管理

```bash
# 查看特定服务日志
docker-compose logs -f api-gateway
docker-compose logs -f llm
docker-compose logs -f redis

# 清理旧日志
docker system prune -f
```

### 数据备份

```bash
# 备份Redis数据
docker exec moviehub-redis redis-cli BGSAVE
docker cp moviehub-redis:/data/dump.rdb ./backup/

# 备份配置文件
tar -czf config-backup.tar.gz .env docker-compose*.yml
```

## 🔄 更新和维护

### 更新项目

```bash
# 拉取最新代码
git pull origin main

# 重新构建镜像
docker-compose build --no-cache

# 重启服务
docker-compose up -d
```

### 服务管理

```bash
# 停止所有服务
docker-compose down

# 重启特定服务
docker-compose restart api-gateway

# 查看服务状态
docker-compose ps
```

## 🛡️ 安全配置

### 防火墙配置

```bash
# Ubuntu/Debian
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 3000

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

### SSL/HTTPS配置（可选）

```bash
# 使用Let's Encrypt
sudo apt install certbot
sudo certbot --nginx -d your-domain.com
```

## 📈 性能优化

### 系统优化

```bash
# 增加文件描述符限制
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# 优化内核参数
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Docker优化

```bash
# 清理未使用的资源
docker system prune -f

# 限制容器资源使用
# 在docker-compose.yml中添加：
# deploy:
#   resources:
#     limits:
#       memory: 512M
#       cpus: '0.5'
```

## 🎯 生产环境部署

### 使用Docker Swarm

```bash
# 初始化Swarm
docker swarm init

# 部署服务栈
docker stack deploy -c docker-compose.yml moviehub

# 查看服务
docker service ls
```

### 使用Kubernetes

```bash
# 应用Kubernetes配置
kubectl apply -f k8s/moviehub.yaml

# 查看Pod状态
kubectl get pods -n moviehub

# 查看服务
kubectl get services -n moviehub
```

## 📞 技术支持

### 获取帮助

1. **查看项目文档**：
   - README.md：项目概述
   - DOCKER_DEPLOYMENT_GUIDE.md：Docker部署指南
   - QUICK_REFERENCE.md：快速参考

2. **检查日志**：
   ```bash
   docker-compose logs -f
   ```

3. **验证配置**：
   ```bash
   docker-compose config
   ```

### 常用命令速查

```bash
# 项目克隆
git clone https://github.com/WilliamJiang1014/MicroServices-MovieHub.git

# 快速部署
./scripts/quick-deploy.sh

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 清理资源
docker system prune -f
```

## 🎉 部署成功

部署成功后，您将拥有：

- ✅ **完整的微服务架构**：11个独立服务
- ✅ **容器化部署**：Docker + Docker Compose
- ✅ **AI增强功能**：智能搜索和推荐
- ✅ **数据可视化**：多维度评分展示
- ✅ **完整的API**：RESTful API接口
- ✅ **Web前端**：现代化的用户界面

恭喜您成功部署了MovieHub微服务架构项目！

---

**文档版本**: 1.0.0  
**最后更新**: 2025年1月22日  
**作者**: 姜政言 (2353594)  
**项目**: MovieHub 微服务架构
