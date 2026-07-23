import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CommandDialog, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList,
  CommandSeparator,
  CommandShortcut
} from '@/components/ui/command';
import { 
  TrendingDown,
  FileText,
  Camera,
  MessageSquare,
  Lightbulb,
  FileSpreadsheet,
  Home,
  User,
  LayoutDashboard
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export function CommandPalette({ open, setOpen }: { open: boolean, setOpen: (open: boolean) => void }) {
  const navigate = useNavigate();
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

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setOpen]);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => navigate('/home'))}>
            <Home className="mr-2 h-4 w-4" />
            <span>Home</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/dashboard'))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
            <CommandShortcut>⌘D</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        
        <CommandGroup heading="Tools">
          {profileType === 'personal' && (
            <CommandItem onSelect={() => runCommand(() => navigate('/tracker'))}>
              <TrendingDown className="mr-2 h-4 w-4" />
              <span>Track Expense</span>
              <CommandShortcut>⌘E</CommandShortcut>
            </CommandItem>
          )}

          {profileType === 'business' && (
            <>
              <CommandItem onSelect={() => runCommand(() => navigate('/invoice'))}>
                <FileText className="mr-2 h-4 w-4" />
                <span>Create Sales Invoice</span>
                <CommandShortcut>⌘I</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => navigate('/scanner'))}>
                <Camera className="mr-2 h-4 w-4" />
                <span>Scan Invoice</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => navigate('/gst-filing'))}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                <span>GST Filing</span>
              </CommandItem>
            </>
          )}

          <CommandItem onSelect={() => runCommand(() => navigate('/reports'))}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            <span>Reports</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />

        <CommandGroup heading="AI Features">
          <CommandItem onSelect={() => runCommand(() => navigate('/coach'))}>
            <MessageSquare className="mr-2 h-4 w-4" />
            <span>AI Assistant</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        
        <CommandGroup heading="Settings">
          <CommandItem onSelect={() => runCommand(() => navigate('/profile'))}>
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
            <CommandShortcut>⌘P</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        
      </CommandList>
    </CommandDialog>
  );
}
