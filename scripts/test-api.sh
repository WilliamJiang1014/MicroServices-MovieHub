#!/bin/bash

# MovieHub API 测试脚本

API_BASE="http://localhost:3000"
USER_ID="demo-user-1"

# 颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║   MovieHub API 测试                   ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}\n"

# 检查jq是否安装
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}提示: 安装 jq 以获得更好的JSON格式化输出${NC}"
    echo "macOS: brew install jq"
    echo "Ubuntu/Debian: sudo apt-get install jq"
    echo ""
    JQ_INSTALLED=false
else
    JQ_INSTALLED=true
fi

# 格式化JSON输出
format_json() {
    if [ "$JQ_INSTALLED" = true ]; then
        echo "$1" | jq .
    else
        echo "$1"
    fi
}

# 1. 健康检查
echo -e "${BLUE}1. 健康检查${NC}"
response=$(curl -s "$API_BASE/health")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ API Gateway 正在运行${NC}"
    format_json "$response"
else
    echo -e "${RED}✗ API Gateway 未响应${NC}"
    exit 1
fi

# 2. 搜索电影
echo -e "\n${BLUE}2. 搜索电影 (查询: Dune)${NC}"
response=$(curl -s "$API_BASE/api/search?query=Dune&limit=3")
if echo "$response" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ 搜索成功${NC}"
    if [ "$JQ_INSTALLED" = true ]; then
        echo "$response" | jq '{
            success: .success,
            totalResults: .totalResults,
            movies: .data | map({
                title: .title,
                year: .year,
                rating: .aggregatedRating.score,
                sources: .sources
            })
        }'
    else
        echo "$response"
    fi
else
    echo -e "${RED}✗ 搜索失败${NC}"
    echo "$response"
fi

# 获取第一个电影ID
if [ "$JQ_INSTALLED" = true ]; then
    MOVIE_ID=$(echo "$response" | jq -r '.data[0].id')
else
    MOVIE_ID="tmdb-438631"  # Dune的TMDB ID作为后备
fi

echo -e "\n${YELLOW}使用电影ID: $MOVIE_ID${NC}"

# 3. 获取电影详情
echo -e "\n${BLUE}3. 获取电影详情${NC}"
response=$(curl -s "$API_BASE/api/movie/$MOVIE_ID")
if echo "$response" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ 获取详情成功${NC}"
    if [ "$JQ_INSTALLED" = true ]; then
        echo "$response" | jq '{
            title: .data.title,
            year: .data.year,
            plot: .data.plot[:100] + "...",
            directors: .data.directors,
            cast: .data.cast[:3],
            ratings: .data.ratings,
            aggregatedRating: .data.aggregatedRating.score
        }'
    else
        echo "$response"
    fi
else
    echo -e "${RED}✗ 获取详情失败${NC}"
    echo "$response"
fi

# 4. 生成AI摘要
echo -e "\n${BLUE}4. 生成AI摘要 (使用通义千问)${NC}"
response=$(curl -s "$API_BASE/api/movie/$MOVIE_ID/summary")
if echo "$response" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ AI摘要生成成功${NC}"
    if [ "$JQ_INSTALLED" = true ]; then
        echo "$response" | jq '{
            title: .data.movie.title,
            aiSummary: .data.aiSummary.summary,
            highlights: .data.aiSummary.highlights,
            similarMovies: .data.aiSummary.similarMovies
        }'
    else
        echo "$response"
    fi
else
    echo -e "${RED}✗ AI摘要生成失败${NC}"
    echo "$response"
fi

# 5. 添加到观影清单
echo -e "\n${BLUE}5. 添加到观影清单${NC}"
response=$(curl -s -X POST "$API_BASE/api/users/$USER_ID/watchlist" \
    -H "Content-Type: application/json" \
    -d "{\"movieId\":\"$MOVIE_ID\",\"status\":\"want_to_watch\",\"notes\":\"测试添加\"}")

if echo "$response" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ 添加成功${NC}"
    format_json "$response"
else
    # 如果已存在也算正常
    if echo "$response" | grep -q "already in watchlist"; then
        echo -e "${YELLOW}○ 电影已在清单中${NC}"
    else
        echo -e "${RED}✗ 添加失败${NC}"
    fi
    echo "$response"
fi

# 6. 获取观影清单
echo -e "\n${BLUE}6. 获取观影清单${NC}"
response=$(curl -s "$API_BASE/api/users/$USER_ID/watchlist")
if echo "$response" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ 获取清单成功${NC}"
    if [ "$JQ_INSTALLED" = true ]; then
        echo "$response" | jq '{
            success: .success,
            total: .data | length,
            movies: .data | map({
                movieId: .movieId,
                status: .status,
                addedAt: .addedAt
            })
        }'
    else
        echo "$response"
    fi
else
    echo -e "${RED}✗ 获取清单失败${NC}"
    echo "$response"
fi

# 7. 获取清单统计
echo -e "\n${BLUE}7. 获取观影清单统计${NC}"
response=$(curl -s "$API_BASE/api/users/$USER_ID/watchlist/stats")
if echo "$response" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ 获取统计成功${NC}"
    format_json "$response"
else
    echo -e "${RED}✗ 获取统计失败${NC}"
    echo "$response"
fi

echo -e "\n${GREEN}"
echo "╔════════════════════════════════════════╗"
echo "║   测试完成！                          ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}\n"

echo -e "访问 ${BLUE}http://localhost:5173${NC} 查看Web界面"
echo -e "API文档: ${BLUE}http://localhost:3000${NC}\n"

