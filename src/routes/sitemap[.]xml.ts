import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://intask.ng";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const now = new Date().toISOString();
        const entries = [
          { path: "/", priority: "1.0", changefreq: "weekly" as const },
          { path: "/about", priority: "0.7", changefreq: "monthly" as const },
          { path: "/contact", priority: "0.6", changefreq: "monthly" as const },
          { path: "/terms", priority: "0.3", changefreq: "yearly" as const },
          { path: "/privacy", priority: "0.3", changefreq: "yearly" as const },
          { path: "/auth/login", priority: "0.5", changefreq: "monthly" as const },
          { path: "/auth/signup", priority: "0.8", changefreq: "monthly" as const },
        ];
        const urls = entries.map((e) => `  <url>\n    <loc>${BASE_URL}${e.path}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`);
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>`;
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
