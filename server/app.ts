import { validateInvoice } from './services/invoiceValidator.js';
import { validateGST3BData, generateGST3BXml } from './services/gstValidator.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import { AIRouter } from './ai-router.js';

export const app = express();
app.use(helmet({
  contentSecurityPolicy: false, // disabled for local dev / react compatibility
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const upload = multer({ storage: multer.memoryStorage() });
const aiRouter = new AIRouter();

// API endpoints
app.post('/api/scan-invoice', (req, res, next) => {
  upload.single('invoice')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ error: 'File upload error: ' + err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileMimeType = req.file.mimetype;
    const fileBuffer = req.file.buffer;
    const base64Image = fileBuffer.toString('base64');
    
    const prompt = `Extract the following information and respond ONLY with a valid JSON object matching this structure, with no markdown formatting or extra text:
{
  "invoice_type": "sales" or "purchase",
  "invoice_number": "string",
  "date": "YYYY-MM-DD",
  "vendor_name": "string",
  "customer_name": "string",
  "vendor_gstin": "string",
  "customer_gstin": "string",
  "items": [
    {
      "description": "string",
      "hsn": "string",
      "quantity": number,
      "rate": number,
      "amount": number
    }
  ],
  "total_amount": number,
  "total_cgst": number,
  "total_sgst": number,
  "total_igst": number
}
Determine if this is a 'sales' invoice (issued to a customer) or a 'purchase' invoice (received from a vendor / a receipt).
If any field is not found or unclear, leave it empty or 0. Try your best to extract HSN and tax breakdown.`;

    const result = await aiRouter.routeRequest({
      task: 'scanInvoice',
      prompt,
      image: {
        base64: base64Image,
        mimeType: fileMimeType
      },
      jsonMode: true
    });

    return res.json(result);
  } catch (error: any) {
    console.error('Invoice scan error:', error);
    res.status(500).json({ error: error.message || 'Failed to scan invoice' });
  }
});

app.post('/api/parse-voice', async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    const prompt = `Extract transaction items from the following voice transcript.
Respond ONLY with a valid JSON array of objects matching this structure, with no markdown formatting:
[
  {
    "amount": number,
    "description": "string",
    "category": "string (Food, Transport, Utilities, Entertainment, Shopping, Health, Salary, Freelance, Investments, Gift, Other)",
    "type": "expense" or "income"
  }
]
Transcript: "${transcript}"`;

    const result = await aiRouter.routeRequest({
      task: 'aiSuggestions',
      prompt,
      jsonMode: true
    });

    let parsed = result;
    if (parsed.items) parsed = parsed.items;
    return res.json({ items: Array.isArray(parsed) ? parsed : Object.values(parsed) });
  } catch (error: any) {
    console.error('Parse voice error:', error);
    res.status(500).json({ error: error.message || 'Failed to parse voice' });
  }
});

app.post('/api/parse-invoice-voice', async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    const prompt = `Extract invoice item details from the following voice transcript.
Respond ONLY with a valid JSON array of objects matching this structure, with no markdown formatting:
[
  {
    "description": "string (name of the item or service)",
    "quantity": number (default to 1 if not specified),
    "rate": number (price per unit)
  }
]
Transcript: "${transcript}"`;

    const result = await aiRouter.routeRequest({
      task: 'aiSuggestions',
      prompt,
      jsonMode: true
    });

    let parsed = result;
    if (parsed.items) parsed = parsed.items;
    return res.json({ items: Array.isArray(parsed) ? parsed : Object.values(parsed) });
  } catch (error: any) {
    console.error('Parse invoice voice error:', error);
    res.status(500).json({ error: error.message || 'Failed to parse invoice voice' });
  }
});

app.post('/api/generate-monthly-report', async (req, res) => {
  try {
    const { data, budgets, currencySymbol } = req.body;
    const prompt = `Analyze this financial data and provide a detailed report with insights on income, expenses, budgets, and savings.
Data: ${JSON.stringify(data)}
Active Budgets Status: ${JSON.stringify(budgets)}
Currency: ${currencySymbol}

Format the output in Markdown with the following sections:
### Overview
### Budget Tracking Analysis
### Spending Insights
### Savings & Recommendations`;
    
    const response = await aiRouter.routeRequest({
      task: 'businessReports',
      prompt: prompt,
      jsonMode: false
    });
    res.json({ result: response });
  } catch (error: any) {
    console.error('AI Monthly Report Error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate report' });
  }
});

app.post('/api/generate-insights', async (req, res) => {
  try {
    const { summary, currency = 'INR' } = req.body;

    if (!summary) {
      return res.status(400).json({ error: 'Financial summary is required' });
    }

    const prompt = `Analyze the following business financial data and generate 4-6 simple, actionable insights or recommendations.
Cover areas like Income, Expenses, Savings, Profit, GST, Customers, and Vendors if applicable.
Respond ONLY with a valid JSON array matching this exact structure, with no markdown formatting or extra text:
[
  {
    "title": "string (Short insight title)",
    "description": "string (1-2 sentences of actionable advice or observation)",
    "category": "income" | "expense" | "tax" | "general" | "warning" | "success"
  }
]

NOTE: All monetary values provided are in ${currency}. Generate insights using the ${currency} currency symbol.

Financial Data Summary:
${JSON.stringify(summary, null, 2)}
`;

    const result = await aiRouter.routeRequest({
      task: 'financialSummaries',
      prompt,
      jsonMode: true
    });

    let parsed = result;
    if (parsed.insights) parsed = parsed.insights; // Handle potential object wrapper
    return res.json({ insights: Array.isArray(parsed) ? parsed : Object.values(parsed) });

  } catch (error: any) {
    console.error('Generate insights error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate insights' });
  }
});

app.post('/api/budget-calculator', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages are required' });
    }

    const systemPrompt = `You are an expert financial planner and trip advisor. The user is asking you to create a detailed budget breakdown for a trip, project, or event. 
Provide a comprehensive, itemized budget in Markdown format. 
Use markdown tables for the budget breakdown (Item, Estimated Cost, Notes). 
Include sections for an Executive Summary, Detailed Expenses (tailored to the requested budget level), Facilities & Activities (detailing what facilities can be accessed and what can be explored with this specific budget in full details), and Money Saving Tips. 
Be creative but realistic with numbers. Structure the response clearly with headings.`;

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
  } catch (error: any) {
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
      systemPrompt: `You are roleplaying in the following scenario: ${scenario || 'Financial Advisor'}.`,
      messages
    });
    return res.json({ response: result });
  } catch (error: any) {
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
  } catch (error: any) {
    console.error('Legal error:', error);
    res.status(500).json({ error: error.message || 'Failed to get legal response' });
  }
});

app.post('/api/financial-coach', async (req, res) => {
  try {
    const { messages, context, language = 'Hindi/English (based on query)' } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages are required' });
    }

    let totalRevenue = 0;
    let totalExpenses = 0;
    const categories: Record<string, number> = {};

    if (context?.recent_transactions) {
       context.recent_transactions.forEach((tx: any) => {
           const amount = Number(tx.amount) || 0;
           if (tx.type === 'income') totalRevenue += amount;
           if (tx.type === 'expense') {
               totalExpenses += amount;
               categories[tx.category || 'Other'] = (categories[tx.category || 'Other'] || 0) + amount;
           }
       });
    }
    
    const topCategories = Object.entries(categories).sort((a,b) => b[1] - a[1]).slice(0,3).map(e => e[0]).join(', ') || 'None';
    const businessType = context?.profile_type || 'Small Business';

    const systemPrompt = `You are a financial advisor for Indian small businesses. Analyze the user's expense data and provide personalized advice. You MUST reply ONLY in the language the user uses in their prompt. If the user asks in English, reply entirely in English. If the user asks in Hindi, reply entirely in Hindi. Do not mix languages unless necessary for specific terminology.

Context:
- User speaks: ${language}
- Monthly revenue: ₹${totalRevenue}
- Monthly expenses: ₹${totalExpenses}
- Top expense categories: ${topCategories}
- Business type: ${businessType}

Provide:
1. Spending pattern analysis
2. Cost optimization opportunities specific to ${businessType}
3. GST-related tax savings recommendations
4. Cash flow forecasting for next 3 months
5. Top 3 actionable recommendations

Format response in ${language} using conversational Hindi where appropriate. Do not hallucinate facts or data. If you lack data, make reasonable assumptions based on the Business type and Indian SMB landscape.

Raw Context Data for Reference:
${JSON.stringify(context || {})}`;

    const result = await aiRouter.routeRequest({
      task: 'financialCoach',
      prompt: '',
      systemPrompt,
      messages
    });

    return res.json({ response: result });
  } catch (error: any) {
    console.error('Financial coach error:', error);
    res.status(500).json({ error: error.message || 'Failed to get response' });
  }
});

app.post('/api/categorize-transaction', async (req, res) => {
  try {
    const { description, amount, date, prevCategory, businessType, gstType, revenue } = req.body;
    
    const prompt = `Categorize this transaction and flag compliance issues for Indian SMBs.

Transaction details:
- Description: ${description}
- Amount: ₹${amount}
- Date: ${date}
- Previous category: ${prevCategory || 'None'}

Context:
- User's business type: ${businessType || 'Small Business'}
- Their GST registration: ${gstType || 'Unregistered'}
- Monthly revenue: ₹${revenue || 0}

Respond ONLY with a valid JSON object matching this structure, with no markdown formatting:
{
  "category": "one of [revenue, salary, rent, utilities, office_supplies, travel, food, marketing, software, professional_services, depreciation, other]",
  "sub_category": "more specific category",
  "gst_applicable": true/false,
  "gst_rate": "0%, 5%, 12%, 18%, 28%",
  "tax_deductible": true/false,
  "flags": ["flag1", "flag2"],
  "explanation": "brief explanation in user's language",
  "confidence": 0.95
}`;

    const aiResult = await aiRouter.routeRequest({
    task: 'categorizeTransaction',
    prompt,
    jsonMode: true
  });

  const validCategories = {
    revenue: { deductible: false, gstRate: '18%' },
    salary: { deductible: true, gstRate: 'N/A' },
    rent: { deductible: true, gstRate: '0%' },
    utilities: { deductible: true, gstRate: '18%' },
    office_supplies: { deductible: true, gstRate: '18%' },
    travel: { deductible: true, gstRate: '5-18%' },
    food: { deductible: false, gstRate: '5%' }, // Personal expense typically
    marketing: { deductible: true, gstRate: '18%' },
    software: { deductible: true, gstRate: '18%' },
    professional_services: { deductible: true, gstRate: '18%' },
    depreciation: { deductible: true, gstRate: 'N/A' },
    other: { deductible: false, gstRate: 'Verify' }
  };

  if (aiResult.category && validCategories[aiResult.category as keyof typeof validCategories]) {
    const categoryData = validCategories[aiResult.category as keyof typeof validCategories];
    
    if (aiResult.category === 'food') {
      aiResult.tax_deductible = false;
      if (!aiResult.explanation) aiResult.explanation = '';
      aiResult.explanation += ' Note: Personal meal expenses are NOT deductible. Only business entertainment may qualify.';
    }
  }

  return res.json({ result: aiResult });
  } catch (error: any) {
    console.error('Categorize transaction error:', error);
    res.status(500).json({ error: error.message || 'Failed to categorize transaction' });
  }
});

app.post('/api/generate-gst3b', async (req, res) => {
try {
  const {
    gstin,
    fy,
    quarter,
    businessType,
    sales,
    taxableSales,
    purchases,
    itcPurchases,
    b2b,
    b2c,
    exportSales
  } = req.body;

  // Validate before processing
  const validation = validateGST3BData({
    gstin,
    fy,
    quarter,
    businessType,
    sales,
    taxableSales,
    purchases,
    itcPurchases,
    b2b,
    b2c,
    exportSales
  });

  if (!validation.valid) {
    return res.status(400).json({
      error: 'GST data validation failed',
      errors: validation.errors,
      warnings: validation.warnings
    });
  }

  // Generate XML
  const gstXml = generateGST3BXml(
    {
      gstin,
      fy,
      quarter,
      businessType,
      sales,
      taxableSales,
      purchases,
      itcPurchases,
      b2b,
      b2c,
      exportSales
    },
    validation
  );

  // Return both AI insights + validated data + XML
  return res.json({
    result: validation.gstData,
    xml: Buffer.from(gstXml).toString('base64'),
    warnings: validation.warnings,
    complianceStatus: 'validated'
  });

} catch (error: any) {
  console.error('Generate GST-3B error:', error);
  res.status(500).json({ error: error.message || 'Failed to generate GST-3B' });
}
});

app.get('/api/ai-usage', (req, res) => {
  res.json(aiRouter.getUsageLogs());
});

app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});
