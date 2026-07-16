
-- ===== ENUMS =====
CREATE TYPE public.user_role AS ENUM ('student','alumni','company','individual');
CREATE TYPE public.task_status AS ENUM ('open','matched','in_progress','in_review','completed','disputed','cancelled');
CREATE TYPE public.application_status AS ENUM ('pending','accepted','rejected','withdrawn');
CREATE TYPE public.transaction_status AS ENUM ('pending','in_escrow','released','refunded');
CREATE TYPE public.work_type AS ENUM ('remote','on_campus','either');
CREATE TYPE public.verification_method AS ENUM ('email','id_upload');

-- ===== updated_at helper =====
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ===== PROFILES (base) =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  role public.user_role NOT NULL DEFAULT 'student',
  avatar_url TEXT,
  bio TEXT,
  onboarded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by anyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== STUDENT PROFILES =====
CREATE TABLE public.student_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  university TEXT,
  department TEXT,
  year_of_study TEXT,
  university_email TEXT,
  skills TEXT[] NOT NULL DEFAULT '{}',
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_method public.verification_method,
  verification_doc_url TEXT,
  rating_average NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  tasks_completed INTEGER NOT NULL DEFAULT 0,
  portfolio JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.student_profiles TO authenticated;
GRANT SELECT ON public.student_profiles TO anon;
GRANT ALL ON public.student_profiles TO service_role;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student profiles readable" ON public.student_profiles FOR SELECT USING (true);
CREATE POLICY "students manage own" ON public.student_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER student_profiles_updated BEFORE UPDATE ON public.student_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== COMPANY PROFILES =====
CREATE TABLE public.company_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL DEFAULT '',
  industry TEXT,
  location TEXT,
  website TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.company_profiles TO authenticated;
GRANT SELECT ON public.company_profiles TO anon;
GRANT ALL ON public.company_profiles TO service_role;
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company profiles readable" ON public.company_profiles FOR SELECT USING (true);
CREATE POLICY "company manage own" ON public.company_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER company_profiles_updated BEFORE UPDATE ON public.company_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== TASKS =====
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  budget_negotiable BOOLEAN NOT NULL DEFAULT FALSE,
  deadline DATE,
  work_type public.work_type NOT NULL DEFAULT 'either',
  skills_needed TEXT[] NOT NULL DEFAULT '{}',
  status public.task_status NOT NULL DEFAULT 'open',
  matched_student_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  applicants_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tasks_status_idx ON public.tasks(status);
CREATE INDEX tasks_poster_idx ON public.tasks(poster_id);
CREATE INDEX tasks_category_idx ON public.tasks(category);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks readable by authenticated" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "posters insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = poster_id);
CREATE POLICY "posters update own tasks" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() = poster_id) WITH CHECK (auth.uid() = poster_id);
CREATE POLICY "posters delete own open tasks" ON public.tasks FOR DELETE TO authenticated USING (auth.uid() = poster_id AND status = 'open');
CREATE TRIGGER tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== APPLICATIONS =====
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL DEFAULT '',
  status public.application_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, student_id)
);
CREATE INDEX applications_task_idx ON public.applications(task_id);
CREATE INDEX applications_student_idx ON public.applications(student_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
-- Student sees their own; poster sees apps for tasks they own
CREATE POLICY "students see own apps" ON public.applications FOR SELECT TO authenticated
  USING (auth.uid() = student_id OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.poster_id = auth.uid()));
CREATE POLICY "students apply" ON public.applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "student or poster updates" ON public.applications FOR UPDATE TO authenticated
  USING (auth.uid() = student_id OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.poster_id = auth.uid()));
CREATE POLICY "students withdraw" ON public.applications FOR DELETE TO authenticated USING (auth.uid() = student_id);
CREATE TRIGGER applications_updated BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Maintain tasks.applicants_count
CREATE OR REPLACE FUNCTION public.bump_applicants_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.tasks SET applicants_count = applicants_count + 1 WHERE id = NEW.task_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.tasks SET applicants_count = GREATEST(0, applicants_count - 1) WHERE id = OLD.task_id;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER applications_count_ins AFTER INSERT ON public.applications FOR EACH ROW EXECUTE FUNCTION public.bump_applicants_count();
CREATE TRIGGER applications_count_del AFTER DELETE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.bump_applicants_count();

-- ===== TRANSACTIONS =====
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  poster_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  platform_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.transaction_status NOT NULL DEFAULT 'pending',
  paystack_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties read tx" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = poster_id OR auth.uid() = student_id);
CREATE POLICY "poster creates tx" ON public.transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = poster_id);
CREATE TRIGGER transactions_updated BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== CONVERSATIONS =====
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  poster_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, student_id)
);
GRANT SELECT, INSERT ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties read convs" ON public.conversations FOR SELECT TO authenticated USING (auth.uid() = student_id OR auth.uid() = poster_id);
CREATE POLICY "parties create convs" ON public.conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id OR auth.uid() = poster_id);

-- ===== MESSAGES =====
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  file_url TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_conv_idx ON public.messages(conversation_id);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties read messages" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.student_id = auth.uid() OR c.poster_id = auth.uid())));
CREATE POLICY "parties send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.student_id = auth.uid() OR c.poster_id = auth.uid())));
CREATE POLICY "mark as read" ON public.messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.student_id = auth.uid() OR c.poster_id = auth.uid())));

-- ===== REVIEWS =====
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, reviewer_id)
);
GRANT SELECT, INSERT ON public.reviews TO authenticated;
GRANT SELECT ON public.reviews TO anon;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews public" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "reviewer inserts" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = reviewer_id);

-- ===== NOTIFICATIONS =====
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, read);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own notifs" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users update own notifs" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ===== Auto-create profile on signup =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
