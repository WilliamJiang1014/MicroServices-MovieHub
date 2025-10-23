#!/bin/bash

# MovieHub Linux快速部署脚本
# 适用于Ubuntu/Debian/CentOS系统

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# 检测操作系统
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    else
        log_error "无法检测操作系统"
        exit 1
    fi
    
    log_info "检测到操作系统: $OS $VER"
}

# 安装基础工具
install_basic_tools() {
    log_info "安装基础工具..."
    
    if [[ $OS == *"Ubuntu"* ]] || [[ $OS == *"Debian"* ]]; then
        sudo apt update
        sudo apt install -y curl wget git vim
    elif [[ $OS == *"CentOS"* ]] || [[ $OS == *"Red Hat"* ]]; then
        sudo yum update -y
        sudo yum install -y curl wget git vim
    else
        log_warning "未识别的操作系统，请手动安装基础工具"
    fi
    
    log_success "基础工具安装完成"
}

# 安装Node.js
install_nodejs() {
    log_info "安装Node.js 18..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -ge 18 ]; then
            log_success "Node.js版本满足要求: $(node --version)"
            return
        fi
    fi
    
    # 安装Node.js 18
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    
    if [[ $OS == *"Ubuntu"* ]] || [[ $OS == *"Debian"* ]]; then
        sudo apt-get install -y nodejs
    elif [[ $OS == *"CentOS"* ]] || [[ $OS == *"Red Hat"* ]]; then
        sudo yum install -y nodejs
    fi
    
    log_success "Node.js安装完成: $(node --version)"
}

# 安装pnpm
install_pnpm() {
    log_info "安装pnpm..."
    
    if command -v pnpm &> /dev/null; then
        log_success "pnpm已安装: $(pnpm --version)"
        return
    fi
    
    npm install -g pnpm
    log_success "pnpm安装完成: $(pnpm --version)"
}

# 安装Docker
install_docker() {
    log_info "安装Docker..."
    
    if command -v docker &> /dev/null; then
        log_success "Docker已安装: $(docker --version)"
        return
    fi
    
    # 安装Docker
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    
    log_success "Docker安装完成"
    log_warning "请重新登录或运行 'newgrp docker' 以应用Docker组权限"
}

# 安装Docker Compose
install_docker_compose() {
    log_info "安装Docker Compose..."
    
    if command -v docker-compose &> /dev/null; then
        log_success "Docker Compose已安装: $(docker-compose --version)"
        return
    fi
    
    # 安装Docker Compose
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
    log_success "Docker Compose安装完成: $(docker-compose --version)"
}

# 克隆项目
clone_project() {
    log_info "克隆MovieHub项目..."
    
    if [ -d "MicroServices-MovieHub" ]; then
        log_warning "项目目录已存在，跳过克隆"
        return
    fi
    
    git clone https://github.com/WilliamJiang1014/MicroServices-MovieHub.git
    cd MicroServices-MovieHub
    
    log_success "项目克隆完成"
}

# 配置环境变量
configure_env() {
    log_info "配置环境变量..."
    
    if [ ! -f ".env" ]; then
        cp env.docker.example .env
        log_warning "已创建.env文件，请编辑并填入API密钥"
        log_warning "必需的API密钥："
        log_warning "  - TMDB_API_KEY: https://www.themoviedb.org/settings/api"
        log_warning "  - OMDB_API_KEY: http://www.omdbapi.com/apikey.aspx"
        log_warning "  - QWEN_API_KEY: https://dashscope.console.aliyun.com/"
        echo ""
        read -p "按Enter键继续（请确保已配置API密钥）..."
    else
        log_success "环境变量文件已存在"
    fi
}

# 部署项目
deploy_project() {
    log_info "部署MovieHub项目..."
    
    # 给脚本添加执行权限
    chmod +x scripts/*.sh
    
    # 使用快速部署脚本
    if [ -f "scripts/quick-deploy.sh" ]; then
        ./scripts/quick-deploy.sh
    else
        # 手动部署
        log_info "使用Docker Compose部署..."
        docker-compose build
        docker-compose up -d
        
        # 等待服务启动
        log_info "等待服务启动..."
        sleep 15
        
        # 检查服务状态
        docker-compose ps
    fi
    
    log_success "项目部署完成"
}

# 验证部署
verify_deployment() {
    log_info "验证部署..."
    
    # 检查服务状态
    if docker-compose ps | grep -q "Up"; then
        log_success "Docker服务运行正常"
    else
        log_error "Docker服务启动失败"
        return 1
    fi
    
    # 检查API Gateway
    if curl -s http://localhost:3000/health > /dev/null; then
        log_success "API Gateway运行正常"
    else
        log_warning "API Gateway可能未完全启动，请稍后检查"
    fi
    
    # 检查Web Client
    if curl -s http://localhost/health > /dev/null; then
        log_success "Web Client运行正常"
    else
        log_warning "Web Client可能未完全启动，请稍后检查"
    fi
}

# 显示访问信息
show_access_info() {
    log_success "🎉 MovieHub部署完成！"
    echo ""
    echo "🌐 访问地址："
    echo "   Web前端: http://localhost"
    echo "   API Gateway: http://localhost:3000"
    echo "   健康检查: http://localhost:3000/health"
    echo ""
    echo "📋 常用命令："
    echo "   查看服务状态: docker-compose ps"
    echo "   查看日志: docker-compose logs -f"
    echo "   重启服务: docker-compose restart"
    echo "   停止服务: docker-compose down"
    echo ""
    echo "🔧 故障排查："
    echo "   查看详细日志: docker-compose logs -f [service-name]"
    echo "   进入容器调试: docker-compose exec [service-name] sh"
    echo "   检查服务健康: curl http://localhost:3000/health"
    echo ""
}

# 主函数
main() {
    echo "🎬 MovieHub Linux快速部署工具"
    echo "=============================="
    echo ""
    
    # 检查是否为root用户
    if [ "$EUID" -eq 0 ]; then
        log_error "请不要使用root用户运行此脚本"
        exit 1
    fi
    
    # 检查sudo权限
    if ! sudo -n true 2>/dev/null; then
        log_error "需要sudo权限来安装软件包"
        exit 1
    fi
    
    # 执行部署步骤
    detect_os
    install_basic_tools
    install_nodejs
    install_pnpm
    install_docker
    install_docker_compose
    clone_project
    configure_env
    deploy_project
    verify_deployment
    show_access_info
    
    echo ""
    log_success "部署完成！请访问 http://localhost 查看应用"
}

# 如果直接运行脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
