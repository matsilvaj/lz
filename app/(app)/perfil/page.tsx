import { logout } from "@/app/auth/actions";
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
    <div className="space-y-4">
      {errorMessage ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Conta">
          <form action={updateAccountAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-800" htmlFor="firstName">
                  Nome
                </label>
                <input
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-950"
                  defaultValue={firstName}
                  id="firstName"
                  name="firstName"
                  placeholder="Seu nome"
                  type="text"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-800" htmlFor="lastName">
                  Sobrenome
                </label>
                <input
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-950"
                  defaultValue={lastName}
                  id="lastName"
                  name="lastName"
                  placeholder="Seu sobrenome"
                  type="text"
                />
              </div>
            </div>

            <button
              className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800"
              type="submit"
            >
              Salvar
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Email">
          <div className="space-y-4">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
              <p className="text-sm text-neutral-500">Email atual</p>
              <p className="mt-1 text-base font-semibold text-neutral-950">{user.email}</p>
            </div>

            <form action={updateEmailAction} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-800" htmlFor="email">
                  Novo email
                </label>
                <input
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-950"
                  id="email"
                  name="email"
                  placeholder="voce@empresa.com"
                  type="email"
                />
              </div>

              <button
                className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800"
                type="submit"
              >
                Salvar email
              </button>
            </form>
          </div>
        </SectionCard>

        <SectionCard title="Senha">
          <form action={updatePasswordAction} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-800" htmlFor="password">
                Nova senha
              </label>
              <input
                className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-950"
                id="password"
                minLength={8}
                name="password"
                placeholder="Minimo de 8 caracteres"
                type="password"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-800" htmlFor="confirmPassword">
                Confirmar nova senha
              </label>
              <input
                className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-950"
                id="confirmPassword"
                minLength={8}
                name="confirmPassword"
                placeholder="Repita a nova senha"
                type="password"
              />
            </div>

            <button
              className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800"
              type="submit"
            >
              Salvar senha
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Acesso">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 px-4 py-4">
              <div>
                <p className="text-sm font-medium text-neutral-900">Sair da conta</p>
              </div>

              <form action={logout}>
                <button
                  className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950"
                  type="submit"
                >
                  Sair
                </button>
              </form>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 px-4 py-4">
              <div>
                <p className="text-sm font-medium text-neutral-900">Deletar conta</p>
                <p className="mt-1 text-sm text-neutral-500">
                  Remove a conta e todos os dados vinculados.
                </p>
              </div>

              <DeleteAccountForm />
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-500">
        Algumas alteracoes podem exigir confirmacao por email antes de serem aplicadas.
      </div>
    </div>
  );
}
