import Image from "next/image";
import Link from "next/link";
import { type ReactNode } from "react";

import { requireWorkspaceContext } from "@/lib/auth/workspace-context";

import { AppNavigation } from "./_components/app-navigation";
import { ConverterStateGuard } from "./_components/converter-state-guard";
import { ThemeToggle } from "./_components/theme-toggle";
import { UserMenu } from "./_components/user-menu";

export default async function ProtectedAppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  // Garante o usuário logado e o workspace dele antes de montar a área do app.
  await requireWorkspaceContext();

  return (
    <div className="min-h-screen text-[var(--text-primary)]">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[rgba(6,2,7,0.78)] backdrop-blur-2xl">
        <div className="mx-auto max-w-[1480px] px-4 py-3 md:px-6 xl:px-8">
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-4">
            <Link className="inline-flex items-center gap-3" href="/dashboard">
              <Image
                alt="LZ Community"
                className="h-auto w-14 md:w-16"
                height={157}
                priority
                sizes="(max-width: 768px) 56px, 64px"
                src="/lz-logo-240.png"
                width={240}
              />
              <span className="hidden text-xs font-semibold uppercase tracking-[0.34em] text-[var(--text-secondary)] sm:inline-flex">
                LZ Community
              </span>
            </Link>

            <AppNavigation />

            <div className="grid grid-cols-[1fr_auto_auto_1fr] items-center gap-2 lg:flex lg:flex-wrap lg:items-center lg:justify-end">
              <div className="col-start-2 justify-self-end lg:col-auto lg:justify-self-auto">
                <ThemeToggle />
              </div>
              <div className="col-start-3 justify-self-start lg:col-auto lg:justify-self-auto">
                <UserMenu />
              </div>
            </div>
          </div>
        </div>
      </header>

      <ConverterStateGuard />

      <main className="mx-auto w-full max-w-[1480px] px-4 py-5 md:px-6 xl:px-8 xl:py-6">
        <div className="lz-page-enter">{children}</div>
      </main>
    </div>
  );
}
