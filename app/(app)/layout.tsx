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
          <div className="grid grid-cols-[1fr_auto] items-center gap-3 lg:grid-cols-[auto_1fr_auto] lg:gap-4">
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

            <div className="col-span-2 row-start-2 hidden min-w-0 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:block">
              <AppNavigation />
            </div>

            {/* Celular e tablet: logo e botões na mesma linha, abas embaixo. */}
            <div className="col-start-2 row-start-1 flex items-center gap-2 lg:col-start-3">
              <ThemeToggle />
              <UserMenu />
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
