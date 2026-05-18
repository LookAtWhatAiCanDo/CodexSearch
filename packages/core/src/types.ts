export interface Turn {
  turnId: string;
  userMessage: string;
  finalAnswer: string;
  lastAgentMessage: string;
}

export interface Session {
  id: string;
  filePath: string;
  isArchived: boolean;
  timestamp: string;
  updatedAt: string;
  cwd: string;
  cliVersion: string;
  modelProvider: string;
  threadName: string;
  turns: Turn[];
}

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

export interface SearchableChunk {
  sessionId: string;
  turnId: string;
  userMessage: string;
  agentSummary: string;
}

export interface SearchIndex {
  sessions: Map<string, Session>;
  chunks: SearchableChunk[];
  builtAt: Date;
  sessionCount: number;
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
