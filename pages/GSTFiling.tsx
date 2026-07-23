import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  FileSpreadsheet, Download, Share2, ArrowLeft, 
  Loader2, Calculator, Receipt, ShieldCheck, Sparkles, AlertCircle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function GSTFiling() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [showAiDialog, setShowAiDialog] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();
        
      if (profileData) {
        setProfile(profileData);
      }

      const { data: salesData } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user?.id)
        .order('date', { ascending: false });

      const { data: purchasesData } = await supabase
        .from('scanned_purchases')
        .select('*')
        .eq('user_id', user?.id)
        .order('date', { ascending: false });

      const allPurchases = purchasesData || [];
      const actualPurchases = allPurchases.filter(p => p.invoice_type !== 'sales');
      const scannedSales = allPurchases.filter(p => p.invoice_type === 'sales').map(s => ({
        ...s,
        subtotal: Number(s.total_amount) - (Number(s.total_cgst) + Number(s.total_sgst) + Number(s.total_igst)),
        customer_gstin: s.customer_gstin || s.vendor_gstin // fallback if they were swapped
      }));

      setSales([...(salesData || []), ...scannedSales]);
      setPurchases(actualPurchases);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateGST3B = async () => {
    setAiLoading(true);
    setShowAiDialog(true);
    setAiResult(null);
    try {
      const b2bSales = sales.filter(s => s.customer_gstin).reduce((sum, s) => sum + (Number(s.subtotal) || 0), 0);
      const b2cSales = sales.filter(s => !s.customer_gstin).reduce((sum, s) => sum + (Number(s.subtotal) || 0), 0);
      
      const response = await fetch('/api/generate-gst3b', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gstin: profile?.gstin,
          fy: '2023-24', // Example, can be dynamic
          quarter: 'Q2', 
          businessType: profile?.profile_type,
          sales: sales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0),
          taxableSales: b2bSales + b2cSales,
          purchases: purchases.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0),
          itcPurchases: purchases.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0), // Simplified
          b2b: b2bSales,
          b2c: b2cSales,
          exportSales: 0
        })
      });

      if (!response.ok) throw new Error('Failed to generate GST-3B');
      const data = await response.json();
      setAiResult(data.result);
      toast.success('GST-3B Generated successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate GST-3B');
    } finally {
      setAiLoading(false);
    }
  };

  const handleExportJSON = () => {
    const gstData = {
      gstin: profile?.gstin || "USER_GSTIN",
      fp: format(new Date(), 'MMyyyy'),
      gt: 0,
      cur_gt: 0,
      b2b: sales.filter(s => s.customer_gstin).map(sale => ({
        ctin: sale.customer_gstin,
        inv: [{
          inum: sale.invoice_number,
          idt: sale.date ? format(parseISO(sale.date), 'dd-MM-yyyy') : "",
          val: sale.total_amount,
          pos: "29", 
          rchrg: "N",
          inv_typ: "R",
          itms: sale.items?.map((item: any) => ({
            num: 1,
            itm_det: {
              txval: item.amount,
              rt: 18, 
              camt: (item.amount * 0.09) || 0,
              samt: (item.amount * 0.09) || 0,
              iamt: 0,
              csamt: 0
            }
          })) || []
        }]
      })),
      b2cs: sales.filter(s => !s.customer_gstin).map(sale => ({
        sply_ty: "INTRA",
        rt: 18,
        typ: "OE",
        pos: "29",
        txval: sale.subtotal,
        camt: sale.total_cgst,
        samt: sale.total_sgst
      }))
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(gstData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `GSTR1_${profile?.gstin || 'EXPORT'}_${format(new Date(), 'MMyyyy')}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    toast.success('GST JSON downloaded');
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('GST SUMMARY REPORT', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${format(new Date(), 'dd-MM-yyyy')}`, 14, 28);
    if (profile?.business_name) doc.text(`Business Name: ${profile.business_name}`, 14, 34);
    if (profile?.gstin) doc.text(`GSTIN: ${profile.gstin}`, 14, 40);

    const totalSales = sales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
    const totalCGST = sales.reduce((sum, s) => sum + (Number(s.total_cgst) || 0), 0);
    const totalSGST = sales.reduce((sum, s) => sum + (Number(s.total_sgst) || 0), 0);
    
    const totalITC = purchases.reduce((sum, p) => sum + (Number(p.total_cgst || 0) + Number(p.total_sgst || 0) + Number(p.total_igst || 0)), 0);

    autoTable(doc, {
      startY: 50,
      head: [['Particulars', 'Amount (Rs)']],
      body: [
        ['Total Sales (Outward Supplies)', totalSales.toFixed(2)],
        ['CGST Collected', totalCGST.toFixed(2)],
        ['SGST Collected', totalSGST.toFixed(2)],
        ['Total Tax Liability', (totalCGST + totalSGST).toFixed(2)],
        ['Total ITC Available (Purchases)', totalITC.toFixed(2)],
        ['Net Tax Payable', Math.max(0, (totalCGST + totalSGST) - totalITC).toFixed(2)]
      ],
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] }
    });

    doc.save(`GST_Report_${format(new Date(), 'MMyyyy')}.pdf`);
    toast.success('PDF downloaded successfully');
  };

  const handleShareWhatsApp = () => {
    const totalSales = sales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
    const totalTax = sales.reduce((sum, s) => sum + (Number(s.total_cgst) || 0) + (Number(s.total_sgst) || 0), 0);
    const totalITC = purchases.reduce((sum, p) => sum + (Number(p.total_cgst || 0) + Number(p.total_sgst || 0) + Number(p.total_igst || 0)), 0);
    
    const text = `*GST Summary ${format(new Date(), 'MMM yyyy')}*\n\n` +
      `Total Sales: Rs ${totalSales.toFixed(2)}\n` +
      `Tax Liability: Rs ${totalTax.toFixed(2)}\n` +
      `ITC Available: Rs ${totalITC.toFixed(2)}\n` +
      `Net Payable: Rs ${Math.max(0, totalTax - totalITC).toFixed(2)}\n\n` +
      `Generated via AI Studio Applet`;
      
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      <header className="bg-background border-b px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">GST Filing</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleShareWhatsApp}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Calculator className="h-6 w-6" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Total Sales Liability</p>
              <h3 className="text-3xl font-bold">
                ₹{sales.reduce((sum, s) => sum + (Number(s.total_cgst) || 0) + (Number(s.total_sgst) || 0), 0).toFixed(2)}
              </h3>
            </CardContent>
          </Card>

          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                  <Receipt className="h-6 w-6" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Total ITC (Purchases)</p>
              <h3 className="text-3xl font-bold">
                ₹{purchases.reduce((sum, p) => sum + (Number(p.total_cgst || 0) + Number(p.total_sgst || 0) + Number(p.total_igst || 0)), 0).toFixed(2)}
              </h3>
            </CardContent>
          </Card>

          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                  <ShieldCheck className="h-6 w-6" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Net Tax Payable</p>
              <h3 className="text-3xl font-bold">
                ₹{Math.max(0, sales.reduce((sum, s) => sum + (Number(s.total_cgst) || 0) + (Number(s.total_sgst) || 0), 0) - purchases.reduce((sum, p) => sum + (Number(p.total_cgst || 0) + Number(p.total_sgst || 0) + Number(p.total_igst || 0)), 0)).toFixed(2)}
              </h3>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-3 my-4">
          <Button onClick={handleGenerateGST3B} className="flex-1 md:flex-none bg-purple-600 hover:bg-purple-700">
            <Sparkles className="mr-2 h-4 w-4" /> Auto-generate GST-3B
          </Button>
          <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center">
                  <Sparkles className="mr-2 h-5 w-5 text-purple-500" />
                  AI Generated GST-3B Return
                </DialogTitle>
                <DialogDescription>
                  Based on your transaction records and business context.
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-[400px] rounded-md border p-4 bg-muted/50">
                {aiLoading ? (
                  <div className="flex flex-col items-center justify-center h-full space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                    <p className="text-sm text-muted-foreground">Analyzing transactions & generating return...</p>
                  </div>
                ) : aiResult ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Net GST Payable</p>
                        <p className="text-2xl font-bold">₹{aiResult.net_gst_payable?.toFixed(2)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Next Due Date</p>
                        <p className="text-lg font-semibold">{aiResult.next_due_date}</p>
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-background border rounded-lg p-3">
                        <h4 className="font-semibold mb-2 flex items-center"><Calculator className="mr-2 h-4 w-4"/> Liability</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between"><span>CGST</span><span>₹{aiResult.gst_liability?.cgst?.toFixed(2)}</span></div>
                          <div className="flex justify-between"><span>SGST</span><span>₹{aiResult.gst_liability?.sgst?.toFixed(2)}</span></div>
                          <div className="flex justify-between"><span>IGST</span><span>₹{aiResult.gst_liability?.igst?.toFixed(2)}</span></div>
                          <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Total</span><span>₹{aiResult.gst_liability?.total_gst?.toFixed(2)}</span></div>
                        </div>
                      </div>
                      
                      <div className="bg-background border rounded-lg p-3">
                        <h4 className="font-semibold mb-2 flex items-center"><Receipt className="mr-2 h-4 w-4"/> Eligible ITC</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between"><span>CGST</span><span>₹{aiResult.input_tax_credit?.cgst?.toFixed(2)}</span></div>
                          <div className="flex justify-between"><span>SGST</span><span>₹{aiResult.input_tax_credit?.sgst?.toFixed(2)}</span></div>
                          <div className="flex justify-between"><span>IGST</span><span>₹{aiResult.input_tax_credit?.igst?.toFixed(2)}</span></div>
                          <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Total</span><span>₹{aiResult.input_tax_credit?.total_itc?.toFixed(2)}</span></div>
                        </div>
                      </div>
                    </div>

                    {aiResult.compliance_warnings && aiResult.compliance_warnings.length > 0 && (
                      <div className="bg-rose-500/10 text-rose-600 rounded-lg p-3 space-y-2">
                        <h4 className="font-semibold flex items-center text-sm"><AlertCircle className="mr-2 h-4 w-4"/> Compliance Warnings</h4>
                        <ul className="text-xs list-disc pl-4 space-y-1">
                          {aiResult.compliance_warnings.map((warning: string, i: number) => (
                            <li key={i}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">XML for e-Filing (Base64)</h4>
                      <code className="text-xs bg-background border p-2 rounded block break-all text-muted-foreground max-h-24 overflow-hidden">
                        {aiResult.gst3b_xml || 'N/A'}
                      </code>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    Failed to generate content.
                  </div>
                )}
              </ScrollArea>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setShowAiDialog(false)}>Close</Button>
                <Button disabled={aiLoading || !aiResult} className="bg-green-600 hover:bg-green-700">
                  <Download className="mr-2 h-4 w-4"/> Download JSON
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={handleDownloadPDF} className="flex-1 md:flex-none" variant="outline">
            <Download className="mr-2 h-4 w-4" /> Download Report PDF
          </Button>
          <Button onClick={handleExportJSON} variant="secondary" className="flex-1 md:flex-none">
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Govt JSON
          </Button>
          <Button onClick={() => window.open('https://services.gst.gov.in/services/login', '_blank')} className="flex-1 md:flex-none bg-orange-600 hover:bg-orange-700">
            <ShieldCheck className="mr-2 h-4 w-4" /> File on Govt Portal
          </Button>
        </div>

        <Tabs defaultValue="b2b" className="w-full mt-6">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto gap-2 sm:gap-0 mb-6">
            <TabsTrigger value="b2b">B2B Sales (GSTR-1)</TabsTrigger>
            <TabsTrigger value="b2c">B2C Sales</TabsTrigger>
            <TabsTrigger value="purchases">Purchases (ITC)</TabsTrigger>
          </TabsList>
          
          <TabsContent value="b2b" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>B2B Invoices</CardTitle>
                <CardDescription>Sales to registered businesses with GSTIN</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-6 w-6" /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="overflow-x-auto"><table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-3 font-medium">Invoice #</th>
                          <th className="pb-3 font-medium">Date</th>
                          <th className="pb-3 font-medium">Customer GSTIN</th>
                          <th className="pb-3 font-medium text-right">Taxable Val</th>
                          <th className="pb-3 font-medium text-right">Tax Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {sales.filter(s => s.customer_gstin).map(sale => (
                          <tr key={sale.id}>
                            <td className="py-3">{sale.invoice_number}</td>
                            <td className="py-3">{format(new Date(sale.date), 'dd/MM/yyyy')}</td>
                            <td className="py-3">{sale.customer_gstin}</td>
                            <td className="py-3 text-right">₹{sale.subtotal?.toFixed(2)}</td>
                            <td className="py-3 text-right">₹{(Number(sale.total_cgst) + Number(sale.total_sgst))?.toFixed(2)}</td>
                          </tr>
                        ))}
                        {sales.filter(s => s.customer_gstin).length === 0 && (
                          <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No B2B sales found</td></tr>
                        )}
                      </tbody>
                    </table></div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="b2c" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>B2C Invoices</CardTitle>
                <CardDescription>Sales to unregistered consumers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <div className="overflow-x-auto"><table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-3 font-medium">Invoice #</th>
                        <th className="pb-3 font-medium">Date</th>
                        <th className="pb-3 font-medium">Customer Name</th>
                        <th className="pb-3 font-medium text-right">Taxable Val</th>
                        <th className="pb-3 font-medium text-right">Tax Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {sales.filter(s => !s.customer_gstin).map(sale => (
                        <tr key={sale.id}>
                          <td className="py-3">{sale.invoice_number}</td>
                          <td className="py-3">{format(new Date(sale.date), 'dd/MM/yyyy')}</td>
                          <td className="py-3">{sale.customer_name}</td>
                          <td className="py-3 text-right">₹{sale.subtotal?.toFixed(2)}</td>
                          <td className="py-3 text-right">₹{(Number(sale.total_cgst) + Number(sale.total_sgst))?.toFixed(2)}</td>
                        </tr>
                      ))}
                      {sales.filter(s => !s.customer_gstin).length === 0 && (
                        <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No B2C sales found</td></tr>
                      )}
                    </tbody>
                  </table></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="purchases" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Eligible ITC (Purchases)</CardTitle>
                <CardDescription>Purchases recorded via invoice scanner</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <div className="overflow-x-auto"><table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-3 font-medium">Invoice #</th>
                        <th className="pb-3 font-medium">Date</th>
                        <th className="pb-3 font-medium">Vendor</th>
                        <th className="pb-3 font-medium text-right">Total Amount</th>
                        <th className="pb-3 font-medium text-right">Eligible ITC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {purchases.map(purchase => (
                        <tr key={purchase.id}>
                          <td className="py-3">{purchase.invoice_number || 'N/A'}</td>
                          <td className="py-3">{purchase.date ? format(new Date(purchase.date), 'dd/MM/yyyy') : 'N/A'}</td>
                          <td className="py-3">{purchase.vendor_name || 'N/A'}</td>
                          <td className="py-3 text-right">₹{purchase.total_amount?.toFixed(2)}</td>
                          <td className="py-3 text-right">₹{(Number(purchase.total_cgst || 0) + Number(purchase.total_sgst || 0) + Number(purchase.total_igst || 0))?.toFixed(2)}</td>
                        </tr>
                      ))}
                      {purchases.length === 0 && (
                        <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No purchases found</td></tr>
                      )}
                    </tbody>
                  </table></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </main>
    </div>
  );
}
