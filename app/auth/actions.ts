"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { PASSWORD_RECOVERY_COOKIE } from "@/lib/auth/password-recovery";
import { getAppUrl } from "@/lib/auth/urls";
import { normalizeEmail, normalizeText } from "@/lib/security/input";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const ACCOUNT_ALREADY_EXISTS_MESSAGE = "Já existe uma conta com este e-mail. Entre para acessar.";
const PASSWORD_RESET_REQUEST_MESSAGE =
  "Se houver uma conta com este e-mail, enviaremos instruções para redefinir sua senha.";

function buildAuthRedirect(path: string, key: "error" | "message", message: string) {
  return `${path}?${key}=${encodeURIComponent(message)}`;
}

function isAlreadyRegisteredError(error: { code?: string; message?: string }) {
  const message = String(error.message ?? "").trim();
  const code = String(error.code ?? "").trim().toLowerCase();
  const normalizedMessage = message.toLowerCase();

  return (
    code === "email_exists" ||
    code === "user_already_exists" ||
    normalizedMessage.includes("already registered") ||
    normalizedMessage.includes("already exists") ||
    normalizedMessage.includes("user already") ||
    normalizedMessage.includes("email exists")
  );
}

function getSignupErrorMessage(error: { code?: string; message?: string }) {
  const message = String(error.message ?? "").trim();
  const normalizedMessage = message.toLowerCase();

  if (isAlreadyRegisteredError(error)) {
    return ACCOUNT_ALREADY_EXISTS_MESSAGE;
  }

  if (
    normalizedMessage.includes("smtp") ||
    normalizedMessage.includes("send") ||
    normalizedMessage.includes("email")
  ) {
    return "Não foi possível enviar o e-mail de confirmação. Verifique as configurações de SMTP no Supabase.";
  }

  if (process.env.NODE_ENV !== "production" && message) {
    return `Supabase: ${message}`;
  }

  return "Não foi possível criar a conta.";
}

function getPasswordResetErrorMessage(error: { message?: string }) {
  const message = String(error.message ?? "").trim();
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("smtp") ||
    normalizedMessage.includes("send") ||
    normalizedMessage.includes("email")
  ) {
    return "Não foi possível enviar o e-mail de redefinição. Verifique as configurações de SMTP no Supabase.";
  }

  if (process.env.NODE_ENV !== "production" && message) {
    return `Supabase: ${message}`;
  }

  return "Não foi possível solicitar a redefinição de senha.";
}

function getPasswordUpdateErrorMessage(error: { message?: string }) {
  const message = String(error.message ?? "").trim();

  if (process.env.NODE_ENV !== "production" && message) {
    return `Supabase: ${message}`;
  }

  return "Não foi possível redefinir a senha. Solicite um novo e-mail e tente novamente.";
}

function isExistingAccountSignup(data: {
  user: { identities?: unknown[] | null } | null;
  session: unknown | null;
}) {
  return Boolean(
    data.user &&
      !data.session &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0,
  );
}

async function authEmailAlreadyExists(email: string) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return false;
  }

  try {
    const admin = createAdminClient();
    const perPage = 1000;
    let page = 1;

    while (page > 0) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        console.error("Supabase user lookup error", {
          message: error.message,
          name: error.name,
          status: error.status,
        });

        return false;
      }

      if (
        data.users.some((user) => normalizeEmail(user.email ?? "") === email)
      ) {
        return true;
      }

      if (!data.nextPage || data.users.length < perPage) {
        return false;
      }

      page = data.nextPage;
    }
  } catch (error) {
    console.error("Supabase user lookup failed", error);
  }

  return false;
}

function normalizeName(value: FormDataEntryValue | null) {
  return normalizeText(value, 80);
}

function getCredentials(formData: FormData, errorPath: string) {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "").slice(0, 512);

  if (!email || !password) {
    redirect(buildAuthRedirect(errorPath, "error", "Informe e-mail e senha."));
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

function getPasswordResetEmail(formData: FormData) {
  const email = normalizeEmail(formData.get("email"));

  if (!email) {
    redirect(
      buildAuthRedirect(
        "/esqueci-a-senha",
        "error",
        "Informe seu e-mail para redefinir a senha.",
      ),
    );
  }

  return email;
}

function getNewPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "").slice(0, 512);
  const confirmPassword = String(formData.get("confirmPassword") ?? "").slice(0, 512);

  if (!password || !confirmPassword) {
    redirect(
      buildAuthRedirect(
        "/redefinir-senha",
        "error",
        "Informe a nova senha e a confirmação.",
      ),
    );
  }

  if (password.length < 8) {
    redirect(
      buildAuthRedirect(
        "/redefinir-senha",
        "error",
        "A senha precisa ter pelo menos 8 caracteres.",
      ),
    );
  }

  if (password !== confirmPassword) {
    redirect(
      buildAuthRedirect(
        "/redefinir-senha",
        "error",
        "A confirmação precisa ser igual à nova senha.",
      ),
    );
  }

  return password;
}

async function hasPasswordRecoveryCookie() {
  const cookieStore = await cookies();
  return Boolean(cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value);
}

async function clearPasswordRecoveryCookie() {
  const cookieStore = await cookies();
  cookieStore.set(PASSWORD_RECOVERY_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/redefinir-senha",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
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
    redirect(buildAuthRedirect("/login", "error", "E-mail ou senha inválidos."));
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

  if (await authEmailAlreadyExists(credentials.email)) {
    redirect(buildAuthRedirect("/cadastro", "error", ACCOUNT_ALREADY_EXISTS_MESSAGE));
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
    console.error("Supabase signup error", {
      message: error.message,
      name: error.name,
      status: error.status,
    });
    redirect(buildAuthRedirect("/cadastro", "error", getSignupErrorMessage(error)));
  }

  if (isExistingAccountSignup(data)) {
    redirect(buildAuthRedirect("/cadastro", "error", ACCOUNT_ALREADY_EXISTS_MESSAGE));
  }

  revalidatePath("/", "layout");

  if (data.session) {
    redirect("/dashboard");
  }

  redirect(
    buildAuthRedirect(
      "/cadastro",
      "message",
      "Conta criada. Verifique seu e-mail para confirmar o acesso.",
    ),
  );
}

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  const email = getPasswordResetEmail(formData);
  const appUrl = await getAppUrl();
  const canRequestIp = await consumeRateLimit({
    key: "auth:password-reset:ip",
    limit: 8,
    windowMs: 60 * 60_000,
  });
  const canRequestEmail = await consumeRateLimit({
    identity: email,
    key: "auth:password-reset:email",
    limit: 3,
    windowMs: 60 * 60_000,
  });

  if (!canRequestIp || !canRequestEmail) {
    redirect(
      buildAuthRedirect(
        "/esqueci-a-senha",
        "error",
        "Muitas tentativas. Aguarde um pouco.",
      ),
    );
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/confirm?next=/redefinir-senha`,
  });

  if (error) {
    console.error("Supabase password reset request error", {
      message: error.message,
      name: error.name,
      status: error.status,
    });
    redirect(
      buildAuthRedirect(
        "/esqueci-a-senha",
        "error",
        getPasswordResetErrorMessage(error),
      ),
    );
  }

  redirect(buildAuthRedirect("/login", "message", PASSWORD_RESET_REQUEST_MESSAGE));
}

export async function updatePasswordFromRecovery(formData: FormData) {
  const supabase = await createClient();
  const password = getNewPassword(formData);
  const canUpdatePassword = await consumeRateLimit({
    key: "auth:password-update:ip",
    limit: 10,
    windowMs: 15 * 60_000,
  });

  if (!canUpdatePassword) {
    redirect(
      buildAuthRedirect(
        "/redefinir-senha",
        "error",
        "Muitas tentativas. Aguarde um pouco.",
      ),
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(
      buildAuthRedirect(
        "/login",
        "error",
        "O link de redefinição expirou ou é inválido. Solicite um novo e-mail.",
      ),
    );
  }

  if (!(await hasPasswordRecoveryCookie())) {
    redirect(
      buildAuthRedirect(
        "/login",
        "error",
        "Acesse o link enviado por e-mail para redefinir sua senha.",
      ),
    );
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("Supabase password update error", {
      message: error.message,
      name: error.name,
      status: error.status,
    });
    redirect(
      buildAuthRedirect(
        "/redefinir-senha",
        "error",
        getPasswordUpdateErrorMessage(error),
      ),
    );
  }

  await clearPasswordRecoveryCookie();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(
    buildAuthRedirect(
      "/login",
      "message",
      "Senha redefinida com sucesso. Entre com sua nova senha.",
    ),
  );
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/login");
}
