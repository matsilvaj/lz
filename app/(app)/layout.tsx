import Image from "next/image";
import Link from "next/link";
import { type ReactNode } from "react";

import { requireWorkspaceContext } from "@/lib/auth/workspace-context";

import { AppNavigation } from "./_components/app-navigation";
import { WorkspaceSwitcher } from "./_components/workspace-switcher";
import { UserMenu } from "./_components/user-menu";

export default async function ProtectedAppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const { activeWorkspace, workspaces } = await requireWorkspaceContext();

  return (
    <div className="min-h-screen text-[var(--text-primary)]">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[rgba(6,2,7,0.78)] backdrop-blur-2xl">
        <div className="mx-auto max-w-[1480px] px-4 py-3 md:px-6 xl:px-8">
          <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[auto_1fr_auto] xl:items-center">
            <Link className="inline-flex items-center gap-3" href="/dashboard">
              <Image
                alt="LZ"
                className="h-auto w-14 md:w-16"
                height={78}
                priority
                sizes="(max-width: 768px) 56px, 64px"
                src="/LOGO_1.png"
                width={120}
              />
              <span className="text-xs font-semibold uppercase tracking-[0.34em] text-[var(--text-secondary)]">
                LZ Community
              </span>
            </Link>

            <AppNavigation />

            <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
              <WorkspaceSwitcher activeWorkspace={activeWorkspace} workspaces={workspaces} />
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1480px] px-4 py-5 md:px-6 xl:px-8 xl:py-6">
        <div className="lz-page-enter">{children}</div>
      </main>
    </div>
  );
}
