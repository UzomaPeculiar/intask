import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { getSupabaseClientConfig, hasSupabaseClientConfig } from "@/integrations/supabase/env";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { InstallPwaButton } from "@/components/intask/InstallPwaButton";
import { PwaUpdatePrompt } from "@/components/intask/PwaUpdatePrompt";
import { registerServiceWorker } from "@/lib/pwa";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-medium text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-medium tracking-tight text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We're on it. Try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#3dcb6c" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "InTask" },
      { title: "InTask — Work, collaborate, and grow" },
      { name: "description", content: "InTask connects Nigerian students with paid tasks — design, writing, research, tutoring and more. Get hired, get paid safely via escrow." },
      { name: "author", content: "InTask" },
      { name: "robots", content: "index, follow, max-snippet:-1, max-image-preview:large" },
      { property: "og:title", content: "InTask — Work, collaborate, and grow" },
      { property: "og:description", content: "Built for Nigerian students. Find paid tasks or hire verified students. Secure escrow payments." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "InTask" },
      { property: "og:locale", content: "en_NG" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@intask_ng" },
      { name: "twitter:title", content: "InTask — Work, collaborate, and grow" },
      { name: "twitter:description", content: "Built for Nigerian students. Find paid tasks or hire verified students. Secure escrow payments." },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "InTask",
          url: "https://intask.ng",
          logo: "https://intask.ng/intask-icon.svg",
          description: "InTask connects Nigerian university students with clients who need quality work done quickly. Verified students, secure escrow payments, fair outcomes.",
          sameAs: [],
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer service",
            email: "support@intask.ng",
            availableLanguage: "English",
          },
          areaServed: {
            "@type": "Country",
            name: "Nigeria",
          },
          makesOffer: {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Student Freelance Marketplace",
              description: "Connect with verified Nigerian university students for web design, content writing, research, tutoring, and more.",
            },
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "InTask",
          url: "https://intask.ng",
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: "https://intask.ng/app/browse?q={search_term_string}",
            },
            "query-input": "required name=search_term_string",
          },
        }),
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap",
      },
      // PWA: app manifest, install icons, and favicon.
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/svg+xml", href: "/intask-icon.svg" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const { supabaseUrl, supabaseKey } = getSupabaseClientConfig();
  const supabaseProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;

  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__INTASK_ENV__=${JSON.stringify({
              SUPABASE_URL: supabaseUrl,
              SUPABASE_PUBLISHABLE_KEY: supabaseKey,
              SUPABASE_PROJECT_ID: supabaseProjectId,
            })};`,
          }}
        />
        <script src="https://js.paystack.co/v2/inline.js" />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    if (!hasSupabaseClientConfig()) return;

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <InstallPwaButton />
      <PwaUpdatePrompt />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
