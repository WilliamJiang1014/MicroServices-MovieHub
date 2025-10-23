import axios, { AxiosInstance } from 'axios';
import { Logger } from '@moviehub/shared';
import { LLMMessage, LLMRequest, LLMResponse } from '@moviehub/shared';

export class QwenClient {
  private client: AxiosInstance;
  private logger: Logger;
  private apiKey: string;

  constructor(apiKey: string, apiUrl: string = 'https://dashscope.aliyuncs.com/compatible-mode/v1') {
    this.apiKey = apiKey;
    this.logger = new Logger('QwenClient');
    
    this.client = axios.create({
      baseURL: apiUrl,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    });
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    try {
      this.logger.info('Sending request to Qwen API');

      // 使用 OpenAI 兼容格式
      const response = await this.client.post('/chat/completions', {
        model: 'qwen-plus',
        messages: request.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 1500,
      });

      const choice = response.data.choices[0];
      const usage = response.data.usage;

      this.logger.info('Received response from Qwen API');

      return {
        content: choice.message.content,
        model: 'qwen-plus',
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        },
      };
    } catch (error: any) {
      this.logger.error('Error calling Qwen API:', error.message);
      throw new Error(`Qwen API error: ${error.message}`);
    }
  }

  async generateMovieSummary(title: string, plot?: string, genres?: string[]): Promise<string> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: '你是一个专业的电影评论家和推荐专家。请用简洁、吸引人的语言总结电影内容，突出亮点。',
      },
      {
        role: 'user',
        content: `请为电影《${title}》生成一个简短的推荐语（100字以内）。${plot ? `\n剧情：${plot}` : ''}${genres && genres.length > 0 ? `\n类型：${genres.join('、')}` : ''}`,
      },
    ];

    const response = await this.chat({
      messages,
      temperature: 0.8,
      maxTokens: 500,
    });

    return response.content;
  }

  async generateSimilarMovies(title: string, genres?: string[], plot?: string): Promise<string[]> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: '你是一个电影推荐专家。根据用户提供的电影信息，推荐5部相似的电影。只返回电影名称，用逗号分隔。',
      },
      {
        role: 'user',
        content: `基于电影《${title}》${genres && genres.length > 0 ? `（类型：${genres.join('、')}）` : ''}，推荐5部相似的电影。只返回电影名称，用逗号分隔，不要其他解释。`,
      },
    ];

    const response = await this.chat({
      messages,
      temperature: 0.7,
      maxTokens: 300,
    });

    return response.content
      .split(/[,，、]/)
      .map(movie => movie.trim())
      .filter(movie => movie.length > 0)
      .slice(0, 5);
  }

  async generateHighlights(title: string, plot?: string): Promise<string[]> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: '你是一个电影评论专家。提取电影的3个核心看点，每个看点用一句话概括（15字以内）。',
      },
      {
        role: 'user',
        content: `电影《${title}》${plot ? `的剧情：${plot}。` : '。'}请提取3个核心看点，每行一个，不要编号。`,
      },
    ];

    const response = await this.chat({
      messages,
      temperature: 0.6,
      maxTokens: 300,
    });

    return response.content
      .split('\n')
      .map(line => line.trim().replace(/^[0-9\-\*\.、]+/, '').trim())
      .filter(line => line.length > 0)
      .slice(0, 3);
  }
}

