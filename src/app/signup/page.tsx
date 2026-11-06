import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "../theme-toggle";
import { AuthForm } from "../auth-form";
import styles from "../auth.module.css";

export const metadata: Metadata = {
  title: "Create account | SwapGap AI",
  description: "Create a SwapGap AI account to access the skill exchange workspace.",
};

export default function SignupPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="SwapGap AI home"><span className={styles.mark}>↔</span>swapgap<span>.ai</span></Link>
        <ThemeToggle />
      </header>
      <section className={styles.shell}>
        <div className={styles.story}><p className={styles.eyebrow}>START YOUR EXCHANGE</p><h1>Bring your best skill to the table.</h1><p>Create your account, confirm your email, and begin exploring what a fair exchange could unlock.</p><div className={styles.orbit} aria-hidden="true"><span>YOU OFFER</span><b>Your expertise</b><i>↔</i><span>YOU RECEIVE</span><b>New possibilities</b></div></div>
        <div className={styles.card}><p className={styles.eyebrow}>JOIN SWAPGAP AI</p><h2>Create account</h2><p className={styles.intro}>We’ll send a confirmation link before you can sign in.</p><AuthForm mode="signup" /></div>
      </section>
    </main>
  );
}
