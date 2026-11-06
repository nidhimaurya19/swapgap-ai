import type { Metadata } from "next";
import WorkspaceClient from "./workspace-client";
import "./workspace.css";

export const metadata: Metadata = {
  title: "Workspace | SwapGap AI",
  description: "Explore the SwapGap AI skill marketplace and create your first exchange listing.",
};

export default function WorkspacePage() {
  return <WorkspaceClient />;
}
