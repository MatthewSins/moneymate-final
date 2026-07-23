import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password reset link sent to your email');
      setSubmitted(true);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2 pb-6">
          <CardTitle className="text-2xl font-bold tracking-tight">Reset password</CardTitle>
          <CardDescription className="text-base">
            Enter your email address and we'll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        {!submitted ? (
          <form onSubmit={handleReset} className="flex flex-col gap-4">
            <CardContent className="space-y-6 pt-4">
              <div className="space-y-3">
                <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pb-8 px-6">
              <Button type="submit" className="w-full h-11 text-base font-medium" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send reset link
              </Button>
              <div className="text-center text-sm">
                Remember your password?{' '}
                <Link to="/login" className="font-medium text-primary hover:underline">
                  Login
                </Link>
              </div>
            </CardFooter>
          </form>
        ) : (
          <CardContent className="space-y-6 pt-4 pb-8 px-6">
            <div className="text-center text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
              If an account exists with {email}, you will receive a password reset link shortly.
            </div>
            <Button variant="outline" className="w-full h-11 text-base font-medium" onClick={() => setSubmitted(false)}>
              Try another email
            </Button>
            <div className="text-center text-sm">
              <Link to="/login" className="font-medium text-primary hover:underline">
                Back to login
              </Link>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
