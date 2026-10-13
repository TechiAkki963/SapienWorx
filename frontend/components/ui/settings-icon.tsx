import { cn } from "@/lib/cn";

/** Shared eight-tooth outline; its enclosing control supplies the accessible name. */
export function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      data-icon="settings"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-[22px] w-[22px] shrink-0", className)}
    >
      <path
        vectorEffect="non-scaling-stroke"
        d="M10.4 2h3.2l.6 2.6 1.8.8L18.3 4 20 5.7 18.6 8l.8 1.8 2.6.6v3.2l-2.6.6-.8 1.8 1.4 2.3-1.7 1.7-2.3-1.4-1.8.8-.6 2.6h-3.2l-.6-2.6-1.8-.8L5.7 20 4 18.3 5.4 16l-.8-1.8-2.6-.6v-3.2l2.6-.6.8-1.8L4 5.7 5.7 4 8 5.4l1.8-.8Z"
      />
      <circle cx="12" cy="12" r="3.3" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
