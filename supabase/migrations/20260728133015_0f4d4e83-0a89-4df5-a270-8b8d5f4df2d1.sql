-- Missing feature schemas used by app routes and client queries
-- Adds mentorship, learning, project-room, subscriptions, and partnerships tables.

-- Ensure admin helper prerequisites exist when older wallet migration is not applied.
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'is_admin_user'
  ) THEN
    CREATE FUNCTION public.is_admin_user(_uid UUID DEFAULT auth.uid())
    RETURNS BOOLEAN
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
      SELECT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = _uid AND p.is_admin = TRUE
      );
    $fn$;

    GRANT EXECUTE ON FUNCTION public.is_admin_user(UUID) TO authenticated;
  END IF;
END $$;

-- =========================
-- Subscription plans
-- =========================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  billing_cycle TEXT DEFAULT 'monthly',
  max_active_posts INTEGER DEFAULT 2 CHECK (max_active_posts >= 1),
  featured_posts INTEGER DEFAULT 0 CHECK (featured_posts >= 0),
  can_search_talent BOOLEAN DEFAULT FALSE,
  priority_support BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'pending')),
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  paystack_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_subscriptions_status_idx
  ON public.company_subscriptions(status);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscription plans readable" ON public.subscription_plans;
CREATE POLICY "subscription plans readable" ON public.subscription_plans
FOR SELECT TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "company subscriptions own read" ON public.company_subscriptions;
CREATE POLICY "company subscriptions own read" ON public.company_subscriptions
FOR SELECT TO authenticated
USING (auth.uid() = company_id OR public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "company subscriptions own write" ON public.company_subscriptions;
CREATE POLICY "company subscriptions own write" ON public.company_subscriptions
FOR ALL TO authenticated
USING (auth.uid() = company_id OR public.is_admin_user(auth.uid()))
WITH CHECK (auth.uid() = company_id OR public.is_admin_user(auth.uid()));

GRANT SELECT ON public.subscription_plans TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.company_subscriptions TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
GRANT ALL ON public.company_subscriptions TO service_role;

-- =========================
-- Mentorship
-- =========================
CREATE TABLE IF NOT EXISTS public.mentorship_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  duration_minutes INTEGER DEFAULT 60 CHECK (duration_minutes >= 15),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mentorship_services_mentor_idx
  ON public.mentorship_services(mentor_id);

CREATE TABLE IF NOT EXISTS public.mentorship_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES public.mentorship_services(id) ON DELETE SET NULL,
  mentor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  mentee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  notes TEXT,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mentorship_bookings_mentor_idx
  ON public.mentorship_bookings(mentor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mentorship_bookings_mentee_idx
  ON public.mentorship_bookings(mentee_id, created_at DESC);

-- Compatibility view for older naming used in planning docs.
CREATE OR REPLACE VIEW public.mentorship_sessions AS
SELECT
  id,
  service_id,
  mentor_id,
  mentee_id,
  status,
  notes,
  scheduled_at,
  created_at,
  updated_at
FROM public.mentorship_bookings;

GRANT SELECT ON public.mentorship_sessions TO authenticated;
GRANT ALL ON public.mentorship_sessions TO service_role;

ALTER TABLE public.mentorship_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentorship_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mentorship services read" ON public.mentorship_services;
CREATE POLICY "mentorship services read" ON public.mentorship_services
FOR SELECT TO authenticated, anon
USING (active = true OR auth.uid() = mentor_id OR public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "mentorship services owner write" ON public.mentorship_services;
CREATE POLICY "mentorship services owner write" ON public.mentorship_services
FOR ALL TO authenticated
USING (auth.uid() = mentor_id OR public.is_admin_user(auth.uid()))
WITH CHECK (auth.uid() = mentor_id OR public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "mentorship bookings participant read" ON public.mentorship_bookings;
CREATE POLICY "mentorship bookings participant read" ON public.mentorship_bookings
FOR SELECT TO authenticated
USING (
  auth.uid() = mentor_id
  OR auth.uid() = mentee_id
  OR public.is_admin_user(auth.uid())
);

DROP POLICY IF EXISTS "mentorship bookings mentee insert" ON public.mentorship_bookings;
CREATE POLICY "mentorship bookings mentee insert" ON public.mentorship_bookings
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = mentee_id);

DROP POLICY IF EXISTS "mentorship bookings participant update" ON public.mentorship_bookings;
CREATE POLICY "mentorship bookings participant update" ON public.mentorship_bookings
FOR UPDATE TO authenticated
USING (
  auth.uid() = mentor_id
  OR auth.uid() = mentee_id
  OR public.is_admin_user(auth.uid())
)
WITH CHECK (
  auth.uid() = mentor_id
  OR auth.uid() = mentee_id
  OR public.is_admin_user(auth.uid())
);

DROP TRIGGER IF EXISTS mentorship_services_updated ON public.mentorship_services;
CREATE TRIGGER mentorship_services_updated
BEFORE UPDATE ON public.mentorship_services
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS mentorship_bookings_updated ON public.mentorship_bookings;
CREATE TRIGGER mentorship_bookings_updated
BEFORE UPDATE ON public.mentorship_bookings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentorship_services TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mentorship_bookings TO authenticated;
GRANT SELECT ON public.mentorship_services TO anon;
GRANT ALL ON public.mentorship_services TO service_role;
GRANT ALL ON public.mentorship_bookings TO service_role;

-- =========================
-- InTask Learn
-- =========================
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  level TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  is_free BOOLEAN DEFAULT TRUE,
  duration_hours NUMERIC(6,2),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  enrolled_count INTEGER DEFAULT 0 CHECK (enrolled_count >= 0),
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS courses_status_created_idx
  ON public.courses(status, created_at DESC);
CREATE INDEX IF NOT EXISTS courses_instructor_idx
  ON public.courses(instructor_id);

CREATE TABLE IF NOT EXISTS public.course_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  video_url TEXT,
  duration_minutes INTEGER DEFAULT 10 CHECK (duration_minutes >= 0),
  order_index INTEGER DEFAULT 1 CHECK (order_index >= 1),
  is_free_preview BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, order_index)
);

CREATE INDEX IF NOT EXISTS course_lessons_course_idx
  ON public.course_lessons(course_id, order_index);

CREATE TABLE IF NOT EXISTS public.course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  paystack_reference TEXT,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, student_id)
);

CREATE INDEX IF NOT EXISTS course_enrollments_student_idx
  ON public.course_enrollments(student_id, enrolled_at DESC);

CREATE TABLE IF NOT EXISTS public.course_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  UNIQUE(enrollment_id, lesson_id)
);

-- Compatibility view for wording used in issue report.
CREATE OR REPLACE VIEW public.lesson_progress AS
SELECT
  id,
  enrollment_id,
  lesson_id,
  completed,
  completed_at
FROM public.course_progress;

GRANT SELECT ON public.lesson_progress TO authenticated;
GRANT ALL ON public.lesson_progress TO service_role;

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "courses read" ON public.courses;
CREATE POLICY "courses read" ON public.courses
FOR SELECT TO authenticated, anon
USING (status = 'published' OR auth.uid() = instructor_id OR public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "courses instructor write" ON public.courses;
CREATE POLICY "courses instructor write" ON public.courses
FOR ALL TO authenticated
USING (auth.uid() = instructor_id OR public.is_admin_user(auth.uid()))
WITH CHECK (auth.uid() = instructor_id OR public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "course lessons read" ON public.course_lessons;
CREATE POLICY "course lessons read" ON public.course_lessons
FOR SELECT TO authenticated, anon
USING (
  EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = course_id
      AND (
        c.status = 'published'
        OR c.instructor_id = auth.uid()
        OR public.is_admin_user(auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "course lessons instructor write" ON public.course_lessons;
CREATE POLICY "course lessons instructor write" ON public.course_lessons
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.courses c WHERE c.id = course_id AND (c.instructor_id = auth.uid() OR public.is_admin_user(auth.uid()))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.courses c WHERE c.id = course_id AND (c.instructor_id = auth.uid() OR public.is_admin_user(auth.uid()))
  )
);

DROP POLICY IF EXISTS "course enrollments participant read" ON public.course_enrollments;
CREATE POLICY "course enrollments participant read" ON public.course_enrollments
FOR SELECT TO authenticated
USING (
  auth.uid() = student_id
  OR EXISTS (
    SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.instructor_id = auth.uid()
  )
  OR public.is_admin_user(auth.uid())
);

DROP POLICY IF EXISTS "course enrollments student write" ON public.course_enrollments;
CREATE POLICY "course enrollments student write" ON public.course_enrollments
FOR ALL TO authenticated
USING (auth.uid() = student_id OR public.is_admin_user(auth.uid()))
WITH CHECK (auth.uid() = student_id OR public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "course progress participant read" ON public.course_progress;
CREATE POLICY "course progress participant read" ON public.course_progress
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.course_enrollments ce
    JOIN public.courses c ON c.id = ce.course_id
    WHERE ce.id = enrollment_id
      AND (
        ce.student_id = auth.uid()
        OR c.instructor_id = auth.uid()
        OR public.is_admin_user(auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "course progress student write" ON public.course_progress;
CREATE POLICY "course progress student write" ON public.course_progress
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.course_enrollments ce
    WHERE ce.id = enrollment_id
      AND (ce.student_id = auth.uid() OR public.is_admin_user(auth.uid()))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.course_enrollments ce
    WHERE ce.id = enrollment_id
      AND (ce.student_id = auth.uid() OR public.is_admin_user(auth.uid()))
  )
);

DROP TRIGGER IF EXISTS courses_updated ON public.courses;
CREATE TRIGGER courses_updated
BEFORE UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT SELECT ON public.courses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_lessons TO authenticated;
GRANT SELECT ON public.course_lessons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_enrollments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_progress TO authenticated;
GRANT ALL ON public.courses TO service_role;
GRANT ALL ON public.course_lessons TO service_role;
GRANT ALL ON public.course_enrollments TO service_role;
GRANT ALL ON public.course_progress TO service_role;

-- =========================
-- Project Rooms
-- =========================
CREATE TABLE IF NOT EXISTS public.project_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID UNIQUE REFERENCES public.tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.project_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'lead', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.project_room_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.project_rooms(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_room_messages_room_created_idx
  ON public.project_room_messages(room_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.project_room_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.project_rooms(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_room_members_room_idx
  ON public.project_room_members(room_id);
CREATE INDEX IF NOT EXISTS project_room_files_room_idx
  ON public.project_room_files(room_id, created_at DESC);

ALTER TABLE public.project_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_room_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project rooms participant read" ON public.project_rooms;
CREATE POLICY "project rooms participant read" ON public.project_rooms
FOR SELECT TO authenticated
USING (
  public.is_admin_user(auth.uid())
  OR auth.uid() = created_by
  OR EXISTS (
    SELECT 1 FROM public.project_room_members prm
    WHERE prm.room_id = id AND prm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id AND t.poster_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "project rooms owner write" ON public.project_rooms;
CREATE POLICY "project rooms owner write" ON public.project_rooms
FOR ALL TO authenticated
USING (
  public.is_admin_user(auth.uid())
  OR auth.uid() = created_by
  OR EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.poster_id = auth.uid()
  )
)
WITH CHECK (
  public.is_admin_user(auth.uid())
  OR auth.uid() = created_by
  OR EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.poster_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "project room members participant read" ON public.project_room_members;
CREATE POLICY "project room members participant read" ON public.project_room_members
FOR SELECT TO authenticated
USING (
  public.is_admin_user(auth.uid())
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.project_room_members me
    WHERE me.room_id = public.project_room_members.room_id AND me.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.project_rooms pr
    JOIN public.tasks t ON t.id = pr.task_id
    WHERE pr.id = public.project_room_members.room_id AND t.poster_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "project room members manage" ON public.project_room_members;
CREATE POLICY "project room members manage" ON public.project_room_members
FOR ALL TO authenticated
USING (
  public.is_admin_user(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.project_rooms pr
    JOIN public.tasks t ON t.id = pr.task_id
    WHERE pr.id = public.project_room_members.room_id AND t.poster_id = auth.uid()
  )
)
WITH CHECK (
  public.is_admin_user(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.project_rooms pr
    JOIN public.tasks t ON t.id = pr.task_id
    WHERE pr.id = public.project_room_members.room_id AND t.poster_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "project room messages participant read" ON public.project_room_messages;
CREATE POLICY "project room messages participant read" ON public.project_room_messages
FOR SELECT TO authenticated
USING (
  public.is_admin_user(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.project_room_members prm
    WHERE prm.room_id = public.project_room_messages.room_id AND prm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.project_rooms pr
    JOIN public.tasks t ON t.id = pr.task_id
    WHERE pr.id = public.project_room_messages.room_id AND t.poster_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "project room messages member insert" ON public.project_room_messages;
CREATE POLICY "project room messages member insert" ON public.project_room_messages
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = public.project_room_messages.sender_id
  AND (
    public.is_admin_user(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_room_members prm
      WHERE prm.room_id = public.project_room_messages.room_id AND prm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_rooms pr
      JOIN public.tasks t ON t.id = pr.task_id
      WHERE pr.id = public.project_room_messages.room_id AND t.poster_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "project room files participant read" ON public.project_room_files;
CREATE POLICY "project room files participant read" ON public.project_room_files
FOR SELECT TO authenticated
USING (
  public.is_admin_user(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.project_room_members prm
    WHERE prm.room_id = public.project_room_files.room_id AND prm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.project_rooms pr
    JOIN public.tasks t ON t.id = pr.task_id
    WHERE pr.id = public.project_room_files.room_id AND t.poster_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "project room files member insert" ON public.project_room_files;
CREATE POLICY "project room files member insert" ON public.project_room_files
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = public.project_room_files.uploaded_by
  AND (
    public.is_admin_user(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_room_members prm
      WHERE prm.room_id = public.project_room_files.room_id AND prm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_rooms pr
      JOIN public.tasks t ON t.id = pr.task_id
      WHERE pr.id = public.project_room_files.room_id AND t.poster_id = auth.uid()
    )
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_rooms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_room_members TO authenticated;
GRANT SELECT, INSERT ON public.project_room_messages TO authenticated;
GRANT SELECT, INSERT ON public.project_room_files TO authenticated;
GRANT ALL ON public.project_rooms TO service_role;
GRANT ALL ON public.project_room_members TO service_role;
GRANT ALL ON public.project_room_messages TO service_role;
GRANT ALL ON public.project_room_files TO service_role;

-- =========================
-- University partnerships
-- =========================
CREATE TABLE IF NOT EXISTS public.university_partnerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  students_count INTEGER DEFAULT 0 CHECK (students_count >= 0),
  tasks_completed INTEGER DEFAULT 0 CHECK (tasks_completed >= 0),
  total_earned NUMERIC(14,2) DEFAULT 0 CHECK (total_earned >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS university_partnerships_status_idx
  ON public.university_partnerships(status, created_at DESC);

ALTER TABLE public.university_partnerships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partnerships read" ON public.university_partnerships;
CREATE POLICY "partnerships read" ON public.university_partnerships
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "partnerships insert" ON public.university_partnerships;
CREATE POLICY "partnerships insert" ON public.university_partnerships
FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "partnerships admin update" ON public.university_partnerships;
CREATE POLICY "partnerships admin update" ON public.university_partnerships
FOR UPDATE TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

DROP TRIGGER IF EXISTS university_partnerships_updated ON public.university_partnerships;
CREATE TRIGGER university_partnerships_updated
BEFORE UPDATE ON public.university_partnerships
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.university_partnerships TO authenticated;
GRANT ALL ON public.university_partnerships TO service_role;
