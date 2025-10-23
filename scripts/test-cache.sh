#!/bin/bash

# Redis 缓存测试脚本
# 验证缓存是否正常工作

set -e

GATEWAY_URL="${GATEWAY_URL:-http://localhost:3000}"

echo "🧪 MovieHub Cache Testing Script"
echo "=================================="
echo "Gateway URL: $GATEWAY_URL"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试搜索缓存
echo "📝 Test 1: Search Cache"
echo "----------------------"

QUERY="dune"
echo "Searching for: $QUERY"

echo -e "${YELLOW}First request (cache miss expected):${NC}"
time curl -s "$GATEWAY_URL/api/search?query=$QUERY" > /dev/null
echo ""

echo -e "${YELLOW}Second request (cache hit expected):${NC}"
time curl -s "$GATEWAY_URL/api/search?query=$QUERY" > /dev/null
echo ""

# 测试热门搜索
echo "📊 Test 2: Popular Searches"
echo "-------------------------"

# 发送多个搜索请求
for query in "inception" "interstellar" "the matrix" "avatar" "titanic"; do
    curl -s "$GATEWAY_URL/api/search?query=$query" > /dev/null
    echo "✓ Searched: $query"
done
echo ""

# 获取热门搜索
echo "Getting popular searches:"
POPULAR=$(curl -s "$GATEWAY_URL/api/analytics/popular-searches?limit=5")
echo "$POPULAR" | jq '.data' || echo "$POPULAR"
echo ""

# 测试缓存统计
echo "📈 Test 3: Cache Statistics"
echo "-------------------------"
STATS=$(curl -s "$GATEWAY_URL/api/cache/stats")
echo "$STATS" | jq '.' || echo "$STATS"
echo ""

# 测试电影详情缓存
echo "🎬 Test 4: Movie Details Cache"
echo "----------------------------"

# 先搜索获取一个电影ID
MOVIE_ID=$(curl -s "$GATEWAY_URL/api/search?query=dune" | jq -r '.data[0].id' 2>/dev/null || echo "")

if [ -n "$MOVIE_ID" ] && [ "$MOVIE_ID" != "null" ]; then
    echo "Testing movie details for ID: $MOVIE_ID"
    
    echo -e "${YELLOW}First request (cache miss expected):${NC}"
    time curl -s "$GATEWAY_URL/api/movie/$MOVIE_ID" > /dev/null
    echo ""
    
    echo -e "${YELLOW}Second request (cache hit expected):${NC}"
    time curl -s "$GATEWAY_URL/api/movie/$MOVIE_ID" > /dev/null
    echo ""
else
    echo "⚠️  Could not get movie ID for testing"
fi

# 测试缓存清除
echo "🗑️  Test 5: Cache Clearing"
echo "------------------------"

read -p "Do you want to clear the search cache? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    RESULT=$(curl -s -X DELETE "$GATEWAY_URL/api/cache/clear?type=search")
    echo "$RESULT" | jq '.' || echo "$RESULT"
    echo -e "${GREEN}✓ Search cache cleared${NC}"
else
    echo "Skipped cache clearing"
fi
echo ""

echo "✅ All tests completed!"
echo ""
echo "Tips:"
echo "  - Check Redis Commander: http://localhost:8081"
echo "  - View service logs: docker-compose logs -f api-gateway"
echo "  - Monitor Redis: docker exec -it moviehub-redis redis-cli MONITOR"



