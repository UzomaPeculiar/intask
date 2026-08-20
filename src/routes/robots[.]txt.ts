import { createFileRoute } from "@tanstack/react-router";

const BASE_URL = "https://intask.ng";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const body = `User-agent: *
Allow: /
Disallow: /app/
Disallow: /admin/
Disallow: /auth/
Disallow: /api/

Sitemap: ${BASE_URL}/sitemap.xml
`;
        return new Response(body, {
          headers: {
            "Content-Type": "text/plain",
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
