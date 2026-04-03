
CREATE TABLE public.cleaning_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  zone TEXT NOT NULL,
  task_name TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'quotidien' CHECK (frequency IN ('quotidien', 'hebdomadaire', 'mensuel')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.cleaning_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  task_id UUID NOT NULL REFERENCES public.cleaning_tasks(id) ON DELETE CASCADE,
  done_date DATE NOT NULL DEFAULT CURRENT_DATE,
  done_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cleaning_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaning_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cleaning tasks"
ON public.cleaning_tasks FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own cleaning logs"
ON public.cleaning_logs FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_cleaning_tasks_updated_at
BEFORE UPDATE ON public.cleaning_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
