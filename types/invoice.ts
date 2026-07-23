export interface InvoiceItem {
  id: string;
  description: string;
  hsn: string;
  quantity: number;
  rate: number;
  discount: number;
  cgst: number;
  sgst: number;
  igst: number;
  amount: number;
}

export interface Invoice {
  id: string;
  user_id: string;
  invoice_number: string;
  date: string;
  due_date: string;
  
  // Company Details
  company_name: string;
  company_address: string;
  company_gstin: string;
  company_email: string;
  company_phone: string;
  company_logo?: string; 
  signature?: string; 

  // Customer Details
  customer_name: string;
  customer_address: string;
  customer_gstin: string;
  customer_email: string;
  customer_phone: string;

  // Items
  items: InvoiceItem[];

  // Totals
  subtotal: number;
  total_discount: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  shipping_charges: number;
  total_amount: number;
  
  notes: string;
  terms: string;
  
  // Payment
  upi_id: string;
  
  created_at?: string;
}
