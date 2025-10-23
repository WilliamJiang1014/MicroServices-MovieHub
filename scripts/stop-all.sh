#!/bin/bash

# MovieHub 一键停止脚本
# 停止所有相关服务

echo "🛑 正在停止 MovieHub 所有服务..."

# 停止所有相关进程
echo "停止 pnpm 开发服务..."
pkill -f "pnpm.*dev" 2>/dev/null || true

echo "停止 tsx 监听服务..."
pkill -f "tsx.*watch" 2>/dev/null || true

echo "停止 Vite 前端服务..."
pkill -f "vite" 2>/dev/null || true

# 等待进程完全停止
sleep 2

# 检查是否还有残留进程
REMAINING=$(ps aux | grep -E "(pnpm.*dev|tsx.*watch|vite)" | grep -v grep | wc -l)

if [ "$REMAINING" -gt 0 ]; then
    echo "⚠️  发现残留进程，强制停止..."
    pkill -9 -f "pnpm.*dev" 2>/dev/null || true
    pkill -9 -f "tsx.*watch" 2>/dev/null || true
    pkill -9 -f "vite" 2>/dev/null || true
fi

echo "✅ 所有服务已停止"
echo "💡 使用 './scripts/restart-all.sh' 重新启动所有服务"
