#!/bin/bash

# MovieHub 快速Docker部署脚本
# 一键部署MovieHub微服务架构

set -e

echo "🎬 MovieHub Docker快速部署"
echo "=========================="

# 检查Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose未安装，请先安装Docker Compose"
    exit 1
fi

echo "✅ Docker环境检查通过"

# 检查环境变量
if [ ! -f ".env" ]; then
    echo "⚠️  未找到.env文件，正在创建..."
    cp env.docker.example .env
    echo "📝 请编辑.env文件，填入您的API密钥："
    echo "   - TMDB_API_KEY: https://www.themoviedb.org/settings/api"
    echo "   - OMDB_API_KEY: http://www.omdbapi.com/apikey.aspx"
    echo "   - QWEN_API_KEY: https://dashscope.console.aliyun.com/"
    echo ""
    read -p "按Enter键继续..."
fi

# 构建镜像
echo "🔨 构建Docker镜像..."
docker-compose build

# 启动服务
echo "🚀 启动服务..."
docker-compose up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 15

# 检查服务状态
echo "📊 检查服务状态..."

# 检查API Gateway
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ API Gateway运行正常"
else
    echo "❌ API Gateway启动失败"
fi

# 检查Web Client
if curl -s http://localhost/health > /dev/null 2>&1; then
    echo "✅ Web Client运行正常"
else
    echo "❌ Web Client启动失败"
fi

# 检查Redis
if docker exec moviehub-redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis运行正常"
else
    echo "❌ Redis启动失败"
fi

echo ""
echo "🎉 部署完成！"
echo ""
echo "🌐 访问地址："
echo "   Web前端: http://localhost"
echo "   API Gateway: http://localhost:3000"
echo "   健康检查: http://localhost:3000/health"
echo ""
echo "📋 常用命令："
echo "   查看日志: docker-compose logs -f"
echo "   停止服务: docker-compose down"
echo "   重启服务: docker-compose restart"
echo ""
