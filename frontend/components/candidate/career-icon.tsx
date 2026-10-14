import type { CSSProperties } from "react";

const paths = {
  application: <><path d="M14 2H5a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8z"/><path d="M14 2v6h6M8 12h8M8 16h8"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h6"/></>,
  bookmark: <path d="M6 3h12v18l-6-4-6 4z"/>,
  search: <><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></>,
  person: <><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2z"/></>,
  share: <><circle cx="18" cy="4" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="20" r="3"/><path d="m8.5 10.5 7-5M8.5 13.5l7 5"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
  copy: <><rect x="8" y="7" width="12" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12"/></>,
  link: <><path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(1 1) scale(.92)"/></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9 21h6"/></>,
};
export function CareerIcon({name,size=20,style}:{name:keyof typeof paths;size?:number;style?:CSSProperties}) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style}>{paths[name]}</svg>;
}
export function SocialIcon({provider}:{provider:"linkedin"|"x"|"facebook"}) {
  if(provider==="linkedin")return <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><rect width="24" height="24" rx="4"/><path fill="white" d="M5 9h3v10H5zm1.5-5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M10 9h3v1.4c.7-1 1.6-1.7 3.2-1.7 2.6 0 3.8 1.6 3.8 4.7V19h-3v-5c0-1.7-.5-2.5-1.8-2.5-1.4 0-2.2.9-2.2 2.5v5h-3z"/></svg>;
  if(provider==="facebook")return <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><circle cx="12" cy="12" r="12"/><path fill="white" d="M13.5 24v-9.5h3l.5-3h-3.5V9.7c0-.9.3-1.7 1.8-1.7H17V5.2c-.3 0-1.2-.2-2.5-.2-2.7 0-4.5 1.7-4.5 4.5v2H7v3h3V24z"/></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M18.9 2H22l-6.8 7.8L23 22h-6.1l-4.8-7.3L5.8 22H2.6l7.9-9L1 2h6.3l4.3 6.6L18.9 2Zm-1.1 18h1.7L6.4 3.8H4.6Z"/></svg>;
}
