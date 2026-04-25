import Link from "next/link";
import { type ReactNode } from "react";

import { requireUser } from "@/lib/auth/session";

import { AppNavigation } from "./_components/app-navigation";
import { UserMenu } from "./_components/user-menu";

export default async function ProtectedAppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  await requireUser();

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-950">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:px-6">
          <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[auto_1fr_auto] xl:items-center">
            <Link
              className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500"
              href="/dashboard"
            >
              LZ
            </Link>

            <AppNavigation />

            <div className="flex justify-start xl:justify-end">
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}
