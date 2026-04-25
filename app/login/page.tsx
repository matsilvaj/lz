import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";

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
      description="Entre com seu email e senha."
      errorMessage={errorMessage}
      successMessage={successMessage}
      footer={
        <p>
          Ainda nao tem conta?{" "}
          <Link
            className="text-neutral-950 underline-offset-4 hover:underline"
            href="/cadastro"
          >
            Cadastrar
          </Link>
        </p>
      }
    >
      <form className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-800" htmlFor="email">
            Email
          </label>
          <input
            className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-950"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-800" htmlFor="password">
            Senha
          </label>
          <input
            className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-950"
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Minimo de 8 caracteres"
            required
            minLength={8}
          />
        </div>

        <button
          className="w-full rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800"
          formAction={login}
        >
          Entrar
        </button>
      </form>
    </AuthPageShell>
  );
}
