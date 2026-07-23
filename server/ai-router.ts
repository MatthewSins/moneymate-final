import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { AI_CONFIG, TaskType } from './ai-config.js';

// In-memory logging and caching for demonstration purposes
const usageLogs: any[] = [];
const cache = new Map<string, any>();

interface AIRequest {
  task: TaskType;
  prompt: string;
  systemPrompt?: string;
  messages?: any[];
  image?: {
    base64: string;
    mimeType: string;
  };
  jsonMode?: boolean;
}

export class AIRouter {
  private openai: OpenAI | null = null;
  private gemini: GoogleGenAI | null = null;

  constructor() {
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (openRouterKey) {
      this.openai = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: openRouterKey,
        defaultHeaders: {
          "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
          "X-Title": "MoneyMate",
        }
      });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      this.gemini = new GoogleGenAI({ apiKey: geminiKey });
    }
  }

  private logUsage(record: any) {
    usageLogs.push({ ...record, timestamp: new Date() });
    console.log('[AI Router Log]', record);
  }

  private generateCacheKey(request: AIRequest): string {
    return JSON.stringify({
      task: request.task,
      prompt: request.prompt,
      systemPrompt: request.systemPrompt,
      messages: request.messages,
      hasImage: !!request.image
    });
  }

  async routeRequest(request: AIRequest): Promise<any> {
    const startTime = Date.now();
    let retries = 0;
    
    // Check Cache
    const cacheKey = this.generateCacheKey(request);
    if (!request.image && cache.has(cacheKey)) {
      console.log('[AI Router] Cache hit for task:', request.task);
      return cache.get(cacheKey);
    }

    // Routing everything via OpenRouter loop above.

    
    if (!this.openai) {
      if (!this.gemini) {
         throw new Error("Either OpenRouter or Gemini API key is required.");
      }
      // If no OpenRouter key, jump straight to Gemini fallback
      return this.fallbackToGemini(request, startTime, retries, cacheKey);
    }


    const defaultModel = AI_CONFIG.providers.openrouter.models[request.task as keyof typeof AI_CONFIG.providers.openrouter.models] || AI_CONFIG.providers.openrouter.models.financialCoach;
    let modelsToTry = [defaultModel, ...AI_CONFIG.providers.openrouter.fallbackModels];
    
    if (request.image) {
       // Filter fallback models to only those that might support vision based on user config
       const visionModels = [
          'google/gemma-4-31b-it:free',
          'google/gemma-4-26b-a4b-it:free',
          'nvidia/nemotron-nano-12b-v2-vl:free',
          'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'
       ];
       modelsToTry = [defaultModel, ...visionModels.filter(m => m !== defaultModel)].slice(0, 3); // max 3 to prevent timeout
    }

    let lastError = null;

    for (const model of modelsToTry) {
      try {
        const messages: any[] = [];
        if (request.systemPrompt) {
          messages.push({ role: 'system', content: request.systemPrompt });
        }
        if (request.messages && request.messages.length > 0) {
          messages.push(...request.messages);
        } else if (request.prompt) {
          if (request.image) {
            messages.push({
              role: 'user',
              content: [
                { type: 'text', text: request.prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${request.image.mimeType};base64,${request.image.base64}`
                  }
                }
              ]
            });
          } else {
            messages.push({ role: 'user', content: request.prompt });
          }
        }

        const params: any = {
          model: model,
          messages,
          max_tokens: request.task === 'categorizeTransaction' ? 256 : (request.task === 'budgetCalculator' ? 4096 : (request.task === 'generateGST3B' ? 2048 : 2048)),
          temperature: request.task === 'categorizeTransaction' ? 0.1 : (request.task === 'gstExplanations' || request.task === 'businessReports' || request.task === 'generateGST3B' ? 0.0 : 0.7),
        };
        
        // OpenRouter free models might not all support response_format strict json, but we can pass it if needed, or rely on prompt.
        if (request.jsonMode) {
            // Some models on OpenRouter support response_format, some don't. We will rely on prompt engineering as standard fallback, but we can try response_format for known good models.
            // params.response_format = { type: "json_object" };
        }

        const response = await this.openai.chat.completions.create(params);
        let resultText = response.choices[0]?.message?.content || (request.jsonMode ? "{}" : "");
        
        let result = resultText;
        if (request.jsonMode) {
            try {
                result = JSON.parse(resultText);
            } catch(e) {
                // simple cleanup
                result = JSON.parse(resultText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, ''));
            }
        }

        this.logUsage({
          provider: 'openrouter',
          model,
          feature: request.task,
          responseTime: Date.now() - startTime,
          failureCount: retries,
          retries,
        });

        cache.set(cacheKey, result);
        return result;

      } catch (error: any) {
        lastError = error;
        retries++;
        console.warn(`[AI Router] Model ${model} failed, trying fallback...`, error.message);
      }
    }

    if (this.gemini) {
      console.warn(`[AI Router] OpenRouter models failed, falling back to Gemini...`);
      try {
        const model = AI_CONFIG.providers.gemini.textModel || 'gemini-3-flash-preview';
        const parts: any[] = [];
        if (request.systemPrompt) {
            parts.push({ text: `System Prompt: ${request.systemPrompt}` });
        }
        if (request.messages && request.messages.length > 0) {
            for (const msg of request.messages) {
               parts.push({ text: `${msg.role}: ${msg.content}` });
            }
        } else if (request.prompt) {
            parts.push({ text: request.prompt });
        }

        const config: any = {
           temperature: request.task === 'categorizeTransaction' ? 0.1 : (request.task === 'gstExplanations' || request.task === 'businessReports' || request.task === 'generateGST3B' ? 0.0 : 0.7),
           maxOutputTokens: request.task === 'budgetCalculator' ? 8192 : 2048
        };
        if (request.jsonMode) {
          config.responseMimeType = 'application/json';
        }

        const response = await this.gemini.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
          config
        });

        let resultText = response.text || (request.jsonMode ? "{}" : "");
        let result = resultText;
        if (request.jsonMode) {
          try {
            result = JSON.parse(resultText);
          } catch(e) {
            result = JSON.parse(resultText.replace(/```json/g, '').replace(/```/g, ''));
          }
        }

        this.logUsage({
          provider: 'google-gemini (fallback)',
          model,
          feature: request.task,
          responseTime: Date.now() - startTime,
          failureCount: retries,
          retries,
        });

        cache.set(cacheKey, result);
        return result;

      } catch (geminiError: any) {
         console.error('[AI Router] Gemini fallback also failed:', geminiError.message);
         lastError = geminiError;
      }
    }

    this.logUsage({ provider: 'openrouter', feature: request.task, responseTime: Date.now() - startTime, failureCount: retries, retries, error: lastError?.message });
    throw new Error(`All fallback models failed. Last error: ${lastError?.message}`);
  }

  
  private async fallbackToGemini(request: AIRequest, startTime: number, retries: number, cacheKey: string, previousError: any = null) {
      console.info(`[AI Router] Falling back to Gemini...`);
      try {
        const model = AI_CONFIG.providers.gemini.textModel || 'gemini-3-flash-preview';
        const parts: any[] = [];
        if (request.systemPrompt) {
            parts.push({ text: `System Prompt: ${request.systemPrompt}` });
        }
        if (request.messages && request.messages.length > 0) {
            for (const msg of request.messages) {
               parts.push({ text: `${msg.role}: ${msg.content}` });
            }
        } else if (request.prompt) {
            parts.push({ text: request.prompt });
        }
        if (request.image) {
          parts.push({
            inlineData: { data: request.image.base64, mimeType: request.image.mimeType }
          });
        }
        const config: any = {
           temperature: request.task === 'categorizeTransaction' ? 0.1 : 0.7,
           maxOutputTokens: request.task === 'budgetCalculator' ? 8192 : 2048
        };
        if (request.jsonMode) {
          config.responseMimeType = 'application/json';
        }

        const response = await this.gemini!.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
          config
        });
        let resultText = response.text || (request.jsonMode ? "{}" : "");
        let result = resultText;
        if (request.jsonMode) {
          try {
            const jsonStr = resultText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
            result = JSON.parse(jsonStr);
          } catch(e) {
            console.warn("Failed to parse JSON", e);
          }
        }
        this.logUsage({
          provider: 'google-gemini (fallback)',
          model,
          feature: request.task,
          responseTime: Date.now() - startTime,
          failureCount: retries,
          retries,
        });
        cache.set(cacheKey, result);
        return result;
      } catch (geminiError: any) {
         console.error('[AI Router] Gemini fallback also failed:', geminiError.message);
         throw new Error(`All fallback models failed. Last error: ${geminiError?.message}`);
      }
  }

  getUsageLogs() {
    return usageLogs;
  }
}
