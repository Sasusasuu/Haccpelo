
-- Table for traceability photo history
CREATE TABLE public.traceability_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  categorie TEXT NOT NULL DEFAULT 'Autre',
  photo_url TEXT NOT NULL,
  product_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.traceability_photos ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own traceability photos"
ON public.traceability_photos FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own traceability photos"
ON public.traceability_photos FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own traceability photos"
ON public.traceability_photos FOR DELETE
USING (auth.uid() = user_id);

-- Function to clean up photos older than 3 months
CREATE OR REPLACE FUNCTION public.cleanup_old_traceability_photos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.traceability_photos
  WHERE created_at < now() - interval '90 days';
END;
$$;

-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Schedule daily cleanup at 3:30 AM
SELECT cron.schedule(
  'cleanup-traceability-photos',
  '30 3 * * *',
  $$SELECT public.cleanup_old_traceability_photos();$$
);
