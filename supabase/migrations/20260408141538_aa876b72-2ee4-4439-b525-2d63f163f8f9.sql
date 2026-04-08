CREATE TABLE public.memos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.memos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own memos"
ON public.memos
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);