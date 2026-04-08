
-- Add category and employee_name columns
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS employee_name text;

-- Create index on category for filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON public.audit_logs (category);

-- Create index on created_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at);

-- Create cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < now() - interval '90 days';
END;
$$;

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule daily cleanup at 3 AM
SELECT cron.schedule(
  'cleanup-audit-logs-daily',
  '0 3 * * *',
  'SELECT public.cleanup_old_audit_logs()'
);
