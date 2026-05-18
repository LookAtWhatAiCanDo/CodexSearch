export interface SessionSummary {
  id: string;
  threadName: string;
  cwd: string;
  timestamp: string;
  updatedAt: string;
  isArchived: boolean;
  modelProvider: string;
  turnCount: number;
  filePath: string;
}

export interface Turn {
  turnId: string;
  userMessage: string;
  finalAnswer: string;
  lastAgentMessage: string;
}

export interface Session extends SessionSummary {
  cliVersion: string;
  turns: Turn[];
}

export interface SearchResult {
  session: SessionSummary;
  turnId: string;
  matchField: 'user' | 'agent' | 'thread';
  snippet: string;
  score: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalResults: number;
  sessionCount: number;
  indexAge: number;
}

export interface StatusResponse {
  sessionCount: number;
  indexAge: number;
  builtAt: string;
}
