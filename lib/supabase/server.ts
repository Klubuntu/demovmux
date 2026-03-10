import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Use in Server Components, Route Handlers, and Server Actions.
 * Always create a new client per request – do NOT store in a module-level variable
 * (especially important with Vercel Fluid compute).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component – safe to ignore when using
            // the proxy pattern for session refresh (no auth in this app).
          }
        },
      },
    },
  );
}
