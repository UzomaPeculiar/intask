import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AcceptApplicantInput = {
  taskId: string;
  appId: string;
  studentId: string;
  agreedPrice?: number;
};

export const acceptTaskApplicant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: AcceptApplicantInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

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

    const { error: insertMemberError } = await supabase.from("task_team_members").insert({
      task_id: data.taskId,
      student_id: data.studentId,
      role: currentCount === 0 ? "lead" : "member",
      payment_share: Math.floor(paymentShare),
      status: "active",
    });

    if (insertMemberError) throw insertMemberError;

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

    const { data: existingRoom, error: roomError } = await supabase
      .from("project_rooms")
      .select("id")
      .eq("task_id", data.taskId)
      .maybeSingle();

    if (roomError) throw roomError;

    let roomId = existingRoom?.id;
    if (!roomId) {
      const { data: newRoom, error: createRoomError } = await supabase
        .from("project_rooms")
        .insert({
          task_id: data.taskId,
          name: task.title ?? "Project Room",
          description: task.description,
          created_by: userId,
          status: "active",
        })
        .select("id")
        .single();

      if (createRoomError || !newRoom) {
        throw createRoomError ?? new Error("Could not create project room");
      }

      roomId = newRoom.id;

      const { error: seedMembersError } = await supabase
        .from("project_room_members")
        .upsert(
          [
            { room_id: roomId, user_id: userId, role: "owner" },
            { room_id: roomId, user_id: data.studentId, role: "member" },
          ],
          { onConflict: "room_id,user_id" },
        );

      if (seedMembersError) throw seedMembersError;
    } else {
      const { error: addMemberError } = await supabase
        .from("project_room_members")
        .upsert(
          [{ room_id: roomId, user_id: data.studentId, role: "member" }],
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