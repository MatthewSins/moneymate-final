import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageCaptcha } from '@/components/ImageCaptcha';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaValid, setCaptchaValid] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaValid) {
      toast.error('Please complete the security check.');
      return;
    }
    setLoading(true);
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      }
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Check your email for the confirmation link');
      navigate('/login');
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2 pb-6">
          <CardTitle className="text-2xl font-bold tracking-tight">Create an account</CardTitle>
          <CardDescription className="text-base">
            Enter your details to create a new account
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
              <Input 
                id="fullName" 
                type="text" 
                placeholder="John Doe" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="h-11"
              />
            </div>
            
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
            
            <div className="space-y-3">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <PasswordInput 
                id="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-11"
                placeholder="Create a secure password"
              />
            </div>
            
            <div className="pt-2">
              <ImageCaptcha onVerify={setCaptchaValid} />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pb-8 px-6">
            <Button type="submit" className="w-full h-11 text-base font-medium" disabled={loading || !captchaValid}>
              {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              Create account
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
      
      <footer className="mt-8 text-center text-muted-foreground text-sm relative z-10">
        <p>Made with ❤️ by X</p>
      </footer>
    </div>
  );
}
