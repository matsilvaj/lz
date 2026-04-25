import { requireWorkspaceContext } from "@/lib/auth/workspace-context";

import { createWorkspaceAction } from "./actions";
import { WorkspaceList } from "./workspace-list";

export default async function WorkspacesPage() {
  const { activeWorkspace, workspaces } = await requireWorkspaceContext();

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <form action={createWorkspaceAction} className="flex flex-col gap-3 md:flex-row">
          <input
            className="flex-1 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-950 outline-none transition focus:border-neutral-950"
            name="name"
            placeholder="Criar novo workspace"
            type="text"
          />
          <button
            className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800"
            type="submit"
          >
            Criar workspace
          </button>
        </form>
      </section>

      <WorkspaceList activeWorkspaceId={activeWorkspace.id} workspaces={workspaces} />
    </div>
  );
}
