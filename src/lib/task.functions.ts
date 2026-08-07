import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getNumericPlatformSetting, PLATFORM_SETTING_DEFAULTS } from "@/lib/platform-settings";

type AcceptApplicantInput = {
  taskId: string;
  appId: string;
  studentId: string;
  agreedPrice?: number;
};

type RemoveAcceptedApplicantInput = {
  taskId: string;
  appId: string;
  studentId: string;
};

type SubmitTaskDeliveryInput = {
  taskId: string;
  title: string;
  message: string;
  url?: string;
  fileUrl?: string;
  fileName?: string;
};

export const getTaskForDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { taskId: string }) => input)
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: task, error: taskError } = await db
      .from("tasks")
      .select("id, title, poster_id, matched_student_id, status, is_team_task, revision_notes")
      .eq("id", data.taskId)
      .maybeSingle();

    if (taskError) throw taskError;
    if (!task) throw new Error("Task not found");

    const { data: teamMember, error: memberError } = await db
      .from("task_team_members")
      .select("id")
      .eq("task_id", data.taskId)
      .eq("student_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (memberError) throw memberError;

    const canAccess =
      task.poster_id === userId ||
      task.matched_student_id === userId ||
      Boolean(teamMember);

    if (!canAccess) throw new Error("Task not found");

    return task;
  });

export const getTaskForViewer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { taskId: string }) => input)
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: task, error: taskError } = await db
      .from("tasks")
      .select("*, poster:profiles!tasks_poster_id_fkey(id, full_name, role)")
      .eq("id", data.taskId)
      .maybeSingle();

    if (taskError) throw taskError;
    if (!task) throw new Error("Task not found");

    const { data: teamMember, error: memberError } = await db
      .from("task_team_members")
      .select("id")
      .eq("task_id", data.taskId)
      .eq("student_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (memberError) throw memberError;

    const canAccess =
      String(task.status) === "open" ||
      task.poster_id === userId ||
      task.matched_student_id === userId ||
      Boolean(teamMember);

    if (!canAccess) throw new Error("Task not found");

    return task;
  });

async function ensureProjectRoomForTask(db: any, taskId: string) {
  const { data: task, error: taskError } = await db
    .from("tasks")
    .select("id, title, description, poster_id, matched_student_id, is_team_task, status")
    .eq("id", taskId)
    .maybeSingle();

  if (taskError) throw taskError;
  if (!task) throw new Error("Task not found");

  const shouldHaveRoom =
    ["matched", "in_progress", "in_review", "completed"].includes(String(task.status)) &&
    (Boolean(task.is_team_task) || Boolean(task.matched_student_id));

  if (!shouldHaveRoom) {
    return null;
  }

  const { data: existingRoom, error: roomError } = await db
    .from("project_rooms")
    .select("id, task_id")
    .eq("task_id", taskId)
    .maybeSingle();

  if (roomError) throw roomError;

  let room = existingRoom;

  if (!room) {
    const { data: createdRoom, error: createRoomError } = await db
      .from("project_rooms")
      .insert({
        task_id: task.id,
        name: task.title ?? "Project Room",
        description: task.description,
        created_by: task.poster_id,
        status: "active",
      })
      .select("id, task_id")
      .single();

    if (createRoomError || !createdRoom) {
      throw createRoomError ?? new Error("Could not create project room");
    }

    room = createdRoom;
  }

  const { data: teamMembers, error: teamMembersError } = await db
    .from("task_team_members")
    .select("student_id")
    .eq("task_id", task.id)
    .eq("status", "active");

  if (teamMembersError) throw teamMembersError;

  const memberIds = new Set<string>();
  if (task.poster_id) memberIds.add(task.poster_id);
  if (task.matched_student_id) memberIds.add(task.matched_student_id);
  for (const member of teamMembers ?? []) {
    if (member?.student_id) memberIds.add(member.student_id);
  }

  if (memberIds.size > 0) {
    const members = [...memberIds].map((memberId) => ({
      room_id: room.id,
      user_id: memberId,
      role: memberId === task.poster_id ? "owner" : "member",
    }));

    const { error: seedMembersError } = await db
      .from("project_room_members")
      .upsert(members, { onConflict: "room_id,user_id" });

    if (seedMembersError) throw seedMembersError;
  }

  return room;
}

export const acceptTaskApplicant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: AcceptApplicantInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const settingsDb = supabaseAdmin as any;
    const db = supabaseAdmin as any;
    const minTaskBudget = await getNumericPlatformSetting(
      settingsDb,
      "min_task_budget",
      PLATFORM_SETTING_DEFAULTS.min_task_budget,
    );
    const normalizedMinTaskBudget = Math.max(0, Number(minTaskBudget));

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, title, description, budget, poster_id, status, is_team_task, team_size, matched_student_id")
      .eq("id", data.taskId)
      .single();

    if (taskError || !task) throw new Error("Task not found");
    if (task.poster_id !== userId) throw new Error("Only the task owner can accept applicants");

    const teamSize = Number(task.team_size ?? 1);
    const isTeamTask = Boolean(task.is_team_task);

    if (!isTeamTask && task.status !== "open") {
      throw new Error("Only open tasks can accept applicants");
    }

    if (isTeamTask && !["open", "matched"].includes(task.status)) {
      throw new Error("This task is no longer accepting team members");
    }

    const { data: application, error: applicationError } = await supabase
      .from("applications")
      .select("id, task_id, student_id, status")
      .eq("id", data.appId)
      .eq("task_id", data.taskId)
      .single();

    if (applicationError || !application) throw new Error("Application not found");
    if (application.student_id !== data.studentId) throw new Error("Applicant mismatch");
    if (application.status !== "pending") throw new Error("This application is no longer pending");

    if (typeof data.agreedPrice === "number" && Number(data.agreedPrice) < normalizedMinTaskBudget) {
      throw new Error(`Minimum task budget is ₦${normalizedMinTaskBudget.toLocaleString("en-NG")}`);
    }

    const { error: acceptError } = await supabase
      .from("applications")
      .update({ status: "accepted" })
      .eq("id", application.id)
      .eq("status", "pending");

    if (acceptError) throw acceptError;

    if (!isTeamTask) {
      const taskUpdate: Record<string, string | number> = {
        status: "matched",
        matched_student_id: data.studentId,
      };

      if (typeof data.agreedPrice === "number") {
        taskUpdate.budget = data.agreedPrice;
      }

      const { error: updateTaskError } = await supabase
        .from("tasks")
        .update(taskUpdate)
        .eq("id", task.id)
        .eq("status", "open");

      if (updateTaskError) throw updateTaskError;

      return { ok: true, isTeamTask: false, teamSize, taskStatus: "matched" };
    }

    const { data: existingMembers, error: membersError } = await supabase
      .from("task_team_members")
      .select("id, student_id")
      .eq("task_id", data.taskId)
      .eq("status", "active");

    if (membersError) throw membersError;
    if ((existingMembers ?? []).some((member) => member.student_id === data.studentId)) {
      throw new Error("This student is already on the task team");
    }

    const currentCount = existingMembers?.length ?? 0;
    if (currentCount >= teamSize) {
      throw new Error("This team is already full");
    }

    const paymentShare = data.agreedPrice
      ? data.agreedPrice / teamSize
      : Number(task.budget ?? 0) / teamSize;

    const nextRole = currentCount === 0 ? "lead" : "member";

    const { data: existingMemberRecord, error: existingMemberRecordError } = await supabase
      .from("task_team_members")
      .select("id, status")
      .eq("task_id", data.taskId)
      .eq("student_id", data.studentId)
      .maybeSingle();

    if (existingMemberRecordError) throw existingMemberRecordError;

    if (existingMemberRecord?.id) {
      const { error: reactivateMemberError } = await supabase
        .from("task_team_members")
        .update({
          role: nextRole,
          payment_share: Math.floor(paymentShare),
          status: "active",
        })
        .eq("id", existingMemberRecord.id);

      if (reactivateMemberError) throw reactivateMemberError;
    } else {
      const { error: insertMemberError } = await supabase.from("task_team_members").insert({
        task_id: data.taskId,
        student_id: data.studentId,
        role: nextRole,
        payment_share: Math.floor(paymentShare),
        status: "active",
      });

      if (insertMemberError) throw insertMemberError;
    }

    const teamFilled = currentCount + 1 >= teamSize;
    if (teamFilled) {
      const taskUpdate: Record<string, string | number> = {
        status: "matched",
        matched_student_id: data.studentId,
      };

      if (typeof data.agreedPrice === "number") {
        taskUpdate.budget = data.agreedPrice;
      }

      const { error: updateTaskError } = await supabase
        .from("tasks")
        .update(taskUpdate)
        .eq("id", task.id)
        .in("status", ["open", "matched"]);

      if (updateTaskError) throw updateTaskError;
    }

    const room = await ensureProjectRoomForTask(db, data.taskId);
    if (room?.id) {
      const { error: addMemberError } = await db
        .from("project_room_members")
        .upsert(
          [
            { room_id: room.id, user_id: userId, role: "owner" },
            { room_id: room.id, user_id: data.studentId, role: "member" },
          ],
          { onConflict: "room_id,user_id" },
        );

      if (addMemberError) throw addMemberError;
    }

    return {
      ok: true,
      isTeamTask: true,
      teamSize,
      taskStatus: teamFilled ? "matched" : task.status,
      teamFilled,
    };
  });

export const removeAcceptedTaskApplicant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: RemoveAcceptedApplicantInput) => input)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: task, error: taskError } = await db
      .from("tasks")
      .select("id, title, poster_id, status, is_team_task, team_size, matched_student_id")
      .eq("id", data.taskId)
      .maybeSingle();

    if (taskError) throw taskError;
    if (!task) throw new Error("Task not found");
    if (task.poster_id !== userId) throw new Error("Only the task owner can remove accepted students");

    const isTeamTask = Boolean(task.is_team_task);
    const canEditAccepted = ["open", "matched"].includes(String(task.status));
    if (!canEditAccepted) {
      throw new Error("You can only change accepted students before work starts");
    }

    const { data: application, error: applicationError } = await db
      .from("applications")
      .select("id, student_id, status")
      .eq("id", data.appId)
      .eq("task_id", data.taskId)
      .maybeSingle();

    if (applicationError) throw applicationError;
    if (!application) throw new Error("Application not found");
    if (application.student_id !== data.studentId) throw new Error("Applicant mismatch");
    if (application.status !== "accepted") throw new Error("This student is not currently accepted");

    const { error: resetApplicationError } = await db
      .from("applications")
      .update({ status: "pending" })
      .eq("id", application.id)
      .eq("status", "accepted");

    if (resetApplicationError) throw resetApplicationError;

    if (isTeamTask) {
      const { error: removeMemberError } = await db
        .from("task_team_members")
        .update({ status: "removed" })
        .eq("task_id", data.taskId)
        .eq("student_id", data.studentId)
        .eq("status", "active");

      if (removeMemberError) throw removeMemberError;

      const { data: activeMembers, error: activeMembersError } = await db
        .from("task_team_members")
        .select("id, student_id, role")
        .eq("task_id", data.taskId)
        .eq("status", "active")
        .order("created_at", { ascending: true });

      if (activeMembersError) throw activeMembersError;

      const teamSize = Number(task.team_size ?? 1);
      const hasLead = (activeMembers ?? []).some((member: any) => member.role === "lead");
      if (!hasLead && (activeMembers ?? []).length > 0) {
        const leadId = (activeMembers as any[])[0].id;
        const { error: promoteLeadError } = await db
          .from("task_team_members")
          .update({ role: "lead" })
          .eq("id", leadId);

        if (promoteLeadError) throw promoteLeadError;
      }

      const nextMatchedStudentId = (activeMembers ?? [])[0]?.student_id ?? null;
      const nextStatus = (activeMembers ?? []).length >= teamSize ? "matched" : "open";

      const { error: updateTaskError } = await db
        .from("tasks")
        .update({
          status: nextStatus,
          matched_student_id: nextMatchedStudentId,
        })
        .eq("id", data.taskId);

      if (updateTaskError) throw updateTaskError;
    } else {
      const { error: updateTaskError } = await db
        .from("tasks")
        .update({
          status: "open",
          matched_student_id: null,
        })
        .eq("id", data.taskId)
        .in("status", ["open", "matched"]);

      if (updateTaskError) throw updateTaskError;
    }

    const { data: room } = await db
      .from("project_rooms")
      .select("id")
      .eq("task_id", data.taskId)
      .maybeSingle();

    if (room?.id) {
      const { error: removeRoomMemberError } = await db
        .from("project_room_members")
        .delete()
        .eq("room_id", room.id)
        .eq("user_id", data.studentId);

      if (removeRoomMemberError) throw removeRoomMemberError;
    }

    const { error: notifyError } = await db.from("notifications").insert({
      user_id: data.studentId,
      type: "application_rejected",
      message: `You were removed from ${task.title}. Your application is pending again and can be re-selected.`,
      link: `/app/tasks/${data.taskId}`,
    });

    if (notifyError) throw notifyError;

    return { ok: true };
  });

export const getStudentActiveTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const [soloRes, teamRes] = await Promise.all([
      db
        .from("tasks")
        .select("id, title, budget, status, is_team_task, matched_student_id, poster_id, updated_at, created_at, poster:profiles!tasks_poster_id_fkey(id, full_name, role)")
        .eq("matched_student_id", userId)
        .in("status", ["matched", "in_progress", "in_review"])
        .order("updated_at", { ascending: false }),
      db
        .from("task_team_members")
        .select("task_id, task:tasks!task_team_members_task_id_fkey(id, title, budget, status, is_team_task, matched_student_id, poster_id, updated_at, created_at, poster:profiles!tasks_poster_id_fkey(id, full_name, role))")
        .eq("student_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false }),
    ]);

    if (soloRes.error) throw soloRes.error;
    if (teamRes.error) throw teamRes.error;

    const soloTasks = (soloRes.data ?? []).map((task: any) => ({ ...task, room_id: null }));
    const teamTasks = (teamRes.data ?? [])
      .map((row: any) => row.task)
      .filter(Boolean)
      .filter((task: any) => ["matched", "in_progress", "in_review"].includes(String(task.status)))
      .map((task: any) => ({ ...task, room_id: null }));

    const taskMap = new Map<string, any>();
    for (const task of [...soloTasks, ...teamTasks]) {
      taskMap.set(task.id, task);
    }

    const taskIds = [...taskMap.keys()];
    if (taskIds.length > 0) {
      const { data: rooms, error: roomError } = await db
        .from("project_rooms")
        .select("id, task_id")
        .in("task_id", taskIds);
      if (roomError) throw roomError;

      const roomMap = new Map((rooms ?? []).map((room: any) => [room.task_id, room.id]));
      for (const [taskId, task] of taskMap.entries()) {
        taskMap.set(taskId, { ...task, room_id: roomMap.get(taskId) ?? null });
      }
    }

    return Array.from(taskMap.values()).sort((a: any, b: any) => new Date(b.updated_at ?? b.created_at ?? 0).getTime() - new Date(a.updated_at ?? a.created_at ?? 0).getTime());
  });

export const getProjectRoomForTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { taskId: string }) => input)
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: task, error: taskError } = await db
      .from("tasks")
      .select("id, poster_id, matched_student_id, is_team_task")
      .eq("id", data.taskId)
      .maybeSingle();

    if (taskError) throw taskError;
    if (!task) throw new Error("Task not found");

    const { data: member } = await db
      .from("task_team_members")
      .select("id")
      .eq("task_id", data.taskId)
      .eq("student_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (task.poster_id !== userId && task.matched_student_id !== userId && !member) {
      throw new Error("Project room not found");
    }

    const room = await ensureProjectRoomForTask(db, data.taskId);
    if (!room) throw new Error("Project room not found");

    return { roomId: room.id };
  });

export const getProjectRoomData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { roomId: string }) => input)
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: initialRoom, error: roomLookupError } = await db
      .from("project_rooms")
      .select("id, name, description, status, task_id, created_by, task:tasks(id, title, status, budget, is_team_task, poster_id, matched_student_id)")
      .eq("id", data.roomId)
      .maybeSingle();

    if (roomLookupError) throw roomLookupError;
    if (!initialRoom?.task_id) throw new Error("Project room not found");

    const { data: teamMember } = await db
      .from("task_team_members")
      .select("id")
      .eq("task_id", initialRoom.task_id)
      .eq("student_id", userId)
      .eq("status", "active")
      .maybeSingle();

    const task = initialRoom.task as any;
    const allowed =
      task?.poster_id === userId ||
      task?.matched_student_id === userId ||
      Boolean(teamMember);

    if (!allowed) throw new Error("Project room not found");

    const room = await ensureProjectRoomForTask(db, initialRoom.task_id);
    if (!room?.id) throw new Error("Project room not found");

    const [roomRes, membersRes, messagesRes, filesRes] = await Promise.all([
      db
        .from("project_rooms")
        .select("id, name, description, status, task_id, created_by, task:tasks(id, title, status, budget, is_team_task, poster_id, matched_student_id)")
        .eq("id", room.id)
        .single(),
      db
        .from("project_room_members")
        .select("*, user:profiles!project_room_members_user_id_fkey(id, full_name, role)")
        .eq("room_id", room.id)
        .order("joined_at", { ascending: true }),
      db
        .from("project_room_messages")
        .select("*, sender:profiles!project_room_messages_sender_id_fkey(id, full_name)")
        .eq("room_id", room.id)
        .order("created_at", { ascending: true }),
      db
        .from("project_room_files")
        .select("*, uploader:profiles!project_room_files_uploaded_by_fkey(full_name)")
        .eq("room_id", room.id)
        .order("created_at", { ascending: false }),
    ]);

    if (roomRes.error) throw roomRes.error;
    if (membersRes.error) throw membersRes.error;
    if (messagesRes.error) throw messagesRes.error;
    if (filesRes.error) throw filesRes.error;

    return {
      room: roomRes.data,
      members: membersRes.data ?? [],
      messages: messagesRes.data ?? [],
      files: filesRes.data ?? [],
    };
  });

export const postProjectRoomMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { roomId: string; content: string }) => input)
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const content = String(data.content ?? "").trim();
    if (!content) throw new Error("Message cannot be empty");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const roomState = await getProjectRoomData({
      data: { roomId: data.roomId },
      context,
    } as any);

    const roomId = roomState?.room?.id;
    if (!roomId) throw new Error("Project room not found");

    const { error } = await db
      .from("project_room_messages")
      .insert({ room_id: roomId, sender_id: userId, content });

    if (error) throw error;

    return { ok: true };
  });

export const addProjectRoomFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { roomId: string; fileName: string; fileUrl: string; fileType?: string | null }) => input)
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const fileName = String(data.fileName ?? "").trim();
    const fileUrl = String(data.fileUrl ?? "").trim();

    if (!fileName) throw new Error("File name is required");
    if (!fileUrl) throw new Error("File URL is required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const roomState = await getProjectRoomData({
      data: { roomId: data.roomId },
      context,
    } as any);

    const roomId = roomState?.room?.id;
    if (!roomId) throw new Error("Project room not found");

    const { error } = await db.from("project_room_files").insert({
      room_id: roomId,
      uploaded_by: userId,
      file_name: fileName,
      file_url: fileUrl,
      file_type: data.fileType ?? null,
    });

    if (error) throw error;

    return { ok: true };
  });

export const submitTaskDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: SubmitTaskDeliveryInput) => input)
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const title = String(data.title ?? "").trim();
    const message = String(data.message ?? "").trim();
    const url = String(data.url ?? "").trim();
    const fileUrl = String(data.fileUrl ?? "").trim();
    const fileName = String(data.fileName ?? "").trim();

    if (!title) throw new Error("Work title is required");
    if (!message) throw new Error("Delivery message is required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: task, error: taskError } = await db
      .from("tasks")
      .select("id, title, poster_id, matched_student_id, status, is_team_task")
      .eq("id", data.taskId)
      .maybeSingle();

    if (taskError) throw taskError;
    if (!task) throw new Error("Task not found");

    const { data: teamMember } = await db
      .from("task_team_members")
      .select("id")
      .eq("task_id", data.taskId)
      .eq("student_id", userId)
      .eq("status", "active")
      .maybeSingle();

    const canSubmit = task.matched_student_id === userId || !!teamMember;
    if (!canSubmit) throw new Error("Only assigned students can submit delivery");
    if (task.status !== "in_progress" && !(task.is_team_task && task.status === "in_review")) {
      throw new Error("This task is not currently accepting delivery");
    }

    const submittedAt = new Date().toISOString();

    if (task.is_team_task) {
      if (!teamMember) throw new Error("Only active team members can submit delivery");

      const { data: existingSubmission, error: existingSubmissionError } = await db
        .from("task_team_members")
        .select("delivery_submitted_at")
        .eq("id", teamMember.id)
        .maybeSingle();

      if (existingSubmissionError) throw existingSubmissionError;
      if (existingSubmission?.delivery_submitted_at) {
        throw new Error("You already submitted your delivery. Wait for review or revision request.");
      }

      const { error: memberUpdateError } = await db
        .from("task_team_members")
        .update({
          delivery_title: title,
          delivery_message: message,
          delivery_url: url || null,
          delivery_file_url: fileUrl || null,
          delivery_file_name: fileName || null,
          delivery_submitted_at: submittedAt,
        })
        .eq("id", teamMember.id);

      if (memberUpdateError) throw memberUpdateError;

      const { data: activeMembers, error: activeMembersError } = await db
        .from("task_team_members")
        .select("id, delivery_submitted_at")
        .eq("task_id", data.taskId)
        .eq("status", "active");

      if (activeMembersError) throw activeMembersError;

      const allSubmitted = (activeMembers ?? []).length > 0 && (activeMembers ?? []).every((member: any) => !!member.delivery_submitted_at);

      const { error: taskUpdateError } = await db
        .from("tasks")
        .update({
          status: allSubmitted ? "in_review" : "in_progress",
          delivery_submitted_at: allSubmitted ? submittedAt : null,
        })
        .eq("id", data.taskId);

      if (taskUpdateError) throw taskUpdateError;
    } else {
      const deliveryPayload: Record<string, any> = {
        status: "in_review",
        delivery_title: title,
        delivery_message: message,
        delivery_url: url || null,
        delivery_file_url: fileUrl || null,
        delivery_file_name: fileName || null,
        delivery_submitted_at: submittedAt,
      };

      const { error: updateError } = await db
        .from("tasks")
        .update(deliveryPayload)
        .eq("id", data.taskId);

      if (updateError) throw updateError;
    }

    const { data: profile } = await db
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    const submitterName = profile?.full_name ?? "A student";

    if (task.is_team_task) {
      const room = await ensureProjectRoomForTask(db, task.id);
      if (room?.id) {
        const roomMessage = [
          `${submitterName} submitted team delivery: ${title}`,
          "",
          message,
          url ? `Link: ${url}` : "",
          fileUrl ? `Document: ${fileUrl}` : "",
        ].filter(Boolean).join("\n");

        const { error: roomMessageError } = await db
          .from("project_room_messages")
          .insert({
            room_id: room.id,
            sender_id: userId,
            content: roomMessage,
          });

        if (roomMessageError) throw roomMessageError;

        if (fileUrl && fileName) {
          const { error: roomFileError } = await db.from("project_room_files").insert({
            room_id: room.id,
            uploaded_by: userId,
            file_name: fileName,
            file_url: fileUrl,
            file_type: null,
          });

          if (roomFileError) throw roomFileError;
        }
      }
    }

    if (task.poster_id) {
      let notificationMessage = `${submitterName} submitted work for ${task.title}. Review it now.`;
      if (task.is_team_task) {
        const { data: activeMembers } = await db
          .from("task_team_members")
          .select("delivery_submitted_at")
          .eq("task_id", data.taskId)
          .eq("status", "active");
        const allSubmitted = (activeMembers ?? []).length > 0 && (activeMembers ?? []).every((member: any) => !!member.delivery_submitted_at);
        notificationMessage = allSubmitted
          ? `All team members submitted work for ${task.title}. Review it now.`
          : `${submitterName} submitted their part for ${task.title}. Waiting for the rest of the team.`;
      }
      const { error: notifError } = await db.from("notifications").insert({
        user_id: task.poster_id,
        type: "delivery_submitted",
        message: notificationMessage,
        link: `/app/tasks/${task.id}/review`,
      });
      if (notifError) throw notifError;
    }

    return { ok: true };
  });