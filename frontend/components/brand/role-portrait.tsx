import Image from "next/image";

import { ROLE_ASSETS, SapienRoleAsset } from "@/lib/role-assets";

export function RolePortrait({ role, priority = false, className = "" }: { role: SapienRoleAsset; priority?: boolean; className?: string }) {
  const asset = ROLE_ASSETS[role];
  if (!asset.publicSrc) return null;

  return (
    <div className={`organic-mask relative overflow-hidden bg-indigo-soft/40 ${className}`.trim()}>
      <Image
        src={asset.publicSrc}
        alt={asset.alt}
        fill
        priority={priority}
        sizes="(max-width: 768px) 92vw, 42vw"
        className="object-cover object-center"
      />
    </div>
  );
}
