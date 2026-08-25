"use client";

export function SupportHelpFab({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-20 right-4 z-30 flex h-12 items-center rounded-full bg-brand px-4 text-sm font-semibold text-white shadow-lg print:hidden md:bottom-6"
    >
      ¿Te ayudo a dejarlo listo?
    </a>
  );
}
