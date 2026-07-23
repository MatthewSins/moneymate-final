export interface Invoice {
  invoice_type: 'sales' | 'purchase';
  invoice_number: string;
  date: string;
  vendor_name: string;
  customer_name: string;
  vendor_gstin: string;
  customer_gstin: string;
  items: Array<{
    description: string;
    hsn: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
  total_amount: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  description: string;
  category: string;
  type: 'income' | 'expense';
  date: string;
  itcEligible?: boolean;
  gstRate?: string;
  invoiceId?: string;
}

export interface GST3B {
  gstin: string;
  fy: string;
  quarter: string;
  gst_liability: {
    sgst: number;
    cgst: number;
    igst: number;
    total_gst: number;
  };
  input_tax_credit: {
    sgst: number;
    cgst: number;
    igst: number;
    total_itc: number;
  };
  net_gst_payable: number;
}
