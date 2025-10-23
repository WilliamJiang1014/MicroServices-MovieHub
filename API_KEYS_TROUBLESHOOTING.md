# 🔑 API密钥配置说明

## 问题分析

当前搜索结果只显示TVMaze的结果，这是因为：

1. **TVMaze服务** ✅ - 正常工作（免费API，无需密钥）
2. **TMDB服务** ❌ - 返回401错误（需要有效API密钥）
3. **OMDb服务** ❌ - 返回401错误（需要有效API密钥）

## 解决方案

### 1. 获取API密钥

#### TMDB API密钥
1. 访问：https://www.themoviedb.org/settings/api
2. 注册账号并申请API密钥
3. 选择"Developer"类型

#### OMDb API密钥
1. 访问：http://www.omdbapi.com/apikey.aspx
2. 注册账号并申请API密钥
3. 免费版本每天有1000次请求限制

### 2. 配置API密钥

编辑`.env`文件：
```bash
# 替换为您的真实API密钥
TMDB_API_KEY=your_actual_tmdb_api_key
OMDB_API_KEY=your_actual_omdb_api_key
QWEN_API_KEY=your_actual_qwen_api_key
```

### 3. 重启服务

```bash
docker-compose down
docker-compose up -d
```

## 当前状态

- ✅ **TVMaze**: 免费API，正常工作
- ❌ **TMDB**: 需要API密钥
- ❌ **OMDb**: 需要API密钥
- ✅ **聚合服务**: 正常工作，会合并所有可用数据源的结果

## 测试命令

```bash
# 测试TMDB服务
curl "http://localhost:3002/api/search?query=batman&page=1"

# 测试OMDb服务  
curl "http://localhost:3003/api/search?query=batman&page=1"

# 测试TVMaze服务
curl "http://localhost:3006/api/search?query=batman&page=1"

# 测试聚合服务
curl "http://localhost:3000/api/search?query=batman&page=1"
```

## 预期结果

配置正确的API密钥后，搜索结果将包含：
- TMDB的电影数据（海报、评分、详细信息）
- OMDb的电影数据（IMDb评分、详细信息）
- TVMaze的电视节目数据
- 聚合后的综合结果
