import { redirect } from "next/navigation";

// A tela de workspaces foi substituída por Parceiros.
export default function WorkspacesPage() {
  redirect("/parceiros");
}
