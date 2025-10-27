#!/bin/bash

# 项目提交前清理脚本
# 删除依赖包和打包文件，只保留源代码和必要资源

echo "🧹 开始清理项目..."
echo ""

# 删除所有 node_modules 目录
echo "📦 删除 node_modules 目录..."
find . -name "node_modules" -type d -prune -exec rm -rf '{}' +
echo "✅ node_modules 已删除"
echo ""

# 删除所有 dist 目录（打包输出）
echo "📦 删除 dist 目录..."
find . -name "dist" -type d -prune -exec rm -rf '{}' +
echo "✅ dist 已删除"
echo ""

# 删除 pnpm-lock.yaml（可以从 package.json 重新生成）
echo "📦 删除 pnpm-lock.yaml..."
find . -name "pnpm-lock.yaml" -type f -delete
echo "✅ pnpm-lock.yaml 已删除"
echo ""

# 删除 .DS_Store（macOS 系统文件）
echo "📦 删除 .DS_Store 文件..."
find . -name ".DS_Store" -type f -delete
echo "✅ .DS_Store 已删除"
echo ""

# 删除 web-client 的构建产物
echo "📦 删除前端构建产物..."
if [ -d "apps/web-client/dist" ]; then
    rm -rf apps/web-client/dist
    echo "✅ web-client/dist 已删除"
fi
echo ""

# 显示清理后的目录大小
echo "📊 清理完成！当前目录大小："
du -sh .
echo ""

echo "✅ 项目清理完成，可以打包提交了！"
echo ""
echo "💡 提示："
echo "   - 源代码已保留"
echo "   - 配置文件已保留"
echo "   - 文档已保留"
echo "   - 依赖包已删除（可通过 pnpm install 重新安装）"
echo "   - 构建产物已删除（可通过 pnpm build 重新构建）"

