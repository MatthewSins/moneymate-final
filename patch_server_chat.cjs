const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const chatRoute = `
  app.post('/api/chat', async (req, res) => {
    try {
      const { message, history, systemPrompt } = req.body;
      const messages = [...(history || [])];
      if (message) {
        messages.push({ role: 'user', content: message });
      }
      
      const result = await aiRouter.routeRequest({
        task: 'chat',
        prompt: message,
        systemPrompt: systemPrompt || "You are a helpful AI assistant for MoneyMate.",
        messages
      });
      return res.json({ response: result });
    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({ error: error.message || 'Failed to get chat response' });
    }
  });

  app.post('/api/roleplay', async (req, res) => {
    try {
      const { message, history, scenario } = req.body;
      const messages = [...(history || [])];
      if (message) {
        messages.push({ role: 'user', content: message });
      }
      
      const result = await aiRouter.routeRequest({
        task: 'roleplay',
        prompt: message,
        systemPrompt: \`You are roleplaying in the following scenario: \${scenario || 'Financial Advisor'}.\`,
        messages
      });
      return res.json({ response: result });
    } catch (error) {
      console.error('Roleplay error:', error);
      res.status(500).json({ error: error.message || 'Failed to get roleplay response' });
    }
  });

  app.post('/api/legal', async (req, res) => {
    try {
      const { message, history } = req.body;
      const messages = [...(history || [])];
      if (message) {
        messages.push({ role: 'user', content: message });
      }
      
      const result = await aiRouter.routeRequest({
        task: 'legal',
        prompt: message,
        systemPrompt: "You are a legal advisor for financial and business matters in India.",
        messages
      });
      return res.json({ response: result });
    } catch (error) {
      console.error('Legal error:', error);
      res.status(500).json({ error: error.message || 'Failed to get legal response' });
    }
  });
`;

code = code.replace(/app\.post\('\/api\/financial-coach',/, chatRoute + "\n  app.post('/api/financial-coach',");
fs.writeFileSync('server.ts', code);
