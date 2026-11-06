"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error?: string;
  message?: string;
};

function credentialsFrom(formData: FormData): { email: string; password: string } | AuthState {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }

  if (password.length < 8) {
    return { error: "Your password must be at least 8 characters." };
  }

  return { email, password };
}

function isAuthState(value: { email: string; password: string } | AuthState): value is AuthState {
  return "error" in value || "message" in value;
}

export async function login(_previousState: AuthState, formData: FormData): Promise<AuthState> {
  const credentials = credentialsFrom(formData);
  if (isAuthState(credentials)) return credentials;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (error) {
    return {
      error: error.message === "Invalid login credentials"
        ? "Email or password is incorrect."
        : error.message,
    };
  }

  revalidatePath("/", "layout");
  redirect("/workspace");
}

export async function signup(_previousState: AuthState, formData: FormData): Promise<AuthState> {
  const credentials = credentialsFrom(formData);
  if (isAuthState(credentials)) return credentials;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp(credentials);

  if (error) return { error: error.message };

  return {
    message: "Check your inbox to confirm your email, then return here to sign in.",
  };
}

export async function signOut() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    await supabase.auth.signOut();
  }

  revalidatePath("/", "layout");
  redirect("/login");
}
