
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS delivery_message TEXT,
  ADD COLUMN IF NOT EXISTS delivery_url TEXT,
  ADD COLUMN IF NOT EXISTS delivery_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revision_notes TEXT;

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
