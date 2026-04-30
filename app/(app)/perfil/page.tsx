import { logout } from "@/app/auth/actions";
import { ClearMessageSearchParams } from "@/app/_components/clear-message-search-params";
import { FormSubmitButton } from "@/app/_components/form-submit-button";
import { PasswordInput } from "@/app/_components/password-input";
import { requireUser } from "@/lib/auth/session";

import { SectionCard } from "../_components/ui";
import { DeleteAccountForm } from "./delete-account-form";
import {
  updateAccountAction,
  updateEmailAction,
  updatePasswordAction,
} from "./actions";

type ProfilePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getProfileNames(user: Awaited<ReturnType<typeof requireUser>>) {
  const firstName = String(user.user_metadata?.first_name ?? "").trim();
  const lastName = String(user.user_metadata?.last_name ?? "").trim();
  const fullName = String(user.user_metadata?.full_name ?? "").trim();

  if (firstName || lastName) {
    return { firstName, lastName };
  }

  if (fullName) {
    const [derivedFirstName = "", ...rest] = fullName.split(/\s+/);

    return {
      firstName: derivedFirstName,
      lastName: rest.join(" "),
    };
  }

  return {
    firstName: "",
    lastName: "",
  };
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const user = await requireUser();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const errorMessage = readParam(resolvedSearchParams.error);
  const successMessage = readParam(resolvedSearchParams.message);
  const { firstName, lastName } = getProfileNames(user);

  return (
    <div className="space-y-5">
      {errorMessage || successMessage ? <ClearMessageSearchParams /> : null}

      {errorMessage ? (
        <p className="rounded-[24px] border border-[rgba(255,107,133,0.24)] bg-[rgba(41,13,21,0.94)] px-4 py-3 text-sm text-[var(--negative)]">
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p className="rounded-[24px] border border-[rgba(73,212,166,0.24)] bg-[rgba(13,34,27,0.92)] px-4 py-3 text-sm text-[var(--positive)]">
          {successMessage}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Conta">
          <form action={updateAccountAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white" htmlFor="firstName">
                  Nome
                </label>
                <input
                  className="lz-input w-full rounded-2xl px-3 py-3 text-sm"
                  defaultValue={firstName}
                  id="firstName"
                  name="firstName"
                  placeholder="Seu nome"
                  type="text"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white" htmlFor="lastName">
                  Sobrenome
                </label>
                <input
                  className="lz-input w-full rounded-2xl px-3 py-3 text-sm"
                  defaultValue={lastName}
                  id="lastName"
                  name="lastName"
                  placeholder="Seu sobrenome"
                  type="text"
                />
              </div>
            </div>

            <FormSubmitButton
              className="lz-button-primary rounded-full px-4 py-3 text-sm font-semibold"
              pendingLabel="Salvando..."
            >
              Salvar
            </FormSubmitButton>
          </form>
        </SectionCard>

        <SectionCard title="E-mail">
          <div className="space-y-4">
            <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-sm text-[var(--text-dim)]">E-mail atual</p>
              <p className="mt-1 text-base font-semibold text-white">{user.email}</p>
            </div>

            <form action={updateEmailAction} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white" htmlFor="email">
                  Novo e-mail
                </label>
                <input
                  className="lz-input w-full rounded-2xl px-3 py-3 text-sm"
                  id="email"
                  name="email"
                  placeholder="Seu novo e-mail"
                  type="email"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white" htmlFor="emailCurrentPassword">
                  Senha atual
                </label>
                <PasswordInput
                  className="lz-input w-full rounded-2xl px-3 py-3 text-sm"
                  id="emailCurrentPassword"
                  minLength={8}
                  name="currentPassword"
                  placeholder="Confirme sua senha"
                  required
                />
              </div>

              <FormSubmitButton
                className="lz-button-primary rounded-full px-4 py-3 text-sm font-semibold"
                pendingLabel="Salvando..."
              >
                Salvar e-mail
              </FormSubmitButton>
            </form>
          </div>
        </SectionCard>

        <SectionCard title="Senha">
          <form action={updatePasswordAction} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white" htmlFor="currentPassword">
                Senha atual
              </label>
              <PasswordInput
                className="lz-input w-full rounded-2xl px-3 py-3 text-sm"
                id="currentPassword"
                minLength={8}
                name="currentPassword"
                placeholder="Sua senha atual"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white" htmlFor="password">
                Nova senha
              </label>
              <PasswordInput
                className="lz-input w-full rounded-2xl px-3 py-3 text-sm"
                id="password"
                minLength={8}
                name="password"
                placeholder="Mínimo de 8 caracteres"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white" htmlFor="confirmPassword">
                Confirmar nova senha
              </label>
              <PasswordInput
                className="lz-input w-full rounded-2xl px-3 py-3 text-sm"
                id="confirmPassword"
                minLength={8}
                name="confirmPassword"
                placeholder="Repita a nova senha"
                required
              />
            </div>

            <FormSubmitButton
              className="lz-button-primary rounded-full px-4 py-3 text-sm font-semibold"
              pendingLabel="Salvando..."
            >
              Salvar senha
            </FormSubmitButton>
          </form>
        </SectionCard>

        <SectionCard title="Acesso">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-white/4 px-4 py-4">
              <div>
                <p className="text-sm font-medium text-white">Sair da conta</p>
              </div>

              <form action={logout}>
                <FormSubmitButton
                  className="lz-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold"
                  pendingLabel="Saindo..."
                >
                  Sair
                </FormSubmitButton>
              </form>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-white/4 px-4 py-4">
              <div>
                <p className="text-sm font-medium text-white">Deletar conta</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Remove a conta e todos os dados vinculados.
                </p>
              </div>

              <DeleteAccountForm />
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-white/4 px-4 py-3 text-sm text-[var(--text-muted)]">
        Algumas alterações podem exigir confirmação por e-mail antes de serem aplicadas.
      </div>
    </div>
  );
}
