import Image from "next/image";

import { cn } from "@/lib/cn";
import { HumanSignal } from "./human-signal";

type OrganicPortraitProps = {
  alt?: string;
  className?: string;
  src?: string;
};

export function OrganicPortrait({ alt = "", className, src }: OrganicPortraitProps) {
  return (
    <div
      className={cn(
        "organic-mask relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-peach via-lavender to-mint shadow-soft",
        className,
      )}
    >
      {src ? (
        <Image alt={alt} className="object-cover" fill sizes="(max-width: 768px) 78vw, 38vw" src={src} />
      ) : (
        <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
          <div className="relative h-[76%] w-[68%]">
            <div className="absolute left-1/2 top-[9%] h-[30%] w-[43%] -translate-x-1/2 rounded-[48%] bg-ink/88" />
            <div className="absolute bottom-[-3%] left-1/2 h-[65%] w-[82%] -translate-x-1/2 rounded-t-[48%] bg-ink/88" />
          </div>
          <HumanSignal className="absolute -right-[9%] bottom-[-7%] w-[64%] text-indigo/50" />
        </div>
      )}
    </div>
  );
}
