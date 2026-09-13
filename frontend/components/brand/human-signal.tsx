import { cn } from "@/lib/cn";

type HumanSignalProps = {
  className?: string;
  title?: string;
};

export function HumanSignal({ className, title = "Human Signal" }: HumanSignalProps) {
  const decorative = title.trim() === "";
  return (
    <svg
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
      className={cn("h-auto w-full", className)}
      role={decorative ? undefined : "img"}
      viewBox="0 0 320 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="160" cy="160" r="144" fill="currentColor" opacity="0.06" />
      <g stroke="currentColor" strokeLinecap="round" strokeWidth="6">
        <path d="M160 55c-58 0-105 47-105 105" />
        <path d="M160 84c-42 0-76 34-76 76 0 35-9 62-27 86" />
        <path d="M160 112c-27 0-48 21-48 48 0 55-14 96-43 123" />
        <path d="M160 140c-11 0-20 9-20 20 0 66-15 112-45 139" />
        <path d="M187 145c7 9 10 19 10 31 0 50-10 89-31 117" />
        <path d="M214 122c15 16 23 36 23 60 0 39-7 72-21 98" />
        <path d="M235 96c26 25 40 57 40 94 0 24-3 48-10 69" />
        <path d="M160 55c58 0 105 47 105 105" opacity="0.45" />
      </g>
      <circle cx="160" cy="160" r="10" fill="currentColor" />
    </svg>
  );
}
