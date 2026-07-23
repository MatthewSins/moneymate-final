import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ArrowLeft, Download, Save, Share2, Plus, Trash2, Printer,
  Mail, MessageCircle, FileText, Mic, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Invoice, InvoiceItem } from '@/types/invoice';

const emptyItem: InvoiceItem = {
  id: '',
  description: '',
  hsn: '',
  quantity: 1,
  rate: 0,
  discount: 0,
  cgst: 0,
  sgst: 0,
  igst: 0,
  amount: 0
};

export default function InvoiceGenerator() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const invoiceRef = useRef<HTMLDivElement>(null);
  
  const [activeTab, setActiveTab] = useState('details');
  const [isListening, setIsListening] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [signaturePreview, setSignaturePreview] = useState<string>('');

  const [invoice, setInvoice] = useState<Partial<Invoice>>({
    invoice_number: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
    date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    company_name: '',
    company_address: '',
    company_gstin: '',
    company_email: '',
    company_phone: '',
    customer_name: '',
    customer_address: '',
    customer_gstin: '',
    customer_email: '',
    customer_phone: '',
    items: [{ ...emptyItem, id: Math.random().toString() }],
    shipping_charges: 0,
    notes: 'Thank you for your business.',
    terms: 'Please pay within 7 days.',
    upi_id: '',
  });

  // Calculate totals
  useEffect(() => {
    if (!invoice.items) return;
    
    let subtotal = 0;
    let total_discount = 0;
    let total_cgst = 0;
    let total_sgst = 0;
    let total_igst = 0;
    
    const updatedItems = invoice.items.map(item => {
      const baseAmount = item.quantity * item.rate;
      const discountAmt = (baseAmount * item.discount) / 100;
      const taxableAmt = baseAmount - discountAmt;
      
      const cgstAmt = (taxableAmt * item.cgst) / 100;
      const sgstAmt = (taxableAmt * item.sgst) / 100;
      const igstAmt = (taxableAmt * item.igst) / 100;
      
      const itemAmount = taxableAmt + cgstAmt + sgstAmt + igstAmt;
      
      subtotal += baseAmount;
      total_discount += discountAmt;
      total_cgst += cgstAmt;
      total_sgst += sgstAmt;
      total_igst += igstAmt;
      
      return { ...item, amount: itemAmount };
    });

    const shipping = Number(invoice.shipping_charges || 0);
    const total_amount = subtotal - total_discount + total_cgst + total_sgst + total_igst + shipping;
    
    // Only update if something changed significantly to prevent infinite loops
    if (total_amount !== invoice.total_amount) {
      setInvoice(prev => ({
        ...prev,
        items: updatedItems,
        subtotal,
        total_discount,
        total_cgst,
        total_sgst,
        total_igst,
        total_amount
      }));
    }
  }, [invoice.items, invoice.shipping_charges]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setInvoice(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    setInvoice(prev => {
      const newItems = [...(prev.items || [])];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const addItem = () => {
    setInvoice(prev => ({
      ...prev,
      items: [...(prev.items || []), { ...emptyItem, id: Math.random().toString() }]
    }));
  };

  const removeItem = (index: number) => {
    setInvoice(prev => ({
      ...prev,
      items: (prev.items || []).filter((_, i) => i !== index)
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'signature') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'logo') {
          setLogoPreview(reader.result as string);
          setInvoice(prev => ({ ...prev, company_logo: reader.result as string }));
        } else {
          setSignaturePreview(reader.result as string);
          setInvoice(prev => ({ ...prev, signature: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  
  const startVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in (window as any))) {
      toast.error('Speech recognition is not supported in this browser.');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      toast.info('Listening for invoice items...');
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      
      const toastId = toast.loading('Processing voice input...');
      try {
        const response = await fetch('/api/parse-invoice-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript }),
        });

        if (!response.ok) throw new Error('Failed to parse voice');

        const data = await response.json();
        if (data.items && data.items.length > 0) {
          const newItems = data.items.map((item: any) => ({
            id: Math.random().toString(),
            description: item.description || '',
            hsn: '',
            quantity: item.quantity || 1,
            rate: item.rate || 0,
            discount: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            amount: (item.quantity || 1) * (item.rate || 0)
          }));
          
          setInvoice(prev => {
            const currentItems = prev.items?.length === 1 && prev.items[0].description === '' ? [] : (prev.items || []);
            return {
              ...prev,
              items: [...currentItems, ...newItems]
            };
          });
          toast.success('Items added from voice', { id: toastId });
        } else {
          toast.error('No items detected in voice', { id: toastId });
        }
      } catch (error) {
        toast.error('Failed to process voice input', { id: toastId });
      }
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event.error !== 'no-speech') {
        toast.error('Microphone error: ' + event.error);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const saveToSupabase = async () => {
    setIsSaving(true);
    try {
      const newInvoice = {
        ...invoice,
        user_id: user?.id,
      };

      const { error } = await supabase.from('invoices').insert([newInvoice]);
      if (error) throw error;
      
      toast.success('Invoice saved successfully');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to save invoice');
    } finally {
      setIsSaving(false);
    }
  };

  const exportPDF = async () => {
    toast.info('Generating PDF...');
    try {
      const doc = new jsPDF();
      let y = 20;
      
      // Header
      doc.setFontSize(20);
      doc.text('INVOICE', 14, y);
      y += 10;
      
      doc.setFontSize(10);
      doc.text(`Invoice Number: ${invoice.invoice_number}`, 14, y);
      y += 5;
      doc.text(`Date: ${invoice.date}`, 14, y);
      y += 5;
      doc.text(`Due Date: ${invoice.due_date}`, 14, y);
      y += 15;
      
      // Company Details
      doc.setFontSize(12);
      doc.text('From:', 14, y);
      doc.text('To:', 120, y);
      y += 5;
      doc.setFontSize(10);
      doc.text(invoice.company_name, 14, y);
      doc.text(invoice.customer_name, 120, y);
      y += 5;
      doc.text(invoice.company_address, 14, y);
      doc.text(invoice.customer_address, 120, y);
      y += 5;
      if (invoice.company_gstin) doc.text(`GSTIN: ${invoice.company_gstin}`, 14, y);
      if (invoice.customer_gstin) doc.text(`GSTIN: ${invoice.customer_gstin}`, 120, y);
      y += 15;
      
      // Items
      const tableData = invoice.items.map(item => [
        item.description,
        item.hsn || '-',
        item.quantity.toString(),
        item.rate.toFixed(2),
        item.discount > 0 ? item.discount.toFixed(2) : '-',
        (item.cgst + item.sgst + item.igst).toFixed(2),
        item.amount.toFixed(2)
      ]);
      
      autoTable(doc, {
        startY: y,
        head: [['Description', 'HSN', 'Qty', 'Rate', 'Discount', 'GST %', 'Amount']],
        body: tableData,
      });
      
      y = (doc as any).lastAutoTable.finalY + 10;
      
      // Totals
      const rightCol = 140;
      doc.text(`Subtotal:`, rightCol, y);
      doc.text(`${invoice.subtotal.toFixed(2)}`, 180, y);
      y += 5;
      if (invoice.total_discount > 0) {
        doc.text(`Discount:`, rightCol, y);
        doc.text(`-${invoice.total_discount.toFixed(2)}`, 180, y);
        y += 5;
      }
      doc.text(`CGST:`, rightCol, y);
      doc.text(`${invoice.total_cgst.toFixed(2)}`, 180, y);
      y += 5;
      doc.text(`SGST:`, rightCol, y);
      doc.text(`${invoice.total_sgst.toFixed(2)}`, 180, y);
      y += 5;
      if (invoice.total_igst > 0) {
        doc.text(`IGST:`, rightCol, y);
        doc.text(`${invoice.total_igst.toFixed(2)}`, 180, y);
        y += 5;
      }
      if (invoice.shipping_charges > 0) {
        doc.text(`Shipping:`, rightCol, y);
        doc.text(`${invoice.shipping_charges.toFixed(2)}`, 180, y);
        y += 5;
      }
      doc.setFontSize(12);
      doc.text(`Total:`, rightCol, y);
      doc.text(`${invoice.total_amount?.toFixed(2) || '0.00'}`, 180, y);
      
      doc.save(`${invoice.invoice_number || 'invoice'}.pdf`);
      toast.success('PDF downloaded');
    } catch (err: any) {
      console.error('PDF Generation Error:', err);
      toast.error(`Failed to generate PDF: ${err.message || 'Unknown error'}`);
    }
  };

  const printInvoice = () => {
    window.print();
  };

  const shareWhatsApp = () => {
    const text = `Here is your invoice ${invoice.invoice_number} for amount ₹${invoice.total_amount?.toFixed(2)}. Please pay by ${invoice.due_date}.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareEmail = () => {
    const subject = `Invoice ${invoice.invoice_number} from ${invoice.company_name}`;
    const body = `Dear ${invoice.customer_name},\n\nPlease find attached the details for invoice ${invoice.invoice_number}.\nTotal Amount: ₹${invoice.total_amount?.toFixed(2)}\nDue Date: ${invoice.due_date}\n\nThank you for your business.`;
    window.open(`mailto:${invoice.customer_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const upiUrl = invoice.upi_id && invoice.total_amount ? 
    `upi://pay?pa=${invoice.upi_id}&pn=${invoice.company_name || 'Business'}&am=${invoice.total_amount.toFixed(2)}&cu=INR&tn=Invoice ${invoice.invoice_number}` : '';

  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      <header className="bg-background border-b px-4 py-3 flex items-center justify-between sticky top-0 z-20 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Professional Invoice Generator</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={saveToSupabase} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" /> Save
          </Button>
          <Button size="sm" onClick={exportPDF}>
            <Download className="mr-2 h-4 w-4" /> PDF
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 print:block print:p-0">
        
        {/* Left Column: Form Controls (Hidden on Print) */}
        <div className="lg:col-span-5 space-y-6 print:hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-2 sm:gap-0">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="items">Items</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="export">Export</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 animate-in fade-in-50 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Document Info</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Invoice Number</Label>
                    <Input name="invoice_number" value={invoice.invoice_number || ''} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" name="date" value={invoice.date || ''} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input type="date" name="due_date" value={invoice.due_date || ''} onChange={handleChange} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Your Company (Billed By)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Company Logo</Label>
                    <Input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'logo')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input name="company_name" value={invoice.company_name || ''} onChange={handleChange} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input name="company_email" value={invoice.company_email || ''} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input name="company_phone" value={invoice.company_phone || ''} onChange={handleChange} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>GSTIN</Label>
                    <Input name="company_gstin" value={invoice.company_gstin || ''} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Textarea name="company_address" value={invoice.company_address || ''} onChange={handleChange} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Customer (Billed To)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Customer Name</Label>
                    <Input name="customer_name" value={invoice.customer_name || ''} onChange={handleChange} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input name="customer_email" value={invoice.customer_email || ''} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input name="customer_phone" value={invoice.customer_phone || ''} onChange={handleChange} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>GSTIN</Label>
                    <Input name="customer_gstin" value={invoice.customer_gstin || ''} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Textarea name="customer_address" value={invoice.customer_address || ''} onChange={handleChange} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="items" className="space-y-4 animate-in fade-in-50 mt-4">
              {invoice.items?.map((item, index) => (
                <Card key={item.id} className="relative">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-2 right-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Item {index + 1}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 col-span-2">
                        <Label>Description</Label>
                        <Input 
                          value={item.description} 
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>HSN/SAC</Label>
                        <Input 
                          value={item.hsn} 
                          onChange={(e) => handleItemChange(index, 'hsn', e.target.value)} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input 
                          type="number" 
                          value={item.quantity} 
                          onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Rate</Label>
                        <Input 
                          type="number" 
                          value={item.rate} 
                          onChange={(e) => handleItemChange(index, 'rate', Number(e.target.value))} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Discount (%)</Label>
                        <Input 
                          type="number" 
                          value={item.discount} 
                          onChange={(e) => handleItemChange(index, 'discount', Number(e.target.value))} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>CGST (%)</Label>
                        <Input 
                          type="number" 
                          value={item.cgst} 
                          onChange={(e) => handleItemChange(index, 'cgst', Number(e.target.value))} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>SGST (%)</Label>
                        <Input 
                          type="number" 
                          value={item.sgst} 
                          onChange={(e) => handleItemChange(index, 'sgst', Number(e.target.value))} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>IGST (%)</Label>
                        <Input 
                          type="number" 
                          value={item.igst} 
                          onChange={(e) => handleItemChange(index, 'igst', Number(e.target.value))} 
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              <Button variant="outline" className="w-full" onClick={addItem}>
                <Plus className="mr-2 h-4 w-4" /> Add Item
              </Button>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 animate-in fade-in-50 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Additional Charges & Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Shipping Charges</Label>
                    <Input 
                      type="number" 
                      name="shipping_charges" 
                      value={invoice.shipping_charges || 0} 
                      onChange={handleChange} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea 
                      name="notes" 
                      value={invoice.notes || ''} 
                      onChange={handleChange} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Terms & Conditions</Label>
                    <Textarea 
                      name="terms" 
                      value={invoice.terms || ''} 
                      onChange={handleChange} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>UPI ID (For QR Code)</Label>
                    <Input 
                      name="upi_id" 
                      value={invoice.upi_id || ''} 
                      onChange={handleChange} 
                      placeholder="e.g. name@bank"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Digital Signature (Image)</Label>
                    <Input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'signature')} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="export" className="space-y-4 animate-in fade-in-50 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Export Options</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <Button variant="outline" onClick={exportPDF} className="h-20 flex flex-col items-center justify-center">
                    <FileText className="h-6 w-6 mb-2" /> PDF
                  </Button>
                  <Button variant="outline" onClick={printInvoice} className="h-20 flex flex-col items-center justify-center">
                    <Printer className="h-6 w-6 mb-2" /> Print
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Share Options</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <Button variant="outline" onClick={shareWhatsApp} className="h-20 flex flex-col items-center justify-center">
                    <MessageCircle className="h-6 w-6 mb-2 text-green-500" /> WhatsApp
                  </Button>
                  <Button variant="outline" onClick={shareEmail} className="h-20 flex flex-col items-center justify-center">
                    <Mail className="h-6 w-6 mb-2 text-rose-500" /> Email
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column: Invoice Preview */}
        <div className="lg:col-span-7 print:col-span-12 print:m-0">
          <div className="sticky top-24">
            <div className="bg-white border rounded-xl shadow-sm overflow-x-auto print:border-none print:shadow-none" >
              
              {/* Actual Invoice Content for Rendering */}
              <div ref={invoiceRef} className="p-8 md:p-12 text-black bg-white min-h-[1056px] min-w-[816px] mx-auto text-sm font-sans" id="invoice-preview">
                
                {/* Header */}
                <div className="flex justify-between items-start border-b pb-8 mb-8">
                  <div className="flex flex-col space-y-4">
                    {logoPreview && (
                      <img src={logoPreview} alt="Company Logo" className="max-h-20 max-w-[200px] object-contain" />
                    )}
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight text-gray-900">{invoice.company_name || 'COMPANY NAME'}</h1>
                      <div className="text-gray-500 mt-1 space-y-1">
                        <p className="whitespace-pre-line">{invoice.company_address}</p>
                        {invoice.company_email && <p>{invoice.company_email}</p>}
                        {invoice.company_phone && <p>{invoice.company_phone}</p>}
                        {invoice.company_gstin && <p className="font-semibold text-gray-700 mt-2">GSTIN: {invoice.company_gstin}</p>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <h2 className="text-4xl font-light text-gray-300 uppercase tracking-widest mb-4">Invoice</h2>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                      <span className="font-semibold text-gray-800">Invoice No:</span>
                      <span>{invoice.invoice_number}</span>
                      <span className="font-semibold text-gray-800">Date:</span>
                      <span>{invoice.date}</span>
                      <span className="font-semibold text-gray-800">Due Date:</span>
                      <span>{invoice.due_date}</span>
                    </div>
                  </div>
                </div>

                {/* Billed To */}
                <div className="mb-8">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Billed To</h3>
                  <div className="text-gray-800 space-y-1">
                    <p className="font-bold text-lg">{invoice.customer_name || 'Customer Name'}</p>
                    <p className="whitespace-pre-line text-gray-600">{invoice.customer_address}</p>
                    {invoice.customer_email && <p className="text-gray-600">{invoice.customer_email}</p>}
                    {invoice.customer_phone && <p className="text-gray-600">{invoice.customer_phone}</p>}
                    {invoice.customer_gstin && <p className="font-semibold text-gray-700 mt-1">GSTIN: {invoice.customer_gstin}</p>}
                  </div>
                </div>

                {/* Items Table */}
                <div className="mb-8 overflow-hidden rounded-lg border border-gray-200">
                  <div className="overflow-x-auto"><table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-3 border-b">Description</th>
                        <th className="px-4 py-3 border-b text-right">Qty</th>
                        <th className="px-4 py-3 border-b text-right">Rate</th>
                        <th className="px-4 py-3 border-b text-right">Disc %</th>
                        <th className="px-4 py-3 border-b text-right">Tax %</th>
                        <th className="px-4 py-3 border-b text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700 align-top">
                      {invoice.items?.map((item, index) => (
                        <tr key={index} className="border-b border-gray-100 last:border-0">
                          <td className="px-4 py-4">
                            <p className="font-medium">{item.description || 'Item Description'}</p>
                            {item.hsn && <p className="text-xs text-gray-400 mt-1">HSN/SAC: {item.hsn}</p>}
                          </td>
                          <td className="px-4 py-4 text-right">{item.quantity}</td>
                          <td className="px-4 py-4 text-right">{item.rate.toFixed(2)}</td>
                          <td className="px-4 py-4 text-right">{item.discount > 0 ? `${item.discount}%` : '-'}</td>
                          <td className="px-4 py-4 text-right">
                            <span className="text-xs text-gray-500 block">
                              {(Number(item.cgst) + Number(item.sgst) + Number(item.igst)) > 0 
                                ? `${(Number(item.cgst) + Number(item.sgst) + Number(item.igst))}%` 
                                : '-'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right font-medium">
                            {item.amount?.toFixed(2) || '0.00'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                </div>

                {/* Totals Section */}
                <div className="flex justify-between items-start mb-8">
                  
                  {/* Left Side: Notes & UPI */}
                  <div className="w-1/2 pr-8 space-y-6">
                    {invoice.upi_id && upiUrl && (
                      <div className="flex items-center gap-4 p-4 border rounded-lg bg-gray-50">
                        <QRCodeSVG value={upiUrl} size={80} level="M" />
                        <div>
                          <p className="font-semibold text-gray-800">Scan to Pay</p>
                          <p className="text-xs text-gray-500 break-all">{invoice.upi_id}</p>
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Notes</h3>
                      <p className="text-gray-600 text-sm whitespace-pre-line">{invoice.notes}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Terms & Conditions</h3>
                      <p className="text-gray-600 text-sm whitespace-pre-line">{invoice.terms}</p>
                    </div>
                  </div>

                  {/* Right Side: Totals Summary */}
                  <div className="w-1/2 max-w-[300px] ml-auto">
                    <div className="space-y-3 text-gray-600">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-medium text-gray-900">{invoice.subtotal?.toFixed(2)}</span>
                      </div>
                      
                      {Number(invoice.total_discount) > 0 && (
                        <div className="flex justify-between text-rose-600">
                          <span>Discount:</span>
                          <span>-{invoice.total_discount?.toFixed(2)}</span>
                        </div>
                      )}
                      
                      {Number(invoice.total_cgst) > 0 && (
                        <div className="flex justify-between">
                          <span>CGST:</span>
                          <span>{invoice.total_cgst?.toFixed(2)}</span>
                        </div>
                      )}
                      
                      {Number(invoice.total_sgst) > 0 && (
                        <div className="flex justify-between">
                          <span>SGST:</span>
                          <span>{invoice.total_sgst?.toFixed(2)}</span>
                        </div>
                      )}
                      
                      {Number(invoice.total_igst) > 0 && (
                        <div className="flex justify-between">
                          <span>IGST:</span>
                          <span>{invoice.total_igst?.toFixed(2)}</span>
                        </div>
                      )}
                      
                      {Number(invoice.shipping_charges) > 0 && (
                        <div className="flex justify-between">
                          <span>Shipping:</span>
                          <span>{Number(invoice.shipping_charges).toFixed(2)}</span>
                        </div>
                      )}
                      
                      <Separator className="my-2" />
                      
                      <div className="flex justify-between items-center text-lg font-bold text-gray-900">
                        <span>Total:</span>
                        <span>₹{invoice.total_amount?.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Signature */}
                    <div className="mt-12 text-center">
                      {signaturePreview ? (
                        <img src={signaturePreview} alt="Signature" className="h-16 mx-auto object-contain mb-2" />
                      ) : (
                        <div className="h-16 border-b-2 border-dashed border-gray-300 w-48 mx-auto mb-2" />
                      )}
                      <p className="text-xs text-gray-500 font-medium">Authorized Signatory</p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-auto pt-8 border-t text-center text-gray-400 text-xs">
                  <p>Powered by MoneyMate AI Invoice Generator</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
