export type IntentCategory = 
  | 'BEHAVIORAL' 
  | 'CODING_ALGORITHM' 
  | 'SYSTEM_DESIGN' 
  | 'TECHNICAL_KNOWLEDGE' 
  | 'GENERAL';

export interface TranscriptSegment {
  id: string;
  speaker: 'interviewer' | 'candidate';
  text: string;
  timestamp: number;
  isFinal: boolean;
}

export interface CopilotSuggestion {
  id: string;
  question: string;
  intent: IntentCategory;
  summary: string;
  bulletPoints: string[];
  codeSnippet?: {
    language: string;
    code: string;
    complexity?: string;
  };
  starStory?: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
  retrievedContext?: string[];
  timestamp: number;
  latencyMs?: number;
  modelUsed?: string;
}

export interface AudioLevels {
  micRms: number;
  loopbackRms: number;
}

export interface AppSettings {
  opacity: number;
  clickThrough: boolean;
  modelProvider: 'groq' | 'anthropic' | 'openai' | 'local' | 'openrouter';
  groqModel: 'llama-3.3-70b-versatile' | 'llama-3.1-8b-instant';
  openRouterModel?: string;
  apiKey: string;
  selectedMic: string;
  autoScroll: boolean;
  stealthModeEnabled: boolean;
  localModelUrl: string;
  localModelName: string;
  resumeContext: string;
  speechLanguage: string;
}
