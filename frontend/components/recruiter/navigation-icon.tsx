import {cn} from "@/lib/cn";
export type NavigationIconName="overview"|"discover"|"applications"|"pools"|"saved"|"outreach"|"insights"|"jobs"|"interviews"|"offers"|"referrals"|"settings"|"messages"|"candidates"|"talent"|"notifications";
/** One outline vocabulary for Recruit and Talent. The link owns the accessible name. */
export function NavigationIcon({name,className}:{name:NavigationIconName;className?:string}){
 const paths:Record<NavigationIconName,React.ReactNode>={
 overview:<><rect x="3" y="3" width="7" height="11" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M3 18h7v3H3z"/></>,
 discover:<><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></>,
 applications:<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6m-12 7 3 3 5-5"/>,
 pools:<><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v3"/></>,
 saved:<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Zm-10-11 2 2 4-4"/>,
 outreach:<path d="m22 2-7 20-4-9-9-4Zm0 0L11 13"/>,
 insights:<path d="M3 3v18h18M7 15l5-5 4 3 5-7m-5 0h5v5"/>,
 jobs:<><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18m-9 0v3"/></>,
 interviews:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 10h18"/><circle cx="12" cy="15.5" r="3"/><path d="M12 14v2h1"/></>,
 offers:<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M8 12h5m-5 7 3-3 2 2 3-3"/>,
 referrals:<><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2m3-13v6m-3-3h6"/></>,
 settings:<><path d="m9 3-1 3-3 1-2 3 2 3-1 3 3 2 3-1 2 2 3-2 3 1 2-3-1-3 2-3-2-3-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/></>,
 messages:<path d="M3 4h18v13H9l-6 4ZM7 8h10m-10 4h7"/>,
 candidates:<><circle cx="8" cy="7" r="4"/><path d="M2 21v-2a6 6 0 0 1 9-5m7 4 4 4"/><circle cx="16" cy="15" r="4"/></>,
 talent:<><circle cx="12" cy="12" r="10"/><path d="m16 8-2 6-6 2 2-6Z"/></>,
 notifications:<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8M10 20h4"/>,
 };
 return <svg aria-hidden="true" data-icon={name} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className={cn("h-5 w-5 shrink-0 fill-none stroke-current stroke-[1.8]",className)}>{paths[name]}</svg>;
}
