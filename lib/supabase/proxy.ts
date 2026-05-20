import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import {
  createContentSecurityPolicy,
  createCspNonce,
} from "@/lib/security/csp";

import { getSupabaseConfig } from "./config";

export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-middleware-subrequest");
  const nonce = createCspNonce();
  const contentSecurityPolicy = createContentSecurityPolicy(nonce);

  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  function createResponse() {
    const nextResponse = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    nextResponse.headers.set("Content-Security-Policy", contentSecurityPolicy);

    return nextResponse;
  }

  let response = createResponse();

  const { url, publishableKey } = getSupabaseConfig();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = createResponse();

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getClaims();

  return response;
}
