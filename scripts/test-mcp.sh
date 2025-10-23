#!/bin/bash

# MCP服务测试脚本
# 测试MCP Gateway和各个Provider的集成

echo "🎬 MovieHub MCP服务测试脚本"
echo "================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试函数
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    echo -n "测试 $name... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✓ 通过${NC}"
        return 0
    else
        echo -e "${RED}✗ 失败 (HTTP $response)${NC}"
        return 1
    fi
}

test_json_endpoint() {
    local name="$1"
    local url="$2"
    local expected_field="$3"
    
    echo -n "测试 $name... "
    
    response=$(curl -s "$url")
    
    if echo "$response" | jq -e ".$expected_field" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 通过${NC}"
        return 0
    else
        echo -e "${RED}✗ 失败${NC}"
        echo "响应: $response"
        return 1
    fi
}

# 等待服务启动
echo -e "${YELLOW}等待服务启动...${NC}"
sleep 5

echo ""
echo "🔍 健康检查测试"
echo "----------------"

# 测试MCP Gateway
test_endpoint "MCP Gateway" "http://localhost:3007/health"

# 测试TMDB MCP Provider
test_endpoint "TMDB MCP Provider" "http://localhost:3008/health"

# 测试OMDb MCP Provider
test_endpoint "OMDb MCP Provider" "http://localhost:3009/health"

# 测试Graph Orchestrator
test_endpoint "Graph Orchestrator" "http://localhost:3010/health"

echo ""
echo "🛠️ 工具发现测试"
echo "----------------"

# 测试工具列表
test_json_endpoint "MCP Gateway工具列表" "http://localhost:3007/tools" "tools"

# 测试服务器列表
test_json_endpoint "MCP Gateway服务器列表" "http://localhost:3007/servers" "servers"

echo ""
echo "🎯 工具调用测试"
echo "----------------"

# 测试TMDB搜索
echo -n "测试TMDB电影搜索... "
tmdb_result=$(curl -s -X POST "http://localhost:3007/call-tool" \
    -H "Content-Type: application/json" \
    -d '{"toolName": "tmdb-provider.search_movies", "args": {"query": "Dune", "year": 2021}}')

if echo "$tmdb_result" | jq -e ".success" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 通过${NC}"
    echo "  找到 $(echo "$tmdb_result" | jq '.result.result.results | length') 部电影"
else
    echo -e "${RED}✗ 失败${NC}"
    echo "  错误: $(echo "$tmdb_result" | jq -r '.error // "未知错误"')"
fi

# 测试OMDb搜索
echo -n "测试OMDb电影搜索... "
omdb_result=$(curl -s -X POST "http://localhost:3007/call-tool" \
    -H "Content-Type: application/json" \
    -d '{"toolName": "omdb-provider.search_movies", "args": {"query": "Dune"}}')

if echo "$omdb_result" | jq -e ".success" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 通过${NC}"
    echo "  找到 $(echo "$omdb_result" | jq '.result.result.results | length') 部电影"
else
    echo -e "${RED}✗ 失败${NC}"
    echo "  错误: $(echo "$omdb_result" | jq -r '.error // "未知错误"')"
fi

echo ""
echo "🔄 工作流测试"
echo "----------------"

# 测试Graph Orchestrator工作流
echo -n "测试电影搜索工作流... "
workflow_result=$(curl -s -X POST "http://localhost:3010/execute" \
    -H "Content-Type: application/json" \
    -d '{"query": "帮我找《Dune》并给出评分对比"}')

if echo "$workflow_result" | jq -e ".success" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 通过${NC}"
    echo "  意图: $(echo "$workflow_result" | jq -r '.result.intent.type')"
    echo "  执行步骤: $(echo "$workflow_result" | jq '.result.executionTrace | length')"
    echo "  总耗时: $(echo "$workflow_result" | jq -r '.result.totalDuration')ms"
else
    echo -e "${RED}✗ 失败${NC}"
    echo "  错误: $(echo "$workflow_result" | jq -r '.error // "未知错误"')"
fi

echo ""
echo "📊 测试总结"
echo "----------------"

# 统计测试结果
total_tests=8
passed_tests=0

# 重新运行关键测试并统计
if curl -s "http://localhost:3007/health" | jq -e ".status" > /dev/null 2>&1; then
    ((passed_tests++))
fi

if curl -s "http://localhost:3008/health" | jq -e ".status" > /dev/null 2>&1; then
    ((passed_tests++))
fi

if curl -s "http://localhost:3009/health" | jq -e ".status" > /dev/null 2>&1; then
    ((passed_tests++))
fi

if curl -s "http://localhost:3010/health" | jq -e ".status" > /dev/null 2>&1; then
    ((passed_tests++))
fi

if curl -s "http://localhost:3007/tools" | jq -e ".tools" > /dev/null 2>&1; then
    ((passed_tests++))
fi

if curl -s "http://localhost:3007/servers" | jq -e ".servers" > /dev/null 2>&1; then
    ((passed_tests++))
fi

# 工具调用测试
if curl -s -X POST "http://localhost:3007/call-tool" \
    -H "Content-Type: application/json" \
    -d '{"toolName": "tmdb-provider.search_movies", "args": {"query": "test"}}' | \
    jq -e ".success" > /dev/null 2>&1; then
    ((passed_tests++))
fi

# 工作流测试
if curl -s -X POST "http://localhost:3010/execute" \
    -H "Content-Type: application/json" \
    -d '{"query": "test"}' | \
    jq -e ".success" > /dev/null 2>&1; then
    ((passed_tests++))
fi

echo "总测试数: $total_tests"
echo "通过测试: $passed_tests"

if [ $passed_tests -eq $total_tests ]; then
    echo -e "${GREEN}🎉 所有测试通过！MCP服务运行正常${NC}"
    exit 0
else
    echo -e "${RED}❌ 部分测试失败，请检查服务状态${NC}"
    exit 1
fi

