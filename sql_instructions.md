# Database Update Required

To fix the check constraint error and create the feedback table, copy **ONLY the SQL code below** (inside the code block) and run it in your **Supabase SQL Editor**. Do not copy the markdown text.

```sql
-- 1. Fix transactions check constraint
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('income', 'expense', 'budget'));

-- Force schema cache reload for PostgREST API
NOTIFY pgrst, 'reload schema';


-- 2. Add Feedback Table
CREATE TABLE IF NOT EXISTS feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  content TEXT NOT NULL,
  rating INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE feedback TO authenticated, anon, service_role;

DROP POLICY IF EXISTS "Users can insert their own feedback" ON feedback;
DROP POLICY IF EXISTS "Users can view their own feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON feedback;

CREATE POLICY "Users can insert their own feedback" ON feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own feedback" ON feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all feedback" ON feedback FOR SELECT USING (
  auth.jwt()->>'email' = 'matthewdebbarman@gmail.com'
);
```
