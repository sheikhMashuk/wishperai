import type { AppSettings, CopilotSuggestion, IntentCategory } from '../types';

const SYSTEM_PROMPT = `You are WhisperAI — an elite, ultra-low latency real-time technical interview copilot.
Your job is to provide crisp, high-impact answers to technical & behavioral interview questions instantly.

Return your response strictly as valid JSON matching this structure:
{
  "intent": "BEHAVIORAL" | "CODING_ALGORITHM" | "SYSTEM_DESIGN" | "TECHNICAL_KNOWLEDGE" | "GENERAL",
  "summary": "1-2 sentence direct, punchy answer the candidate can speak out loud immediately.",
  "bulletPoints": [
    "Key architectural/technical point 1 with exact terminology",
    "Key trade-off or metric 2",
    "Key implementation nuance 3"
  ],
  "codeSnippet": {
    "language": "TypeScript / Python / Rust / C++ / Go",
    "code": "Optimal, clean, production-grade code implementation",
    "complexity": "Time: O(...) | Space: O(...)"
  } (or null if not a coding question),
  "starStory": {
    "situation": "Context & high-stakes challenge",
    "task": "Specific engineering objective",
    "action": "Exact architectural action & tools you led",
    "result": "Quantifiable metrics & business outcome"
  } (or null if not a behavioral/leadership question)
}
Output pure JSON only. No markdown fences around the json.`;

export class AIService {
  public static classifyIntent(question: string): IntentCategory {
    const q = question.toLowerCase();
    if (
      q.includes('tell me about a time') ||
      q.includes('conflict') ||
      q.includes('disagreement') ||
      q.includes('proudest') ||
      q.includes('failed') ||
      q.includes('leadership') ||
      q.includes('handle pressure')
    ) {
      return 'BEHAVIORAL';
    }
    if (
      q.includes('write a function') ||
      q.includes('algorithm') ||
      q.includes('leetcode') ||
      q.includes('time complexity') ||
      q.includes('implement') ||
      q.includes('binary tree') ||
      q.includes('array') ||
      q.includes('lru') ||
      q.includes('two sum') ||
      q.includes('dynamic programming') ||
      q.includes('graph')
    ) {
      return 'CODING_ALGORITHM';
    }
    if (
      q.includes('design') ||
      q.includes('architecture') ||
      q.includes('scale') ||
      q.includes('microservice') ||
      q.includes('distributed') ||
      q.includes('rate limiter') ||
      q.includes('cache') ||
      q.includes('throughput') ||
      q.includes('websocket') ||
      q.includes('kafka') ||
      q.includes('pub/sub')
    ) {
      return 'SYSTEM_DESIGN';
    }
    return 'TECHNICAL_KNOWLEDGE';
  }

  public static async generateCopilotResponse(
    question: string,
    settings: AppSettings
  ): Promise<CopilotSuggestion> {
    const startTime = performance.now();
    const intent = this.classifyIntent(question);
    const contextPrompt = settings.resumeContext
      ? `Candidate Background / Portfolio:\n${settings.resumeContext}\n\n`
      : '';

    const userPrompt = `${contextPrompt}Interviewer Question: "${question}"\nGenerate the optimal interview copilot JSON response.`;

    try {
      if (settings.modelProvider === 'groq' && settings.apiKey) {
        const res = await this.callGroq(userPrompt, settings);
        const elapsed = Math.round(performance.now() - startTime);
        return {
          ...res,
          id: `sug-${Date.now()}`,
          question,
          intent: res.intent || intent,
          timestamp: Date.now(),
          latencyMs: elapsed,
          modelUsed: `Groq (${settings.groqModel || 'llama-3.3-70b-versatile'})`,
        };
      }

      if (settings.modelProvider === 'openai' && settings.apiKey) {
        const res = await this.callOpenAI(userPrompt, settings.apiKey);
        const elapsed = Math.round(performance.now() - startTime);
        return {
          ...res,
          id: `sug-${Date.now()}`,
          question,
          intent: res.intent || intent,
          timestamp: Date.now(),
          latencyMs: elapsed,
          modelUsed: 'OpenAI GPT-4o',
        };
      }

      if (settings.modelProvider === 'anthropic' && settings.apiKey) {
        const res = await this.callAnthropic(userPrompt, settings.apiKey);
        const elapsed = Math.round(performance.now() - startTime);
        return {
          ...res,
          id: `sug-${Date.now()}`,
          question,
          intent: res.intent || intent,
          timestamp: Date.now(),
          latencyMs: elapsed,
          modelUsed: 'Claude 3.5 Sonnet',
        };
      }

      if (settings.modelProvider === 'openrouter' && settings.apiKey) {
        const res = await this.callOpenRouter(userPrompt, settings);
        const elapsed = Math.round(performance.now() - startTime);
        return {
          ...res,
          id: `sug-${Date.now()}`,
          question,
          intent: res.intent || intent,
          timestamp: Date.now(),
          latencyMs: elapsed,
          modelUsed: `OpenRouter (${settings.openRouterModel || 'Unknown'})`,
        };
      }

      if (settings.modelProvider === 'local') {
        const res = await this.callLocalModel(userPrompt, settings);
        const elapsed = Math.round(performance.now() - startTime);
        return {
          ...res,
          id: `sug-${Date.now()}`,
          question,
          intent: res.intent || intent,
          timestamp: Date.now(),
          latencyMs: elapsed,
          modelUsed: `Local (${settings.localModelName || 'llama3.2'})`,
        };
      }

      // Offline Heuristic Engine Fallback (instant <50ms response)
      const res = this.generateOfflineHeuristic(question, intent, settings.resumeContext);
      const elapsed = Math.round(performance.now() - startTime);
      return {
        ...res,
        id: `sug-${Date.now()}`,
        question,
        intent,
        timestamp: Date.now(),
        latencyMs: elapsed,
        modelUsed: 'Built-in Realtime Engine (Offline)',
      };
    } catch (err) {
      console.warn('AI Service upstream error:', err);
      const elapsed = Math.round(performance.now() - startTime);
      return {
        id: `sug-${Date.now()}`,
        question,
        intent,
        summary: `AI Connection Failed: ${(err as Error).message}`,
        bulletPoints: [
          'If using Ollama in Docker, ensure CORS is allowed (OLLAMA_ORIGINS="*").',
          'Ensure the local model name matches exactly (e.g. llama3.2).',
          'Check browser dev tools console for full error details.'
        ],
        timestamp: Date.now(),
        latencyMs: elapsed,
        modelUsed: 'Error Fallback',
      };
    }
  }

  private static parseJSONSafely(text: string): any {
    try {
      return JSON.parse(text);
    } catch {
      // Clean possible markdown code fences ```json ... ```
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      throw new Error('Could not parse JSON response from LLM');
    }
  }

  private static async callGroq(prompt: string, settings: AppSettings): Promise<any> {
    const model = settings.groqModel || 'llama-3.3-70b-versatile';
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Groq API returned ${response.status}: ${err}`);
    }

    const data = await response.json();
    return this.parseJSONSafely(data.choices[0].message.content);
  }

  private static async callOpenAI(prompt: string, apiKey: string): Promise<any> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API returned ${response.status}: ${err}`);
    }

    const data = await response.json();
    return this.parseJSONSafely(data.choices[0].message.content);
  }

  private static async callAnthropic(prompt: string, apiKey: string): Promise<any> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'dangerously-allow-browser': 'true',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API returned ${response.status}: ${err}`);
    }

    const data = await response.json();
    return this.parseJSONSafely(data.content[0].text);
  }

  private static async callOpenRouter(prompt: string, settings: AppSettings): Promise<any> {
    const model = settings.openRouterModel || 'meta-llama/llama-3-8b-instruct:free';
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter API returned ${response.status}: ${err}`);
    }

    const data = await response.json();
    return this.parseJSONSafely(data.choices[0].message.content);
  }

  private static async callLocalModel(prompt: string, settings: AppSettings): Promise<any> {
    const url = settings.localModelUrl || 'http://localhost:11434';
    const model = settings.localModelName || 'llama3.2';

    // Try Ollama native endpoint first
    const response = await fetch(`${url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: `${SYSTEM_PROMPT}\n\n${prompt}`,
        format: 'json',
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Local model endpoint returned ${response.status}`);
    }

    const data = await response.json();
    return this.parseJSONSafely(data.response);
  }

  private static generateOfflineHeuristic(
    question: string,
    intent: IntentCategory,
    resumeContext: string
  ): Omit<CopilotSuggestion, 'id' | 'question' | 'timestamp'> {
    if (intent === 'BEHAVIORAL') {
      return {
        intent: 'BEHAVIORAL',
        summary:
          'Led a high-concurrency production refactor resolving distributed race conditions and cut p99 latency by 65%.',
        bulletPoints: [
          'Pinpointed microservice database deadlocks using distributed OpenTelemetry tracing.',
          'Replaced optimistic retries with Redis distributed Redlock semantics and atomic Lua scripts.',
          'Delivered zero transaction inconsistencies across 3M+ high-volume requests with zero customer impact.',
        ],
        starStory: {
          situation:
            'A high-concurrency payment settlement service experienced database deadlocks during flash sale spikes.',
          task: 'Eliminate double-spending and ledger discrepancies while maintaining sub-50ms latency.',
          action:
            'Engineered an idempotent transaction queue with Redis distributed locks and atomic Lua operations.',
          result:
            'Eliminated 100% of ledger inconsistencies and decreased p99 response latency from 140ms to 32ms.',
        },
        retrievedContext: resumeContext ? ['Resume: High-Throughput Distributed Systems'] : undefined,
      };
    }

    if (intent === 'CODING_ALGORITHM') {
      return {
        intent: 'CODING_ALGORITHM',
        summary:
          'Implement with a Hash Map paired with a Doubly Linked List to guarantee strict O(1) time complexity for both get and put.',
        bulletPoints: [
          'Hash Map provides instant O(1) node pointer lookup by key.',
          'Doubly Linked List allows O(1) removal and re-insertion at the head for recency tracking.',
          'Use dummy Head and Tail sentinel nodes to eliminate boundary null checks.',
        ],
        codeSnippet: {
          language: 'TypeScript / Rust',
          code: `class LRUCache<K, V> {
  private capacity: number;
  private cache = new Map<K, V>();

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  get(key: K): V | -1 {
    if (!this.cache.has(key)) return -1;
    const val = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, val); // Move to most recent
    return val;
  }

  put(key: K, value: V): void {
    if (this.cache.has(key)) this.cache.delete(key);
    else if (this.cache.size >= this.capacity) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }
}`,
          complexity: 'Time: O(1) get & put | Space: O(capacity)',
        },
      };
    }

    if (intent === 'SYSTEM_DESIGN') {
      return {
        intent: 'SYSTEM_DESIGN',
        summary:
          'Architect an asynchronous event-driven cluster using Rust/Go edge gateways with Redis Dragonfly Pub/Sub for sub-10ms fanout.',
        bulletPoints: [
          'Edge Gateway: Non-blocking async event loop (Tokio/epoll) with zero-copy buffer recycling.',
          'State & Fanout: Partition websocket connections across nodes using consistent hashing rings; Pub/Sub backplane for distributed room broadcasts.',
          'Backpressure: Implement bounded ring buffers per socket connection to drop degraded frames gracefully without blocking threads.',
        ],
      };
    }

    return {
      intent: 'TECHNICAL_KNOWLEDGE',
      summary:
        `Direct answer for ${question}: Focus on clean separation of concerns, acyclic dependencies, and memory safety.`,
      bulletPoints: [
        'Pure functions at boundaries with explicit error values over uncaught exceptions.',
        'Deterministic resource cleanup and thread-safe shared state synchronization.',
        'Comprehensive telemetry metrics for latency, throughput, and error budgets.',
      ],
    };
  }
}
