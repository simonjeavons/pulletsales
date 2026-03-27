import {
  createRootRouteWithContext,
  Outlet,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import appCss from "~/styles/app.css?url";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

export const Route = createRootRouteWithContext()({
  component: RootComponent,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lloyds Pullet Sales" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" as any },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
});

function RootComponent() {
  // Detect Supabase auth redirects with hash tokens and route to correct page
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash || !hash.includes("access_token")) return;

    const hashParams = new URLSearchParams(hash.substring(1));
    const type = hashParams.get("type");
    const currentPath = window.location.pathname;

    // Only redirect if we're NOT already on the right auth page
    if (type === "recovery" && currentPath !== "/auth/reset-password") {
      window.location.href = `/auth/reset-password${hash}`;
    } else if (type === "invite" && currentPath !== "/auth/set-password") {
      window.location.href = `/auth/set-password${hash}`;
    } else if (type === "magiclink" && currentPath !== "/auth/set-password") {
      window.location.href = `/auth/set-password${hash}`;
    }
  }, []);

  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <Outlet />
      </QueryClientProvider>
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
