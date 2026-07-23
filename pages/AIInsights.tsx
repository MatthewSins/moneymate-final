import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Lightbulb, TrendingUp, TrendingDown, 
  AlertTriangle, CheckCircle, RefreshCcw, Landmark, Receipt, 
  Wallet, DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Insight {
  title: string;
  description: string;
  category: 'income' | 'expense' | 'tax' | 'general' | 'warning' | 'success';
}

export default function AIInsights() {
  const currency = localStorage.getItem('preferred_currency') || 'INR';
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
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (user) {
      generateInsights();
    }
  }, [user]);

  const generateInsights = async () => {
    setIsLoading(true);
    try {
      // 1. Aggregate User Data for Analysis
      const { data: profile } = await supabase.from('profiles').select('profile_type').eq('id', user?.id).single();
      const currentProfileType = profile?.profile_type || 'personal';

      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user?.id)
        .eq('profile_type', currentProfileType);

      let invoices: any[] = [];
      let scannedPurchases: any[] = [];
      
      if (currentProfileType === 'business') {
        const { data: invs } = await supabase
          .from('invoices')
          .select('*')
          .eq('user_id', user?.id);
        invoices = invs || [];
        
        const { data: purcs } = await supabase
          .from('scanned_purchases')
          .select('*')
          .eq('user_id', user?.id);
        scannedPurchases = purcs || [];
      }

      let totalIncome = 0;
      let totalExpense = 0;
      const expenseByCategory: Record<string, number> = {};
      
      transactions?.forEach(t => {
        if (t.type === 'income') totalIncome += Number(t.amount || 0);
        if (t.type === 'expense') {
          totalExpense += Number(t.amount || 0);
          expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + Number(t.amount || 0);
        }
      });

      let totalInvoiced = 0;
      let totalGSTCollected = 0;
      let totalGSTPaid = 0;
      
      invoices?.forEach(i => {
        if (i.status !== 'draft') {
          totalInvoiced += Number(i.total_amount || 0);
          const gst = Number(i.total_cgst || 0) + Number(i.total_sgst || 0) + Number(i.total_igst || 0);
          totalGSTCollected += gst;
        }
      });

      scannedPurchases?.forEach(p => {
        totalExpense += Number(p.total_amount || 0);
        const gst = Number(p.total_cgst || 0) + Number(p.total_sgst || 0) + Number(p.total_igst || 0);
        totalGSTPaid += gst;
        expenseByCategory['Business Purchase'] = (expenseByCategory['Business Purchase'] || 0) + Number(p.total_amount || 0);
      });
      
      if (currentProfileType === 'business') {
         totalIncome += totalInvoiced;
      }

      const profit = totalIncome - totalExpense;

      const summary = {
        totalIncome,
        totalExpense,
        profit,
        expenseByCategory,
        totalInvoiced,
        totalGSTCollected,
        totalGSTPaid,
        recentTransactionsCount: transactions?.length || 0,
        recentInvoicesCount: invoices?.length || 0
      };

      // 2. Call API to generate insights
      const response = await fetch('/api/generate-insights', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ summary })
      });

      if (!response.ok) {
        let errorMsg = 'Failed to generate insights';
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch (e) {
          errorMsg = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }

      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error("Received an invalid response from the server (possibly an HTML error page).");
      }
      setInsights(data.insights || []);
      setLastUpdated(new Date());
      toast.success('Insights refreshed successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate insights. Ensure AI keys are set.');
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = (category: string) => {
    switch (category) {
      case 'income': return <TrendingUp className="h-6 w-6 text-emerald-500" />;
      case 'expense': return <TrendingDown className="h-6 w-6 text-rose-500" />;
      case 'tax': return <Landmark className="h-6 w-6 text-purple-500" />;
      case 'warning': return <AlertTriangle className="h-6 w-6 text-amber-500" />;
      case 'success': return <CheckCircle className="h-6 w-6 text-blue-500" />;
      default: return <Lightbulb className="h-6 w-6 text-primary" />;
    }
  };

  const getColor = (category: string) => {
    switch (category) {
      case 'income': return 'bg-emerald-500/10 border-emerald-500/20';
      case 'expense': return 'bg-rose-500/10 border-rose-500/20';
      case 'tax': return 'bg-purple-500/10 border-purple-500/20';
      case 'warning': return 'bg-amber-500/10 border-amber-500/20';
      case 'success': return 'bg-blue-500/10 border-blue-500/20';
      default: return 'bg-primary/10 border-primary/20';
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      <header className="bg-background border-b px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-1.5 rounded-full">
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <h1 className="font-semibold text-lg">AI Business Insights</h1>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={generateInsights} disabled={isLoading}>
          <RefreshCcw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Your Financial Analysis</h2>
            <p className="text-muted-foreground mt-1">
              AI-generated recommendations based on your income, expenses, and invoices.
            </p>
          </div>
          {lastUpdated && (
            <p className="text-sm text-muted-foreground hidden md:block">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>

        {isLoading && insights.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="animate-pulse border-muted">
                <CardContent className="p-6 flex gap-4">
                  <div className="h-12 w-12 rounded-full bg-muted flex-shrink-0" />
                  <div className="space-y-3 w-full">
                    <div className="h-5 bg-muted rounded w-1/2" />
                    <div className="h-4 bg-muted rounded w-full" />
                    <div className="h-4 bg-muted rounded w-3/4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatePresence>
              {insights.map((insight, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className={`h-full border transition-colors hover:shadow-md ${getColor(insight.category)}`}>
                    <CardHeader className="pb-2 flex flex-row items-start gap-4 space-y-0">
                      <div className="p-2 bg-background rounded-full shadow-sm">
                        {getIcon(insight.category)}
                      </div>
                      <CardTitle className="text-lg leading-tight flex-1">
                        {insight.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {insight.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>

            {insights.length === 0 && !isLoading && (
              <div className="col-span-full flex flex-col items-center justify-center p-12 text-center bg-background rounded-xl border border-dashed">
                <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Insights Yet</h3>
                <p className="text-muted-foreground max-w-md">
                  We need more financial data to generate meaningful insights. Try adding some income, expenses, or invoices first.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
