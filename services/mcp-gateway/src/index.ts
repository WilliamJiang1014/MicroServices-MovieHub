import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { WebSocketServer } from 'ws';
import { Logger } from '@moviehub/shared';

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const port = process.env.MCP_GATEWAY_PORT || 3007;
const logger = new Logger('MCP-Gateway');

app.use(cors());
app.use(express.json());

// MCP服务器注册表
interface MCPServerInfo {
  name: string;
  version: string;
  description: string;
  endpoint: string;
  tools: MCPTool[];
  status: 'online' | 'offline';
  lastHeartbeat: Date;
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

class MCPGateway {
  private servers: Map<string, MCPServerInfo> = new Map();
  private wss: WebSocketServer;

  constructor() {
    // 创建WebSocket服务器
    this.wss = new WebSocketServer({ port: 8080 });
    this.setupWebSocketHandlers();
    this.setupRoutes();
    this.startHeartbeat();
  }

  private setupWebSocketHandlers() {
    this.wss.on('connection', (ws) => {
      logger.info('New MCP client connected');
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          logger.error('Invalid message received:', error);
        }
      });

      ws.on('close', () => {
        logger.info('MCP client disconnected');
      });
    });
  }

  private handleMessage(ws: any, message: any) {
    switch (message.type) {
      case 'register':
        this.registerServer(message.server);
        ws.send(JSON.stringify({ type: 'registered', success: true }));
        break;
      case 'discover':
        const tools = this.discoverTools();
        ws.send(JSON.stringify({ type: 'tools', tools }));
        break;
      case 'call_tool':
        this.callTool(message.toolName, message.args)
          .then(result => {
            ws.send(JSON.stringify({ type: 'tool_result', result }));
          })
          .catch(error => {
            ws.send(JSON.stringify({ type: 'tool_error', error: error.message }));
          });
        break;
    }
  }

  private setupRoutes() {
    // 健康检查
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        service: 'mcp-gateway',
        servers: Array.from(this.servers.keys()),
        totalTools: this.getAllTools().length
      });
    });

    // 获取所有注册的服务器
    app.get('/servers', (req, res) => {
      const servers = Array.from(this.servers.values()).map(server => ({
        name: server.name,
        version: server.version,
        description: server.description,
        status: server.status,
        toolCount: server.tools.length
      }));
      res.json({ servers });
    });

    // 获取所有可用工具
    app.get('/tools', (req, res) => {
      const tools = this.getAllTools();
      res.json({ tools });
    });

    // 调用工具
    app.post('/call-tool', async (req, res) => {
      try {
        const { toolName, args } = req.body;
        const result = await this.callTool(toolName, args);
        res.json({ success: true, result });
      } catch (error) {
        logger.error('Tool call failed:', error);
        res.status(500).json({ success: false, error: (error as Error).message });
      }
    });

    // 注册服务器
    app.post('/register', (req, res) => {
      try {
        this.registerServer(req.body);
        res.json({ success: true, message: 'Server registered successfully' });
      } catch (error) {
        logger.error('Server registration failed:', error);
        res.status(400).json({ success: false, error: (error as Error).message });
      }
    });
  }

  private registerServer(serverInfo: Partial<MCPServerInfo>) {
    if (!serverInfo.name || !serverInfo.endpoint) {
      throw new Error('Server name and endpoint are required');
    }

    const server: MCPServerInfo = {
      name: serverInfo.name,
      version: serverInfo.version || '1.0.0',
      description: serverInfo.description || '',
      endpoint: serverInfo.endpoint,
      tools: serverInfo.tools || [],
      status: 'online',
      lastHeartbeat: new Date()
    };

    this.servers.set(server.name, server);
    logger.info(`Registered MCP server: ${server.name} at ${server.endpoint}`);
  }

  private discoverTools(): MCPTool[] {
    return this.getAllTools();
  }

  private getAllTools(): MCPTool[] {
    const allTools: MCPTool[] = [];
    for (const server of this.servers.values()) {
      allTools.push(...server.tools);
    }
    return allTools;
  }

  private async callTool(toolName: string, args: any): Promise<any> {
    // 解析工具名称格式: serverName.toolName
    const parts = toolName.split('.');
    if (parts.length !== 2) {
      throw new Error(`Invalid tool name format: ${toolName}. Expected format: serverName.toolName`);
    }
    
    const [serverName, actualToolName] = parts;
    const server = this.servers.get(serverName);
    
    if (!server) {
      throw new Error(`Server ${serverName} not found`);
    }
    
    const tool = server.tools.find(t => t.name === actualToolName);
    if (!tool) {
      throw new Error(`Tool ${actualToolName} not found in server ${serverName}`);
    }
    
    return await this.executeToolCall(server, actualToolName, args);
  }

  private async executeToolCall(server: MCPServerInfo, toolName: string, args: any): Promise<any> {
    try {
      const response = await fetch(`${server.endpoint}/call-tool`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolName,
          args
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      logger.error(`Failed to call tool ${toolName} on server ${server.name}:`, error);
      throw error;
    }
  }

  private startHeartbeat() {
    setInterval(() => {
      for (const [name, server] of this.servers) {
        // 检查服务器是否在线
        this.checkServerHealth(server)
          .then(isHealthy => {
            if (!isHealthy && server.status === 'online') {
              server.status = 'offline';
              logger.warn(`Server ${name} is offline`);
            } else if (isHealthy && server.status === 'offline') {
              server.status = 'online';
              logger.info(`Server ${name} is back online`);
            }
          })
          .catch(error => {
            logger.error(`Health check failed for ${name}:`, error);
          });
      }
    }, 30000); // 每30秒检查一次
  }

  private async checkServerHealth(server: MCPServerInfo): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${server.endpoint}/health`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  public start() {
    app.listen(port, () => {
      logger.info(`MCP Gateway started on port ${port}`);
      logger.info(`WebSocket server started on port 8080`);
      logger.info(`Available endpoints:`);
      logger.info(`  GET  /health - Health check`);
      logger.info(`  GET  /servers - List registered servers`);
      logger.info(`  GET  /tools - List available tools`);
      logger.info(`  POST /call-tool - Call a tool`);
      logger.info(`  POST /register - Register a server`);
    });
  }
}

// 启动MCP Gateway
const gateway = new MCPGateway();
gateway.start();

export default MCPGateway;
