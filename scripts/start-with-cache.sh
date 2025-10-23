#!/bin/bash

# MovieHub 启动脚本
# 用于本地开发环境快速启动所有服务

set -e

echo "🎬 MovieHub Startup Script"
echo "=========================="
echo ""

# 检查 pnpm 是否安装
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Please install it first:"
    echo "   npm install -g pnpm"
    exit 1
fi

# 检查 Redis 是否运行
echo "🔍 Checking Redis..."
if redis-cli ping &> /dev/null; then
    echo "✓ Redis is running"
else
    echo "❌ Redis is not running!"
    echo "Please start Redis first:"
    echo "  brew services start redis"
    echo ""
    exit 1
fi
echo ""

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "⚠️  .env file not found"
    if [ -f env.example ]; then
        echo "📝 Creating .env from env.example..."
        cp env.example .env
        echo "⚠️  Please edit .env and add your API keys"
        echo ""
        read -p "Press Enter after editing .env file..." 
    else
        echo "❌ env.example not found!"
        exit 1
    fi
fi

# 安装依赖
echo "📦 Installing dependencies..."
pnpm install
echo ""

# 构建 shared 包
echo "🔨 Building shared package..."
pnpm --filter @moviehub/shared build
echo ""

# 启动所有服务
echo "🚀 Starting all services..."
echo ""
echo "Services will start on the following ports:"
echo "  - API Gateway:        http://localhost:3000"
echo "  - LLM Service:        http://localhost:3001"
echo "  - TMDB Provider:      http://localhost:3002"
echo "  - OMDb Provider:      http://localhost:3003"
echo "  - Aggregation:        http://localhost:3004"
echo "  - User Service:       http://localhost:3005"
echo "  - TVMaze Provider:    http://localhost:3006"
echo "  - Web Client:         http://localhost:5173"
echo "  - Redis:              localhost:6379"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

pnpm dev

