const fs = require('fs');
let code = fs.readFileSync('server/ai-router.ts', 'utf8');

code = code.replace(/if \(!this\.openai\) \{\s*throw new Error\("OpenRouter API key is required for tasks\."\);\s*\}/, `
    if (!this.openai) {
      if (!this.gemini) {
        throw new Error("Either OpenRouter or Gemini API key is required.");
      }
      return this.fallbackToGemini(request, startTime, retries, cacheKey);
    }
`);

// Also need to wrap the Gemini fallback in a helper method so it can be called.
code = code.replace(/if \(this\.gemini\) \{\s*console\.warn\(\\\`\[AI Router\] OpenRouter models failed, falling back to Gemini\.\.\.\\\`\);\s*try \{[\s\S]*?lastError = geminiError;\s*\}\s*\}/, `
    if (this.gemini) {
      return this.fallbackToGemini(request, startTime, retries, cacheKey, lastError);
    }
`);

// Add the fallback method to the class
code = code.replace(/getUsageLogs\(\) \{/, `
  private async fallbackToGemini(request: AIRequest, startTime: number, retries: number, cacheKey: string, previousError: any = null) {
      console.warn(\`[AI Router] Using Gemini (OpenRouter failed or not configured)...\`);
      try {
        const model = AI_CONFIG.providers.gemini.textModel || 'gemini-3-flash-preview';
        const parts: any[] = [];
        if (request.systemPrompt) {
            parts.push({ text: \`System Prompt: \${request.systemPrompt}\` });
        }
        if (request.messages && request.messages.length > 0) {
            for (const msg of request.messages) {
               parts.push({ text: \`\${msg.role}: \${msg.content}\` });
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
           temperature: request.task === 'categorizeTransaction' ? 0.1 : 0.7
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
            const jsonStr = resultText.replace(/\\\`\\\`\\\`json/g, '').replace(/\\\`\\\`\\\`/g, '').trim();
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
         throw new Error(\`All fallback models failed. Last error: \${geminiError?.message}\`);
      }
  }

  getUsageLogs() {`);

fs.writeFileSync('server/ai-router.ts', code);
