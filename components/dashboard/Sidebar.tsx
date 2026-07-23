import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  LayoutDashboard, 
  TrendingDown,
  FileText,
  Camera,
  MessageSquare,
  Lightbulb,
  FileSpreadsheet,
  Home,
  Sparkles
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const personalSidebarItems = [
  { name: 'AI Home', icon: Home, path: '/ai-home' },
  { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { name: 'Track Expense', icon: TrendingDown, path: '/dashboard/tracker' },
  { name: 'Reports', icon: FileSpreadsheet, path: '/dashboard/reports' },
  { name: 'AI Assistant', icon: MessageSquare, path: '/coach' },
  { name: 'Feedback', icon: MessageSquare, path: '/feedback' },
];

const businessSidebarItems = [
  { name: 'AI Home', icon: Home, path: '/ai-home' },
  { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { name: 'Create Sales Invoice', icon: FileText, path: '/generate' },
  { name: 'Scan Invoice', icon: Camera, path: '/scan' },
  { name: 'GST Filing', icon: FileSpreadsheet, path: '/gst-filing' },
  { name: 'Reports', icon: FileSpreadsheet, path: '/dashboard/reports' },
  { name: 'AI Assistant', icon: MessageSquare, path: '/coach' },
  { name: 'Feedback', icon: MessageSquare, path: '/feedback' },
];

export function Sidebar({ className, onClose }: { className?: string, onClose?: () => void }) {
  const location = useLocation();
  const { user } = useAuth();
  const [profileType, setProfileType] = useState<'personal' | 'business'>('personal');

  useEffect(() => {
    async function getProfile() {
      if (user) {
        const { data } = await supabase.from('profiles').select('profile_type').eq('id', user.id).single();
        if (data && data.profile_type) {
          setProfileType(data.profile_type);
        }
      }
    }
    getProfile();
  }, [user]);

  const sidebarItems = profileType === 'business' ? businessSidebarItems : personalSidebarItems;

  
  const [currency, setCurrency] = useState(() => localStorage.getItem('preferred_currency') || 'INR');
  
  const toggleCurrency = () => {
    const newCurr = currency === 'INR' ? 'USD' : 'INR';
    setCurrency(newCurr);
    localStorage.setItem('preferred_currency', newCurr);
    window.dispatchEvent(new Event('currencyChange'));
    window.location.reload(); // Quick way to update everything
  };

  return (
    <div className={cn("pb-12 h-full flex flex-col border-r bg-card", className)}>

      <div className="space-y-4 py-4 h-full flex flex-col">
        <div className="px-6 py-2">
          <Link to="/ai-home" onClick={onClose} className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span>MoneyMate AI</span>
          </Link>
        </div>
        
        <ScrollArea className="flex-1 px-3">
          <div className="space-y-1 p-2">
            {sidebarItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                onClick={onClose}
                className={cn(
                  buttonVariants({ variant: location.pathname === item.path ? "secondary" : "ghost" }),
                  "w-full justify-start font-medium",
                  location.pathname === item.path ? "bg-secondary" : "hover:bg-muted"
                )}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
