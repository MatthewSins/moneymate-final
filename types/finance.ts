export type TransactionType = 'expense' | 'income' | 'budget';

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: TransactionType;
  category: string;
  description: string;
  date: string;
  created_at?: string;
  receipt_url?: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: TransactionType;
  color: string;
  icon?: string;
}
