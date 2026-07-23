import { convertPdfFileToImageFile } from '@/lib/pdfUtils';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';
import {
  Mic,
  Upload,
  Plus,
  TrendingDown,
  TrendingUp,
  PieChart as PieChartIcon,
  List,
  CalendarIcon,
  ArrowLeft,
  Loader2,
  Receipt,
  Sparkles,
  Wallet
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Transaction } from '@/types/finance';
import { toast } from 'sonner';

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const expenseCategories = ['Food', 'Transport', 'Utilities', 'Entertainment', 'Shopping', 'Health', 'Other'];
const incomeCategories = ['Salary', 'Freelance', 'Investments', 'Gift', 'Other'];

const transactionItemSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  category: z.string().optional(),
  description: z.string().min(1, "Description is required"),
});

const transactionSchema = z.object({
  type: z.enum(['expense', 'income', 'budget']),
  date: z.date().optional(),
  period: z.string().optional(),
  start_date: z.date().optional(),
  end_date: z.date().optional(),
  items: z.array(transactionItemSchema).min(1, "At least one item is required"),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

export default function ExpenseTracker() {
  const [currency, setCurrency] = useState(() => localStorage.getItem('preferred_currency') || 'INR');
  const getCurrencySymbol = (curr) => {
    switch(curr) {
      case 'USD': return '\$';
      case 'EUR': return '€';
      case 'GBP': return '£';
      case 'INR': default: return '₹';
    }
  };
  const currencySymbol = getCurrencySymbol(currency);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [budgetAmount, setBudgetAmount] = useState(() => Number(localStorage.getItem(`budget_${user?.id}`) || '10000'));
  const [budgetPeriod, setBudgetPeriod] = useState(() => localStorage.getItem(`period_${user?.id}`) || 'Monthly');
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [pendingSubmitData, setPendingSubmitData] = useState<any>(null);
  const [isBudgetSelectOpen, setIsBudgetSelectOpen] = useState(false);
  const [selectedGlobalBudget, setSelectedGlobalBudget] = useState('none');
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);

  
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { register, control, handleSubmit, formState: { errors }, setValue, watch, reset, getValues } = useForm({
    resolver: zodResolver(transactionSchema) as any,
    defaultValues: {
      type: 'expense' as 'expense' | 'income' | 'budget',
      date: new Date(),
      period: 'Monthly',
      start_date: new Date(),
      end_date: new Date(),
      items: [{ amount: undefined as any, category: '', description: '', budget_name: undefined as any }]
    }
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'items'
  });

  const transactionType = watch('type');
  const transactionDate = watch('date');
  const period = watch('period');
  const startDate = watch('start_date');
  const endDate = watch('end_date');
  const userBudgets = Array.from(new Set(transactions.filter(t => (t.type as any) === 'budget').map(t => t.category)));
  const currentCategories = (transactionType as any) === 'budget' 
    ? ['Trip Budget', 'School Budget', 'Grocery Budget', 'Other'] 
    : transactionType === 'expense' 
      ? [...expenseCategories, ...userBudgets] 
      : incomeCategories;

  const [profileType, setProfileType] = useState<'personal' | 'business'>('personal');

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      const { data: profile } = await supabase.from('profiles').select('profile_type').eq('id', user?.id).single();
      const currentProfileType = profile?.profile_type || 'personal';
      setProfileType(currentProfileType);

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user?.id)
        .eq('profile_type', currentProfileType)
        .order('date', { ascending: false });

      if (error) {
        throw error;
      } else {
        setTransactions(data || []);
      }
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      if (error?.message?.includes('profile_type')) {
        toast.error('Database update required: Please run the SQL commands to add profile_type.');
      } else {
        toast.error('Failed to load transactions');
      }
    } finally {
      setLoading(false);
    }
  };

  const [categorizingIndex, setCategorizingIndex] = useState<number | null>(null);

  const handleDescriptionBlur = async (index: number, e: React.FocusEvent<HTMLInputElement>) => {
    const description = e.target.value;
    if (!description || transactionType !== 'expense') return;

    setCategorizingIndex(index);
    try {
      const amount = getValues(`items.${index}.amount`);
      const date = getValues('date');
      const prevCategory = getValues(`items.${index}.category`);

      const res = await fetch('/api/categorize-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          amount: amount || 0,
          date: date.toISOString(),
          prevCategory,
          businessType: profileType,
          revenue: 500000 // assuming some default or context
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.result && data.result.category) {
          const catLower = data.result.category.toLowerCase();
          const matched = currentCategories.find(c => c.toLowerCase() === catLower || c.toLowerCase().includes(catLower));
          if (matched) {
            setValue(`items.${index}.category`, matched, { shouldValidate: true });
          } else {
            setValue(`items.${index}.category`, 'Other', { shouldValidate: true });
          }

          if (data.result.flags && data.result.flags.length > 0) {
            toast.warning(`Compliance Flag: ${data.result.flags.join(', ')}`, {
              description: data.result.explanation
            });
          } else {
            toast.success(`Categorized as ${matched || 'Other'}`, {
              description: data.result.explanation
            });
          }
        }
      }
    } catch (err) {
      console.error('Categorization failed', err);
    } finally {
      setCategorizingIndex(null);
    }
  };

  const onSubmit = async (data: any) => {
    if (data.type === 'expense') {
      const activeBudgetsList = Array.from(new Set([
        ...(budgetAmount > 0 ? ['Global Budget'] : []),
        ...transactions.filter(t => t.type === 'budget').map(b => b.description).filter(Boolean)
      ]));
      if (activeBudgetsList.length > 0) {
        setPendingSubmitData(data);
        setIsBudgetSelectOpen(true);
        return;
      }
    }
    await processSubmit(data, 'none');
  };

  const processSubmit = async (data: any, budgetName: string) => {
    setIsSubmitting(true);
    try {
      if (!user?.id) {
        throw new Error("User not authenticated.");
      }
      const newTransactions = data.items.map((item: any) => {
        let finalCategory = item.category || 'Uncategorized';
        let finalDate = data.date || new Date();
        
        if (data.type === 'budget') {
          if (data.period === 'Custom') {
            finalCategory = `Custom: ${data.start_date ? data.start_date.toLocaleDateString() : ''} - ${data.end_date ? data.end_date.toLocaleDateString() : ''}`;
          } else {
            finalCategory = data.period || 'Monthly';
          }
        } else if (data.type === 'income') {
          if (data.period === 'Custom') {
            finalCategory = `Custom: ${data.start_date ? data.start_date.toLocaleDateString() : ''} - ${data.end_date ? data.end_date.toLocaleDateString() : ''}`;
          } else {
            finalCategory = data.period || 'Monthly';
          }
        }
        
        return {
          user_id: user.id,
          amount: item.amount,
          type: data.type,
          category: finalCategory,
          description: data.type === 'expense' && budgetName !== 'none' ? `${item.description || ''} @budget:${budgetName}` : item.description,
          date: finalDate.toISOString(),
          profile_type: profileType
        };
      });

      const { error } = await supabase
        .from('transactions')
        .insert(newTransactions);

      if (error) throw error;

      toast.success('Transactions added successfully!');
      fetchTransactions();
      
      reset({ type: 'expense', date: new Date(), period: 'Monthly', start_date: new Date(), end_date: new Date(), items: [{ amount: undefined as any, category: '', description: '', budget_name: undefined as any }] });
      setActiveTab('dashboard');
    } catch (error: any) {
      console.error('Error adding transaction:', error);
      if (error?.message?.includes('transactions_type_check') || error?.message?.includes('check constraint')) {
        toast.error('Database update required! Please run the SQL command from sql_instructions.md in Supabase to allow budgets.', { duration: 10000 });
      } else {
        toast.error(error.message || 'Failed to add transaction');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsSubmitting(true);
    toast.info('Scanning receipt with AI...');
    
    try {
      let processedFile = file;
      if (file.type === 'application/pdf') {
         try {
           processedFile = await convertPdfFileToImageFile(file);
         } catch (e) {
           console.warn('Failed to convert PDF to image', e);
           setIsSubmitting(false);
           toast.error('Failed to process PDF. Please try a different file or format.');
           return;
         }
      }

      const formData = new FormData();
      formData.append('invoice', processedFile);

      const response = await fetch('/api/scan-invoice', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to scan receipt');
      }

      if (!response.ok) throw new Error(await response.text() || "Failed to scan receipt");
      const data = await response.json();
      
      const newItems = [];
      if (data.items && data.items.length > 0) {
        for (const item of data.items) {
          let itemCategory = 'Other';
          const itemText = JSON.stringify(item).toLowerCase();
          if (itemText.includes('food') || itemText.includes('restaurant') || itemText.includes('cafe') || itemText.includes('meal')) itemCategory = 'Food';
          else if (itemText.includes('uber') || itemText.includes('taxi') || itemText.includes('fuel')) itemCategory = 'Transport';
          else if (itemText.includes('shopping') || itemText.includes('retail') || itemText.includes('apparel')) itemCategory = 'Shopping';
          
          newItems.push({
            amount: item.amount || (item.rate * item.quantity) || 0,
            category: itemCategory,
            description: item.description || (data.vendor_name ? `Receipt from ${data.vendor_name}` : 'Scanned Item')
          });
        }
      } else {
        let category = 'Other';
        const text = JSON.stringify(data).toLowerCase();
        if (text.includes('food') || text.includes('restaurant') || text.includes('cafe')) category = 'Food';
        else if (text.includes('uber') || text.includes('taxi') || text.includes('fuel')) category = 'Transport';
        else if (text.includes('walmart') || text.includes('amazon') || text.includes('shopping') || text.includes('retail')) category = 'Shopping';
        
        newItems.push({
          amount: data.total_amount || 0,
          category,
          description: data.vendor_name ? `Receipt from ${data.vendor_name}` : 'Scanned Receipt'
        });
      }

      const currentItems = getValues('items');
      const isFirstItemEmpty = currentItems.length === 1 && !currentItems[0].amount && !currentItems[0].category && !currentItems[0].description;
      
      if (isFirstItemEmpty) {
        replace(newItems);
      } else {
        append(newItems);
      }
      
      if (data.date) {
         const parsedDate = new Date(data.date);
         if (!isNaN(parsedDate.getTime())) {
           setValue('date', parsedDate, { shouldValidate: true });
         }
      }
      setValue('type', 'expense', { shouldValidate: true });
      setIsSubmitting(false);
      
      toast.success('Receipt scanned! Details auto-filled.');
    } catch (error) {
      console.error(error);
      toast.error('Failed to scan receipt. Please try again.');
    } finally {
      setIsSubmitting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSpeak = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Speech recognition is not supported in this browser.');
      return;
    }
    
    setIsListening(true);
    
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      toast.success(`Heard: "${transcript}"`);
      setIsListening(false);
      setIsSubmitting(true);
      
      try {
        const response = await fetch('/api/parse-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript })
        });
        
        if (!response.ok) throw new Error('Failed to parse voice');
        if (!response.ok) throw new Error(await response.text() || "Failed to scan receipt");
      const data = await response.json();
        
        if (data.items && data.items.length > 0) {
          setValue('type', data.items[0].type || 'expense', { shouldValidate: true });
          
          const currentItems = getValues('items');
          const isFirstItemEmpty = currentItems.length === 1 && !currentItems[0].amount && !currentItems[0].category && !currentItems[0].description;
          
          const newItems = data.items.map((item: any) => ({
            amount: item.amount,
            category: item.category,
            description: item.description
          }));

          if (isFirstItemEmpty) {
            replace(newItems);
          } else {
            append(newItems);
          }
          
          toast.success('Added voice items to the form!');
        }
      } catch (error) {
        console.error(error);
        toast.error('Could not process voice input.');
      } finally {
        setIsSubmitting(false);
      }
    };
    
    recognition.onerror = () => {
      toast.error('Could not understand audio.');
      setIsListening(false);
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };
    
    recognition.start();
  };

  // Calculate summaries
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  const activeBudgets = transactions.filter(t => (t.type as any) === 'budget').map(b => ({ name: b.description, amount: Number(b.amount), period: b.category, spent: transactions.filter(t => t.type === 'expense' && t.description?.includes('@budget:' + b.description)).reduce((sum, t) => sum + Number(t.amount), 0) }));
  const budgetProgress = budgetAmount > 0 ? (totalExpense / budgetAmount) * 100 : 0;
  const totalBudgeted = activeBudgets.reduce((sum, b) => sum + b.amount, 0);
  const remainingBudget = totalIncome - totalBudgeted;

  // Group by month
  const transactionsByMonth = transactions.reduce((acc, t) => {
    const month = t.date ? format(new Date(t.date), 'MMMM yyyy') : 'Unknown';
    if (!acc[month]) acc[month] = [];
    acc[month].push(t);
    return acc;
  }, {} as Record<string, any>);

  const generateBudgetAnalysis = async () => {
    setIsGeneratingAnalysis(true);
    try {
      const res = await fetch('/api/generate-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: { budgets: activeBudgets, type: "budget_analysis" }, currency: currencySymbol })
      });
      if (!res.ok) throw new Error('Failed to generate analysis');
      const data = await res.json();
      setAiAnalysis(data.insights || data);
      toast.success('AI Analysis generated!');
    } catch (err) {
      console.error(err);
      toast.error('Could not generate analysis');
    } finally {
      setIsGeneratingAnalysis(false);
    }
  };

  const saveBudget = (amount: number, period: string) => {
    setBudgetAmount(amount);
    setBudgetPeriod(period);
    localStorage.setItem(`budget_${user?.id}`, amount.toString());
    localStorage.setItem(`period_${user?.id}`, period);
    setIsBudgetModalOpen(false);
    toast.success('Budget updated');
  };

  // Prepare chart data
  const expensesByCategory = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
      return acc;
    }, {} as Record<string, number>);

  const pieChartData = Object.entries(expensesByCategory).map(([name, value]) => ({ name, value }));

  
  const [tempBudget, setTempBudget] = useState(budgetAmount);
  const [tempPeriod, setTempPeriod] = useState(budgetPeriod);

  // Update temp state when modal opens
  useEffect(() => {
    if (isBudgetModalOpen) {
      setTempBudget(budgetAmount);
      setTempPeriod(budgetPeriod);
    }
  }, [isBudgetModalOpen, budgetAmount, budgetPeriod]);

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col">
      
      <Dialog open={isBudgetSelectOpen} onOpenChange={setIsBudgetSelectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign to Budget</DialogTitle>
            <DialogDescription>
              Which budget would you like to assign this transaction to?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Budget</Label>
              <Select value={selectedGlobalBudget} onValueChange={setSelectedGlobalBudget}>
                <SelectTrigger>
                  <SelectValue placeholder="No budget assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No budget assigned</SelectItem>
                  {Array.from(new Set([
                    ...(budgetAmount > 0 ? ['Global Budget'] : []),
                    ...transactions.filter(t => t.type === 'budget').map(b => b.description).filter(Boolean)
                  ])).map((b: any) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBudgetSelectOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              setIsBudgetSelectOpen(false);
              processSubmit(pendingSubmitData, selectedGlobalBudget);
            }} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Transaction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBudgetModalOpen} onOpenChange={setIsBudgetModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Budget</DialogTitle>
            <DialogDescription>Track your expenses against a target budget.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Budget Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{currencySymbol}</span>
                <Input 
                  type="number" 
                  className="pl-7"
                  value={tempBudget} 
                  onChange={(e) => setTempBudget(Number(e.target.value))} 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Period</Label>
              <Select value={tempPeriod} onValueChange={setTempPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Weekly">Weekly</SelectItem>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBudgetModalOpen(false)}>Cancel</Button>
            <Button onClick={() => saveBudget(tempBudget, tempPeriod)}>Save Budget</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <header className="bg-background border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Expense Tracker</h1>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-5xl mx-auto w-full space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:w-[400px] mx-auto">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="add">Add Transaction</TabsTrigger>
            
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6 animate-in fade-in-50 duration-500">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                

                
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                        <TrendingUp className="mr-2 h-4 w-4 text-emerald-500" />
                        Total Income
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-emerald-500">
                        {currencySymbol}{totalIncome.toFixed(2)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                        <TrendingDown className="mr-2 h-4 w-4 text-rose-500" />
                        Expenses
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-rose-500">
                        {currencySymbol}{totalExpense.toFixed(2)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                        <Wallet className="mr-2 h-4 w-4 text-primary" />
                        Balance
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={cn("text-2xl font-bold", balance >= 0 ? "text-emerald-500" : "text-rose-500")}>
                        {currencySymbol}{balance.toFixed(2)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="md:col-span-3 mt-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                        <span>Active Budgets (Total Budgeted: {currencySymbol}{totalBudgeted.toFixed(2)} / {currencySymbol}{totalIncome.toFixed(2)})</span>
                        <Button variant="ghost" size="sm" onClick={() => setActiveTab('add')} className="h-6 px-2 text-xs">Add</Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {activeBudgets.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No active budgets. Create one below.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {activeBudgets.map((b, i) => {
                            const progress = b.amount > 0 ? (b.spent / b.amount) * 100 : 0;
                            return (
                              <div key={i} className="space-y-2 border p-3 rounded-lg bg-card">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <span className="font-semibold text-sm">{b.name}</span>
                                    <span className="text-xs text-muted-foreground ml-2">({b.period})</span>
                                  </div>
                                  <div className="text-sm font-medium">{currencySymbol}{b.spent.toFixed(2)} / {currencySymbol}{b.amount.toFixed(2)}</div>
                                </div>
                                <div className="mt-2 h-2 w-full bg-secondary rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full ${progress > 90 ? "bg-rose-500" : progress > 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                                    style={{ width: `${Math.min(progress, 100)}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <Button variant="outline" size="sm" className="w-full mt-4 flex items-center justify-center gap-2" onClick={generateBudgetAnalysis} disabled={isGeneratingAnalysis}>{isGeneratingAnalysis ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} AI Analysis</Button>
                    </CardContent>
                  </Card>

                </div>

                {aiAnalysis && (
                  <Card className="border-purple-500/20 bg-purple-500/5 mb-6">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold flex items-center text-purple-600 dark:text-purple-400">
                        <Sparkles className="mr-2 h-5 w-5" />
                        AI Budget Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ul className="space-y-2">
                          {aiAnalysis.map((insight: any, i: number) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-purple-500">•</span>
                              <div>
                                <strong className="block">{insight.title}</strong>
                                <span className="text-muted-foreground">{insight.description}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Charts */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center text-lg">
                        <PieChartIcon className="mr-2 h-5 w-5 text-primary" />
                        Expenses by Category
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {pieChartData.length > 0 ? (
                        <div className="h-[300px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieChartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                {pieChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip 
                                formatter={(value: number) => `${currencySymbol}${value.toFixed(2)}`}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                          No expense data available
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  
                  {/* Transactions by Month */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center text-lg">
                        <List className="mr-2 h-5 w-5 text-primary" />
                        Transactions by Month
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {Object.entries(transactionsByMonth).length > 0 ? (
                          Object.entries(transactionsByMonth).map(([month, txs]: [string, any]) => (
                            <div key={month} className="space-y-3">
                              <h3 className="font-medium text-sm text-muted-foreground sticky top-0 bg-card py-1 z-10 border-b">{month}</h3>
                              <div className="space-y-3">
                                {txs.map((t: any) => (
                                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                                    <div className="flex items-center gap-3">
                                      <div className={cn(
                                        "p-2 rounded-full",
                                        t.type === 'income' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                                      )}>
                                        {t.type === 'income' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                      </div>
                                      <div>
                                        <p className="font-medium text-sm">{t.description}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                          <span className="text-xs text-muted-foreground">{t.category}</span>
                                          <span className="text-xs text-muted-foreground">•</span>
                                          <span className="text-xs text-muted-foreground">{t.date ? format(new Date(t.date), 'MMM d, yyyy') : 'Unknown'}</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className={cn(
                                      "font-bold",
                                      t.type === 'income' ? "text-emerald-500" : "text-foreground"
                                    )}>
                                      {t.type === 'income' ? '+' : '-'}{currencySymbol}{Number(t.amount).toFixed(2)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            No transactions yet
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="add">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <Card className="md:col-span-8">
                <CardHeader>
                  <CardTitle>Add Transaction</CardTitle>
                  <CardDescription>Manually enter details or use AI tools.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-3">
                      <Label>Transaction Type</Label>
                      <RadioGroup 
                        defaultValue="expense" 
                        onValueChange={(val) => setValue('type', val as 'expense' | 'income' | 'budget')}
                        className="flex items-center space-x-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="expense" id="expense" />
                          <Label htmlFor="expense" className="cursor-pointer">Expense</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="budget" id="budget" />
                          <Label htmlFor="budget" className="cursor-pointer">Budget</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="income" id="income" />
                          <Label htmlFor="income" className="cursor-pointer">Income</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="space-y-4">
                      
                      {transactionType === 'expense' ? (
                        <div className="space-y-2">
                          <Label>Date</Label>
                          <Popover>
                            <PopoverTrigger 
                              className={cn(
                                buttonVariants({ variant: "outline" }),
                                "w-full justify-start text-left font-normal",
                                !transactionDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {transactionDate ? format(transactionDate, "PPP") : <span>Pick a date</span>}
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={transactionDate}
                                onSelect={(date) => date && setValue('date', date, { shouldValidate: true })}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Period</Label>
                            <Select value={period || 'Monthly'} onValueChange={(val) => setValue('period', val, { shouldValidate: true })}>
                              <SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Monthly">Monthly</SelectItem>
                                <SelectItem value="Yearly">Yearly</SelectItem>
                                <SelectItem value="Weekly">Weekly</SelectItem>
                                <SelectItem value="Custom">Custom Date</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {period === 'Custom' && (
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Start Date</Label>
                                <Popover>
                                  <PopoverTrigger className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={startDate} onSelect={(date) => date && setValue('start_date', date, { shouldValidate: true })} />
                                  </PopoverContent>
                                </Popover>
                              </div>
                              <div className="space-y-2">
                                <Label>End Date</Label>
                                <Popover>
                                  <PopoverTrigger className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={endDate} onSelect={(date) => date && setValue('end_date', date, { shouldValidate: true })} />
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </div>
                          )}
                        </div>
                      )}


                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-semibold">Items</Label>
                          {transactionType === 'expense' && <Button type="button" variant="outline" size="sm" onClick={() => append({ amount: undefined as any, category: '', description: '', budget_name: undefined as any })}
                          >
                            <Plus className="mr-2 h-4 w-4" /> Add Item
                          </Button>}
                        </div>
                        
                        {fields.map((field, index) => (
                          <div key={field.id} className="relative grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-card">
                            {fields.length > 1 && (
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => remove(index)}
                              >
                                &times;
                              </Button>
                            )}
                            
                            <div className="space-y-2">
                              <Label>Amount</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{currencySymbol}</span>
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  className="pl-7" 
                                  placeholder="0.00"
                                  {...register(`items.${index}.amount`, { valueAsNumber: true })} 
                                />
                              </div>
                              {errors.items?.[index]?.amount && <p className="text-xs text-rose-500">{errors.items[index]?.amount?.message as string}</p>}
                            </div>

                            
                            {transactionType === 'expense' && (
                              <div className="space-y-2">
                                <Label>Category</Label>
                                <Select 
                                  value={watch(`items.${index}.category`) || ""} 
                                  onValueChange={(val) => setValue(`items.${index}.category`, val, { shouldValidate: true })}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {currentCategories.map(cat => (
                                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {errors.items?.[index]?.category && <p className="text-xs text-rose-500">{errors.items[index]?.category?.message as string}</p>}
                              </div>
                            )}


                            <div className="space-y-2 md:col-span-2 relative">
                              <Label>{transactionType === 'budget' ? 'Budget Name' : transactionType === 'income' ? 'Income Source' : 'Description (Auto-categorizes on blur)'}</Label>
                              <div className="relative">
                                <Input 
                                  placeholder={transactionType === 'budget' ? 'e.g. Trip Budget' : transactionType === 'income' ? 'e.g. Salary' : 'e.g. Groceries at Walmart'} 
                                  {...register(`items.${index}.description`)} 
                                  onBlur={(e) => transactionType !== 'budget' && handleDescriptionBlur(index, e)}
                                />
                                {categorizingIndex === index && transactionType !== 'budget' && (
                                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                                )}
                              </div>
                              {errors.items?.[index]?.description && <p className="text-xs text-rose-500">{errors.items[index]?.description?.message as string}</p>}
                            </div>

                            

                          </div>
                        ))}
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                      {transactionType === 'budget' ? 'Save Budget' : transactionType === 'income' ? 'Save Income' : 'Save Transaction'}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <div className="md:col-span-4 space-y-4">
                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-primary flex items-center text-lg">
                      <Sparkles className="mr-2 h-5 w-5" />
                      Expense Tracker Guide
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div>
                      <h4 className="font-semibold mb-1">What is this for?</h4>
                      <p className="text-muted-foreground">
                        Keep track of your daily cash flow. Use it to record expenses (money out) and income (money in).
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">What can I scan?</h4>
                      <p className="text-muted-foreground mb-1">
                        Scan printed or handwritten receipts to automatically extract amounts, categories, and descriptions. Works with:
                      </p>
                      <ul className="text-muted-foreground space-y-1 list-disc pl-4">
                        <li>Store & Restaurant receipts</li>
                        <li>Fuel & Transport bills</li>
                        <li>Utility bills & general invoices</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Smart Input</CardTitle>
                    <CardDescription>Let AI do the work for you.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button 
                      variant="outline" 
                      className={cn("w-full h-auto py-4 flex flex-col items-center gap-2", isListening && "border-primary bg-primary/5")}
                      onClick={handleSpeak}
                    >
                      <div className={cn("p-3 rounded-full", isListening ? "bg-primary text-primary-foreground animate-pulse" : "bg-muted")}>
                        <Mic className="h-6 w-6" />
                      </div>
                      <div className="text-center">
                        <p className="font-semibold">{isListening ? 'Listening...' : 'Speak Expense'}</p>
                        <p className="text-xs text-muted-foreground font-normal">"I spent {currencySymbol}500 on lunch"</p>
                      </div>
                    </Button>

                    <Button 
                      variant="outline" 
                      className="w-full h-auto py-4 flex flex-col items-center gap-2"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="p-3 rounded-full bg-muted">
                        <Receipt className="h-6 w-6" />
                      </div>
                      <div className="text-center">
                        <p className="font-semibold">Scan Receipt</p>
                        <p className="text-xs text-muted-foreground font-normal">Auto-extract details</p>
                      </div>
                    </Button>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          

        </Tabs>
      </main>
    </div>
  );
}
