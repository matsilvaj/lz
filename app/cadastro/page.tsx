import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { FormSubmitButton } from "@/app/_components/form-submit-button";

import { signup } from "../auth/actions";
import { AuthPageShell } from "../auth/auth-page-shell";

type SignupPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const errorMessage = readParam(resolvedSearchParams.error);
  const successMessage = readParam(resolvedSearchParams.message);

  return (
    <AuthPageShell
      title="Cadastro"
      description="Crie sua conta com email e senha."
      errorMessage={errorMessage}
      successMessage={successMessage}
      footer={
        <p>
          Ja tem conta?{" "}
          <Link className="text-white underline-offset-4 hover:underline" href="/login">
            Entrar
          </Link>
        </p>
      }
    >
      <form className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white" htmlFor="firstName">
              Nome
            </label>
            <input
              className="lz-input w-full rounded-2xl px-4 py-3 text-sm"
              id="firstName"
              name="firstName"
              type="text"
              autoComplete="given-name"
              placeholder="Seu nome"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white" htmlFor="lastName">
              Sobrenome
            </label>
            <input
              className="lz-input w-full rounded-2xl px-4 py-3 text-sm"
              id="lastName"
              name="lastName"
              type="text"
              autoComplete="family-name"
              placeholder="Seu sobrenome"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-white" htmlFor="email">
            Email
          </label>
          <input
            className="lz-input w-full rounded-2xl px-4 py-3 text-sm"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-white" htmlFor="password">
            Senha
          </label>
          <input
            className="lz-input w-full rounded-2xl px-4 py-3 text-sm"
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo de 8 caracteres"
            minLength={8}
            required
          />
        </div>

        <FormSubmitButton
          className="lz-button-primary w-full rounded-2xl px-4 py-3 text-sm font-semibold"
          formAction={signup}
          pendingLabel="Criando conta..."
        >
          Cadastrar
        </FormSubmitButton>
      </form>
    </AuthPageShell>
  );
}
