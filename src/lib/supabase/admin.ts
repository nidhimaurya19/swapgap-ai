import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase Admin Client using SUPABASE_SECRET_KEY
 * Used exclusively on authenticated server-side routes to persist payments.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error("Missing Supabase admin environment variables (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY).");
  }

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
