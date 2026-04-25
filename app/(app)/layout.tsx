import Image from "next/image";
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
        <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-4 py-4 md:px-6 xl:px-8">
          <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[auto_1fr_auto] xl:items-center">
            <Link
              className="inline-flex items-center"
              href="/dashboard"
            >
              <Image
                alt="LZ"
                className="h-auto w-24"
                height={78}
                priority
                src="/LOGO_1.png"
                width={120}
              />
            </Link>

            <AppNavigation />

            <div className="flex justify-start xl:justify-end">
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1430px] px-4 py-6 md:px-6 xl:px-8">{children}</main>
    </div>
  );
}
