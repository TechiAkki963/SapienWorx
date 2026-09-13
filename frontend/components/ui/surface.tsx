import { cn } from "@/lib/cn";

type SurfaceTone = "white" | "lavender" | "mint" | "peach";

type SurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: SurfaceTone;
};

const tones: Record<SurfaceTone, string> = {
  white: "bg-white/88",
  lavender: "bg-lavender/75",
  mint: "bg-mint/75",
  peach: "bg-peach/75",
};

export function Surface({ className, tone = "white", ...props }: SurfaceProps) {
  return (
    <div
      className={cn("rounded-[var(--radius-panel)] border border-white/80 shadow-soft backdrop-blur-sm", tones[tone], className)}
      {...props}
    />
  );
}
