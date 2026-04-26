"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function buildProfileRedirect(key: "error" | "message", message: string) {
  return `/perfil?${key}=${encodeURIComponent(message)}`;
}

function parseText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function parseEmail(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toLowerCase();
}

function revalidateApplication() {
  const paths = ["/perfil", "/dashboard", "/procedimentos", "/freebets", "/bancas"];

  for (const path of paths) {
    revalidatePath(path);
  }
}

export async function updateAccountAction(formData: FormData) {
  const supabase = await createClient();
  const firstName = parseText(formData.get("firstName"));
  const lastName = parseText(formData.get("lastName"));

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
  const supabase = await createClient();
  const email = parseEmail(formData.get("email"));

  if (!email) {
    redirect(buildProfileRedirect("error", "Informe o novo email."));
  }

  const { error } = await supabase.auth.updateUser({ email });

  if (error) {
    redirect(buildProfileRedirect("error", error.message));
  }

  revalidateApplication();
  redirect(
    buildProfileRedirect(
      "message",
      "Solicitação enviada. Verifique seu email para confirmar a alteração.",
    ),
  );
}

export async function updatePasswordAction(formData: FormData) {
  const supabase = await createClient();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    redirect(
      buildProfileRedirect("error", "A nova senha precisa ter pelo menos 8 caracteres."),
    );
  }

  if (password !== confirmPassword) {
    redirect(buildProfileRedirect("error", "As senhas nao conferem."));
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(buildProfileRedirect("error", error.message));
  }

  revalidateApplication();
  redirect(buildProfileRedirect("message", "Senha atualizada com sucesso."));
}

export async function deleteAccountAction() {
  const user = await requireUser();
  const supabase = await createClient();

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);

    if (error) {
      redirect(buildProfileRedirect("error", error.message));
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nao foi possível excluir a conta neste momento.";

    redirect(buildProfileRedirect("error", message));
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login?message=Conta+excluida+com+sucesso.");
}
