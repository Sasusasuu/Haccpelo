CREATE TABLE public.custom_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#888888',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own roles"
ON public.custom_roles
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);