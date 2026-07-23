import { convertPdfFileToImageFile, convertPdfToImage } from '@/lib/pdfUtils';
import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Upload, Camera, Save, FileJson, 
  Trash2, Plus, Loader2, CheckCircle2, AlertCircle, Edit2
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface ExtractedInvoice {
  invoice_type?: 'sales' | 'purchase';
  invoice_number?: string;
  date?: string;
  vendor_name?: string;
  vendor_gstin?: string;
  customer_name?: string;
  customer_gstin?: string;
  items?: Array<{
    description?: string;
    hsn?: string;
    quantity?: number;
    rate?: number;
    amount?: number;
  }>;
  total_amount?: number;
  total_cgst?: number;
  total_sgst?: number;
  total_igst?: number;
}

export default function InvoiceScanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedInvoice | null>(null);
  const [activeTab, setActiveTab] = useState('upload');
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let processedFile = file;
    if (file.type === 'application/pdf') {
      try {
        toast.info('Processing PDF...');
        const imageUrl = await convertPdfToImage(file);
        setImagePreview(imageUrl);
        processedFile = await convertPdfFileToImageFile(file);
      } catch (err) {
        toast.error('Failed to process PDF preview');
        return;
      }
    } else {
      // Show preview
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }

    await scanInvoice(processedFile);
  };

  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          const maxDim = 1200;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
            } else {
              resolve(file);
            }
          }, 'image/jpeg', 0.8);
        };
        img.onerror = () => resolve(file);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const scanInvoice = async (file: File) => {
    setIsScanning(true);
    setActiveTab('preview');
    
    try {
      const compressedFile = await compressImage(file);
      const formData = new FormData();
      formData.append('invoice', compressedFile);

      const response = await fetch('/api/scan-invoice', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      });

      const textResponse = await response.text();

      if (!response.ok) {
        if (textResponse.includes('Cookie check') || textResponse.includes('Action required to load your app')) {
           throw new Error("Authentication cookie blocked. Please open this app in a new tab (click the arrow icon in the top right).");
        }
        let errorMsg = 'Failed to scan invoice';
        try {
          const errorData = JSON.parse(textResponse);
          errorMsg = errorData.error || errorMsg;
        } catch (e) {
          errorMsg = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }

      let data;
      try {
        data = JSON.parse(textResponse);
      } catch (e) {
        if (textResponse.includes('Cookie check') || textResponse.includes('Action required to load your app')) {
           throw new Error("Authentication cookie blocked. Please open this app in a new tab (click the arrow icon in the top right).");
        }
        console.error("Failed to parse JSON. Raw response:", textResponse);
        throw new Error("Received an invalid response from the server. Please check the console.");
      }
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setExtractedData(data);
      toast.success('Invoice extracted successfully');
      setActiveTab('edit');
    } catch (error: any) {
      console.error('Scan error:', error);
      toast.error(error.message || 'Failed to analyze the invoice');
      setActiveTab('upload');
    } finally {
      setIsScanning(false);
    }
  };

  const handleInputChange = (field: keyof ExtractedInvoice, value: any) => {
    setExtractedData(prev => prev ? { ...prev, [field]: value } : { [field]: value });
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setExtractedData(prev => {
      if (!prev || !prev.items) return prev;
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const addItem = () => {
    setExtractedData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: [...(prev.items || []), { description: '', quantity: 1, rate: 0, amount: 0 }]
      };
    });
  };

  const removeItem = (index: number) => {
    setExtractedData(prev => {
      if (!prev || !prev.items) return prev;
      return {
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      };
    });
  };

  const saveInvoice = async () => {
    if (!extractedData) return;
    setIsSaving(true);
    
    try {
      const { data: profile } = await supabase.from('profiles').select('profile_type').eq('id', user?.id).single();
      const currentProfileType = profile?.profile_type || 'personal';

      // 1. Save to scanned_purchases table
      const purchaseData = {
        user_id: user?.id,
        invoice_type: extractedData.invoice_type || 'purchase',
        invoice_number: extractedData.invoice_number,
        date: extractedData.date ? new Date(extractedData.date).toISOString() : null,
        vendor_name: extractedData.vendor_name,
        vendor_gstin: extractedData.vendor_gstin,
        customer_name: extractedData.customer_name,
        customer_gstin: extractedData.customer_gstin,
        items: extractedData.items || [],
        total_amount: extractedData.total_amount,
        total_cgst: extractedData.total_cgst,
        total_sgst: extractedData.total_sgst,
        total_igst: extractedData.total_igst,
      };

      const { data: invData, error: invError } = await supabase
        .from('scanned_purchases')
        .insert([purchaseData])
        .select()
        .single();
        
      if (invError) throw invError;

      // 2. Also log as a transaction
      const isSales = extractedData.invoice_type === 'sales';
      const transactionData = {
        user_id: user?.id,
        amount: extractedData.total_amount || 0,
        type: isSales ? 'income' : 'expense',
        category: isSales ? 'Sales' : 'Scanned Invoice',
        description: `Invoice ${extractedData.invoice_number || 'Unknown'} ${isSales ? 'to ' + (extractedData.customer_name || 'Unknown') : 'from ' + (extractedData.vendor_name || 'Unknown')}`,
        date: extractedData.date ? new Date(extractedData.date).toISOString() : new Date().toISOString(),
        profile_type: currentProfileType
      };
      
      const { error: txError } = await supabase
        .from('transactions')
        .insert([transactionData]);
        
      if (txError) throw txError;

      toast.success('Invoice saved to database and dashboard updated');
      navigate('/dashboard');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to save to database');
    } finally {
      setIsSaving(false);
    }
  };

  const resetScanner = () => {
    setImagePreview(null);
    setExtractedData(null);
    setActiveTab('upload');
  };

  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      <header className="bg-background border-b px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">AI Invoice Scanner</h1>
        </div>
        {extractedData && (
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={saveInvoice} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" /> Save to DB
            </Button>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-6 h-full flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 max-w-md h-auto gap-2 sm:gap-0 mx-auto mb-6">
            <TabsTrigger value="upload" disabled={isScanning}>1. Upload</TabsTrigger>
            <TabsTrigger value="preview" disabled={!imagePreview}>2. Scan</TabsTrigger>
            <TabsTrigger value="edit" disabled={!extractedData}>3. Review</TabsTrigger>
          </TabsList>

          {/* UPLOAD TAB */}
          <TabsContent value="upload" className="flex-1 flex items-center justify-center min-h-[60vh]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
              
              <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <CardContent className="flex flex-col items-center justify-center p-12 text-center h-[300px]">
                  <div className="h-20 w-20 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mb-6">
                    <Upload className="h-10 w-10" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Upload File</h3>
                  <p className="text-muted-foreground">Select a PDF or Image from your device</p>
                  <input 
                    type="file" 
                    accept="image/*,application/pdf" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                </CardContent>
              </Card>

              <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => cameraInputRef.current?.click()}>
                <CardContent className="flex flex-col items-center justify-center p-12 text-center h-[300px]">
                  <div className="h-20 w-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-6">
                    <Camera className="h-10 w-10" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Use Camera</h3>
                  <p className="text-muted-foreground">Take a picture of the invoice</p>
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    className="hidden" 
                    ref={cameraInputRef}
                    onChange={handleFileUpload}
                  />
                </CardContent>
              </Card>

            </div>
          </TabsContent>

          {/* PREVIEW/SCANNING TAB */}
          <TabsContent value="preview" className="flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
              <div className="flex flex-col items-center justify-center bg-black/5 dark:bg-white/5 rounded-xl border p-4 min-h-[400px]">
                {imagePreview ? (
                  imagePreview.startsWith("data:application/pdf") ? <iframe src={imagePreview} className="w-full h-[70vh] rounded" title="PDF Preview" /> : <img src={imagePreview} alt="Invoice Preview" className="max-h-[70vh] object-contain rounded" />
                ) : (
                  <div className="flex flex-col items-center text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mb-4" />
                    <p>No image selected</p>
                    <Button variant="link" onClick={() => setActiveTab('upload')}>Go back</Button>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center justify-center p-8 text-center space-y-6">
                {isScanning ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6"
                  >
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                      <div className="bg-background rounded-full p-6 relative border shadow-lg">
                        <Loader2 className="h-12 w-12 text-primary animate-spin" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-bold">AI Analyzing Invoice</h2>
                      <p className="text-muted-foreground max-w-sm mx-auto">
                        Extracting GSTIN, items, tax breakdown and amounts using advanced vision models...
                      </p>
                    </div>
                  </motion.div>
                ) : extractedData ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6"
                  >
                    <div className="bg-emerald-500/10 text-emerald-500 rounded-full p-6 inline-block mb-4">
                      <CheckCircle2 className="h-12 w-12" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-bold">Extraction Complete</h2>
                      <p className="text-muted-foreground">
                        We've extracted the data. Please review it on the next screen.
                      </p>
                    </div>
                    <Button size="lg" className="w-full max-w-sm" onClick={() => setActiveTab('edit')}>
                      Review Data <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
                    </Button>
                    <Button variant="ghost" onClick={resetScanner}>Scan Another</Button>
                  </motion.div>
                ) : null}
              </div>
            </div>
          </TabsContent>

          {/* EDIT/REVIEW TAB */}
          <TabsContent value="edit" className="flex-1 animate-in fade-in-50">
            {extractedData && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Left Side: Form */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold flex items-center">
                      <Edit2 className="mr-2 h-5 w-5 text-primary" /> Review Extracted Data
                    </h2>
                  </div>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Basic Details</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 col-span-2 md:col-span-1">
                        <Label>Invoice Type</Label>
                        <select 
                          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={extractedData.invoice_type || 'purchase'} 
                          onChange={e => handleInputChange('invoice_type', e.target.value)}
                        >
                          <option value="purchase">Purchase (Receipt)</option>
                          <option value="sales">Sales (Issued to Customer)</option>
                        </select>
                      </div>
                      <div className="space-y-2 col-span-2 md:col-span-1">
                        <Label>Invoice Number</Label>
                        <Input value={extractedData.invoice_number || ''} onChange={e => handleInputChange('invoice_number', e.target.value)} />
                      </div>
                      <div className="space-y-2 col-span-2 md:col-span-1">
                        <Label>Date</Label>
                        <Input type="date" value={extractedData.date || ''} onChange={e => handleInputChange('date', e.target.value)} />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label>Vendor Name</Label>
                        <Input value={extractedData.vendor_name || ''} onChange={e => handleInputChange('vendor_name', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Vendor GSTIN</Label>
                        <Input value={extractedData.vendor_gstin || ''} onChange={e => handleInputChange('vendor_gstin', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Customer Name</Label>
                        <Input value={extractedData.customer_name || ''} onChange={e => handleInputChange('customer_name', e.target.value)} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                      <CardTitle className="text-base">Line Items</CardTitle>
                      <Button variant="outline" size="sm" onClick={addItem}>
                        <Plus className="mr-1 h-3 w-3" /> Add
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {extractedData.items?.map((item, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 items-center p-3 border rounded-lg bg-muted/20 relative">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border shadow-sm text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          <div className="col-span-12 md:col-span-5 space-y-1">
                            <Label className="text-xs">Description</Label>
                            <Input size={1} className="h-8 text-sm" value={item.description || ''} onChange={e => handleItemChange(index, 'description', e.target.value)} />
                          </div>
                          <div className="col-span-4 md:col-span-2 space-y-1">
                            <Label className="text-xs">HSN</Label>
                            <Input size={1} className="h-8 text-sm" value={item.hsn || ''} onChange={e => handleItemChange(index, 'hsn', e.target.value)} />
                          </div>
                          <div className="col-span-4 md:col-span-1 space-y-1">
                            <Label className="text-xs">Qty</Label>
                            <Input size={1} type="number" className="h-8 text-sm px-1 text-center" value={item.quantity || ''} onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))} />
                          </div>
                          <div className="col-span-4 md:col-span-2 space-y-1">
                            <Label className="text-xs">Rate</Label>
                            <Input size={1} type="number" className="h-8 text-sm px-1 text-right" value={item.rate || ''} onChange={e => handleItemChange(index, 'rate', Number(e.target.value))} />
                          </div>
                          <div className="col-span-12 md:col-span-2 space-y-1">
                            <Label className="text-xs">Amount</Label>
                            <Input size={1} type="number" className="h-8 text-sm px-1 text-right font-semibold" value={item.amount || ''} onChange={e => handleItemChange(index, 'amount', Number(e.target.value))} />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Tax & Totals</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Total CGST</Label>
                        <Input type="number" value={extractedData.total_cgst || 0} onChange={e => handleInputChange('total_cgst', Number(e.target.value))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Total SGST</Label>
                        <Input type="number" value={extractedData.total_sgst || 0} onChange={e => handleInputChange('total_sgst', Number(e.target.value))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Total IGST</Label>
                        <Input type="number" value={extractedData.total_igst || 0} onChange={e => handleInputChange('total_igst', Number(e.target.value))} />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-bold text-primary">Total Amount</Label>
                        <Input type="number" className="font-bold text-lg" value={extractedData.total_amount || 0} onChange={e => handleInputChange('total_amount', Number(e.target.value))} />
                      </div>
                    </CardContent>
                  </Card>
                  
                  <div className="pb-10 md:hidden">
                    <Button size="lg" className="w-full" onClick={saveInvoice} disabled={isSaving}>
                      <Save className="mr-2 h-4 w-4" /> Save to DB
                    </Button>
                  </div>
                </div>

                {/* Right Side: Image Reference */}
                <div className="lg:col-span-5 sticky top-24 hidden lg:block">
                   <div className="bg-black/5 dark:bg-white/5 rounded-xl border p-2 h-[80vh] overflow-auto flex items-start justify-center">
                    {imagePreview && (
                      imagePreview.startsWith("data:application/pdf") ? <iframe src={imagePreview} className="w-full min-h-[70vh] rounded" title="PDF Reference" /> : <img src={imagePreview} alt="Invoice Reference" className="max-w-full h-auto rounded" />
                    )}
                  </div>
                </div>

              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
