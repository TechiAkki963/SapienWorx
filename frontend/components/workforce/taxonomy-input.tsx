"use client";

import { useEffect, useId, useRef, useState } from "react";

import { apiRequest } from "@/lib/api";

export type TaxonomySuggestion = {
  id: string;
  entity_type: string;
  canonical_name: string;
  matched_value: string;
  match_kind: string;
  confidence: number;
};

type Props = {
  id?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  ariaRequired?: boolean;
  maxLength?: number;
  name?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  entityTypes?: string[];
  onValueChange?: (value: string) => void;
  onSelect?: (item: TaxonomySuggestion) => void;
  onCommit?: (value: string) => void;
  ariaLabel?: string;
};

function typeLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function TaxonomyInput({
  id,
  ariaInvalid,
  ariaDescribedBy,
  ariaRequired,
  maxLength,
  name,
  value,
  defaultValue = "",
  placeholder,
  className = "",
  entityTypes = [
    "skill",
    "competency",
    "tool",
    "technology",
    "equipment",
    "certification",
    "licence",
    "qualification",
    "domain_knowledge",
    "methodology",
  ],
  onValueChange,
  onSelect,
  onCommit,
  ariaLabel,
}: Props) {
  const controlled = value !== undefined;
  const [localValue, setLocalValue] = useState(defaultValue);
  const currentValue = controlled ? (value ?? "") : localValue;
  const [items, setItems] = useState<TaxonomySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const listID = useId();
  const timer = useRef<number | null>(null);

  function change(next: string) {
    if (!controlled) setLocalValue(next);
    onValueChange?.(next);
    setActive(-1);
  }

  function choose(item: TaxonomySuggestion) {
    change(item.canonical_name);
    onSelect?.(item);
    setItems([]);
    setOpen(false);
    setActive(-1);
  }

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    const query = currentValue.trim();
    if (query.length < 2) {
      setItems([]);
      setOpen(false);
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    timer.current = window.setTimeout(async () => {
      setBusy(true);
      try {
        const params = new URLSearchParams({ q: query, limit: "8" });
        entityTypes.forEach((entityType) => params.append("type", entityType));
        const result = await apiRequest<{ items: TaxonomySuggestion[] }>(
          `/api/v1/workforce/taxonomy/suggest?${params}`,
          { signal: controller.signal },
        );
        setItems(result.items);
        setOpen(result.items.length > 0);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setItems([]);
          setOpen(false);
        }
      } finally {
        setBusy(false);
      }
    }, 180);
    return () => {
      controller.abort();
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [currentValue, entityTypes.join("|")]);

  return (
    <div className="relative">
      <input
        id={id}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-required={ariaRequired}
        maxLength={maxLength}
        name={name}
        value={currentValue}
        onChange={(event) => change(event.target.value)}
        onFocus={() => items.length > 0 && setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
          if (onCommit && currentValue.trim()) onCommit(currentValue.trim());
        }}
        onKeyDown={(event) => {
          if (open && items.length > 0 && event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => Math.min(items.length - 1, index + 1));
          } else if (open && items.length > 0 && event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(0, index - 1));
          } else if (
            open &&
            items.length > 0 &&
            event.key === "Enter" &&
            active >= 0
          ) {
            event.preventDefault();
            choose(items[active]);
          } else if (
            (event.key === "Enter" || event.key === ",") &&
            onCommit &&
            currentValue.trim()
          ) {
            event.preventDefault();
            onCommit(currentValue.trim());
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className={className}
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listID}
        aria-activedescendant={active >= 0 ? `${listID}-${active}` : undefined}
        autoComplete="off"
      />
      {busy && currentValue.trim().length >= 2 && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400">
          Searching…
        </span>
      )}
      {open && (
        <div
          id={listID}
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
        >
          {items.map((item, index) => (
            <button
              id={`${listID}-${index}`}
              role="option"
              aria-selected={index === active}
              type="button"
              key={item.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(item)}
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${index === active ? "bg-indigo-50" : "hover:bg-slate-50"}`}
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold text-slate-900">
                  {item.canonical_name}
                </span>
                {item.match_kind === "alias" &&
                  item.matched_value !== item.canonical_name && (
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                      Matched alias: {item.matched_value}
                    </span>
                  )}
              </span>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                {typeLabel(item.entity_type)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
