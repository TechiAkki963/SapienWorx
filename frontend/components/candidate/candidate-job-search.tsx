"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  FormEvent,
  ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { apiRequest } from "@/lib/api";
import { TaxonomySuggestion } from "@/components/workforce/taxonomy-input";

export type SearchTag = { id?: string; label: string };
type FieldValues = { name: string; value: string }[];
type SearchContextValue = {
  register: (id: string, flush: () => Promise<FieldValues>) => () => void;
};
const SearchContext = createContext<SearchContextValue | null>(null);

export function CandidateJobSearchForm({ children }: { children: ReactNode }) {
  const router = useRouter();
  const fields = useRef(new Map<string, () => Promise<FieldValues>>());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const register = useRef<SearchContextValue>({
    register: (id, flush) => {
      fields.current.set(id, flush);
      return () => {
        fields.current.delete(id);
      };
    },
  });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !event.currentTarget.reportValidity()) return;
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    try {
      const structured = await Promise.all(
        [...fields.current.values()].map((flush) => flush()),
      );
      const query = new URLSearchParams();
      new FormData(form).forEach((value, name) => {
        if (typeof value === "string" && value) query.append(name, value);
      });
      for (const values of structured)
        for (const value of values) query.append(value.name, value.value);
      query.delete("page");
      router.push(`/candidate/jobs?${query}`);
    } catch {
      setError("Please correct the search fields before continuing.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <SearchContext.Provider value={register.current}>
      <form
        className="mt-5 grid gap-4"
        action="/candidate/jobs"
        onSubmit={submit}
        aria-busy={busy}
      >
        {children}
        {error && (
          <p role="alert" className="text-xs text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        {busy && (
          <p role="status" className="text-xs text-ink-muted">
            Preparing your search…
          </p>
        )}
      </form>
    </SearchContext.Provider>
  );
}

const fold = (value: string) =>
  value.trim().toLocaleLowerCase().replace(/\s+/g, " ");

export function CandidateJobTagInput({
  label,
  idName,
  textName,
  initialTags = [],
  entityTypes = [],
  geography = false,
  placeholder,
}: {
  label: string;
  idName: string;
  textName: string;
  initialTags?: SearchTag[];
  entityTypes?: string[];
  geography?: boolean;
  placeholder?: string;
}) {
  const context = useContext(SearchContext);
  const id = useId();
  const [tags, setTags] = useState(initialTags);
  const tagsRef = useRef(initialTags);
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  const draftRef = useRef("");
  const [suggestions, setSuggestions] = useState<SearchTag[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [selectedLast, setSelectedLast] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const validationError = useRef("");
  const [suggestionNotice, setSuggestionNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const pending = useRef<Promise<void>>(Promise.resolve());
  const listId = `${id}-list`;

  async function lookup(
    value: string,
    signal?: AbortSignal,
  ): Promise<SearchTag[]> {
    const query = new URLSearchParams({ q: value, limit: "8" });
    if (geography) {
      const result = await apiRequest<{
        items: { id: string; canonical_name: string; aliases?: string[] }[];
      }>(`/api/v1/candidate/job-locations?${query}`, { signal });
      return result.items.map((item) => ({
        id: item.id,
        label: item.canonical_name,
        matched: item.aliases?.find((alias) => fold(alias) === fold(value)),
      }));
    }
    entityTypes.forEach((type) => query.append("type", type));
    const result = await apiRequest<{ items: TaxonomySuggestion[] }>(
      `/api/v1/workforce/taxonomy/suggest?${query}`,
      { signal },
    );
    return result.items.map((item) => ({
      id: item.id,
      label: item.canonical_name,
      matched: item.matched_value,
      matchKind: item.match_kind,
    })) as SearchTag[];
  }
  function updateDraft(value: string) {
    draftRef.current = value;
    setDraft(value);
    setSelectedLast(false);
    setActive(-1);
  }
  function store(next: SearchTag[]) {
    tagsRef.current = next;
    if (mounted.current) setTags(next);
  }
  function invalidate(message: string) {
    validationError.current = message;
    setError(message);
  }
  function clearError() {
    validationError.current = "";
    setError("");
  }
  function add(tag: SearchTag) {
    if (
      !tag.label ||
      tag.label.length > 180 ||
      /[\u0000-\u001f]/.test(tag.label)
    ) {
      invalidate("Use a search term between 1 and 180 characters.");
      return;
    }
    const duplicate = tagsRef.current.findIndex(
      (item) =>
        (item.id && tag.id && item.id === tag.id) ||
        fold(item.label) === fold(tag.label),
    );
    if (duplicate >= 0) {
      if (tag.id && !tagsRef.current[duplicate].id)
        store(
          tagsRef.current.map((item, index) =>
            index === duplicate ? tag : item,
          ),
        );
      setStatus(`${tag.label} is already selected.`);
      return;
    }
    if (tagsRef.current.length >= 20) {
      invalidate("Use at most 20 tags in each field.");
      return;
    }
    store([...tagsRef.current, tag]);
    setStatus(`${tag.label} added.`);
  }
  function commit(values: string[], selected?: SearchTag) {
    updateDraft("");
    setOpen(false);
    setSuggestions([]);
    pending.current = pending.current.then(async () => {
      validationError.current = "";
      setError("");
      for (const value of values.map((item) => item.trim()).filter(Boolean)) {
        if (selected) {
          add(selected);
          continue;
        }
        if (value.length > 180 || /[\u0000-\u001f]/.test(value)) {
          invalidate("Use a search term between 1 and 180 characters.");
          continue;
        }
        try {
          const matches = await lookup(value);
          setSuggestionNotice("");
          const exact = matches.find(
            (item) =>
              fold(item.label) === fold(value) ||
              fold((item as SearchTag & { matched?: string }).matched ?? "") ===
                fold(value),
          );
          // Suggestion aliases are resolved server-side; don't select fuzzy matches
          // automatically when the candidate deliberately commits a different term.
          add(exact ?? { label: value });
        } catch {
          add({ label: value });
          setSuggestionNotice(
            "Suggestions are temporarily unavailable. You can continue with a text search.",
          );
          setStatus(
            `${value} added as a text search. Suggestions are temporarily unavailable.`,
          );
        }
      }
    });
    return pending.current;
  }

  useEffect(() => {
    mounted.current = true;
    setReady(true);
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const flush = async () => {
      if (draftRef.current.trim()) await commit(draftRef.current.split(","));
      await pending.current;
      if (validationError.current) {
        inputRef.current?.focus();
        throw new Error(validationError.current);
      }
      const values: FieldValues = [];
      for (const tag of tagsRef.current) {
        if (tag.id) {
          values.push(
            { name: idName, value: tag.id },
            { name: `${idName}_label`, value: tag.label },
          );
        } else values.push({ name: textName, value: tag.label });
      }
      return values;
    };
    return context?.register(id, flush);
  }, [context, id, idName, textName, geography, entityTypes.join("|")]);
  useEffect(() => {
    if (draft.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      lookup(draft.trim(), controller.signal)
        .then((items) => {
          if (!controller.signal.aborted) {
            setSuggestionNotice("");
            setSuggestions(items);
            setOpen(items.length > 0);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setSuggestionNotice(
              "Suggestions are temporarily unavailable. You can continue with a text search.",
            );
            setSuggestions([]);
            setOpen(false);
          }
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [draft, geography, entityTypes.join("|")]);

  return (
    <div className="relative min-w-0">
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      <div className="mt-1.5 flex min-h-11 min-w-0 flex-wrap gap-1.5 rounded-xl border border-line bg-white p-2 focus-within:border-indigo/50 focus-within:ring-2 focus-within:ring-indigo/15">
        {tags.map((tag, index) => (
          <span
            key={tag.id ?? fold(tag.label)}
            className={`inline-flex max-w-full items-center gap-1 rounded-lg bg-indigo-soft/70 pl-2 text-xs font-semibold text-indigo ${selectedLast && index === tags.length - 1 ? "ring-2 ring-indigo" : ""}`}
          >
            <span className="break-words [overflow-wrap:anywhere]">
              {tag.label}
            </span>
            <button
              type="button"
              disabled={!ready}
              aria-label={`Remove ${tag.label} from ${label}`}
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-base hover:bg-indigo-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo sm:min-h-9 sm:min-w-9"
              onClick={() => {
                store(
                  tagsRef.current.filter((_, position) => index !== position),
                );
                setStatus(`${tag.label} removed.`);
                clearError();
                setSelectedLast(false);
                inputRef.current?.focus();
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          disabled={!ready}
          aria-busy={!ready}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
          aria-activedescendant={
            open && active >= 0 ? `${listId}-${active}` : undefined
          }
          aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
          aria-invalid={Boolean(error)}
          value={draft}
          maxLength={1000}
          autoComplete="off"
          placeholder={placeholder}
          className="min-h-11 w-full min-w-0 flex-[1_1_8rem] bg-transparent px-1 text-sm text-ink outline-none sm:min-h-9"
          onChange={(event) => {
            const value = event.target.value;
            if (value.includes(",")) {
              const parts = value.split(",");
              const remaining = parts.pop() ?? "";
              void commit(parts);
              updateDraft(remaining);
            } else updateDraft(value);
          }}
          onFocus={() => {
            if (suggestions.length) setOpen(true);
          }}
          onBlur={() => {
            setOpen(false);
            setSelectedLast(false);
          }}
          onPaste={(event) => {
            const text = event.clipboardData.getData("text");
            if (text.includes(",")) {
              event.preventDefault();
              void commit(`${draftRef.current}${text}`.split(","));
            }
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "ArrowDown" && suggestions.length) {
              event.preventDefault();
              setOpen(true);
              setActive((value) => Math.min(suggestions.length - 1, value + 1));
            } else if (event.key === "ArrowUp" && open) {
              event.preventDefault();
              setActive((value) => Math.max(0, value - 1));
            } else if (event.key === "Escape") {
              setOpen(false);
              setActive(-1);
              setSelectedLast(false);
            } else if (event.key === "Enter" || event.key === ",") {
              if (draft.trim() || (open && active >= 0)) {
                event.preventDefault();
                const selected =
                  open && active >= 0 ? suggestions[active] : undefined;
                void commit([selected?.label ?? draft], selected);
              }
            } else if (event.key === "Backspace" && !draft && tags.length) {
              event.preventDefault();
              if (selectedLast) {
                const last = tagsRef.current.at(-1);
                store(tagsRef.current.slice(0, -1));
                setStatus(`${last?.label} removed.`);
                clearError();
                setSelectedLast(false);
              } else {
                setSelectedLast(true);
                setStatus(
                  `${tags.at(-1)?.label} selected. Press Backspace again to remove it.`,
                );
              }
            }
          }}
        />
      </div>
      <p
        id={`${id}-help`}
        className="mt-1 text-[11px] leading-5 text-ink-muted"
      >
        Type a term, then comma or Enter. Paste several comma-separated terms.
      </p>
      <span role="status" className="sr-only">
        {status}
      </span>
      {suggestionNotice && (
        <p className="mt-1 text-xs leading-5 text-ink-muted">
          {suggestionNotice}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-xs text-red-700 dark:text-red-300"
        >
          {error}
        </p>
      )}
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-line bg-white p-1 shadow-xl"
        >
          {suggestions.map((item, index) => (
            <li
              key={item.id ?? item.label}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={active === index}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                void commit([item.label], item);
                inputRef.current?.focus();
              }}
              className={`cursor-pointer break-words rounded-lg px-3 py-3 text-sm text-ink ${active === index ? "bg-indigo-soft/70" : "hover:bg-indigo-soft/30"}`}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
