-- Fix project room policies to avoid recursive checks on project_room_members.
-- This migration must be new so Supabase db push applies it.

CREATE OR REPLACE FUNCTION public.is_project_room_member(_room_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_room_members prm
    WHERE prm.room_id = _room_id
      AND prm.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_project_room(_room_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_user(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.project_rooms pr
      JOIN public.tasks t ON t.id = pr.task_id
      WHERE pr.id = _room_id
        AND t.poster_id = _user_id
    );
$$;

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
  OR public.is_project_room_member(id)
  OR public.can_manage_project_room(id)
);

DROP POLICY IF EXISTS "project rooms owner write" ON public.project_rooms;
CREATE POLICY "project rooms owner write" ON public.project_rooms
FOR ALL TO authenticated
USING (
  public.is_admin_user(auth.uid())
  OR auth.uid() = created_by
  OR public.can_manage_project_room(id)
)
WITH CHECK (
  public.is_admin_user(auth.uid())
  OR auth.uid() = created_by
  OR public.can_manage_project_room(id)
);

DROP POLICY IF EXISTS "project room members participant read" ON public.project_room_members;
CREATE POLICY "project room members participant read" ON public.project_room_members
FOR SELECT TO authenticated
USING (
  public.is_admin_user(auth.uid())
  OR user_id = auth.uid()
  OR public.is_project_room_member(room_id)
  OR public.can_manage_project_room(room_id)
);

DROP POLICY IF EXISTS "project room members manage" ON public.project_room_members;
CREATE POLICY "project room members manage" ON public.project_room_members
FOR ALL TO authenticated
USING (
  public.is_admin_user(auth.uid())
  OR public.can_manage_project_room(room_id)
)
WITH CHECK (
  public.is_admin_user(auth.uid())
  OR public.can_manage_project_room(room_id)
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
