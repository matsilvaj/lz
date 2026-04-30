import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import {
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_COOKIE_MAX_AGE,
} from "@/lib/auth/password-recovery";
import { getSafeAppPath } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

function redirectAfterConfirmation(nextPath: string, requestUrl: string) {
  const response = NextResponse.redirect(new URL(nextPath, requestUrl));

  if (nextPath === "/redefinir-senha") {
    response.cookies.set(PASSWORD_RECOVERY_COOKIE, "1", {
      httpOnly: true,
      maxAge: PASSWORD_RECOVERY_COOKIE_MAX_AGE,
      path: "/redefinir-senha",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const nextPath = getSafeAppPath(requestUrl.searchParams.get("next"), "/dashboard");
  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return redirectAfterConfirmation(nextPath, request.url);
    }
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      return redirectAfterConfirmation(nextPath, request.url);
    }
  }

  return NextResponse.redirect(
    new URL(
      "/login?error=Não+foi+possível+confirmar+o+acesso.+Tente+novamente.",
      request.url,
    ),
  );
}
