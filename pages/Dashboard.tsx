import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Header } from '@/components/dashboard/Header';
import { CommandPalette } from '@/components/dashboard/CommandPalette';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingDown, Activity,
  IndianRupee,
  Receipt,
  Loader2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';


export default function Dashboard() {
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

  const [commandOpen, setCommandOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(true);
  const [profileType, setProfileType] = useState<'personal' | 'business'>('personal');
  const [stats, setStats] = useState({
    income: 0,
    expenses: 0,
    invoices: 0,
    recentActivity: [] as any[],
    budgets: [] as any[]
  });

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('profile_type').eq('id', user?.id).single();
      const currentProfileType = profile?.profile_type || 'personal';
      setProfileType(currentProfileType);

      const [transactionsRes, invoicesRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('user_id', user?.id).eq('profile_type', currentProfileType).order('date', { ascending: false }),
        supabase.from('invoices').select('*').eq('user_id', user?.id).eq('profile_type', currentProfileType).order('date', { ascending: false })
      ]);

      const transactions = transactionsRes.data || [];
      const invoices = invoicesRes.data || [];
      
      let income = 0;
      let expenses = 0;
      let invoiceTotal = 0;
      
      const budgets: any[] = [];
      const expensesByBudget: Record<string, number> = {};

      transactions.forEach(t => {
        if (t.type === 'income') {
          income += Number(t.amount);
        } else if (t.type === 'expense') {
          expenses += Number(t.amount);
          
          const match = t.description?.match(/@budget:(.+)$/);
          if (match && match[1]) {
            const budgetName = match[1].trim();
            expensesByBudget[budgetName] = (expensesByBudget[budgetName] || 0) + Number(t.amount);
          }
        } else if (t.type === 'budget') {
          budgets.push({
            name: t.description,
            amount: Number(t.amount),
            period: t.category,
            spent: 0
          });
        }
      });
      
      budgets.forEach(b => {
        b.spent = expensesByBudget[b.name] || 0;
      });

      invoices.forEach(i => {
        if (i.invoice_type === 'sales') {
          invoiceTotal += Number(i.total_amount);
        }
      });

      const recentTransactions = transactions.filter(t => t.type !== 'budget').slice(0, 5).map(t => ({ ...t, activityType: 'transaction' }));
      const recentInvoices = invoices.slice(0, 5).map(i => ({ ...i, activityType: 'invoice' }));
      
      const combinedRecent = [...recentTransactions, ...recentInvoices]
        .sort((a: any, b: any) => new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime())
        .slice(0, 5);

      setStats({
        income,
        expenses,
        invoices: invoiceTotal,
        recentActivity: combinedRecent,
        budgets
      });
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      if (error?.message?.includes('profile_type')) {
        toast.error('Database schema update needed. Please check the Readme or refresh.', { duration: 10000 });
      } else {
        toast.error('Failed to load dashboard data');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <>
            <div className="mx-auto max-w-6xl space-y-6">
              
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                  <p className="text-muted-foreground">
                    Here's an overview of your account activity.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => navigate('/reports')}>View Reports</Button>
                  <Button onClick={() => navigate(profileType === 'business' ? '/invoice' : '/tracker')}>
                    Create New {profileType === 'business' ? 'Invoice' : 'Expense'}
                  </Button>
                </div>
              </div>
              
              {isLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <motion.div 
                  className="space-y-6"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {(profileType === 'personal' || profileType === 'business') && (
                      <motion.div variants={itemVariants}>
                        <Card className="overflow-hidden relative group dark:border-white/10 dark:bg-black/40 border-slate-200 bg-white/60 backdrop-blur-xl">
                          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                            <Activity className="h-4 w-4 text-emerald-500" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{currencySymbol}{stats.income.toFixed(2)}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Based on logged transactions
                            </p>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}

                    {profileType === 'personal' && (
                      <motion.div variants={itemVariants}>
                        <Card className="overflow-hidden relative group dark:border-white/10 dark:bg-black/40 border-slate-200 bg-white/60 backdrop-blur-xl">
                          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Savings</CardTitle>
                            <Activity className="h-4 w-4 text-indigo-500" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{currencySymbol}{(stats.income - stats.expenses).toFixed(2)}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Remaining amount
                            </p>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}

                    
                    {(profileType === 'personal' || profileType === 'business') && (
                      <motion.div variants={itemVariants}>
                        <Card className="overflow-hidden relative group dark:border-white/10 dark:bg-black/40 border-slate-200 bg-white/60 backdrop-blur-xl">
                          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                            <TrendingDown className="h-4 w-4 text-rose-500" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{currencySymbol}{stats.expenses.toFixed(2)}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Based on logged transactions
                            </p>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}
                    
                    {profileType === 'business' && (
                      <motion.div variants={itemVariants}>
                        <Card className="overflow-hidden relative group dark:border-white/10 dark:bg-black/40 border-slate-200 bg-white/60 backdrop-blur-xl">
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Invoiced</CardTitle>
                            <Receipt className="h-4 w-4 text-blue-500" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{currencySymbol}{stats.invoices.toFixed(2)}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Total from all invoices
                            </p>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}
                  </div>
                  
                  {profileType === 'personal' && stats.budgets && stats.budgets.length > 0 && (
                    <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                      <Card className="lg:col-span-2 overflow-hidden relative dark:border-white/10 dark:bg-black/40 border-slate-200 bg-white/60 backdrop-blur-xl">
                        <CardHeader>
                          <CardTitle>Active Budgets</CardTitle>
                          <CardDescription>Track your spending against your custom budgets.</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-6">
                            {stats.budgets.map((budget: any, index: number) => {
                              const progress = budget.amount > 0 ? (budget.spent / budget.amount) * 100 : 0;
                              return (
                                <div key={index} className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                      <span className="font-medium">{budget.name}</span>
                                      <span className="text-xs text-muted-foreground">{budget.period}</span>
                                    </div>
                                    <div className="text-right">
                                      <div className="font-medium">{currencySymbol}{budget.spent.toFixed(2)} / {currencySymbol}{budget.amount.toFixed(2)}</div>
                                      <div className="text-xs text-muted-foreground">{Math.max(0, budget.amount - budget.spent).toFixed(2)} remaining</div>
                                    </div>
                                  </div>
                                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full ${progress > 90 ? 'bg-rose-500' : progress > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                                      style={{ width: `${Math.min(progress, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="lg:col-span-7 overflow-hidden relative dark:border-white/10 dark:bg-black/40 border-slate-200 bg-white/60 backdrop-blur-xl">
                      <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                        <CardDescription>Your latest transactions and invoices.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {stats.recentActivity.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm flex flex-col items-center gap-2">
                              <Activity className="h-8 w-8 opacity-20" />
                              <p>No recent activity found. Add some transactions or invoices.</p>
                            </div>
                          ) : (
                            stats.recentActivity.map((item, index) => (
                              <motion.div 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 * index }}
                                key={index} 
                                className="flex items-center justify-between py-3 border-b last:border-0 hover:bg-muted/30 -mx-4 px-4 transition-colors rounded-sm"
                              >
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">
                                    {item.activityType === 'transaction' ? item.description || item.category : item.activityType === 'invoice' ? `Invoice #${item.invoice_number}` : `Purchase #${item.invoice_number || 'Receipt'}`}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {item.date ? format(new Date(item.date), 'MMM dd, yyyy') : 'Unknown Date'} • {item.activityType === 'transaction' ? item.category : item.activityType === 'invoice' ? item.customer_name : item.vendor_name}
                                  </span>
                                </div>
                                <div className={`font-medium ${(item.activityType === 'transaction' && item.type === 'expense') || item.activityType === 'scanned_purchase' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                  {(item.activityType === 'transaction' && item.type === 'expense') || item.activityType === 'scanned_purchase' ? '-' : '+'}{currencySymbol}{Number(item.total_amount || item.amount).toFixed(2)}
                                </div>
                              </motion.div>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </motion.div>
              )}
            </div>
          </>
  );
}