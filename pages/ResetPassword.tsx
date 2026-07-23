import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have a session (user clicked link in email)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // If there's a hash in the URL, Supabase might be processing it, but generally
        // if this page loads and there's no session or hash, they shouldn't be here.
        if (!window.location.hash.includes('access_token')) {
          navigate('/login');
        }
      }
    });
  }, [navigate]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password updated successfully');
      navigate('/home');
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2 pb-6">
          <CardTitle className="text-2xl font-bold tracking-tight">Update password</CardTitle>
          <CardDescription className="text-base">
            Enter your new password below.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleReset} className="flex flex-col gap-4">
          <CardContent className="space-y-6 pt-4">
            <div className="space-y-3">
              <Label htmlFor="password" className="text-sm font-medium">New Password</Label>
              <PasswordInput 
                id="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-11"
                placeholder="Create a secure new password"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pb-8 px-6">
            <Button type="submit" className="w-full h-11 text-base font-medium" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update password
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
