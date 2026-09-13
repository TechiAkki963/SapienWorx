import { cn } from "@/lib/cn";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-bold tracking-[-0.03em] text-ink", className)}>
      <span className="grid h-9 w-9 place-items-center rounded-full bg-indigo text-sm text-white shadow-sm" aria-hidden="true">
        S
      </span>
      SapienWorx
    </span>
  );
}
