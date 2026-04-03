
CREATE TABLE public.temperature_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  equipment_name TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('matin', 'soir')),
  temperature NUMERIC(5,2) NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.temperature_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own temperature logs"
ON public.temperature_logs
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_temperature_logs_updated_at
BEFORE UPDATE ON public.temperature_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
