#!/bin/bash

# MovieHub 环境变量配置脚本
# 使用提供的API密钥自动配置所有服务

echo "开始配置MovieHub环境变量..."

# API密钥
TMDB_KEY="24c39bb14fe69df0f83872167d4078f2"
OMDB_KEY="1cfffc20"
QWEN_KEY="sk-9bde3d29354c43f6816159e12cce0e5b"

# 创建服务目录（如果不存在）
mkdir -p services/api-gateway
mkdir -p services/llm-service
mkdir -p services/provider-tmdb
mkdir -p services/provider-omdb
mkdir -p services/provider-tvmaze
mkdir -p services/aggregation-service
mkdir -p services/user-service

# API Gateway
cat > services/api-gateway/.env << EOF
PORT=3000
AGGREGATION_URL=http://localhost:3004
LLM_URL=http://localhost:3001
USER_URL=http://localhost:3005
TMDB_URL=http://localhost:3002
OMDB_URL=http://localhost:3003
TVMAZE_URL=http://localhost:3006
NODE_ENV=development
EOF
echo "✓ API Gateway (.env 已创建)"

# LLM Service
cat > services/llm-service/.env << EOF
PORT=3001
QWEN_API_KEY=$QWEN_KEY
QWEN_API_URL=https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation
NODE_ENV=development
EOF
echo "✓ LLM Service (.env 已创建)"

# TMDB Provider
cat > services/provider-tmdb/.env << EOF
PORT=3002
TMDB_API_KEY=$TMDB_KEY
NODE_ENV=development
EOF
echo "✓ TMDB Provider (.env 已创建)"

# OMDb Provider
cat > services/provider-omdb/.env << EOF
PORT=3003
OMDB_API_KEY=$OMDB_KEY
NODE_ENV=development
EOF
echo "✓ OMDb Provider (.env 已创建)"

# TVMaze Provider (不需要API Key)
cat > services/provider-tvmaze/.env << EOF
PORT=3006
NODE_ENV=development
EOF
echo "✓ TVMaze Provider (.env 已创建)"

# Aggregation Service
cat > services/aggregation-service/.env << EOF
PORT=3004
TMDB_PROVIDER_URL=http://localhost:3002
OMDB_PROVIDER_URL=http://localhost:3003
TVMAZE_PROVIDER_URL=http://localhost:3006
NODE_ENV=development
EOF
echo "✓ Aggregation Service (.env 已创建)"

# User Service
cat > services/user-service/.env << EOF
PORT=3005
NODE_ENV=development
EOF
echo "✓ User Service (.env 已创建)"

echo ""
echo "========================================"
echo "所有环境变量配置完成！"
echo "========================================"
echo ""
echo "下一步："
echo "1. 安装依赖: pnpm install"
echo "2. 构建共享包: cd packages/shared && pnpm build && cd ../.."
echo "3. 启动服务: ./scripts/start-all.sh 或分别启动各服务"
echo ""

