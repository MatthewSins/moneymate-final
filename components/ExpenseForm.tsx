import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Loader2, Plus, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const transactionSchema = z.object({
  type: z.enum(['expense', 'income']),
  date: z.date(),
  items: z.array(z.object({
    amount: z.number().positive('Amount must be positive'),
    category: z.string().min(1, 'Category is required'),
    description: z.string().min(1, 'Description is required')
  })).min(1, 'At least one item is required')
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

const expenseCategories = ['Food', 'Transport', 'Utilities', 'Entertainment', 'Shopping', 'Health', 'Other', 'Office Supplies', 'Marketing', 'Software', 'Professional Services'];
const incomeCategories = ['Salary', 'Freelance', 'Investments', 'Gift', 'Other', 'Revenue'];

interface ExpenseFormProps {
  onSubmit: (data: any) => Promise<void>;
  isSubmitting: boolean;
  profileType: 'personal' | 'business';
}

export function ExpenseForm({ onSubmit, isSubmitting, profileType }: ExpenseFormProps) {
  const [categorizingIndex, setCategorizingIndex] = useState<number | null>(null);

  const { register, control, handleSubmit, formState: { errors }, setValue, watch, getValues } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema) as any,
    defaultValues: {
      type: 'expense',
      date: new Date(),
      items: [{ amount: undefined as any, category: '', description: '' }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  const transactionType = watch('type');
  const transactionDate = watch('date');
  const currentCategories = transactionType === 'expense' ? expenseCategories : incomeCategories;

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
          revenue: 500000 // default or fetch from context
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.result && data.result.category) {
          // find closest match in our categories or just set to 'Other'
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-3">
        <Label>Transaction Type</Label>
        <RadioGroup 
          defaultValue="expense" 
          onValueChange={(val) => setValue('type', val as 'expense' | 'income')}
          className="flex items-center space-x-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="expense" id="expense" />
            <Label htmlFor="expense" className="cursor-pointer">Expense</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="income" id="income" />
            <Label htmlFor="income" className="cursor-pointer">Income</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-4">
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

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Items</Label>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={() => append({ amount: undefined as any, category: '', description: '' })}
            >
              <Plus className="mr-2 h-4 w-4" /> Add Item
            </Button>
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
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
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

              <div className="space-y-2 md:col-span-2 relative">
                <Label>Description (Auto-categorizes on blur)</Label>
                <div className="relative">
                  <Input 
                    placeholder="e.g. Groceries at Walmart" 
                    {...register(`items.${index}.description`)} 
                    onBlur={(e) => handleDescriptionBlur(index, e)}
                  />
                  {categorizingIndex === index && (
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
        Save Transaction
      </Button>
    </form>
  );
}
