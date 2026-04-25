import Link from "next/link";
import { type ReactNode } from "react";

type AuthPageShellProps = {
  title: string;
  description: string;
  errorMessage?: string;
  successMessage?: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthPageShell({
  title,
  description,
  errorMessage,
  successMessage,
  children,
  footer,
}: AuthPageShellProps) {
  return (
    <main className="flex min-h-screen flex-col bg-white px-6 py-6 text-neutral-950">
      <header className="flex justify-start">
        <Link className="text-sm text-neutral-600 transition hover:text-neutral-950" href="/">
          Tela inicial
        </Link>
      </header>

      <section className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-sm space-y-6 rounded-2xl border border-neutral-200 p-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="text-sm text-neutral-600">{description}</p>
          </div>

          {errorMessage ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {successMessage}
            </p>
          ) : null}

          {children}

          <div className="border-t border-neutral-200 pt-4 text-sm text-neutral-600">
            {footer}
          </div>
        </div>
      </section>
    </main>
  );
}
