import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, User, Bot, Loader2, Volume2, Mic, MicOff, Square } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function FinancialCoach() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi there! I am MoneyMate, your AI Financial Coach for Personal and Business. I can help you with personal finance, invoices, expenses, GST, reporting, and business insights. Ask me anything!' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userContext, setUserContext] = useState<any>({});
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);

  const handleSpeak = (text: string, index: number) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      if (speakingIndex === index) {
        setSpeakingIndex(null);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text.replace(/\*/g, ''));
      utterance.onend = () => setSpeakingIndex(null);
      utterance.onerror = () => setSpeakingIndex(null);
      setSpeakingIndex(index);
      window.speechSynthesis.speak(utterance);
    } else {
      toast.error('Text-to-speech is not supported in your browser.');
    }
  };

  const handleListen = () => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      
      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + (prev ? ' ' : '') + transcript);
      };
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        toast.error('Microphone error: ' + event.error);
        setIsListening(false);
      };
      recognition.onend = () => setIsListening(false);
      
      if (isListening) {
        recognition.stop();
        setIsListening(false);
      } else {
        try {
          recognition.start();
        } catch(e) {
          setIsListening(false);
        }
      }
    } else {
      toast.error('Speech recognition is not supported in your browser.');
    }
  };

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);


  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (user) {
      loadUserContext();
    }
  }, [user]);

  const loadUserContext = async () => {
    try {
      const { data: profile } = await supabase.from('profiles').select('profile_type').eq('id', user?.id).single();
      const currentProfileType = profile?.profile_type || 'personal';

      // Fetch recent transactions and invoices to provide context to the AI
      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user?.id)
        .eq('profile_type', currentProfileType)
        .order('date', { ascending: false })
        .limit(20);

      let invData: any[] = [];
      let purchaseData: any[] = [];
      
      if (currentProfileType === 'business') {
        const { data: idata } = await supabase
          .from('invoices')
          .select('*')
          .eq('user_id', user?.id)
          .order('date', { ascending: false })
          .limit(20);
        invData = idata || [];
        
        const { data: pdata } = await supabase
          .from('scanned_purchases')
          .select('*')
          .eq('user_id', user?.id)
          .order('date', { ascending: false })
          .limit(20);
        purchaseData = pdata || [];
      }
      
      setUserContext({
        recent_transactions: txData || [],
        recent_invoices: invData || [],
        recent_scanned_purchases: purchaseData || [],
        profile_type: currentProfileType
      });
    } catch (error) {
      console.error('Error loading context for coach:', error);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Format messages for the API (convert 'assistant' back to 'assistant' for OpenRouter/Gemini context handling in backend)
      const apiMessages = newMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch('/api/financial-coach', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          messages: apiMessages,
          context: userContext
        })
      });

      if (!response.ok) {
        let errorMsg = 'Failed to get response';
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch (e) {
          errorMsg = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }

      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error("Received an invalid response from the server (possibly an HTML error page).");
      }
      
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error: any) {
      console.error('Coach error:', error);
      toast.error(error.message || 'Error communicating with coach');
      setMessages(prev => [...prev, { role: 'assistant', content: "I'm sorry, I encountered an error connecting to the AI service. Please make sure the AI API keys are configured correctly." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-muted/20">
      <header className="bg-background border-b px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500/10 p-1.5 rounded-full">
              <Bot className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <h1 className="font-semibold text-lg leading-tight">MoneyMate: Your AI Financial Coach for Personal and Business</h1>
              <p className="text-xs text-muted-foreground">Expert in Finance & GST</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 w-full max-w-4xl mx-auto flex flex-col gap-6">
        <AnimatePresence initial={false}>
          {messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-4 max-w-[85%] ${message.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
            >
              <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card border text-emerald-500'
              }`}>
                {message.role === 'user' ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
              </div>
              <div className={`rounded-2xl px-5 py-4 ${
                message.role === 'user' 
                  ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                  : 'bg-card border rounded-tl-sm shadow-sm'
              }`}>
                {message.role === 'user' ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none text-foreground prose-p:leading-relaxed prose-pre:bg-muted prose-pre:text-muted-foreground">
                      <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="self-start text-muted-foreground hover:text-foreground h-8 px-2"
                      onClick={() => handleSpeak(message.content, index)}
                    >
                      {speakingIndex === index ? (
                        <><Square className="h-4 w-4 mr-2" /> Stop Reading</>
                      ) : (
                        <><Volume2 className="h-4 w-4 mr-2" /> Read Aloud</>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4 max-w-[85%]"
            >
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-card border text-emerald-500 flex items-center justify-center">
                <Bot className="h-5 w-5" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-card border shadow-sm px-5 py-4 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Coach is typing...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={endOfMessagesRef} />
      </main>

      <footer className="bg-background border-t p-4 pb-8 md:pb-4 sticky bottom-0">
        <div className="max-w-4xl mx-auto relative">
          <form onSubmit={handleSend} className="relative flex items-center">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your expenses, invoices, or GST..."
              className="pr-24 py-6 rounded-full shadow-sm bg-muted/50 focus-visible:bg-background border-muted-foreground/20"
              disabled={isLoading}
            />
            <div className="absolute right-2 flex items-center gap-1">
              <Button 
                type="button" 
                size="icon" 
                variant={isListening ? "destructive" : "ghost"} 
                className="h-9 w-9 rounded-full hover:bg-muted"
                onClick={handleListen}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button
                type="submit"
                size="icon"
                className="h-9 w-9 rounded-full"
                disabled={(!input.trim() && !isListening) || isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </form>
          <div className="text-center mt-2">
            <p className="text-xs text-muted-foreground">AI can make mistakes. Verify important financial information.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
