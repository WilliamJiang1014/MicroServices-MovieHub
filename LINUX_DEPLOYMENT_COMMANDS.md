# MovieHub Linux部署命令清单

## 🚀 一键部署命令

### 方法一：使用部署脚本（推荐）

```bash
# 下载并运行Linux部署脚本
curl -fsSL https://raw.githubusercontent.com/WilliamJiang1014/MicroServices-MovieHub/main/scripts/linux-deploy.sh | bash
```

### 方法二：手动部署

```bash
# 1. 安装基础环境
sudo apt update && sudo apt install -y curl wget git vim
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pnpm
curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh
sudo usermod -aG docker $USER
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 2. 重新登录以应用Docker权限
newgrp docker

# 3. 克隆项目
git clone https://github.com/WilliamJiang1014/MicroServices-MovieHub.git
cd MicroServices-MovieHub

# 4. 配置环境变量
cp env.docker.example .env
vim .env  # 编辑并填入API密钥

# 5. 部署项目
chmod +x scripts/*.sh
./scripts/quick-deploy.sh

# 6. 验证部署
curl http://localhost:3000/health
curl http://localhost/health
```

## 🔧 环境变量配置

在`.env`文件中配置以下API密钥：

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

## 📋 API密钥申请

1. **TMDB API Key**: https://www.themoviedb.org/settings/api
2. **OMDb API Key**: http://www.omdbapi.com/apikey.aspx
3. **通义千问 API Key**: https://dashscope.console.aliyun.com/

## 🌐 访问地址

- **Web前端**: http://localhost
- **API Gateway**: http://localhost:3000
- **健康检查**: http://localhost:3000/health

## 🔍 常用管理命令

```bash
# 查看服务状态
docker-compose ps

# 查看服务日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 查看特定服务日志
docker-compose logs -f api-gateway

# 进入容器调试
docker-compose exec api-gateway sh

# 清理Docker资源
docker system prune -f
```

## 🛠️ 故障排查

### 端口占用
```bash
sudo netstat -tulpn | grep :3000
sudo kill -9 <PID>
```

### 权限问题
```bash
sudo usermod -aG docker $USER
newgrp docker
chmod +x scripts/*.sh
```

### 网络问题
```bash
ping github.com
ping api.themoviedb.org
sudo ufw allow 3000
sudo ufw allow 80
```

### 内存不足
```bash
free -h
docker stats
docker system prune -f
```

## 📊 系统要求

- **CPU**: 2核心以上
- **内存**: 4GB以上
- **磁盘**: 10GB可用空间
- **操作系统**: Ubuntu 18.04+, CentOS 7+, Debian 9+

## 🎯 部署成功标志

✅ Docker服务运行正常  
✅ API Gateway响应健康检查  
✅ Web前端可以访问  
✅ 所有微服务容器启动成功  

## 📞 技术支持

如果遇到问题，请：

1. 查看详细日志：`docker-compose logs -f`
2. 检查服务状态：`docker-compose ps`
3. 验证环境变量：`docker-compose exec api-gateway env`
4. 参考项目文档：`README.md`、`DOCKER_DEPLOYMENT_GUIDE.md`

---

**快速开始**: 复制上述命令到Linux终端执行即可完成部署！
