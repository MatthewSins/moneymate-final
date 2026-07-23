import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star, MessageSquare, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function Feedback() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [rating, setRating] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);

  useEffect(() => {
    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
    if (user && user.email === adminEmail) {
      setIsAdmin(true);
      fetchFeedbacks();
    }
  }, [user]);

  const fetchFeedbacks = async () => {
    const { data, error } = await supabase.from('feedback').select('*').order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load feedbacks. You may need to run the SQL in sql_instructions.md.');
      console.error(error);
    } else if (data) {
      setFeedbacks(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error('Please enter some feedback.');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.from('feedback').insert([{
      user_id: user?.id,
      user_email: user?.email,
      content,
      rating
    }]);

    setIsSubmitting(false);

    if (error) {
      console.error(error);
      toast.error('Failed to submit feedback. Ensure you ran the SQL script.');
    } else {
      toast.success('Thank you for your feedback!');
      setContent('');
      setRating(5);
      if (isAdmin) {
        fetchFeedbacks();
      }
    }
  };

  return (
    <div className="container py-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Feedback</h1>
          <p className="text-muted-foreground mt-2">We value your thoughts! Help us improve MoneyMate AI.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submit Feedback</CardTitle>
          <CardDescription>Tell us what you love or what we can do better.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Rating</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`h-8 w-8 ${star <= rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2 mb-4">
              <Label htmlFor="content">Your Comments</Label>
              <Textarea
                id="content"
                placeholder="What do you think about the app?"
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="pt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {isAdmin && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">Admin: All Feedback</h2>
          {feedbacks.length === 0 ? (
            <p className="text-muted-foreground">No feedback yet.</p>
          ) : (
            <div className="grid gap-4">
              {feedbacks.map((fb) => (
                <Card key={fb.id}>
                  <CardContent className="pt-6 flex gap-4">
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <MessageSquare className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex gap-1 mt-2">
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        <span className="text-sm font-medium">{fb.rating}</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-start">
                        <p className="font-semibold text-sm">{fb.user_email || 'Anonymous'}</p>
                        <span className="text-xs text-muted-foreground">
                          {new Date(fb.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm">{fb.content}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
