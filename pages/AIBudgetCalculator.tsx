import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function AIBudgetCalculator() {
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [budgetLevel, setBudgetLevel] = useState('Medium/Standard');
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-background shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg hidden sm:inline-block">AI Budget Calculator</span>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              AI Budget Calculator
            </CardTitle>
            <CardDescription>Plan your trips or projects with AI analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>What are you planning?</Label>
                <Input id="ai-budget-prompt" placeholder="e.g. 3-day trip to Paris for 2 people" />
              </div>
              <div className="space-y-2">
                <Label>Budget Level</Label>
                <Select value={budgetLevel} onValueChange={setBudgetLevel}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select budget level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low/Backpacker">Low / Backpacker</SelectItem>
                    <SelectItem value="Medium/Standard">Medium / Standard</SelectItem>
                    <SelectItem value="High/Luxury">High / Luxury</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button 
              onClick={async () => {
                const prompt = (document.getElementById('ai-budget-prompt') as HTMLInputElement).value;
                if (!prompt) return;
                setIsGeneratingAnalysis(true);
                try {
                  let currency = localStorage.getItem('preferred_currency') || 'USD';
                  let location = '';

                  if (user) {
                    const { data } = await supabase
                      .from('profiles')
                      .select('currency, address')
                      .eq('id', user.id)
                      .single();
                    if (data) {
                      if (data.currency) currency = data.currency;
                      if (data.address) location = data.address;
                    }
                  }

                  const locationContext = location ? `The user is searching from: ${location}.` : '';
                  const content = `Create a detailed budget breakdown for: ${prompt}. ${locationContext} The requested budget level is: ${budgetLevel}. The currency should be in ${currency}. Provide a comprehensive itemized budget tailored to this level, making sure you output the complete itinerary and full details without cutting off (e.g., if it's a 7-day trip, include details for all days including day 5-7). Most importantly, detail what facilities can be accessed, what accommodation or travel class to expect, and what activities/experiences can be explored with this specific budget in full detail.`;
                  const res = await fetch('/api/budget-calculator', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: [{ role: 'user', content }] })
                  });
                  const data = await res.json();
                  setAiAnalysis({ summary: data.response });
                } catch (e) {
                  toast.error('Failed to generate budget');
                } finally {
                  setIsGeneratingAnalysis(false);
                }
              }}
              disabled={isGeneratingAnalysis}
            >
              {isGeneratingAnalysis ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Calculate Budget"}
            </Button>
              
            {aiAnalysis?.summary && (
              <div className="mt-6 p-6 bg-card rounded-xl border shadow-sm">
                <div className="prose prose-sm md:prose-base dark:prose-invert prose-blue max-w-none prose-headings:font-semibold prose-a:text-primary">
                  <Markdown remarkPlugins={[remarkGfm]}>{aiAnalysis.summary}</Markdown>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
