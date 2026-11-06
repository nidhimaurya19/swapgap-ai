import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WorkspaceClient from "./workspace-client";
import "./workspace.css";

export const metadata: Metadata = {
  title: "Workspace | SwapGap AI",
  description: "Explore the SwapGap AI skill marketplace and create your first exchange listing.",
};

export const instant = false;
export default async function WorkspacePage() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/login");
  }

  return <WorkspaceClient />;
}
