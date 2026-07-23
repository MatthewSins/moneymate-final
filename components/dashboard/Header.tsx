import React from 'react';
import { Bell, Menu, Search, User } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/ThemeToggle';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';

export function Header({ onSearchClick }: { onSearchClick: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 px-4 md:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SheetTrigger className={cn(buttonVariants({ variant: "outline", size: "icon" }), "shrink-0 md:hidden")}>
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-72">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <Sidebar onClose={() => setIsSidebarOpen(false)} />
        </SheetContent>
      </Sheet>
      
      <div className="w-full flex-1 flex items-center gap-4 md:gap-6">
        <form className="hidden md:flex flex-1 sm:max-w-md lg:max-w-lg" onSubmit={(e) => { e.preventDefault(); onSearchClick(); }}>
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search or jump to... (Press ⌘K)"
              className="w-full bg-muted/50 pl-9 md:w-[300px] lg:w-[400px] rounded-full border-muted-foreground/20 focus-visible:ring-primary/50"
              onClick={onSearchClick}
              readOnly
            />
          </div>
        </form>
        <Button variant="outline" className="md:hidden w-full justify-start text-muted-foreground bg-muted/50 rounded-full" onClick={onSearchClick}>
          <Search className="mr-2 h-4 w-4" />
          Search...
        </Button>
      </div>
      
      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Toggle notifications</span>
        </Button>
        
        <ThemeToggle />
        
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "rounded-full h-8 w-8 ml-1")}>
            <Avatar className="h-8 w-8 border">
              <AvatarImage src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user?.email || 'User'}`} alt="Avatar" />
              <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
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
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:bg-red-50 focus:text-red-600 dark:focus:bg-red-950">
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
