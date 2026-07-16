import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

type Props = {
  taskId: string;
  studentId: string | null | undefined;
  posterId: string;
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
};

export function MessagePartyLink({ taskId, studentId, posterId, label = "Message", variant = "outline", className }: Props) {
  const nav = useNavigate();
  const open = useMutation({
    mutationFn: async () => {
      if (!studentId) throw new Error("No student matched yet");
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("task_id", taskId)
        .eq("student_id", studentId)
        .eq("poster_id", posterId)
        .maybeSingle();
      if (existing?.id) return existing.id;
      const { data, error } = await supabase
        .from("conversations")
        .insert({ task_id: taskId, student_id: studentId, poster_id: posterId })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => nav({ to: "/app/messages/$conversationId", params: { conversationId: id } }),
    onError: (e: any) => toast.error(e.message ?? "Could not open conversation"),
  });

  return (
    <Button
      variant={variant}
      className={className}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); open.mutate(); }}
      disabled={open.isPending || !studentId}
    >
      <MessageCircle className="size-4" /> {label}
    </Button>
  );
}
