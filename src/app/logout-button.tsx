"use client";

import { useFormStatus } from "react-dom";
import { signOut } from "./auth/actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return <button className="ws-btn ws-btn-secondary ws-logout" type="submit" disabled={pending}>{pending ? "Signing out…" : "Log out"}</button>;
}

export function LogoutButton() {
  return <form action={signOut}><SubmitButton /></form>;
}
