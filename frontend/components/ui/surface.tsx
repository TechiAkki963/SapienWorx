import { cn } from "@/lib/cn";

type SurfaceTone = "white" | "lavender" | "mint" | "peach" | "photo";
type SurfaceProps = React.HTMLAttributes<HTMLDivElement> & { tone?: SurfaceTone };

const tones: Record<SurfaceTone, string> = {
  white: "bg-white/88 shadow-soft",
  lavender: "bg-lavender/75 shadow-soft",
  mint: "bg-mint/75 shadow-soft",
  peach: "bg-peach/75 shadow-soft",
  photo: "bg-transparent shadow-float",
};

export function Surface({ className, tone = "white", ...props }: SurfaceProps) {
  return <div className={cn("rounded-[var(--radius-panel)] border border-white/65 backdrop-blur-sm", tones[tone], className)} {...props} />;
}
