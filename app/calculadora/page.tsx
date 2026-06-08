import Image from "next/image";
import Link from "next/link";

import { getCalculatorPageData } from "@/lib/server/app-data";

import { AppNavigation } from "../(app)/_components/app-navigation";
import { ThemeToggle } from "../(app)/_components/theme-toggle";
import { UserMenu } from "../(app)/_components/user-menu";
import { CalculatorWorkspace } from "../(app)/calculadora/calculator-workspace";

type CalculatorPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function WorkspaceShortcut() {
  return (
    <Link
      className="inline-flex h-11 max-w-[180px] items-center justify-between gap-2 rounded-full border border-white/10 bg-white/4 px-4 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-white/20 hover:bg-white/8 sm:max-w-[220px]"
      href="/workspaces"
    >
      <span className="truncate">Meu Workspace</span>
      <svg
        aria-hidden="true"
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M6.75 9.75L12 15l5.25-5.25"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      </svg>
    </Link>
  );
}

export default async function CalculatorPage({
  searchParams,
}: CalculatorPageProps) {
  const [data, resolvedSearchParams] = await Promise.all([
    getCalculatorPageData(),
    searchParams ?? Promise.resolve({}),
  ]);

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

            <div className="grid grid-cols-[1fr_auto_auto_auto_1fr] items-center gap-2 lg:flex lg:flex-wrap lg:items-center lg:justify-end">
              <div className="col-start-2 justify-self-center lg:col-auto lg:justify-self-auto">
                <WorkspaceShortcut />
              </div>
              <div className="col-start-3 justify-self-start lg:col-auto lg:justify-self-auto">
                <ThemeToggle />
              </div>
              <div className="col-start-4 justify-self-start lg:col-auto lg:justify-self-auto">
                <UserMenu />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1480px] px-4 py-5 md:px-6 xl:px-8 xl:py-6">
        <div className="lz-page-enter">
          <CalculatorWorkspace
            bookmakers={data.bookmakers}
            initialSearchParams={resolvedSearchParams}
          />
        </div>
      </main>
    </div>
  );
}
