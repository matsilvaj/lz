"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { normalizeEmail, normalizeText } from "@/lib/security/input";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function buildProfileRedirect(key: "error" | "message", message: string) {
  return `/perfil?${key}=${encodeURIComponent(message)}`;
}

function parseText(value: FormDataEntryValue | null) {
  return normalizeText(value, 80);
}

function parseEmail(value: FormDataEntryValue | null) {
  return normalizeEmail(value);
}

async function verifyCurrentPassword(
  supabase: Awaited<ReturnType<typeof createClient>>,
  email: string | undefined,
  formData: FormData,
) {
  const currentPassword = String(formData.get("currentPassword") ?? "").slice(0, 512);

  if (!email || currentPassword.length < 8) {
    redirect(buildProfileRedirect("error", "Informe sua senha atual."));
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });

  if (error) {
    redirect(buildProfileRedirect("error", "Senha atual inválida."));
  }
}

function revalidateApplication() {
  const paths = ["/perfil", "/dashboard", "/procedimentos", "/freebets", "/bancas"];

  for (const path of paths) {
    revalidatePath(path);
  }
}

export async function updateAccountAction(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const canUpdate = await consumeRateLimit({
    identity: user.id,
    key: "profile:update",
    limit: 30,
    windowMs: 10 * 60_000,
  });
  const firstName = parseText(formData.get("firstName"));
  const lastName = parseText(formData.get("lastName"));

  if (!canUpdate) {
    redirect(buildProfileRedirect("error", "Muitas tentativas. Aguarde um pouco."));
  }

  if (!firstName || !lastName) {
    redirect(buildProfileRedirect("error", "Informe nome e sobrenome."));
  }

  const { error } = await supabase.auth.updateUser({
    data: {
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`,
    },
  });

  if (error) {
    redirect(buildProfileRedirect("error", error.message));
  }

  revalidateApplication();
  redirect(buildProfileRedirect("message", "Conta atualizada com sucesso."));
}

export async function updateEmailAction(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const canUpdate = await consumeRateLimit({
    identity: user.id,
    key: "profile:email",
    limit: 5,
    windowMs: 60 * 60_000,
  });
  const email = parseEmail(formData.get("email"));

  if (!canUpdate) {
    redirect(buildProfileRedirect("error", "Muitas tentativas. Aguarde um pouco."));
  }

  if (!email) {
    redirect(buildProfileRedirect("error", "Informe o novo e-mail."));
  }

  await verifyCurrentPassword(supabase, user.email, formData);

  const { error } = await supabase.auth.updateUser({ email });

  if (error) {
    redirect(buildProfileRedirect("error", error.message));
  }

  revalidateApplication();
  redirect(
    buildProfileRedirect(
      "message",
      "Solicitação enviada. Verifique seu e-mail para confirmar a alteração.",
    ),
  );
}

export async function updatePasswordAction(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const canUpdate = await consumeRateLimit({
    identity: user.id,
    key: "profile:password",
    limit: 5,
    windowMs: 60 * 60_000,
  });

  if (!canUpdate) {
    redirect(buildProfileRedirect("error", "Muitas tentativas. Aguarde um pouco."));
  }

  if (password.length < 8) {
    redirect(
      buildProfileRedirect("error", "A nova senha precisa ter pelo menos 8 caracteres."),
    );
  }

  if (password !== confirmPassword) {
    redirect(buildProfileRedirect("error", "As senhas não conferem."));
  }

  await verifyCurrentPassword(supabase, user.email, formData);

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(buildProfileRedirect("error", error.message));
  }

  revalidateApplication();
  redirect(buildProfileRedirect("message", "Senha atualizada com sucesso."));
}

export async function deleteAccountAction(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const canDelete = await consumeRateLimit({
    identity: user.id,
    key: "profile:delete",
    limit: 3,
    windowMs: 60 * 60_000,
  });

  if (!canDelete) {
    redirect(buildProfileRedirect("error", "Muitas tentativas. Aguarde um pouco."));
  }

  await verifyCurrentPassword(supabase, user.email, formData);

  let deletionError: string | null = null;

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);

    if (error) {
      deletionError = error.message;
    }
  } catch (error) {
    deletionError =
      error instanceof Error
        ? error.message
        : "Não foi possível excluir a conta neste momento.";

  }

  if (deletionError) {
    redirect(buildProfileRedirect("error", deletionError));
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login?message=Conta+exclu%C3%ADda+com+sucesso.");
}
