// MCP客户端服务，用于前端调用MCP功能
export interface MCPWorkflowRequest {
  query: string;
  userId?: string;
}

export interface MCPWorkflowResponse {
  success: boolean;
  result?: {
    query: string;
    intent: {
      type: string;
      confidence: number;
    };
    result: {
      type: string;
      results: any[];
      sources?: string[];
    };
    executionTrace: Array<{
      step: string;
      tool: string;
      input: any;
      output: any;
      duration: number;
      success: boolean;
      timestamp: string;
    }>;
    totalDuration: number;
    success: boolean;
  };
  error?: string;
}

export interface MCPToolCallRequest {
  toolName: string;
  args: any;
}

export interface MCPToolCallResponse {
  success: boolean;
  result?: any;
  error?: string;
}

class MCPClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3010') {
    this.baseUrl = baseUrl;
  }

  // 执行工作流（自然语言查询）
  async executeWorkflow(request: MCPWorkflowRequest): Promise<MCPWorkflowResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('MCP workflow execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // 直接调用工具
  async callTool(request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    try {
      const response = await fetch('http://localhost:3007/call-tool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('MCP tool call failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // 获取可用工具列表
  async getAvailableTools(): Promise<any[]> {
    try {
      const response = await fetch('http://localhost:3007/tools');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return data.tools || [];
    } catch (error) {
      console.error('Failed to get available tools:', error);
      return [];
    }
  }

  // 获取服务器状态
  async getServerStatus(): Promise<any> {
    try {
      const response = await fetch('http://localhost:3007/servers');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to get server status:', error);
      return { servers: [] };
    }
  }
}

export const mcpClient = new MCPClient();


