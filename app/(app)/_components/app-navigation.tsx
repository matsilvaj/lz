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
    <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {comingSoonNavigationItems.map((item) => {
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                active
                  ? "bg-neutral-950 text-white"
                  : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
              }`}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="hidden h-6 w-px bg-neutral-200 lg:block" />

      <div className="flex flex-wrap items-center justify-center gap-2">
        {appNavigationItems.map((item) => {
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                active
                  ? "bg-neutral-950 text-white"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
              }`}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
