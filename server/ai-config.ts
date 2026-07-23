export type TaskType = 
  | 'vision'
  | 'financialCoach'
  | 'budgetPlanning'
  | 'expenseAnalysis'
  | 'businessReports'
  | 'gstExplanations'
  | 'invoiceJson'
  | 'financialSummaries'
  | 'aiSuggestions'
  | 'categorizeTransaction'
  | 'generateGST3B'
  | 'roleplay'
  | 'legal'
  | 'calculations'
  | 'budgetCalculator'
  | 'scanInvoice'
  | 'chat';

export const AI_CONFIG = {
  providers: {
    gemini: {
      id: 'google-gemini',
      name: 'Google Gemini',
      visionModel: 'gemini-3-flash-preview',
      textModel: 'gemini-3-flash-preview',
    },
    openrouter: {
      id: 'openrouter',
      name: 'OpenRouter',
      models: {
        financialCoach: 'poolside/laguna-m.1:free',
        budgetPlanning: 'cohere/north-mini-code:free', 
        expenseAnalysis: 'tencent/hy3:free',
        businessReports: 'nvidia/nemotron-3-super-120b-a12b:free',
        gstExplanations: 'tencent/hy3:free',
        invoiceJson: 'google/gemma-4-31b-it:free',
        financialSummaries: 'poolside/laguna-m.1:free',
        aiSuggestions: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
        categorizeTransaction: 'google/gemma-4-26b-a4b-it:free',
        generateGST3B: 'nvidia/nemotron-3-super-120b-a12b:free',
        roleplay: 'poolside/laguna-m.1:free',
        legal: 'nvidia/nemotron-3-super-120b-a12b:free',
        calculations: 'cohere/north-mini-code:free',
        budgetCalculator: 'cohere/north-mini-code:free',
        chat: 'tencent/hy3:free',
        vision: 'google/gemma-4-31b-it:free',
        visionFallback: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
        scanInvoice: 'google/gemma-4-31b-it:free',
        scanGst: 'nvidia/nemotron-nano-12b-v2-vl:free',
        imageToText: 'google/gemma-4-26b-a4b-it:free'
      },
      fallbackModels: [
        'tencent/hy3:free',
        'cohere/north-mini-code:free',
        'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
        'poolside/laguna-m.1:free',
        'google/gemma-4-26b-a4b-it:free',
        'google/gemma-4-31b-it:free',
        'nvidia/nemotron-3-super-120b-a12b:free'
      ]
    }
  }
};
