const fs = require('fs');
let content = fs.readFileSync('/app/applet/server.ts', 'utf-8');

content = content.replace(
  /const { data, currencySymbol } = req\.body;/,
  "const { data, budgets, currencySymbol } = req.body;"
);

content = content.replace(
  /const prompt = \`Analyze this monthly financial data[\s\S]*?### Remaining Budget & Savings\`;/,
  `const prompt = \`Analyze this financial data and provide a detailed report with insights on income, expenses, budgets, and savings.
Data: \${JSON.stringify(data)}
Active Budgets Status: \${JSON.stringify(budgets)}
Currency: \${currencySymbol}

Format the output in Markdown with the following sections:
### Overview
### Budget Tracking Analysis
### Spending Insights
### Savings & Recommendations\`;`
);

fs.writeFileSync('/app/applet/server.ts', content);
