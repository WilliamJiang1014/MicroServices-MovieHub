#!/bin/bash

# MovieHub 完全停止脚本
# 停止所有Docker容器和本地进程

echo "🛑 正在停止所有 MovieHub 服务..."

# 停止Docker容器
echo "🐳 停止Docker容器..."
docker-compose down 2>/dev/null || true

# 停止所有相关进程
echo "🛑 停止本地进程..."
pkill -f "pnpm.*dev" 2>/dev/null || true
pkill -f "tsx.*watch" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
pkill -f "concurrently" 2>/dev/null || true

# 强制释放端口
echo "🔓 释放端口..."
lsof -ti:3000,3001,3002,3003,3004,3005,3006,3007,3008,3009,3010,5173 | xargs kill -9 2>/dev/null || true

# 停止tmux会话
echo "🖥️ 停止tmux会话..."
tmux kill-session -t moviehub-mcp 2>/dev/null || true

# 等待进程完全停止
sleep 2

echo "✅ 所有服务已停止"
echo ""
echo "💡 提示："
echo "  - 启动Docker: docker-compose up -d"
echo "  - 启动本地开发: ./scripts/start-with-cache.sh"
echo "  - 启动MCP服务: ./scripts/start-mcp.sh"
echo "  - 重启所有服务: ./scripts/restart-all.sh"