"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

type Emoji = { value: string; name: string };
const categories = {
  Smileys: [
    ["🙂", "Slightly smiling face"], ["😊", "Smiling face"], ["😀", "Grinning face"],
    ["🤔", "Thinking face"], ["😌", "Relieved face"], ["🙌", "Raising hands"],
  ],
  People: [
    ["👍", "Thumbs up"], ["👍🏻", "Thumbs up: light skin tone"], ["👍🏽", "Thumbs up: medium skin tone"], ["👍🏿", "Thumbs up: dark skin tone"],
    ["🙏", "Folded hands"], ["🙏🏽", "Folded hands: medium skin tone"], ["👋", "Waving hand"], ["👋🏽", "Waving hand: medium skin tone"],
    ["👏", "Clapping hands"], ["👏🏽", "Clapping hands: medium skin tone"], ["🧑‍💻", "Technologist"], ["👩🏽‍💻", "Woman technologist: medium skin tone"],
  ],
  "Work / Objects": [
    ["💼", "Briefcase"], ["📅", "Calendar"], ["📞", "Telephone receiver"], ["📍", "Location pin"],
    ["📎", "Paperclip"], ["💻", "Laptop"], ["📝", "Memo"], ["🤝", "Handshake"],
  ],
  Symbols: [
    ["✅", "Check mark"], ["🎉", "Party popper"], ["⭐", "Star"], ["✔️", "Check mark symbol"], ["💡", "Light bulb"], ["📌", "Pushpin"],
  ],
} as const;
const catalog: Emoji[] = Object.values(categories).flatMap(items => items.map(([value, name]) => ({value, name})));
const known = new Map(catalog.map(emoji => [emoji.value, emoji]));
type Category = "Recent" | keyof typeof categories;

function readRecent(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw.length > 2048) return [];
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && known.has(item)))].slice(0,12) : [];
  } catch { return []; }
}

export function EmojiPicker({anchor, storageKey, onSelect, onClose}: {
  anchor: RefObject<HTMLButtonElement | null>;
  storageKey: string;
  onSelect: (value: string) => boolean;
  onClose: (restoreFocus: boolean) => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [recent, setRecent] = useState(() => readRecent(storageKey));
  const [category, setCategory] = useState<Category>(() => readRecent(storageKey).length ? "Recent" : "Smileys");
  const [active, setActive] = useState(0);
  const [notice, setNotice] = useState("");
  const [position, setPosition] = useState({left:12,top:12,width:320,maxHeight:344,ready:false});
  const items: Emoji[] = category === "Recent" ? recent.map(value => known.get(value)!) : categories[category].map(([value,name])=>({value,name}));

  useLayoutEffect(() => {
    function place() {
      const trigger = anchor.current?.getBoundingClientRect();
      const node = panel.current;
      if (!trigger || !node) return;
      const composer = anchor.current?.form?.getBoundingClientRect() ?? trigger;
      const viewport = window.visualViewport;
      const leftEdge = viewport?.offsetLeft ?? 0, topEdge = viewport?.offsetTop ?? 0;
      const width = Math.min(320, (viewport?.width ?? innerWidth) - 24);
      const bottom = topEdge + (viewport?.height ?? innerHeight);
      const above = composer.top - topEdge - 12, below = bottom - composer.bottom - 12;
      const maxHeight = Math.max(0, Math.min(344, Math.max(above, below)));
      const height = Math.min(node.scrollHeight + node.offsetHeight - node.clientHeight, maxHeight);
      setPosition({left:Math.max(leftEdge+12,Math.min(trigger.right-width,leftEdge+(viewport?.width ?? innerWidth)-width-12)),
        top:above>=below?Math.max(topEdge+8,composer.top-height-8):composer.bottom+8,width,maxHeight,ready:true});
    }
    place();
    const observer = new ResizeObserver(place);
    if (panel.current) observer.observe(panel.current);
    if (anchor.current?.form) observer.observe(anchor.current.form);
    window.addEventListener("resize",place);
    window.addEventListener("scroll",place,true);
    window.visualViewport?.addEventListener("resize",place);
    window.visualViewport?.addEventListener("scroll",place);
    return()=>{observer.disconnect();window.removeEventListener("resize",place);window.removeEventListener("scroll",place,true);window.visualViewport?.removeEventListener("resize",place);window.visualViewport?.removeEventListener("scroll",place);};
  },[anchor,category,notice]);

  useEffect(()=>{
    if (!position.ready) return;
    // A lazy boundary can briefly keep its committed children hidden. Wait for
    // the revealed control rather than losing the initial keyboard focus.
    let focusFrame=0, remainingFrames=60;
    const focusWhenVisible=()=>{
      const node=panel.current?.querySelector<HTMLElement>("[data-emoji-choice]");
      if(!node?.isConnected)return;
      if(getComputedStyle(node).visibility==="visible"&&node.getClientRects().length)node.focus({preventScroll:true});
      else if(--remainingFrames>0)focusFrame=requestAnimationFrame(focusWhenVisible);
    };
    focusFrame=requestAnimationFrame(focusWhenVisible);
    const outside=(event:Event)=>{
      const target=event.target;
      if(target instanceof Node&&!panel.current?.contains(target)&&!anchor.current?.contains(target))onClose(false);
    };
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.preventDefault();event.stopPropagation();onClose(true);}};
    document.addEventListener("pointerdown",outside,true);
    document.addEventListener("focusin",outside);
    document.addEventListener("keydown",escape,true);
    return()=>{cancelAnimationFrame(focusFrame);document.removeEventListener("pointerdown",outside,true);document.removeEventListener("focusin",outside);document.removeEventListener("keydown",escape,true);};
  },[anchor,onClose,position.ready]);

  function choose(emoji: Emoji) {
    if (!onSelect(emoji.value)) {setNotice("Message is full. Shorten it before adding this emoji.");return;}
    const next=[emoji.value,...recent.filter(value=>value!==emoji.value)].slice(0,12);
    setRecent(next);
    try {localStorage.setItem(storageKey,JSON.stringify(next));} catch {/* Recent preferences are optional. */}
  }

  return createPortal(<div ref={panel} id="message-emoji-picker" role="dialog" aria-modal="false" aria-label="Add emoji" className="swx-emoji-picker" onKeyDown={event=>{
    if(event.key!=="Tab")return;
    const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([tabindex="-1"])'));
    if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();onClose(true);}
    else if(!event.shiftKey&&document.activeElement===buttons.at(-1)){
      event.preventDefault();onClose(false);
      const form=anchor.current?.form;
      (form?.querySelector<HTMLElement>('button[type="submit"]:not(:disabled)')??form?.querySelector<HTMLTextAreaElement>("textarea"))?.focus({preventScroll:true});
    }
  }} style={{position:"fixed",zIndex:80,left:position.left,top:position.top,width:position.width,maxHeight:position.maxHeight,visibility:position.ready?"visible":"hidden"}}>
    <header><h2>Emoji</h2><button type="button" aria-label="Close emoji picker" onClick={()=>onClose(true)}>×</button></header>
    <div role="group" aria-label="Emoji categories" className="swx-emoji-categories">
      {([...(recent.length?["Recent" as const]:[]),...Object.keys(categories) as (keyof typeof categories)[]]).map(name=><button type="button" key={name} aria-pressed={category===name} onClick={()=>{setCategory(name);setActive(0);setNotice("");}}>{name==="Work / Objects"?"Work":name}</button>)}
    </div>
    <div role="group" aria-label={`${category} emoji`} className="swx-emoji-grid" onKeyDown={event=>{
      const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
      const current=buttons.indexOf(document.activeElement as HTMLButtonElement);
      const delta=event.key==="ArrowRight"?1:event.key==="ArrowLeft"?-1:event.key==="ArrowDown"?6:event.key==="ArrowUp"?-6:0;
      const next=event.key==="Home"?0:event.key==="End"?buttons.length-1:delta?Math.max(0,Math.min(buttons.length-1,current+delta)):-1;
      if(next>=0){event.preventDefault();setActive(next);buttons[next]?.focus();}
    }}>
      {items.map((emoji,index)=><button key={emoji.value} type="button" data-emoji-choice aria-label={emoji.name} title={emoji.name} tabIndex={active===index?0:-1} onFocus={()=>setActive(index)} onClick={()=>choose(emoji)}><span aria-hidden="true">{emoji.value}</span></button>)}
    </div>
    {notice&&<p role="status" className="swx-emoji-notice">{notice}</p>}
    <p className="swx-emoji-help">Arrow keys to browse · Escape to close</p>
  </div>,document.body);
}
