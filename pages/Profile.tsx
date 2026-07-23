import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, LogOut, User as UserIcon, ArrowLeft } from 'lucide-react';

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [fullName, setFullName] = useState('');
  const [profileType, setProfileType] = useState<'personal' | 'business'>('personal');
  const [businessName, setBusinessName] = useState('');
  const [gstin, setGstin] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [currency, setCurrency] = useState('INR');
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (user?.user_metadata?.full_name) {
      setFullName(user.user_metadata.full_name);
    }
    
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();
        
      if (data) {
        setProfileType(data.profile_type || 'personal');
        setBusinessName(data.business_name || '');
        setGstin(data.gstin || '');
        setPhone(data.phone || '');
        setAddress(data.address || '');
        setCurrency(data.currency || 'INR');
        if (data.currency) localStorage.setItem('preferred_currency', data.currency);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Update auth metadata
    const { error: authError } = await supabase.auth.updateUser({
      data: { full_name: fullName }
    });

    if (authError) {
      toast.error(authError.message);
      setLoading(false);
      return;
    }

    // Upsert profile data
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user?.id,
        profile_type: profileType,
        business_name: businessName,
        gstin: gstin,
        phone: phone,
        address: address,
        currency: currency,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (profileError) {
      toast.error(profileError.message);
    } else {
      toast.success('Profile updated successfully');
      localStorage.setItem('preferred_currency', currency);
    }
    
    setLoading(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="sticky top-0 z-30 flex h-16 items-center border-b bg-background/95 px-4 md:px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-lg">My Profile</h1>
          </div>
        </div>
      </header>
      
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-2 pb-6">
            <div className="flex items-center space-x-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <UserIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">Profile Settings</CardTitle>
                <CardDescription>
                  Manage your account and business settings
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          {initialLoading ? (
             <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
          ) : (
            <form onSubmit={handleUpdateProfile} className="flex flex-col gap-6">
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={user.email || ''} 
                    disabled 
                    className="h-11 bg-muted/50"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
                  <Input 
                    id="fullName" 
                    type="text" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="h-11"
                    placeholder="Enter your full name"
                  />
                </div>
                
                <div className="space-y-3 pt-2">
                  <Label className="text-sm font-medium">Account Type</Label>
                  <RadioGroup 
                    value={profileType} 
                    onValueChange={(val: 'personal' | 'business') => setProfileType(val)}
                    className="flex items-center space-x-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="personal" id="personal" />
                      <Label htmlFor="personal" className="cursor-pointer">Personal</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="business" id="business" />
                      <Label htmlFor="business" className="cursor-pointer">Business</Label>
                    </div>
                  </RadioGroup>
                </div>

                                {profileType === 'personal' && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-3">
                      <Label htmlFor="currency">Preferred Currency</Label>
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INR">INR (₹)</SelectItem>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="EUR">EUR (€)</SelectItem>
                          <SelectItem value="GBP">GBP (£)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {profileType === 'business' && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-3">
                      <Label htmlFor="businessName">Business Name</Label>
                      <Input 
                        id="businessName" 
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="Your Company Ltd"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="gstin">GSTIN</Label>
                      <Input 
                        id="gstin" 
                        value={gstin}
                        onChange={(e) => setGstin(e.target.value)}
                        placeholder="29ABCDE1234F1Z5"
                        className="h-11 uppercase"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="phone">Business Phone</Label>
                      <Input 
                        id="phone" 
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 9876543210"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="address">Business Address</Label>
                      <Input 
                        id="address" 
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="123 Business Street, City"
                        className="h-11"
                      />
                    </div>
                  </div>
                )}
                
              </CardContent>
              <CardFooter className="flex flex-col space-y-4 pt-2 pb-8 px-6">
                <Button type="submit" className="w-full h-11 text-base font-medium" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save changes
                </Button>
                <Button variant="outline" type="button" className="w-full" onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4 text-red-500" />
                  <span className="text-red-500">Sign out</span>
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>
      </main>
    </div>
  );
}
