const fs = require('fs');
let code = fs.readFileSync('server/ai-router.ts', 'utf8');

code = code.replace(/if \(request\.task === 'vision' \|\| request\.image\) \{[\s\S]*?\/\/ Chat\/Reasoning text tasks go to OpenRouter FREE models/, `
    if (!this.openai) {
      throw new Error("OpenRouter API key is required for tasks.");
    }
    const defaultModel = AI_CONFIG.providers.openrouter.models[request.task] || AI_CONFIG.providers.openrouter.models.financialCoach;
    const modelsToTry = [defaultModel, ...AI_CONFIG.providers.openrouter.fallbackModels];
    let lastError = null;
    for (const model of modelsToTry) {
      try {
        const messages = [];
        if (request.systemPrompt) {
          messages.push({ role: 'system', content: request.systemPrompt });
        }
        if (request.messages && request.messages.length > 0) {
          messages.push(...request.messages);
        } else if (request.prompt || request.image) {
          const content = [];
          if (request.prompt) {
            content.push({ type: 'text', text: request.prompt });
          }
          if (request.image) {
            content.push({ type: 'image_url', image_url: { url: \`data:\${request.image.mimeType};base64,\${request.image.base64}\` } });
          }
          messages.push({ role: 'user', content: content.length > 0 ? content : request.prompt });
        }
        const params = {
          model: model,
          messages,
          max_tokens: request.task === 'categorizeTransaction' ? 256 : (request.task === 'generateGST3B' ? 2048 : 2048),
          temperature: request.task === 'categorizeTransaction' ? 0.1 : (request.task === 'gstExplanations' || request.task === 'businessReports' || request.task === 'generateGST3B' ? 0.0 : 0.7),
        };

        if (request.jsonMode) {
           // We might need to handle this based on the model, but let's assume it works or we just parse it.
           // Some models on OpenRouter support response_format
        }

        const response = await this.openai.chat.completions.create(params);
        let resultText = response.choices[0]?.message?.content || (request.jsonMode ? "{}" : "");
        
        let result = resultText;
        if (request.jsonMode) {
            try {
                // simple cleanup
                const jsonStr = resultText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
                result = JSON.parse(jsonStr);
            } catch(e) {
                // If it fails, return raw text or empty obj
                console.warn("Failed to parse JSON", e);
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
      } catch (error) {
        lastError = error;
        retries++;
        console.warn(\`[AI Router] Model \${model} failed, trying fallback...\`, error.message);
      }
    }

    // Chat/Reasoning text tasks go to OpenRouter FREE models
`);
code = code.replace(/if \(\!this\.openai\) \{[\s\S]*?\/\/ Chat\/Reasoning text tasks go to OpenRouter FREE models/, `// Routing everything via OpenRouter loop above.`);
fs.writeFileSync('server/ai-router.ts', code);
