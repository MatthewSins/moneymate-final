const fs = require('fs');
let content = fs.readFileSync('/app/applet/pages/ExpenseTracker.tsx', 'utf-8');

content = content.replace(
  /setValue\('type', 'expense', \{ shouldValidate: true \}\);/,
  "setValue('type', 'expense', { shouldValidate: true });\n      setIsSubmitting(false);"
);

fs.writeFileSync('/app/applet/pages/ExpenseTracker.tsx', content);
