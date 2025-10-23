# OMDb MCP Provider Dockerfile
FROM node:18-alpine AS base

# 设置工作目录
WORKDIR /app

# 复制package.json和pnpm-lock.yaml
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY services/mcp-provider-omdb/package.json ./services/mcp-provider-omdb/

# 安装pnpm
RUN npm install -g pnpm

# 安装依赖
RUN pnpm install --frozen-lockfile

# 构建阶段
FROM base AS builder

# 复制源代码
COPY packages/shared ./packages/shared
COPY services/mcp-provider-omdb ./services/mcp-provider-omdb

# 构建共享包
RUN cd packages/shared && pnpm build

# 构建OMDb MCP Provider
RUN cd services/mcp-provider-omdb && pnpm build

# 生产阶段
FROM node:18-alpine AS production

WORKDIR /app

# 复制package.json文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY services/mcp-provider-omdb/package.json ./services/mcp-provider-omdb/

# 安装pnpm和生产依赖
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile --prod

# 从构建阶段复制构建产物
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/mcp-provider-omdb/dist ./services/mcp-provider-omdb/dist

# 创建非root用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# 更改文件所有权
RUN chown -R nodejs:nodejs /app
USER nodejs

# 暴露端口
EXPOSE 3009

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3009

# 启动命令
CMD ["node", "services/mcp-provider-omdb/dist/index.js"]

