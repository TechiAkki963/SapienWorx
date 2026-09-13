import { cn } from "@/lib/cn";

export function Wordmark({ className, compactOnMobile = false }: { className?: string; compactOnMobile?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-bold tracking-[-0.03em] text-ink", className)}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo text-sm text-white shadow-sm" aria-hidden="true">S</span>
      <span className={compactOnMobile ? "hidden sm:inline" : undefined}>SapienWorx</span>
    </span>
  );
}
