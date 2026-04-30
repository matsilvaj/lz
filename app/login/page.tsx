import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { FormSubmitButton } from "@/app/_components/form-submit-button";
import { PasswordInput } from "@/app/_components/password-input";

import { login } from "../auth/actions";
import { AuthPageShell } from "../auth/auth-page-shell";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const errorMessage = readParam(resolvedSearchParams.error);
  const successMessage = readParam(resolvedSearchParams.message);

  return (
    <AuthPageShell
      title="Login"
      description="Entre com seu e-mail e senha."
      errorMessage={errorMessage}
      successMessage={successMessage}
      footer={
        <p>
          Ainda não tem conta?{" "}
          <Link
            className="text-white underline-offset-4 hover:underline"
            href="/cadastro"
          >
            Cadastrar
          </Link>
        </p>
      }
    >
      <form className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-white" htmlFor="email">
            E-mail
          </label>
          <input
            className="lz-input w-full rounded-2xl px-4 py-3 text-sm"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Seu e-mail"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-white" htmlFor="password">
            Senha
          </label>
          <PasswordInput
            className="lz-input w-full rounded-2xl px-4 py-3 text-sm"
            id="password"
            name="password"
            autoComplete="current-password"
            placeholder="Mínimo de 8 caracteres"
            required
            minLength={8}
          />
        </div>

        <FormSubmitButton
          className="lz-button-primary w-full rounded-2xl px-4 py-3 text-sm font-semibold"
          formAction={login}
          pendingLabel="Entrando..."
        >
          Entrar
        </FormSubmitButton>
      </form>
    </AuthPageShell>
  );
}
