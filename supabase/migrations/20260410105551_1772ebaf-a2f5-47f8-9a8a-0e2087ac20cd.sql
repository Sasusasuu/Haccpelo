ALTER TABLE public.settings
  ADD COLUMN cgu_accepted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN cgv_accepted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN privacy_policy_accepted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN legal_documents_version TEXT DEFAULT 'v1.0';