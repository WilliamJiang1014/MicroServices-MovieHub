#!/bin/bash

# MovieHub Docker部署脚本
# 用于快速部署MovieHub微服务架构

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查Docker是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker未安装，请先安装Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose未安装，请先安装Docker Compose"
        exit 1
    fi
    
    log_success "Docker环境检查通过"
}

# 检查环境变量文件
check_env() {
    if [ ! -f ".env" ]; then
        log_warning "未找到.env文件，正在创建..."
        cp env.docker.example .env
        log_warning "请编辑.env文件，填入您的API密钥"
        log_warning "必需的API密钥："
        log_warning "  - TMDB_API_KEY: https://www.themoviedb.org/settings/api"
        log_warning "  - OMDB_API_KEY: http://www.omdbapi.com/apikey.aspx"
        log_warning "  - QWEN_API_KEY: https://dashscope.console.aliyun.com/"
        read -p "按Enter键继续..."
    fi
    log_success "环境变量文件检查完成"
}

# 构建镜像
build_images() {
    log_info "开始构建Docker镜像..."
    
    # 构建基础服务
    docker-compose build
    
    log_success "Docker镜像构建完成"
}

# 启动服务
start_services() {
    log_info "启动MovieHub服务..."
    
    # 启动基础服务
    docker-compose up -d
    
    log_success "服务启动完成"
}

# 启动完整服务（包含MCP）
start_full_services() {
    log_info "启动MovieHub完整服务（包含MCP）..."
    
    # 启动完整服务
    docker-compose -f docker-compose.full.yml up -d
    
    log_success "完整服务启动完成"
}

# 检查服务状态
check_status() {
    log_info "检查服务状态..."
    
    # 等待服务启动
    sleep 10
    
    # 检查API Gateway
    if curl -s http://localhost:3000/health > /dev/null; then
        log_success "API Gateway运行正常"
    else
        log_error "API Gateway启动失败"
    fi
    
    # 检查Web Client
    if curl -s http://localhost/health > /dev/null; then
        log_success "Web Client运行正常"
    else
        log_error "Web Client启动失败"
    fi
    
    # 检查Redis
    if docker exec moviehub-redis redis-cli ping > /dev/null 2>&1; then
        log_success "Redis运行正常"
    else
        log_error "Redis启动失败"
    fi
}

# 显示服务信息
show_info() {
    log_info "MovieHub服务信息："
    echo ""
    echo "🌐 Web前端: http://localhost"
    echo "🔌 API Gateway: http://localhost:3000"
    echo "🤖 LLM Service: http://localhost:3001"
    echo "📊 TMDB Provider: http://localhost:3002"
    echo "📊 OMDb Provider: http://localhost:3003"
    echo "📊 TVMaze Provider: http://localhost:3006"
    echo "🔄 Aggregation Service: http://localhost:3004"
    echo "👤 User Service: http://localhost:3005"
    echo "🧠 MCP Gateway: http://localhost:3007"
    echo "🔧 TMDB MCP Provider: http://localhost:3008"
    echo "🔧 OMDb MCP Provider: http://localhost:3009"
    echo "📈 Graph Orchestrator: http://localhost:3010"
    echo "💾 Redis: localhost:6379"
    echo ""
    echo "📋 健康检查:"
    echo "  - API Gateway: curl http://localhost:3000/health"
    echo "  - Web Client: curl http://localhost/health"
    echo "  - Redis: docker exec moviehub-redis redis-cli ping"
    echo ""
}

# 停止服务
stop_services() {
    log_info "停止MovieHub服务..."
    
    # 停止基础服务
    docker-compose down
    
    # 停止完整服务（如果运行）
    docker-compose -f docker-compose.full.yml down 2>/dev/null || true
    
    log_success "服务已停止"
}

# 清理资源
cleanup() {
    log_info "清理Docker资源..."
    
    # 停止并删除容器
    docker-compose down -v
    docker-compose -f docker-compose.full.yml down -v 2>/dev/null || true
    
    # 删除镜像
    docker rmi $(docker images "moviehub*" -q) 2>/dev/null || true
    
    # 清理未使用的资源
    docker system prune -f
    
    log_success "清理完成"
}

# 查看日志
view_logs() {
    log_info "查看服务日志..."
    docker-compose logs -f
}

# 主菜单
show_menu() {
    echo ""
    echo "🎬 MovieHub Docker部署工具"
    echo "=========================="
    echo "1. 快速部署（基础服务）"
    echo "2. 完整部署（包含MCP服务）"
    echo "3. 停止服务"
    echo "4. 查看服务状态"
    echo "5. 查看日志"
    echo "6. 清理资源"
    echo "7. 退出"
    echo ""
}

# 主函数
main() {
    log_info "MovieHub Docker部署工具启动"
    
    # 检查Docker环境
    check_docker
    
    # 检查环境变量
    check_env
    
    while true; do
        show_menu
        read -p "请选择操作 (1-7): " choice
        
        case $choice in
            1)
                build_images
                start_services
                check_status
                show_info
                ;;
            2)
                build_images
                start_full_services
                check_status
                show_info
                ;;
            3)
                stop_services
                ;;
            4)
                check_status
                show_info
                ;;
            5)
                view_logs
                ;;
            6)
                cleanup
                ;;
            7)
                log_info "退出部署工具"
                exit 0
                ;;
            *)
                log_error "无效选择，请重新输入"
                ;;
        esac
        
        echo ""
        read -p "按Enter键继续..."
    done
}

# 如果直接运行脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi



