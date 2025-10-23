#!/bin/bash

# MCP服务启动脚本
# 启动所有MCP相关服务

echo "🚀 启动MovieHub MCP服务"
echo "========================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查依赖
echo -e "${YELLOW}检查依赖...${NC}"

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js未安装${NC}"
    exit 1
fi

# 检查pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm未安装${NC}"
    exit 1
fi

# 检查环境变量文件
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env文件不存在，使用env.example创建...${NC}"
    if [ -f "env.example" ]; then
        cp env.example .env
        echo -e "${YELLOW}请编辑.env文件并填入API密钥${NC}"
    else
        echo -e "${RED}❌ env.example文件不存在${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ 依赖检查完成${NC}"

# 安装依赖
echo -e "${YELLOW}安装依赖...${NC}"
pnpm install

# 构建共享包
echo -e "${YELLOW}构建共享包...${NC}"
pnpm --filter @moviehub/shared build

# 构建MCP服务
echo -e "${YELLOW}构建MCP服务...${NC}"
pnpm --filter @moviehub/mcp-gateway build
pnpm --filter @moviehub/mcp-provider-tmdb build
pnpm --filter @moviehub/mcp-provider-omdb build
pnpm --filter @moviehub/graph-orchestrator build

echo -e "${GREEN}✓ 构建完成${NC}"

# 启动服务
echo -e "${YELLOW}启动MCP服务...${NC}"
echo ""

# 使用tmux创建多个窗口
# 如果会话已存在，先删除
tmux kill-session -t moviehub-mcp 2>/dev/null || true

# 创建新会话
tmux new-session -d -s moviehub-mcp

# 创建窗口
tmux rename-window -t moviehub-mcp:0 "mcp-gateway"
tmux new-window -t moviehub-mcp -n "mcp-tmdb"
tmux new-window -t moviehub-mcp -n "mcp-omdb"
tmux new-window -t moviehub-mcp -n "graph-orchestrator"

# 启动各个服务
tmux send-keys -t moviehub-mcp:mcp-gateway "pnpm dev:mcp-gateway" Enter
tmux send-keys -t moviehub-mcp:mcp-tmdb "pnpm dev:mcp-tmdb" Enter
tmux send-keys -t moviehub-mcp:mcp-omdb "pnpm dev:mcp-omdb" Enter
tmux send-keys -t moviehub-mcp:graph-orchestrator "pnpm dev:graph-orchestrator" Enter

echo -e "${GREEN}✓ MCP服务已启动${NC}"
echo ""
echo "📋 服务信息:"
echo "  MCP Gateway:        http://localhost:3007"
echo "  TMDB MCP Provider:  http://localhost:3008"
echo "  OMDb MCP Provider:  http://localhost:3009"
echo "  Graph Orchestrator: http://localhost:3010"
echo ""
echo "🔧 管理命令:"
echo "  查看服务: tmux attach -t moviehub-mcp"
echo "  停止服务: tmux kill-session -t moviehub-mcp"
echo "  测试服务: ./scripts/test-mcp.sh"
echo ""
echo -e "${BLUE}等待服务启动完成...${NC}"
sleep 10

# 运行测试
echo -e "${YELLOW}运行MCP服务测试...${NC}"
./scripts/test-mcp.sh

echo ""
echo -e "${GREEN}🎉 MCP服务启动完成！${NC}"
echo "使用 'tmux attach -t moviehub-mcp' 查看服务日志"



