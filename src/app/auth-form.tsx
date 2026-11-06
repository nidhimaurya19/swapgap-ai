"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup, type AuthState } from "./auth/actions";
import styles from "./auth.module.css";

const initialState: AuthState = {};

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const isSignup = mode === "signup";
  const [state, formAction, pending] = useActionState(isSignup ? signup : login, initialState);

  return (
    <form className={styles.form} action={formAction}>
      <div className={styles.field}>
        <label htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
      </div>
      <div className={styles.field}>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} minLength={8} placeholder="At least 8 characters" required />
      </div>

      {state.error && <p className={styles.error} role="alert">{state.error}</p>}
      {state.message && <p className={styles.message} role="status">{state.message}</p>}

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? (isSignup ? "Creating account…" : "Signing in…") : (isSignup ? "Create account" : "Sign in to SwapGap")}
      </button>

      <p className={styles.switch}>
        {isSignup ? "Already have an account?" : "New to SwapGap?"}{" "}
        <Link href={isSignup ? "/login" : "/signup"}>{isSignup ? "Sign in" : "Create an account"}</Link>
      </p>
    </form>
  );
}
