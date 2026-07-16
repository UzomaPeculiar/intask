CREATE TABLE public.student_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.student_projects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_projects TO authenticated;
GRANT ALL ON public.student_projects TO service_role;
ALTER TABLE public.student_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Projects are viewable by everyone" ON public.student_projects FOR SELECT USING (true);
CREATE POLICY "Users can insert own projects" ON public.student_projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.student_projects FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.student_projects FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX student_projects_user_id_idx ON public.student_projects(user_id);