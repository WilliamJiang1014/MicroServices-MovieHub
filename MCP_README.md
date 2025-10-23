# MovieHub MCP服务文档

## 🎯 概述

MovieHub MCP (Model Context Protocol) 服务实现了Proposal中描述的"对话式操作"功能，通过MCP协议将多个数据源和工具统一暴露，并使用LangGraph进行智能编排。

## 🏗️ 架构

```
┌─────────────────────────────────────────────────────┐
│                Graph Orchestrator                    │
│              (LangGraph + 状态机)                     │
│                  Port: 3010                          │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │   MCP Gateway   │ ──────► 工具发现与注册
         │   Port: 3007    │
         └────────┬────────┘
                  │
      ┌───────────┼───────────┐
      ▼           ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│TMDB MCP  │ │OMDb MCP  │ │其他MCP   │
│Provider  │ │Provider  │ │Providers │
│Port:3008 │ │Port:3009 │ │          │
└────┬─────┘ └────┬─────┘ └────┬─────┘
     │            │            │
     ▼            ▼            ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│TMDB API │  │OMDb API │  │其他API  │
└─────────┘  └─────────┘  └─────────┘
```

## 🚀 快速开始

### 1. 启动MCP服务

```bash
# 一键启动所有MCP服务
./scripts/start-mcp.sh

# 或手动启动
pnpm dev:mcp
```

### 2. 测试MCP服务

```bash
# 运行自动化测试
./scripts/test-mcp.sh
```

### 3. 查看服务状态

```bash
# 查看tmux会话
tmux attach -t moviehub-mcp

# 健康检查
curl http://localhost:3007/health
```

## 📋 服务列表

| 服务名 | 端口 | 描述 | 端点 |
|--------|------|------|------|
| MCP Gateway | 3007 | 工具注册中心 | http://localhost:3007 |
| TMDB MCP Provider | 3008 | TMDB数据源MCP服务 | http://localhost:3008 |
| OMDb MCP Provider | 3009 | OMDb数据源MCP服务 | http://localhost:3009 |
| Graph Orchestrator | 3010 | LangGraph工作流编排器 | http://localhost:3010 |

## 🛠️ 可用工具

### TMDB MCP Provider工具

- `search_movies` - 搜索电影
- `get_movie_details` - 获取电影详情
- `get_movie_by_external_id` - 通过外部ID获取电影
- `get_popular_movies` - 获取热门电影
- `discover_movies` - 按类型/年份发现电影
- `search_movies_by_director` - 按导演搜索电影
- `get_movie_credits` - 获取演职员信息

### OMDb MCP Provider工具

- `search_movies` - 搜索电影
- `get_movie_by_title` - 通过标题获取电影
- `get_movie_by_id` - 通过IMDB ID获取电影
- `get_ratings` - 获取多源评分

## 🔄 工作流示例

### 1. 电影搜索工作流

```bash
curl -X POST "http://localhost:3010/execute" \
  -H "Content-Type: application/json" \
  -d '{"query": "帮我找《Dune》并给出评分对比"}'
```

**执行流程**：
1. 分析用户意图 → `compare_movies`
2. 并行搜索TMDB和OMDb
3. 聚合搜索结果
4. 获取详细评分信息
5. 生成对比分析

### 2. 电影详情工作流

```bash
curl -X POST "http://localhost:3010/execute" \
  -H "Content-Type: application/json" \
  -d '{"query": "获取《Dune》的详细信息"}'
```

**执行流程**：
1. 分析用户意图 → `get_movie_details`
2. 搜索电影获取ID
3. 调用TMDB获取详细信息
4. 获取演职员信息
5. 返回完整电影信息

### 3. 推荐工作流

```bash
curl -X POST "http://localhost:3010/execute" \
  -H "Content-Type: application/json" \
  -d '{"query": "推荐一些类似《盗梦空间》的电影", "userId": "user123"}'
```

**执行流程**：
1. 分析用户意图 → `recommend_movies`
2. 获取用户观影历史
3. 分析电影特征
4. 生成个性化推荐
5. 返回推荐结果

## 📊 API接口

### MCP Gateway

#### 获取工具列表
```bash
GET /tools
```

#### 获取服务器列表
```bash
GET /servers
```

#### 调用工具
```bash
POST /call-tool
{
  "toolName": "tmdb-provider.search_movies",
  "args": {
    "query": "Dune",
    "year": 2021
  }
}
```

### Graph Orchestrator

#### 执行工作流
```bash
POST /execute
{
  "query": "帮我找《Dune》并给出评分对比",
  "userId": "user123"
}
```

#### 获取可用工具
```bash
GET /tools
```

## 🔧 开发指南

### 添加新的MCP Provider

1. **创建Provider服务**
```bash
mkdir services/mcp-provider-new
cd services/mcp-provider-new
```

2. **实现MCP工具**
```typescript
class NewMCPServer {
  private tools: MCPTool[] = [
    {
      name: 'new_tool',
      description: 'New tool description',
      inputSchema: {
        type: 'object',
        properties: {
          param: { type: 'string', description: 'Parameter description' }
        },
        required: ['param']
      }
    }
  ];
}
```

3. **注册到Gateway**
```typescript
private async registerToGateway(): Promise<void> {
  const serverInfo = {
    name: 'new-provider',
    version: '1.0.0',
    description: 'New Provider Description',
    endpoint: `http://localhost:${port}`,
    tools: this.tools
  };
  
  await axios.post(`${gatewayUrl}/register`, serverInfo);
}
```

### 扩展工作流

1. **添加新的意图类型**
```typescript
private async analyzeIntent(query: string): Promise<any> {
  // 添加新的意图识别逻辑
  if (query.includes('新功能')) {
    return { type: 'new_intent', confidence: 0.9 };
  }
}
```

2. **实现新的工作流**
```typescript
private async executeNewWorkflow(query: string, executionTrace: ExecutionStep[]): Promise<any> {
  // 实现新的工作流逻辑
}
```

## 🐛 故障排查

### 常见问题

1. **服务无法启动**
   - 检查端口是否被占用
   - 确认环境变量配置正确
   - 查看服务日志

2. **工具调用失败**
   - 验证API密钥是否正确
   - 检查网络连接
   - 查看MCP Gateway日志

3. **工作流执行失败**
   - 检查Graph Orchestrator日志
   - 验证工具是否可用
   - 查看执行轨迹

### 调试命令

```bash
# 查看服务状态
curl http://localhost:3007/health

# 查看可用工具
curl http://localhost:3007/tools

# 测试工具调用
curl -X POST "http://localhost:3007/call-tool" \
  -H "Content-Type: application/json" \
  -d '{"toolName": "tmdb-provider.search_movies", "args": {"query": "test"}}'

# 查看工作流执行
curl -X POST "http://localhost:3010/execute" \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'
```

## 📈 性能优化

### 缓存策略
- 工具调用结果缓存
- 工作流执行结果缓存
- 用户意图分析缓存

### 并发优化
- 并行工具调用
- 异步工作流执行
- 连接池管理

### 监控指标
- 工具调用延迟
- 工作流执行时间
- 错误率统计

## 🔮 未来扩展

### 计划功能
- [ ] 添加更多数据源（Trakt、TVMaze等）
- [ ] 实现用户认证和授权
- [ ] 添加工作流可视化
- [ ] 实现工作流版本管理
- [ ] 添加性能监控面板

### 技术改进
- [ ] 使用真正的LangGraph库
- [ ] 实现工作流持久化
- [ ] 添加工作流调试器
- [ ] 实现工作流热重载

---

**作者**: 姜政言 (2353594)  
**版本**: 1.0.0  
**更新时间**: 2025年10月
