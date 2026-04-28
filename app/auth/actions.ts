"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAppUrl } from "@/lib/auth/urls";
import { normalizeEmail, normalizeText } from "@/lib/security/input";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

function buildAuthRedirect(path: string, key: "error" | "message", message: string) {
  return `${path}?${key}=${encodeURIComponent(message)}`;
}

function normalizeName(value: FormDataEntryValue | null) {
  return normalizeText(value, 80);
}

function getCredentials(formData: FormData, errorPath: string) {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "").slice(0, 512);

  if (!email || !password) {
    redirect(buildAuthRedirect(errorPath, "error", "Informe email e senha."));
  }

  if (password.length < 8) {
    redirect(
      buildAuthRedirect(
        errorPath,
        "error",
        "A senha precisa ter pelo menos 8 caracteres.",
      ),
    );
  }

  return { email, password };
}

function getSignupProfile(formData: FormData) {
  const firstName = normalizeName(formData.get("firstName"));
  const lastName = normalizeName(formData.get("lastName"));

  if (!firstName || !lastName) {
    redirect(buildAuthRedirect("/cadastro", "error", "Informe nome e sobrenome."));
  }

  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
  };
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const credentials = getCredentials(formData, "/login");
  const canTryIp = await consumeRateLimit({
    key: "auth:login:ip",
    limit: 20,
    windowMs: 15 * 60_000,
  });
  const canTryEmail = await consumeRateLimit({
    identity: credentials.email,
    key: "auth:login:email",
    limit: 8,
    windowMs: 15 * 60_000,
  });

  if (!canTryIp || !canTryEmail) {
    redirect(buildAuthRedirect("/login", "error", "Muitas tentativas. Aguarde um pouco."));
  }

  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (error) {
    redirect(buildAuthRedirect("/login", "error", "Email ou senha inválidos."));
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const credentials = getCredentials(formData, "/cadastro");
  const profile = getSignupProfile(formData);
  const appUrl = await getAppUrl();
  const canSignupIp = await consumeRateLimit({
    key: "auth:signup:ip",
    limit: 6,
    windowMs: 60 * 60_000,
  });
  const canSignupEmail = await consumeRateLimit({
    identity: credentials.email,
    key: "auth:signup:email",
    limit: 3,
    windowMs: 60 * 60_000,
  });

  if (!canSignupIp || !canSignupEmail) {
    redirect(buildAuthRedirect("/cadastro", "error", "Muitas tentativas. Aguarde um pouco."));
  }

  const { data, error } = await supabase.auth.signUp({
    ...credentials,
    options: {
      emailRedirectTo: `${appUrl}/auth/confirm?next=/dashboard`,
      data: {
        first_name: profile.firstName,
        last_name: profile.lastName,
        full_name: profile.fullName,
      },
    },
  });

  if (error) {
    redirect(buildAuthRedirect("/cadastro", "error", "Nao foi possivel criar a conta."));
  }

  revalidatePath("/", "layout");

  if (data.session) {
    redirect("/dashboard");
  }

  redirect(
    buildAuthRedirect(
      "/cadastro",
      "message",
      "Conta criada. Verifique seu email para confirmar o acesso.",
    ),
  );
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/login");
}
