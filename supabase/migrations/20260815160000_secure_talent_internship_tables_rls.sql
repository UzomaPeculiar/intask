-- Secure talent/internship tables: RLS + owner-scoped policies.
--
-- These tables were created outside the migration set (dashboard only), so
-- fresh environments get none of the schema or policies. This migration makes
-- them reproducible and converges any existing database to a known-good state:
--   * CREATE TABLE IF NOT EXISTS (no-op where tables already exist)
--   * RLS enabled idempotently
--   * anon revoked; authenticated granted only the commands each policy needs;
--     service_role granted ALL
--   * dashboard-created policies dropped and recreated canonically.
--     Behavior is preserved, with one deliberate tightening: student_skill_badges
--     was readable in full by anyone ("Anyone can read badges"); the app only
--     ever reads the owner's badges or passed badges (profile / talent search),
--     so SELECT is now scoped to (auth.uid() = user_id OR passed = true).

-- ============================================================================
-- skill_assessments: catalog read by all users; admin manages via is_admin.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.skill_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  passing_score INTEGER,
  questions JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.skill_assessments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.skill_assessments FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.skill_assessments TO authenticated;
GRANT ALL ON TABLE public.skill_assessments TO service_role;

DROP POLICY IF EXISTS "Anyone can read assessments" ON public.skill_assessments;
DROP POLICY IF EXISTS "Admin can manage assessments" ON public.skill_assessments;
DROP POLICY IF EXISTS "skill_assessments_select_authenticated" ON public.skill_assessments;

CREATE POLICY "skill_assessments_select_authenticated"
  ON public.skill_assessments
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "skill_assessments_admin_manage"
  ON public.skill_assessments
  FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin = true));

-- ============================================================================
-- student_skill_badges: owners manage their own badges; everyone can read
-- passed badges (shown on profiles / talent search).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.student_skill_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  passed BOOLEAN DEFAULT false,
  attempts INTEGER DEFAULT 0,
  earned_at TIMESTAMPTZ
);

ALTER TABLE public.student_skill_badges ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.student_skill_badges FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.student_skill_badges TO authenticated;
GRANT ALL ON TABLE public.student_skill_badges TO service_role;

DROP POLICY IF EXISTS "Anyone can read badges" ON public.student_skill_badges;
DROP POLICY IF EXISTS "Users can read own badges" ON public.student_skill_badges;
DROP POLICY IF EXISTS "Users can insert own badges" ON public.student_skill_badges;
DROP POLICY IF EXISTS "Users can update own badges" ON public.student_skill_badges;
DROP POLICY IF EXISTS "student_skill_badges_select_own_or_passed" ON public.student_skill_badges;
DROP POLICY IF EXISTS "student_skill_badges_insert_own" ON public.student_skill_badges;
DROP POLICY IF EXISTS "student_skill_badges_update_own" ON public.student_skill_badges;

CREATE POLICY "student_skill_badges_select_own_or_passed"
  ON public.student_skill_badges
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR passed = true);

CREATE POLICY "student_skill_badges_insert_own"
  ON public.student_skill_badges
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "student_skill_badges_update_own"
  ON public.student_skill_badges
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- talent_searches: owners manage their own search logs.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.talent_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  searcher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  query TEXT,
  filters JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.talent_searches ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.talent_searches FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.talent_searches TO authenticated;
GRANT ALL ON TABLE public.talent_searches TO service_role;

DROP POLICY IF EXISTS "Users can manage own searches" ON public.talent_searches;
DROP POLICY IF EXISTS "talent_searches_select_own" ON public.talent_searches;
DROP POLICY IF EXISTS "talent_searches_insert_own" ON public.talent_searches;

CREATE POLICY "talent_searches_manage_own"
  ON public.talent_searches
  FOR ALL TO authenticated
  USING (auth.uid() = searcher_id);

-- ============================================================================
-- talent_unlocks: searchers manage their unlocks; students can see who
-- unlocked their profile.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.talent_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  searcher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (searcher_id, student_id)
);

ALTER TABLE public.talent_unlocks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.talent_unlocks FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.talent_unlocks TO authenticated;
GRANT ALL ON TABLE public.talent_unlocks TO service_role;

DROP POLICY IF EXISTS "Users can manage own unlocks" ON public.talent_unlocks;
DROP POLICY IF EXISTS "Students can see who unlocked them" ON public.talent_unlocks;
DROP POLICY IF EXISTS "talent_unlocks_select_own" ON public.talent_unlocks;
DROP POLICY IF EXISTS "talent_unlocks_insert_own" ON public.talent_unlocks;

CREATE POLICY "talent_unlocks_searcher_manage_own"
  ON public.talent_unlocks
  FOR ALL TO authenticated
  USING (auth.uid() = searcher_id);

CREATE POLICY "talent_unlocks_student_view_unlockers"
  ON public.talent_unlocks
  FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

-- ============================================================================
-- internships: everyone can read open listings; posters manage their own.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.internships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT,
  skills_needed TEXT[] DEFAULT '{}',
  location TEXT NOT NULL,
  work_type TEXT DEFAULT 'remote',
  duration TEXT NOT NULL,
  paid BOOLEAN DEFAULT false,
  stipend NUMERIC DEFAULT 0,
  stipend_negotiable BOOLEAN DEFAULT false,
  deadline TIMESTAMPTZ,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.internships ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.internships FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.internships TO authenticated;
GRANT ALL ON TABLE public.internships TO service_role;

DROP TRIGGER IF EXISTS internships_updated ON public.internships;
CREATE TRIGGER internships_updated
BEFORE UPDATE ON public.internships
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "Anyone can read open internships" ON public.internships;
DROP POLICY IF EXISTS "Posters can manage own internships" ON public.internships;
DROP POLICY IF EXISTS "internships_select_open_or_own" ON public.internships;
DROP POLICY IF EXISTS "internships_insert_own" ON public.internships;

CREATE POLICY "internships_select_open_or_own"
  ON public.internships
  FOR SELECT TO authenticated
  USING (status = 'open' OR auth.uid() = poster_id);

CREATE POLICY "internships_poster_manage_own"
  ON public.internships
  FOR ALL TO authenticated
  USING (auth.uid() = poster_id);

-- ============================================================================
-- internship_applications: students submit/manage their own applications;
-- the poster of the internship can read applications for their posts.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.internship_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internship_id UUID REFERENCES public.internships(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  cover_letter TEXT,
  resume_url TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.internship_applications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.internship_applications FROM anon;
GRANT SELECT, INSERT ON TABLE public.internship_applications TO authenticated;
GRANT ALL ON TABLE public.internship_applications TO service_role;

DROP POLICY IF EXISTS "Students can apply" ON public.internship_applications;
DROP POLICY IF EXISTS "Students can read own applications" ON public.internship_applications;
DROP POLICY IF EXISTS "Posters can read applications" ON public.internship_applications;
DROP POLICY IF EXISTS "internship_applications_select_own" ON public.internship_applications;
DROP POLICY IF EXISTS "internship_applications_insert_own" ON public.internship_applications;

CREATE POLICY "internship_applications_students_can_apply"
  ON public.internship_applications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "internship_applications_students_read_own"
  ON public.internship_applications
  FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "internship_applications_posters_read"
  ON public.internship_applications
  FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT internships.poster_id
      FROM public.internships
      WHERE internships.id = internship_applications.internship_id
    )
  );
