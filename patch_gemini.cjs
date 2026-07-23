const fs = require('fs');
let code = fs.readFileSync('server/ai-router.ts', 'utf8');

code = code.replace(/if \(!this\.openai\) \{\s*throw new Error\("OpenRouter API key is required for text and reasoning tasks\."\);\s*\}/, `
    if (!this.openai) {
      if (!this.gemini) {
         throw new Error("Either OpenRouter or Gemini API key is required.");
      }
      // If no OpenRouter key, jump straight to Gemini fallback
      return this.fallbackToGemini(request, startTime, retries, cacheKey);
    }
`);

fs.writeFileSync('server/ai-router.ts', code);
