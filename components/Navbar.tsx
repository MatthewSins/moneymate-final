import { Link } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from './ui/button';

export function Navbar() {
  const { user, signOut } = useAuth();

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex gap-6 md:gap-10">
          <Link to="/" className="flex items-center space-x-2">
            <span className="inline-block font-bold">MoneyMate AI</span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-2">
            {user ? (
              <>
                <Link to="/profile">
                  <Button variant="ghost">Profile</Button>
                </Link>
                <Button variant="outline" onClick={() => signOut()}>
                  Log out
                </Button>
              </>
            ) : (
              <Link to="/login">
                <Button>Sign In</Button>
              </Link>
            )}
            <ThemeToggle />
          </nav>
        </div>
      </div>
    </nav>
  );
}
