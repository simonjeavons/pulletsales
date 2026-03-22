import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// These are public keys — safe to inline. They're also available via VITE_ env vars on the client.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

/**
 * Create a Supabase client for server-side use with cookie-based auth.
 * Pass the request headers so cookies flow through.
 */
export function getSupabaseServerClient(request: Request) {
  const headers = new Headers();

  const supabase = createServerClient(
    SUPABASE_URL!,
    SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get("Cookie") ?? "");
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            headers.append(
              "Set-Cookie",
              serializeCookieHeader(name, value, options)
            );
          });
        },
      },
    }
  );

  return { supabase, headers };
}

/**
 * Admin client using service role key — use only on the server for
 * privileged operations like creating auth users, sending invites, etc.
 */
export function getSupabaseAdminClient() {
  return createClient(
    SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
