sed -i 's/fetch('\''\/api\/chat'\'', {/fetch('\''\/api\/generate-insights'\'', {/g' pages/ExpenseTracker.tsx
sed -i 's/body: JSON.stringify({ message: "Generate an analysis on my budgets: " + JSON.stringify(activeBudgets), history: \[\] })/body: JSON.stringify({ summary: { budgets: activeBudgets, type: "budget_analysis" }, currency: currencySymbol })/g' pages/ExpenseTracker.tsx
