#!/bin/bash

# MovieHub 一键重启脚本
# 自动停止所有服务并重新启动

echo "🔄 正在重启 MovieHub 服务..."

# 停止Docker容器
echo "🐳 停止Docker容器..."
docker-compose down 2>/dev/null || true

# 停止所有相关进程
echo "🛑 停止所有服务..."
pkill -f "pnpm.*dev" 2>/dev/null || true
pkill -f "tsx.*watch" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# 强制释放端口
echo "🔓 释放端口..."
lsof -ti:3000,3001,3002,3003,3004,3005,3006,3007,3008,3009,3010 | xargs kill -9 2>/dev/null || true

# 等待进程完全停止
sleep 3

# 启动传统服务
echo "🚀 启动传统微服务..."
./scripts/start-with-cache.sh &
TRADITIONAL_PID=$!

# 等待传统服务启动
sleep 5

# 启动MCP服务
echo "🤖 启动MCP服务..."
./scripts/start-mcp.sh &
MCP_PID=$!

# 等待MCP服务启动
sleep 3

# 验证服务状态
echo "✅ 验证服务状态..."
echo "传统服务健康检查:"
curl -s http://localhost:3000/health | jq 2>/dev/null || echo "传统服务启动中..."

echo -e "\nMCP服务状态:"
curl -s http://localhost:3007/servers | jq 2>/dev/null || echo "MCP服务启动中..."

echo -e "\n🎉 服务重启完成！"
echo "📱 前端地址: http://localhost:5173"
echo "🔗 API网关: http://localhost:3000"
echo "🤖 MCP服务: http://localhost:3007"
