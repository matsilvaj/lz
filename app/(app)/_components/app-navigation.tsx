"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { appNavigationItems, comingSoonNavigationItems } from "../navigation";

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <nav className="overflow-x-auto">
      <div className="flex min-w-max flex-wrap items-center justify-center gap-2 xl:min-w-0 xl:justify-center">
        <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-white/8 bg-[rgba(255,255,255,0.02)] p-1">
          {comingSoonNavigationItems.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "lz-button-primary"
                    : "text-[var(--text-dim)] hover:bg-white/6 hover:text-white"
                }`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden h-6 w-px lz-divider xl:block" />

        <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-white/8 bg-[rgba(255,255,255,0.02)] p-1">
          {appNavigationItems.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "lz-button-primary"
                    : "text-[var(--text-secondary)] hover:bg-white/6 hover:text-white"
                }`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
