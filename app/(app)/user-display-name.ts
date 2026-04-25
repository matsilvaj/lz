import { requireUser } from "@/lib/auth/session";

export function getUserFirstName(user: Awaited<ReturnType<typeof requireUser>>) {
  const firstName = String(user.user_metadata?.first_name ?? "").trim();
  if (firstName) {
    return firstName;
  }

  const fullName = String(user.user_metadata?.full_name ?? "").trim();
  if (fullName) {
    return fullName.split(/\s+/)[0] ?? "Usuario";
  }

  return "Usuario";
}

export function getUserDisplayName(user: Awaited<ReturnType<typeof requireUser>>) {
  const fullName = String(user.user_metadata?.full_name ?? "").trim();
  if (fullName) {
    return fullName;
  }

  const firstName = String(user.user_metadata?.first_name ?? "").trim();
  if (firstName) {
    return firstName;
  }

  return "Usuario";
}
