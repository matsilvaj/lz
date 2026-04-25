import { requireUser } from "@/lib/auth/session";

import { PageHeader, SectionCard } from "../_components/ui";
import { getUserDisplayName } from "../user-display-name";

export default async function ProfilePage() {
  const user = await requireUser();
  const displayName = getUserDisplayName(user);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Perfil"
        description="Informacoes basicas da conta para manter o acesso organizado."
      />

      <SectionCard title="Conta">
        <dl className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <dt className="text-sm font-medium text-neutral-500">Nome</dt>
            <dd className="mt-2 text-base font-semibold text-neutral-950">{displayName}</dd>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <dt className="text-sm font-medium text-neutral-500">Email</dt>
            <dd className="mt-2 text-base font-semibold text-neutral-950">{user.email}</dd>
          </div>
        </dl>
      </SectionCard>
    </div>
  );
}
