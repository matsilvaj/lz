import { requireWorkspaceContext } from "@/lib/auth/workspace-context";
import { FormSubmitButton } from "@/app/_components/form-submit-button";

import { createWorkspaceAction } from "./actions";
import { WorkspaceList } from "./workspace-list";

export default async function WorkspacesPage() {
  const { activeWorkspace, workspaces } = await requireWorkspaceContext();

  return (
    <div className="space-y-5">
      <section className="lz-panel rounded-[30px] p-4">
        <form action={createWorkspaceAction} className="flex flex-col gap-3 md:flex-row">
          <input
            className="lz-input flex-1 rounded-2xl px-4 py-3 text-sm"
            name="name"
            placeholder="Criar novo workspace"
            type="text"
          />
          <FormSubmitButton
            className="lz-button-primary rounded-full px-4 py-3 text-sm font-semibold"
            pendingLabel="Criando..."
          >
            Criar workspace
          </FormSubmitButton>
        </form>
      </section>

      <WorkspaceList activeWorkspaceId={activeWorkspace.id} workspaces={workspaces} />
    </div>
  );
}
