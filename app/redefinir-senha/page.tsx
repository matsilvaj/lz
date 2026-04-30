import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FormSubmitButton } from "@/app/_components/form-submit-button";
import { PasswordInput } from "@/app/_components/password-input";
import { PASSWORD_RECOVERY_COOKIE } from "@/lib/auth/password-recovery";
import { getCurrentUser } from "@/lib/auth/session";

import { updatePasswordFromRecovery } from "../auth/actions";
import { AuthPageShell } from "../auth/auth-page-shell";

type ResetPasswordPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildLoginRedirect(message: string) {
  return `/login?error=${encodeURIComponent(message)}`;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const user = await getCurrentUser();
  const cookieStore = await cookies();
  const hasRecoveryCookie = Boolean(
    cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value,
  );

  if (!user || !hasRecoveryCookie) {
    redirect(
      buildLoginRedirect(
        "O link de redefinição expirou ou é inválido. Solicite um novo e-mail.",
      ),
    );
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const errorMessage = readParam(resolvedSearchParams.error);
  const successMessage = readParam(resolvedSearchParams.message);

  return (
    <AuthPageShell
      title="Redefinir senha"
      description="Crie uma nova senha para recuperar o acesso à sua conta."
      errorMessage={errorMessage}
      successMessage={successMessage}
      footer={
        <p>
          Quer voltar agora?{" "}
          <Link className="text-white underline-offset-4 hover:underline" href="/login">
            Login
          </Link>
        </p>
      }
    >
      <form className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-white" htmlFor="password">
            Nova senha
          </label>
          <PasswordInput
            className="lz-input w-full rounded-2xl px-4 py-3 text-sm"
            id="password"
            name="password"
            autoComplete="new-password"
            placeholder="Mínimo de 8 caracteres"
            minLength={8}
            required
          />
        </div>

        <div className="space-y-2">
          <label
            className="text-sm font-medium text-white"
            htmlFor="confirmPassword"
          >
            Confirmar nova senha
          </label>
          <PasswordInput
            className="lz-input w-full rounded-2xl px-4 py-3 text-sm"
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Repita a nova senha"
            minLength={8}
            required
          />
        </div>

        <FormSubmitButton
          className="lz-button-primary w-full rounded-2xl px-4 py-3 text-sm font-semibold"
          formAction={updatePasswordFromRecovery}
          pendingLabel="Redefinindo..."
        >
          Redefinir senha
        </FormSubmitButton>
      </form>
    </AuthPageShell>
  );
}
