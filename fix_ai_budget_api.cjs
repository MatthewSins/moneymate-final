const fs = require('fs');
let content = fs.readFileSync('/app/applet/server.ts', 'utf-8');

const newEndpoint = `
  app.post('/api/budget-calculator', async (req, res) => {
    try {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages are required' });
      }

      const systemPrompt = \`You are an expert financial planner and trip advisor. The user is asking you to create a detailed budget breakdown for a trip, project, or event. 
Provide a comprehensive, itemized budget in Markdown format. 
Include sections for estimated costs, realistic ranges, and practical tips to save money. 
Be creative but realistic with numbers. Return the final output in Markdown.\`;

      const result = await aiRouter.routeRequest({
        task: 'budgetCalculator',
        prompt: '',
        systemPrompt,
        messages
      });

      return res.json({ response: result });
    } catch (error: any) {
      console.error('Budget calculator error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate budget' });
    }
  });

  app.post('/api/financial-coach',`;

content = content.replace(/app\.post\('\/api\/financial-coach',/, newEndpoint);
fs.writeFileSync('/app/applet/server.ts', content);

let ai = fs.readFileSync('/app/applet/pages/AIBudgetCalculator.tsx', 'utf-8');
ai = ai.replace(
  /fetch\('\/api\/financial-coach'/,
  "fetch('/api/budget-calculator'"
);
fs.writeFileSync('/app/applet/pages/AIBudgetCalculator.tsx', ai);
