import Link from "next/link";
import { redirect } from "next/navigation";

import { FormSubmitButton } from "@/app/_components/form-submit-button";
import { getCurrentUser } from "@/lib/auth/session";

import { requestPasswordReset } from "../auth/actions";
import { AuthPageShell } from "../auth/auth-page-shell";

type ForgotPasswordPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const errorMessage = readParam(resolvedSearchParams.error);
  const successMessage = readParam(resolvedSearchParams.message);

  return (
    <AuthPageShell
      title="Esqueceu a senha?"
      description="Informe seu e-mail para receber as instruções de redefinição."
      errorMessage={errorMessage}
      successMessage={successMessage}
      footer={
        <p>
          Lembrou a senha?{" "}
          <Link className="text-white underline-offset-4 hover:underline" href="/login">
            Entrar
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

        <FormSubmitButton
          className="lz-button-primary w-full rounded-2xl px-4 py-3 text-sm font-semibold"
          formAction={requestPasswordReset}
          pendingLabel="Enviando..."
        >
          Enviar instruções
        </FormSubmitButton>
      </form>
    </AuthPageShell>
  );
}
