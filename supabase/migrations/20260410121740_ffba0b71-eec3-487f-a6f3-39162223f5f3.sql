ALTER TABLE public.settings
ADD COLUMN subscription_status text NOT NULL DEFAULT 'starter';
