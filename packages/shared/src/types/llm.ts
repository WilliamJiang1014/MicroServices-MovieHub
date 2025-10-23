export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface MovieSummaryRequest {
  title: string;
  plot?: string;
  year?: number;
  genres?: string[];
}

export interface MovieSummaryResponse {
  summary: string;
  highlights: string[];
  similarMovies?: string[];
}

