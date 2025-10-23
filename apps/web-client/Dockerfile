# Web Client Dockerfile
FROM node:18-alpine AS base

# 设置工作目录
WORKDIR /app

# 复制package.json和pnpm-lock.yaml
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web-client/package.json ./apps/web-client/

# 安装pnpm
RUN npm install -g pnpm

# 安装依赖
RUN pnpm install --frozen-lockfile

# 构建阶段
FROM base AS builder

# 复制源代码
COPY apps/web-client ./apps/web-client

# 构建Web Client
RUN cd apps/web-client && pnpm build

# 生产阶段 - 使用nginx提供静态文件
FROM nginx:alpine AS production

# 复制构建产物到nginx目录
COPY --from=builder /app/apps/web-client/dist /usr/share/nginx/html

# 复制nginx配置
COPY apps/web-client/nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 启动nginx
CMD ["nginx", "-g", "daemon off;"]


