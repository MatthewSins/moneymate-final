const fs = require('fs');
let content = fs.readFileSync('/app/applet/pages/ExpenseTracker.tsx', 'utf-8');

content = content.replace(
  /const activeBudgetsList = transactions\.filter\(t => t\.type === 'budget'\)\.map\(b => b\.description\)\.filter\(Boolean\);/,
  `const activeBudgetsList = Array.from(new Set([
        ...(budgetAmount > 0 ? ['Global Budget'] : []),
        ...transactions.filter(t => t.type === 'budget').map(b => b.description).filter(Boolean)
      ]));`
);

content = content.replace(
  /\{Array\.from\(new Set\(transactions\.filter\(t => t\.type === 'budget'\)\.map\(b => b\.description\)\.filter\(Boolean\)\)\)\.map\(\(b: any\) => \(/,
  `{Array.from(new Set([
                    ...(budgetAmount > 0 ? ['Global Budget'] : []),
                    ...transactions.filter(t => t.type === 'budget').map(b => b.description).filter(Boolean)
                  ])).map((b: any) => (`
);

fs.writeFileSync('/app/applet/pages/ExpenseTracker.tsx', content);
