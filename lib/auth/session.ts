import "server-only";

import { type User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getProceduresRepository } from "@/lib/server";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type AuthSessionIdentity = {
  sessionId: string;
  supabase: SupabaseServerClient;
  user: User;
};

async function readAuthenticatedSession(
  supabase: SupabaseServerClient,
): Promise<AuthSessionIdentity | null> {
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const sessionId = String(claims?.session_id ?? "").trim();
  const subject = String(claims?.sub ?? "").trim();

  if (claimsError || !sessionId || !subject) {
    return null;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || user.id !== subject) {
    return null;
  }

  return {
    sessionId,
    supabase,
    user,
  };
}

async function signOutLocalSession(supabase: SupabaseServerClient) {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Server Components cannot always persist cookie mutations; the auth guard still fails closed.
  }
}

export const getCurrentAuthUser = cache(async function getCurrentAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});

export const getCurrentActiveSession = cache(async function getCurrentActiveSession() {
  const supabase = await createClient();
  const authenticatedSession = await readAuthenticatedSession(supabase);

  if (!authenticatedSession) {
    return null;
  }

  const repository = getProceduresRepository();
  const isActive = await repository.isActiveUserSession(
    authenticatedSession.user.id,
    authenticatedSession.sessionId,
  );

  if (!isActive) {
    await signOutLocalSession(supabase);
    return null;
  }

  return authenticatedSession;
});

export const getCurrentUser = cache(async function getCurrentUser() {
  return (await getCurrentActiveSession())?.user ?? null;
});

export const requireUser = cache(async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
});

export async function authorizeActiveApiUser() {
  const activeSession = await getCurrentActiveSession();

  if (!activeSession) {
    return {
      response: Response.json({ error: "unauthorized" }, { status: 401 }),
      user: null,
    };
  }

  return {
    response: null,
    user: activeSession.user,
  };
}

export async function registerActiveSessionFromAccessToken(
  supabase: SupabaseServerClient,
  userId: string,
  accessToken: string | undefined,
) {
  if (!accessToken) {
    return false;
  }

  const { data, error } = await supabase.auth.getClaims(accessToken);
  const sessionId = String(data?.claims?.session_id ?? "").trim();

  if (error || !sessionId) {
    return false;
  }

  const repository = getProceduresRepository();
  await repository.setActiveUserSession(userId, sessionId);

  return true;
}

export async function clearCurrentActiveSession(supabase: SupabaseServerClient) {
  const authenticatedSession = await readAuthenticatedSession(supabase);

  if (!authenticatedSession) {
    return;
  }

  const repository = getProceduresRepository();
  await repository.clearActiveUserSession(
    authenticatedSession.user.id,
    authenticatedSession.sessionId,
  );
}
