import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/messages/$conversationId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/app/messages",
      search: { conversationId: params.conversationId },
      replace: true,
    });
  },
  component: () => null,
});
