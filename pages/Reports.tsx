import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileText, Printer, FileSpreadsheet, Calendar as CalendarIcon, Filter, Loader2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, subMonths, startOfYear } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

type ReportType = 'monthly' | 'expense' | 'income' | 'invoice' | 'gst' | 'health' | 'savings';
type DateFilter = 'all' | 'this_month' | 'last_month' | 'this_year' | 'custom';

export default function Reports() {
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
  const [reportType, setReportType] = useState<ReportType>('monthly');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [subFilter, setSubFilter] = useState<string>('all');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [scannedPurchases, setScannedPurchases] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [profileType, setProfileType] = useState<'personal' | 'business'>('personal');
  const [profileInfo, setProfileInfo] = useState<any>(null);

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    setSubFilter('all');
  }, [reportType]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();
      
      if (profileData) {
        setProfileInfo(profileData);
      }
      const currentProfileType = profileData?.profile_type || 'personal';
      setProfileType(currentProfileType);

      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user?.id)
        .eq('profile_type', currentProfileType)
        .order('date', { ascending: false });

      let invData: any[] = [];
      let purchaseData: any[] = [];

      if (currentProfileType === 'business') {
        const { data: idata } = await supabase
          .from('invoices')
          .select('*')
          .eq('user_id', user?.id)
          .order('date', { ascending: false });

        const { data: pdata } = await supabase
          .from('scanned_purchases')
          .select('*')
          .eq('user_id', user?.id)
          .order('date', { ascending: false });
        
        const allScanned = pdata || [];
        const scannedPurchasesOnly = allScanned.filter(p => p.invoice_type !== 'sales');
        const scannedSalesOnly = allScanned.filter(p => p.invoice_type === 'sales').map(s => ({
          ...s,
          customer_gstin: s.customer_gstin || s.vendor_gstin,
          client_name: s.customer_name || s.vendor_name,
          status: 'paid'
        }));

        invData = [...(idata || []), ...scannedSalesOnly];
        purchaseData = scannedPurchasesOnly;
      }

      setTransactions(txData || []);
      setInvoices(invData || []);
      setScannedPurchases(purchaseData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      if (error?.message?.includes('profile_type')) {
        toast.error('Database update required: Please run the SQL commands to add profile_type.');
      } else {
        toast.error('Failed to load report data');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const filterByDate = (dateStr: string) => {
    if (!dateStr) return false;
    const date = parseISO(dateStr);
    const now = new Date();
    
    if (dateFilter === 'this_month') {
      return isWithinInterval(date, { start: startOfMonth(now), end: endOfMonth(now) });
    }
    if (dateFilter === 'last_month') {
      const lastMonth = subMonths(now, 1);
      return isWithinInterval(date, { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) });
    }
    if (dateFilter === 'this_year') {
      return isWithinInterval(date, { start: startOfYear(now), end: now });
    }
    if (dateFilter === 'custom') {
      if (dateFrom && dateTo) {
        return isWithinInterval(date, { start: dateFrom, end: dateTo });
      } else if (dateFrom) {
        return date >= dateFrom;
      } else if (dateTo) {
        return date <= dateTo;
      }
    }
    return true;
  };

  const getSubFilterOptions = () => {
    if (reportType === 'expense' || reportType === 'income') {
      const filtered = transactions.filter(t => filterByDate(t.date) && t.type === reportType);
      const categories = Array.from(new Set(filtered.map(t => t.category).filter(Boolean)));
      return categories;
    }
    if (reportType === 'invoice') {
      return ['paid', 'pending', 'overdue', 'draft'];
    }
    return [];
  };

  const applySubFilter = (data: any[], type: string) => {
    if (subFilter === 'all') return data;
    if (type === 'expense' || type === 'income') {
      return data.filter(item => item.category === subFilter);
    }
    if (type === 'invoice') {
      return data.filter(item => item.status === subFilter);
    }
    return data;
  };


  const generateReportData = () => {
    const filteredTx = transactions.filter(t => filterByDate(t.date));
    const filteredInv = invoices.filter(i => filterByDate(i.date || i.created_at));

    switch (reportType) {
      case 'monthly': {
        const monthsMap: Record<string, { income: number; expense: number }> = {};
        filteredTx.forEach(t => {
          const month = format(parseISO(t.date), 'MMM yyyy');
          if (!monthsMap[month]) monthsMap[month] = { income: 0, expense: 0 };
          if (t.type === 'income') monthsMap[month].income += Number(t.amount);
          if (t.type === 'expense') monthsMap[month].expense += Number(t.amount);
        });
        return {
          headers: ['Month', 'Income', 'Expenses', 'Remaining Budget'],
          rows: Object.entries(monthsMap).map(([month, data]) => [
            month,
            `${currencySymbol}${data.income.toFixed(2)}`,
            `${currencySymbol}${data.expense.toFixed(2)}`,
            `${currencySymbol}${(data.income - data.expense).toFixed(2)}`
          ])
        };
      }
      case 'expense': {
        let expenses = filteredTx.filter(t => t.type === 'expense');
        expenses = applySubFilter(expenses, 'expense');
        return {
          headers: ['Date', 'Title', 'Category', 'Amount'],
          rows: expenses.map(t => [
            format(parseISO(t.date), 'MMM dd, yyyy'),
            t.title,
            t.category,
            `${currencySymbol}${Number(t.amount).toFixed(2)}`
          ])
        };
      }
      case 'income': {
        let incomes = filteredTx.filter(t => t.type === 'income');
        incomes = applySubFilter(incomes, 'income');
        return {
          headers: ['Date', 'Title', 'Source/Category', 'Amount'],
          rows: incomes.map(t => [
            format(parseISO(t.date), 'MMM dd, yyyy'),
            t.title,
            t.category,
            `${currencySymbol}${Number(t.amount).toFixed(2)}`
          ])
        };
      }
      case 'invoice': {
        const invoicesFiltered = applySubFilter(filteredInv, 'invoice');
        return {
          headers: ['Date', 'Invoice #', 'Customer/Vendor', 'Status', 'Total'],
          rows: invoicesFiltered.map(i => [
            format(parseISO(i.date || i.created_at), 'MMM dd, yyyy'),
            i.invoice_number || '-',
            i.client_name || '-',
            i.status,
            `${currencySymbol}${Number(i.total_amount).toFixed(2)}`
          ])
        };
      }
      case 'gst': {
        const monthsMap: Record<string, { collected: number; paid: number }> = {};
        
        const filteredPurchases = scannedPurchases.filter(p => filterByDate(p.date || p.created_at));

        filteredInv.forEach(i => {
          if (i.status === 'draft') return;
          const month = format(parseISO(i.date || i.created_at), 'MMM yyyy');
          if (!monthsMap[month]) monthsMap[month] = { collected: 0, paid: 0 };
          const gst = Number(i.total_cgst || 0) + Number(i.total_sgst || 0) + Number(i.total_igst || 0);
          monthsMap[month].collected += gst;
        });

        filteredPurchases.forEach(p => {
          const month = format(parseISO(p.date || p.created_at), 'MMM yyyy');
          if (!monthsMap[month]) monthsMap[month] = { collected: 0, paid: 0 };
          const gst = Number(p.total_cgst || 0) + Number(p.total_sgst || 0) + Number(p.total_igst || 0);
          monthsMap[month].paid += gst;
        });

        return {
          headers: ['Period', 'GST Collected', 'GST Paid', 'Net GST Payable'],
          rows: Object.entries(monthsMap).map(([month, data]) => [
            month,
            `${currencySymbol}${data.collected.toFixed(2)}`,
            `${currencySymbol}${data.paid.toFixed(2)}`,
            `${currencySymbol}${(data.collected - data.paid).toFixed(2)}`
          ])
        };
      }
      case 'health': {
        let totalIncome = 0;
        let totalExpense = 0;
        filteredTx.forEach(t => {
          if (t.type === 'income') totalIncome += Number(t.amount);
          if (t.type === 'expense') totalExpense += Number(t.amount);
        });
        const profit = totalIncome - totalExpense;
        const profitMargin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;
        const operatingRatio = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;
        
        return {
          headers: ['Metric', 'Value', 'Status'],
          rows: [
            ['Total Revenue', `${currencySymbol}${totalIncome.toFixed(2)}`, totalIncome > 0 ? 'Good' : 'Needs Attention'],
            ['Total Expenses', `${currencySymbol}${totalExpense.toFixed(2)}`, '-'],
            ['Remaining Budget', `${currencySymbol}${profit.toFixed(2)}`, profit >= 0 ? 'Savings' : 'Over Budget'],
            ['Savings Rate', `${profitMargin.toFixed(1)}%`, profitMargin > 15 ? 'Healthy' : 'Low'],
            ['Operating Ratio', `${operatingRatio.toFixed(1)}%`, operatingRatio < 80 ? 'Efficient' : 'High Expenses']
          ]
        };
      }
      case 'savings': {
        const monthsMap: Record<string, { income: number; expense: number }> = {};
        filteredTx.forEach(t => {
          const month = format(parseISO(t.date), 'MMM yyyy');
          if (!monthsMap[month]) monthsMap[month] = { income: 0, expense: 0 };
          if (t.type === 'income') monthsMap[month].income += Number(t.amount);
          if (t.type === 'expense') monthsMap[month].expense += Number(t.amount);
        });
        return {
          headers: ['Month', 'Income', 'Saved Amount', 'Savings Rate'],
          rows: Object.entries(monthsMap).map(([month, data]) => {
            const saved = data.income - data.expense;
            const rate = data.income > 0 ? (saved / data.income) * 100 : 0;
            return [
              month,
              `${currencySymbol}${data.income.toFixed(2)}`,
              `${currencySymbol}${saved.toFixed(2)}`,
              `${rate.toFixed(1)}%`
            ];
          })
        };
      }
      default:
        return { headers: [], rows: [] };
    }
  };

  const handleExportExcel = () => {
    const data = generateReportData();
    if (data.rows.length === 0) {
      toast.error('No data to export');
      return;
    }
    const ws = XLSX.utils.aoa_to_sheet([data.headers, ...data.rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${reportType}-report.xlsx`);
    toast.success('Excel downloaded');
  };

  
  const handleShareWhatsApp = () => {
    const data = generateReportData();
    if (data.rows.length === 0) {
      toast.error('No data to share');
      return;
    }
    
    let text = `*${reportType.toUpperCase()} REPORT*\n\n`;
    data.rows.forEach(row => {
      text += row.join(' | ') + '\n';
    });
    
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const handleExportPDF = () => {
    const data = generateReportData();
    if (data.rows.length === 0) {
      toast.error('No data to export');
      return;
    }
    const doc = new jsPDF();
    doc.text(`${reportType.toUpperCase()} REPORT`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);
    
    // Replace ₹ symbol with Rs. for PDF compatibility
    const safeRows = data.rows.map(row => 
      row.map(cell => typeof cell === 'string' ? cell.replace(new RegExp(currencySymbol, 'g'), currencySymbol) : cell)
    );

    autoTable(doc, {
      head: [data.headers],
      body: safeRows,
      startY: 30,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [15, 23, 42] }
    });
    
    doc.save(`${reportType}-report.pdf`);
    toast.success('PDF downloaded');
  };

  const handleExportGSTJSON = () => {
    const filteredPurchases = scannedPurchases.filter(p => filterByDate(p.date || p.created_at));
    const filteredSales = invoices.filter(i => filterByDate(i.date || i.created_at) && i.status !== 'draft');

    const b2bSales = filteredSales.filter(s => s.customer_gstin && s.customer_gstin.trim() !== '');
    const b2csSales = filteredSales.filter(s => !s.customer_gstin || s.customer_gstin.trim() === '');

    const gstData = {
      gstin: profileInfo?.gstin || "USER_GSTIN", 
      fp: dateFilter === 'this_month' ? format(new Date(), 'MMyyyy') : format(new Date(), 'MMyyyy'), 
      gt: 0,
      cur_gt: 0,
      b2b: b2bSales.length > 0 ? b2bSales.map(sale => ({
        ctin: sale.customer_gstin,
        inv: [{
          inum: sale.invoice_number,
          idt: sale.date ? format(parseISO(sale.date), 'dd-MM-yyyy') : "",
          val: sale.total_amount,
          pos: sale.customer_gstin?.substring(0, 2) || "29", 
          rchrg: "N",
          inv_typ: "R",
          itms: sale.items?.map((item: any, idx: number) => {
             const amount = Number(item.amount) || 0;
             const isIgst = Number(sale.total_igst) > 0;
             const taxRate = item.rate ? (item.tax_rate || 18) : 18; // Defaulting to 18 if not available
             const taxAmt = amount * (taxRate / 100);
             return {
                num: idx + 1,
                itm_det: {
                  txval: amount,
                  rt: taxRate, 
                  camt: isIgst ? 0 : taxAmt / 2,
                  samt: isIgst ? 0 : taxAmt / 2,
                  iamt: isIgst ? taxAmt : 0,
                  csamt: 0
                }
             };
          }) || []
        }]
      })) : undefined,
      b2cs: b2csSales.length > 0 ? b2csSales.map(sale => ({
        sply_ty: "INTRA",
        rt: 18, // Assume 18 for now, robust apps allow item-level editing
        typ: "OE",
        pos: profileInfo?.gstin ? profileInfo.gstin.substring(0, 2) : "29",
        txval: sale.subtotal,
        camt: sale.total_cgst || (sale.subtotal * 0.09),
        samt: sale.total_sgst || (sale.subtotal * 0.09),
        iamt: sale.total_igst || 0
      })) : undefined,
      inward_supplies: filteredPurchases.map(purchase => {
        const isIgst = Number(purchase.total_igst) > 0;
        return {
          ctin: purchase.vendor_gstin || "UNKNOWN",
          inv: [{
            inum: purchase.invoice_number,
            idt: purchase.date ? format(parseISO(purchase.date), 'dd-MM-yyyy') : "",
            val: purchase.total_amount,
            pos: purchase.vendor_gstin?.substring(0, 2) || "29",
            rchrg: "N",
            inv_typ: "R",
            itms: purchase.items?.map((item: any, idx: number) => {
              const amount = Number(item.amount) || 0;
              const taxRate = 18;
              const taxAmt = amount * (taxRate / 100);
              return {
                num: idx + 1,
                itm_det: {
                  txval: amount,
                  rt: taxRate,
                  camt: isIgst ? 0 : taxAmt / 2,
                  samt: isIgst ? 0 : taxAmt / 2,
                  iamt: isIgst ? taxAmt : 0,
                  csamt: 0
                }
              };
            }) || []
          }]
        };
      })
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(gstData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `GST_Return_${dateFilter}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    toast.success('GST JSON exported successfully!');
  };

  const handlePrint = () => {
    window.print();
  };

    const generateAIReport = async () => {
    setIsGeneratingAI(true);
    setAiReport(null);
    try {
      const res = await fetch('/api/generate-monthly-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data: reportData.rows, 
          budgets: transactions.filter(t => t.type === 'budget').map(b => ({
            name: b.description,
            amount: b.amount,
            period: b.category,
            spent: transactions.filter(t => t.type === 'expense' && t.description?.includes('@budget:' + b.description)).reduce((sum, t) => sum + Number(t.amount), 0)
          })),
          currencySymbol 
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setAiReport(result.result);
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate AI report');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const reportData = generateReportData();

  return (
    <div className="min-h-screen bg-muted/20 pb-20 print:bg-white print:pb-0">
      <header className="bg-background border-b px-4 py-3 flex items-center justify-between sticky top-0 z-20 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="bg-blue-500/10 p-1.5 rounded-full">
              <FileText className="h-5 w-5 text-blue-500" />
            </div>
            <h1 className="font-semibold text-lg">Reports & Exports</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6 print:p-0 print:max-w-none">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-8 print:hidden">
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-background border rounded-md p-1">
              <Filter className="h-4 w-4 ml-2 text-muted-foreground" />
              <Select value={reportType} onValueChange={(v: ReportType) => setReportType(v)}>
                <SelectTrigger className="border-0 shadow-none focus:ring-0 bg-transparent w-[180px]">
                  <SelectValue placeholder="Select Report Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly Summary</SelectItem>
                  <SelectItem value="expense">Detailed Expense</SelectItem>
                  <SelectItem value="income">Detailed Income</SelectItem>
                  <SelectItem value="savings">Savings Report</SelectItem>
                  {profileType === 'business' && (
                    <>
                      <SelectItem value="invoice">Invoice Report</SelectItem>
                      <SelectItem value="gst">GST Summary</SelectItem>
                      <SelectItem value="health">Business Health</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 bg-background border rounded-md p-1">
              <CalendarIcon className="h-4 w-4 ml-2 text-muted-foreground" />
              <Select value={dateFilter} onValueChange={(v: DateFilter) => setDateFilter(v)}>
                <SelectTrigger className="border-0 shadow-none focus:ring-0 bg-transparent w-[140px]">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="this_year">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateFilter === 'custom' && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <Popover>
                  <PopoverTrigger 
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "w-[140px] justify-start text-left font-normal border shadow-none bg-background",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "PPP") : <span>From date</span>}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground text-sm">to</span>
                <Popover>
                  <PopoverTrigger 
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "w-[140px] justify-start text-left font-normal border shadow-none bg-background",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "PPP") : <span>To date</span>}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {getSubFilterOptions().length > 0 && (
              <div className="flex items-center gap-2 bg-background border rounded-md p-1">
                <Filter className="h-4 w-4 ml-2 text-muted-foreground" />
                <Select value={subFilter} onValueChange={setSubFilter}>
                  <SelectTrigger className="border-0 shadow-none focus:ring-0 bg-transparent w-[140px] capitalize">
                    <SelectValue placeholder="Filter..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {getSubFilterOptions().map(opt => (
                      <SelectItem key={opt} value={opt} className="capitalize">{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            {reportType === 'monthly' && (
              <Button variant="outline" size="sm" onClick={generateAIReport} disabled={isGeneratingAI} className="flex-1 md:flex-none border-blue-500 text-blue-600 hover:bg-blue-50">
                {isGeneratingAI ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                AI Analysis
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handlePrint} className="flex-1 md:flex-none">
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="flex-1 md:flex-none">
              <Download className="mr-2 h-4 w-4" /> PDF
            </Button>
            <Button variant="default" size="sm" onClick={handleExportExcel} className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700">
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
            </Button>
            {reportType === 'gst' && (
              <Button variant="default" size="sm" onClick={handleExportGSTJSON} className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700">
                <Download className="mr-2 h-4 w-4" /> Govt JSON
              </Button>
            )}
          </div>
        </div>

        <Card className="print:shadow-none print:border-none" ref={printRef}>
          <CardHeader className="border-b bg-muted/30 print:bg-white print:border-b-2">
            <CardTitle className="text-xl capitalize flex items-center justify-between">
              <span>{reportType.replace('_', ' ')} Report</span>
              <span className="text-sm font-normal text-muted-foreground hidden print:inline">
                Generated: {new Date().toLocaleDateString()}
              </span>
            </CardTitle>
            <CardDescription>
              {dateFilter === 'all' ? 'Showing all available data' : `Filtered by: ${dateFilter.replace('_', ' ')}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : reportData.rows.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>No data found for the selected criteria.</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {(reportType === 'expense' || reportType === 'income') && (
                  <div className="h-64 border-b p-4 print:hidden">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Array.from(
                            reportData.rows.reduce((acc, row) => {
                              const cat = row[2];
                              const amount = Number(row[3].toString().replace(/[^0-9.-]+/g, ""));
                              acc.set(cat, (acc.get(cat) || 0) + amount);
                              return acc;
                            }, new Map())
                          ).map(([name, value]) => ({ name, value }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {
                            Array.from(
                            reportData.rows.reduce((acc, row) => {
                              const cat = row[2];
                              const amount = Number(row[3].toString().replace(/[^0-9.-]+/g, ""));
                              acc.set(cat, (acc.get(cat) || 0) + amount);
                              return acc;
                            }, new Map())
                          ).map((entry, index) => {
                            const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
                            return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                          })}
                        </Pie>
                        <Tooltip formatter={(value) => `${currencySymbol}${Number(value).toFixed(2)}`} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              {aiReport && (
                <div className="p-6 bg-blue-50/50 border-b print:hidden">
                  <div className="flex items-center gap-2 mb-4 text-blue-700">
                    <Sparkles className="h-5 w-5" />
                    <h3 className="font-semibold text-lg">AI Financial Analysis</h3>
                  </div>
                  <div className="prose prose-sm md:prose-base dark:prose-invert prose-blue max-w-none prose-headings:font-semibold prose-a:text-primary">
                    <Markdown remarkPlugins={[remarkGfm]}>{aiReport}</Markdown>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto">
                <div className="overflow-x-auto"><table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 print:bg-white border-b">
                    <tr>
                      {reportData.headers.map((header, i) => (
                        <th key={i} className="px-6 py-4 font-semibold">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.rows.map((row, i) => (
                      <tr key={i} className="bg-card border-b print:border-b last:border-0 hover:bg-muted/50 transition-colors">
                        {row.map((cell, j) => (
                          <td key={j} className="px-6 py-4 font-medium text-foreground">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
              
              {reportType === 'monthly' && (
                <div className="p-6 border-t bg-muted/30 print:bg-white">
                  <h3 className="font-semibold text-lg mb-4 text-foreground">Budget Report</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    {Array.from(new Set(transactions.filter(t => t.type === 'budget').map(b => b.description).filter(Boolean))).map((budgetName: any) => {
                      const budgetAmt = Number(transactions.find(t => t.type === 'budget' && t.description === budgetName)?.amount || 0);
                      const spent = transactions.filter(t => t.type === 'expense' && t.description?.includes('@budget:' + budgetName)).reduce((sum, t) => sum + Number(t.amount), 0);
                      const progress = budgetAmt > 0 ? (spent / budgetAmt) * 100 : 0;
                      return (
                        <div key={budgetName} className="p-4 border rounded-lg bg-card">
                          <div className="flex justify-between mb-2">
                            <span className="font-medium text-sm">{budgetName}</span>
                            <span className="text-sm">{currencySymbol}{spent.toFixed(2)} / {currencySymbol}{budgetAmt.toFixed(2)}</span>
                          </div>
                          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                            <div className={`h-full ${progress > 90 ? "bg-rose-500" : progress > 75 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(progress, 100)}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  
                  <h3 className="font-semibold text-lg mb-4 text-foreground">Detailed Transactions</h3>
                  <div className="overflow-x-auto border rounded-lg bg-card">
                    <div className="overflow-x-auto"><table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                        <tr>
                          <th className="px-6 py-3 font-semibold">Date</th>
                          <th className="px-6 py-3 font-semibold">Type</th>
                          <th className="px-6 py-3 font-semibold">Category</th>
                          <th className="px-6 py-3 font-semibold">Description</th>
                          <th className="px-6 py-3 font-semibold text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.filter(t => (t.type === 'expense' || t.type === 'income') && (dateFilter === 'all' || (dateFilter === 'this_month' && isWithinInterval(parseISO(t.date), {start: startOfMonth(new Date()), end: endOfMonth(new Date())})))).map((t, i) => (
                          <tr key={i} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                            <td className="px-6 py-3 font-medium text-foreground">{format(parseISO(t.date), 'dd MMM yyyy')}</td>
                            <td className="px-6 py-3 font-medium capitalize text-foreground">{t.type}</td>
                            <td className="px-6 py-3 text-foreground">{t.category}</td>
                            <td className="px-6 py-3 text-foreground">{t.description?.replace(/@budget:.*/, '')}</td>
                            <td className={`px-6 py-3 text-right font-medium ${t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {t.type === 'income' ? '+' : '-'}{currencySymbol}{Number(t.amount).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table></div>
                  </div>
                </div>
              )}

              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
