import { createFileRoute } from "@tanstack/react-router";
import { WaitlistPage } from "@/components/WaitlistPage";

export const Route = createFileRoute("/waitlist")({
  head: () => ({
    meta: [
      { title: "InTask — Join the Waitlist" },
      {
        name: "description",
        content:
          "Be the first to know when InTask launches. Join the waitlist and get early access to Nigeria's student freelance marketplace.",
      },
      { property: "og:title", content: "InTask — Join the Waitlist" },
      {
        property: "og:description",
        content:
          "Be the first to know when InTask launches. Join the waitlist for early access.",
      },
    ],
  }),
  component: WaitlistPage,
});
