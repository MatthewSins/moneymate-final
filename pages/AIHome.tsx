import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';


import { 
  Camera, 
  FileText, 
  TrendingDown, 
  BarChart3, 
  MessageSquare,
  Sparkles,
  FileSpreadsheet,
  Crown,
  Check
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';

const personalActions = [
  {
    title: 'AI Budget Calculator',
    icon: Sparkles,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    hoverGradient: 'from-blue-500/20',
    path: '/budget-calculator',
  },
  {
    title: 'Dashboard',
    icon: BarChart3,
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
    hoverGradient: 'from-violet-500/20',
    path: '/dashboard',
  },
  {
    title: 'Track Expense',
    icon: TrendingDown,
    color: 'text-rose-500',
    bgColor: 'bg-rose-500/10',
    hoverGradient: 'from-rose-500/20',
    path: '/tracker',
  },
  {
    title: 'Reports',
    icon: FileSpreadsheet,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    hoverGradient: 'from-cyan-500/20',
    path: '/reports',
  },
  {
    title: 'AI Assistant',
    icon: MessageSquare,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    path: '/coach',
  },
  {
    title: 'Feedback',
    icon: MessageSquare,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    hoverGradient: 'from-yellow-500/20',
    path: '/feedback',
  }
];

const businessActions = [
  {
    title: 'AI Budget Calculator',
    icon: Sparkles,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    hoverGradient: 'from-blue-500/20',
    path: '/budget-calculator',
  },
  {
    title: 'Dashboard',
    icon: BarChart3,
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
    hoverGradient: 'from-violet-500/20',
    path: '/dashboard',
  },
  {
    title: 'Create Sales Invoice',
    icon: FileText,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    hoverGradient: 'from-emerald-500/20',
    path: '/invoice',
  },
  {
    title: 'Scan Invoice',
    icon: Camera,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    hoverGradient: 'from-blue-500/20',
    path: '/scanner',
  },
  {
    title: 'GST Filing',
    icon: FileSpreadsheet,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    hoverGradient: 'from-orange-500/20',
    path: '/gst-filing',
  },
  {
    title: 'Reports',
    icon: FileSpreadsheet,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    hoverGradient: 'from-cyan-500/20',
    path: '/reports',
  },
  {
    title: 'AI Assistant',
    icon: MessageSquare,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    path: '/coach',
  },
  {
    title: 'Feedback',
    icon: MessageSquare,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    hoverGradient: 'from-yellow-500/20',
    path: '/feedback',
  }
];



export default function AIHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profileType, setProfileType] = useState<'personal' | 'business'>('personal');
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(() => !sessionStorage.getItem('hasSeenWelcome'));
  
  useEffect(() => {
    if (showWelcome) {
      const timer = setTimeout(() => {
        setShowWelcome(false);
        sessionStorage.setItem('hasSeenWelcome', 'true');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showWelcome]);


  useEffect(() => {
    async function getProfile() {
      if (user) {
        const { data } = await supabase.from('profiles').select('profile_type').eq('id', user.id).single();
        if (data && data.profile_type) {
          setProfileType(data.profile_type);
        }
      }
      setLoading(false);
    }
    getProfile();
  }, [user]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const actions = profileType === 'business' ? businessActions : personalActions;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 1 } }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background text-foreground"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="text-center space-y-6 max-w-2xl px-6"
            >
              <div className="mx-auto h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(var(--primary),0.3)]">
                <Sparkles className="h-10 w-10 text-primary animate-pulse" />
              </div>
              <motion.h1 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1, duration: 0.8 }}
                className="text-4xl md:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b dark:from-white dark:to-white/60 from-slate-900 to-slate-900/60"
              >
                Welcome {user?.email?.split('@')[0] || 'User'}
              </motion.h1>
              <motion.p 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 2, duration: 0.8 }}
                className="text-xl md:text-2xl text-muted-foreground font-light"
              >
                Hi, I'm <span className="text-primary font-medium">MoneyMate AI</span>, your personal CA AI assistant for all your financial needs.
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="min-h-screen bg-background relative overflow-hidden flex flex-col text-foreground transition-colors duration-500">
      <div className="absolute inset-0 overflow-hidden -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br dark:from-zinc-900 dark:via-black dark:to-zinc-900 from-slate-50 via-white to-slate-50" />
        <div className="absolute inset-0 opacity-[0.15] mix-blend-overlay dark:opacity-[0.15] dark:mix-blend-overlay mix-blend-normal" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')" }}></div>
        <div className="absolute -top-[25%] -left-[10%] w-[70%] h-[70%] rounded-full dark:bg-slate-400/10 bg-primary/5 blur-[120px] dark:mix-blend-screen" />
        <div className="absolute top-[40%] -right-[20%] w-[60%] h-[80%] rounded-full dark:bg-zinc-600/10 bg-blue-500/5 blur-[150px] dark:mix-blend-screen" />
      </div>

      <header className="flex items-center justify-between p-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl tracking-tight">MoneyMate AI</span>
          
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded-full uppercase font-semibold ml-2",
              profileType === 'business' ? "bg-orange-500/10 text-orange-600" : "bg-primary/10 text-primary"
            )}>
              {profileType}
            </span>
          
        </div>
        
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 gap-1.5 border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20")}>
              <Crown className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Premium</span>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0 border-amber-200 dark:border-amber-500/30 shadow-lg">
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 p-4 pb-0 rounded-t-lg border-b border-amber-100 dark:border-amber-500/20">
                <div className="flex items-center gap-2 mb-2 pb-2">
                  <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                    <Crown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-amber-900 dark:text-amber-200">MoneyMate Premium</h4>
                    <p className="text-xs text-amber-700/80 dark:text-amber-400/80">Unlock your financial potential</p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-background rounded-b-lg">
                <ul className="space-y-2.5">
                  {[
                    "Unlimited Bulk Invoice Scans",
                    "Advanced AI Financial Insights",
                    "Custom Tax Reporting",
                    "Priority 24/7 Support",
                    "Early Access to New Features"
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full mt-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-md">
                  Upgrade Now
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "rounded-full h-10 w-10 border shadow-sm")}>
              <Avatar className="h-10 w-10">
                <AvatarImage src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user?.email || 'User'}`} alt="Avatar" />
                <AvatarFallback>{user?.user_metadata?.full_name?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.user_metadata?.full_name || 'User'}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email || 'user@example.com'}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                Dashboard
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:bg-red-50 focus:text-red-600 dark:focus:bg-red-950">
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pb-20">
        <div className="w-full max-w-4xl flex flex-col items-center text-center space-y-12">
          
          <div 
            className="space-y-4"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary mb-2 text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              <span>AI Assistant Ready</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight">
              Hi, I'm <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">MoneyMate AI.</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground font-medium">
              What would you like to do today?
            </p>
          </div>

          <div 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 w-full"
          >
            {actions.map((action, index) => (
              <div key={index}>
                <Card 
                  className="group relative overflow-hidden dark:border-white/10 dark:bg-black/40 border-slate-200 bg-white/60 backdrop-blur-xl hover:border-primary/50 hover:shadow-2xl transition-all duration-500 cursor-pointer h-full hover:-translate-y-1"
                  onClick={() => navigate(action.path)}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${action.hoverGradient} via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <div className="absolute inset-0 bg-gradient-to-br dark:from-white/5 from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <CardContent className="p-6 md:p-8 flex flex-col items-center justify-center text-center space-y-4 h-full relative z-10">
                    <div className={`p-4 rounded-2xl ${action.bgColor} group-hover:scale-110 transition-transform duration-300`}>
                      <action.icon className={`h-8 w-8 ${action.color}`} />
                    </div>
                    <span className="font-semibold text-base md:text-lg tracking-tight">
                      {action.title}
                    </span>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
          
        </div>
      </main>
      
      <footer className="py-6 text-center text-muted-foreground text-sm z-10 relative">
        <p>Made with ❤️ by X</p>
      </footer>
    </div>
    </>
  );
}