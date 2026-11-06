import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "../theme-toggle";
import { AuthForm } from "../auth-form";
import styles from "../auth.module.css";

export const metadata: Metadata = {
  title: "Sign in | SwapGap AI",
  description: "Sign in to your SwapGap AI workspace.",
};

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="SwapGap AI home"><span className={styles.mark}>↔</span>swapgap<span>.ai</span></Link>
        <ThemeToggle />
      </header>
      <section className={styles.shell}>
        <div className={styles.story}><p className={styles.eyebrow}>WELCOME BACK</p><h1>Pick up the exchange.</h1><p>Return to the skills, ideas, and possibilities waiting in your workspace.</p><div className={styles.orbit} aria-hidden="true"><span>YOU OFFER</span><b>What you know</b><i>↔</i><span>YOU DISCOVER</span><b>What moves you forward</b></div></div>
        <div className={styles.card}><p className={styles.eyebrow}>YOUR SPACE</p><h2>Sign in</h2><p className={styles.intro}>Use your email and password to continue.</p><AuthForm mode="login" /></div>
      </section>
    </main>
  );
}
