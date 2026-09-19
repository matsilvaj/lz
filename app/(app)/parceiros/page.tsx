import { UserPlus } from "lucide-react";

import { FormSubmitButton } from "@/app/_components/form-submit-button";
import { requireUser } from "@/lib/auth/session";
import { getProceduresRepository } from "@/lib/server";
import { PARTNER_NAME_MAX_LENGTH } from "@/core/domain/shared/partner-name.js";

import { createPartnerAction } from "./actions";
import { PartnerList, type PartnerItem } from "./partner-list";

export default async function PartnersPage() {
  const user = await requireUser();
  const partners = (await getProceduresRepository().listPartners(user.id)) as PartnerItem[];

  return (
    <div className="space-y-5">
      <section className="lz-panel rounded-[30px] p-4 md:p-5">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-white">Parceiros</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Cadastre as pessoas donas das casas que você opera. Casa sem parceiro é sua.
          </p>
        </div>
        <form action={createPartnerAction} className="flex flex-col gap-3 md:flex-row">
          <input
            aria-label="Nome do parceiro"
            className="lz-input flex-1 rounded-2xl px-4 py-3 text-sm"
            maxLength={PARTNER_NAME_MAX_LENGTH}
            name="name"
            placeholder="Nome do parceiro"
            required
            type="text"
          />
          <FormSubmitButton
            className="lz-button-primary rounded-full px-4 py-3 text-sm font-semibold"
            pendingLabel="Adicionando..."
          >
            <UserPlus aria-hidden="true" className="h-4 w-4" />
            <span>Adicionar parceiro</span>
          </FormSubmitButton>
        </form>
      </section>

      <PartnerList partners={partners} />
    </div>
  );
}
