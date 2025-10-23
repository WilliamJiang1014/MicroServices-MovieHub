#!/bin/bash

# MovieHub API密钥恢复脚本
# 用于在开发环境中恢复真实的API密钥

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

# 检查是否存在API密钥备份
check_api_keys() {
    log_info "检查API密钥配置..."
    
    # 从之前的.env文件中提取API密钥
    if [ -f ".env.backup" ]; then
        log_info "找到API密钥备份文件"
        return 0
    fi
    
    # 检查是否有API密钥文件
    if [ -f "../api密钥.md" ]; then
        log_info "找到API密钥文件"
        return 0
    fi
    
    log_warning "未找到API密钥备份，需要手动配置"
    return 1
}

# 恢复API密钥
restore_api_keys() {
    log_info "恢复API密钥..."
    
    # 从API密钥文件恢复
    if [ -f "../api密钥.md" ]; then
        log_info "从API密钥文件恢复..."
        
        # 提取API密钥
        TMDB_KEY=$(grep "TMDB:" ../api密钥.md | cut -d':' -f2 | tr -d ' ')
        OMDB_KEY=$(grep "OMDb:" ../api密钥.md | cut -d':' -f2 | tr -d ' ')
        QWEN_KEY=$(grep "通义千问:" ../api密钥.md | cut -d':' -f2 | tr -d ' ')
        
        # 更新.env文件
        sed -i.bak "s/TMDB_API_KEY=your_tmdb_api_key_here/TMDB_API_KEY=$TMDB_KEY/" .env
        sed -i.bak "s/OMDB_API_KEY=your_omdb_api_key_here/OMDB_API_KEY=$OMDB_KEY/" .env
        sed -i.bak "s/QWEN_API_KEY=your_qwen_api_key_here/QWEN_API_KEY=$QWEN_KEY/" .env
        
        # 清理备份文件
        rm -f .env.bak
        
        log_success "API密钥恢复完成"
        return 0
    fi
    
    # 从备份文件恢复
    if [ -f ".env.backup" ]; then
        log_info "从备份文件恢复..."
        cp .env.backup .env
        log_success "API密钥恢复完成"
        return 0
    fi
    
    log_error "无法恢复API密钥"
    return 1
}

# 手动配置API密钥
manual_config() {
    log_warning "需要手动配置API密钥"
    echo ""
    echo "请编辑.env文件，将以下占位符替换为真实的API密钥："
    echo ""
    echo "TMDB_API_KEY=your_tmdb_api_key_here"
    echo "OMDB_API_KEY=your_omdb_api_key_here"
    echo "QWEN_API_KEY=your_qwen_api_key_here"
    echo ""
    echo "API密钥申请地址："
    echo "  - TMDB: https://www.themoviedb.org/settings/api"
    echo "  - OMDb: http://www.omdbapi.com/apikey.aspx"
    echo "  - 通义千问: https://dashscope.console.aliyun.com/"
    echo ""
    read -p "按Enter键打开编辑器..."
    
    # 打开编辑器
    if command -v code &> /dev/null; then
        code .env
    elif command -v vim &> /dev/null; then
        vim .env
    elif command -v nano &> /dev/null; then
        nano .env
    else
        log_error "未找到可用的编辑器"
        return 1
    fi
}

# 验证配置
verify_config() {
    log_info "验证API密钥配置..."
    
    # 检查是否还有占位符
    if grep -q "your_.*_api_key_here" .env; then
        log_warning "检测到未配置的API密钥占位符"
        return 1
    fi
    
    # 检查API密钥格式
    if grep -q "TMDB_API_KEY=" .env && grep -q "OMDB_API_KEY=" .env && grep -q "QWEN_API_KEY=" .env; then
        log_success "API密钥配置验证通过"
        return 0
    fi
    
    log_error "API密钥配置不完整"
    return 1
}

# 显示配置信息
show_config() {
    log_info "当前API密钥配置："
    echo ""
    echo "TMDB_API_KEY: $(grep TMDB_API_KEY .env | cut -d'=' -f2 | cut -c1-8)..."
    echo "OMDB_API_KEY: $(grep OMDB_API_KEY .env | cut -d'=' -f2 | cut -c1-8)..."
    echo "QWEN_API_KEY: $(grep QWEN_API_KEY .env | cut -d'=' -f2 | cut -c1-8)..."
    echo ""
}

# 主函数
main() {
    echo "🔑 MovieHub API密钥恢复工具"
    echo "============================="
    echo ""
    
    # 检查当前状态
    if grep -q "your_.*_api_key_here" .env; then
        log_warning "检测到占位符API密钥，需要配置真实密钥"
    else
        log_success "API密钥已配置"
        show_config
        return 0
    fi
    
    # 尝试自动恢复
    if check_api_keys; then
        if restore_api_keys; then
            log_success "API密钥自动恢复成功"
            show_config
            return 0
        fi
    fi
    
    # 手动配置
    manual_config
    
    # 验证配置
    if verify_config; then
        log_success "API密钥配置完成"
        show_config
    else
        log_error "API密钥配置失败，请检查配置"
        return 1
    fi
}

# 如果直接运行脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
