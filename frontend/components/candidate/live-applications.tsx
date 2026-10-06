"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { CandidateApplication, humanize } from "@/lib/candidate";
import { candidateDate, candidateStageLabel } from "./workspace-job-utils";

const terminalStages = new Set(["withdrawn", "rejected", "hired"]);
const interviewStages = new Set([
  "technical_interview",
  "hr_round",
  "final_interview",
]);
export type ApplicationPageInfo = {
  page: number;
  limit: number;
  total: number;
};

export function LiveApplications({
  initialItems,
  pageInfo,
}: {
  initialItems: CandidateApplication[];
  pageInfo?: ApplicationPageInfo;
}) {
  const [items, setItems] = useState(initialItems);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [busyID, setBusyID] = useState<string | null>(null);
  const [confirmID, setConfirmID] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const version = useRef(0);
  const mounted = useRef(true);
  const mutating = useRef(false);
  const query = pageInfo
    ? `?page=${pageInfo.page}&limit=${pageInfo.limit}`
    : "";

  useEffect(() => {
    setItems(initialItems);
    setError("");
    setConfirmID(null);
  }, [initialItems]);
  const refresh = useCallback(async () => {
    if (mutating.current) return;
    const generation = ++version.current;
    setRefreshing(true);
    try {
      const result = await apiRequest<{ items: CandidateApplication[] | null }>(
        `/api/v1/candidate/applications${query}`,
      );
      if (mounted.current && generation === version.current) {
        setItems(result.items ?? []);
        setLastSynced(new Date().toISOString());
        setError("");
      }
    } catch (cause) {
      if (mounted.current && generation === version.current)
        setError(
          cause instanceof Error
            ? `Updates couldn’t be loaded: ${cause.message}`
            : "Updates couldn’t be loaded. Your last known applications are still shown.",
        );
    } finally {
      if (mounted.current && generation === version.current)
        setRefreshing(false);
    }
  }, [query]);
  useEffect(() => {
    mounted.current = true;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 10000);
    return () => {
      mounted.current = false;
      ++version.current;
      window.clearInterval(timer);
    };
  }, [refresh]);

  async function withdraw(applicationID: string) {
    if (mutating.current) return;
    mutating.current = true;
    ++version.current;
    setBusyID(applicationID);
    setRefreshing(false);
    setError("");
    let succeeded = false;
    try {
      await apiRequest(
        `/api/v1/candidate/applications/${encodeURIComponent(applicationID)}/withdraw`,
        { method: "POST" },
      );
      setItems((current) =>
        current.map((item) =>
          item.id === applicationID
            ? {
                ...item,
                stage: "withdrawn",
                updated_at: new Date().toISOString(),
              }
            : item,
        ),
      );
      setConfirmID(null);
      succeeded = true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not withdraw the application. No change was made.",
      );
    } finally {
      mutating.current = false;
      setBusyID(null);
      if (succeeded) void refresh();
    }
  }

  return (
    <div className="mt-6 min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
        <p>
          {error
            ? "Showing the last available data"
            : "Updates checked every 10 seconds"}
          {lastSynced
            ? ` · Last checked ${candidateDate(lastSynced, true)} IST`
            : ""}
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing || Boolean(busyID)}
          className="min-h-11 rounded-lg px-3 font-semibold text-indigo hover:bg-indigo-soft/40 disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "Refresh applications"}
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="mb-3 rounded-xl border border-line bg-peach/40 px-3 py-3 text-sm text-ink"
        >
          {error}
        </p>
      )}
      {!items.length ? (
        <Surface className="p-8 text-center" tone="mint">
          <h2 className="text-xl font-bold">Your tracker is ready.</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Apply to an active role and it will appear here.
          </p>
          <Button href="/candidate/jobs" variant="secondary" className="mt-4">
            Find a role
          </Button>
        </Surface>
      ) : (
        <div className="grid min-w-0 gap-4">
          {items.map((item) => (
            <Surface key={item.id} className="min-w-0 p-5 sm:p-6">
              <div className="flex min-w-0 flex-wrap justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-lg font-bold">
                    <Link
                      className="hover:text-indigo hover:underline"
                      href={`/candidate/jobs/${item.job_id}`}
                    >
                      {item.job_title || "Role unavailable"}
                    </Link>
                  </h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    {item.company_name || "Company unavailable"}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {[item.city, item.state].filter(Boolean).join(", ") ||
                      item.country_code ||
                      "Location not specified"}{" "}
                    · {humanize(item.work_mode || "not_specified")}
                  </p>
                </div>
                <span className="h-fit rounded-full bg-indigo-soft/70 px-3 py-1.5 text-xs font-bold text-indigo">
                  {candidateStageLabel(item.stage)}
                </span>
              </div>
              {item.job_status && item.job_status !== "active" && (
                <p className="mt-3 text-xs font-semibold text-ink-muted">
                  This job is {humanize(item.job_status).toLowerCase()}. Your
                  application history is retained.
                </p>
              )}
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm min-[428px]:grid-cols-2">
                <div>
                  <dt className="text-xs text-ink-muted">Applied</dt>
                  <dd className="mt-1 font-medium">
                    {candidateDate(item.applied_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Latest update</dt>
                  <dd className="mt-1 font-medium">
                    {candidateDate(item.updated_at, true)} IST
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line/60 pt-3">
                {interviewStages.has(item.stage) ? (
                  <Link
                    href="/candidate/interviews"
                    className="inline-flex min-h-11 items-center text-sm font-semibold text-indigo hover:underline"
                  >
                    View interviews
                  </Link>
                ) : item.stage === "offer" ? (
                  <Link
                    href="/candidate/inbox"
                    className="inline-flex min-h-11 items-center text-sm font-semibold text-indigo hover:underline"
                  >
                    Check your inbox
                  </Link>
                ) : !terminalStages.has(item.stage) ? (
                  <p className="text-xs text-ink-muted">
                    We’ll notify you when the recruiter updates your
                    application.
                  </p>
                ) : null}
                {!terminalStages.has(item.stage) &&
                  (confirmID === item.id ? (
                    <div
                      role="group"
                      aria-label={`Confirm withdrawal of ${item.job_title}`}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <p className="w-full text-sm text-ink">
                        Withdraw this application? This cannot be undone here.
                      </p>
                      <button
                        type="button"
                        disabled={Boolean(busyID)}
                        onClick={() => void withdraw(item.id)}
                        className="min-h-11 rounded-lg border border-line px-3 text-sm font-semibold text-red-700 dark:text-red-300"
                      >
                        {busyID === item.id
                          ? "Withdrawing…"
                          : "Confirm withdrawal"}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(busyID)}
                        onClick={() => setConfirmID(null)}
                        className="min-h-11 rounded-lg px-3 text-sm font-semibold text-ink"
                      >
                        Keep application
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={Boolean(busyID)}
                      onClick={() => setConfirmID(item.id)}
                      className="ml-auto min-h-11 rounded-lg border border-line px-3 text-sm font-semibold text-ink-muted hover:bg-indigo-soft/30"
                    >
                      Withdraw
                    </button>
                  ))}
              </div>
            </Surface>
          ))}
        </div>
      )}
      {pageInfo && pageInfo.total > pageInfo.limit && (
        <nav
          aria-label="Application pages"
          className="mt-6 flex flex-wrap items-center justify-between gap-3"
        >
          {pageInfo.page > 1 ? (
            <Button
              href={`/candidate/applications?page=${pageInfo.page - 1}`}
              variant="secondary"
            >
              Previous
            </Button>
          ) : (
            <span />
          )}
          <span className="text-sm text-ink-muted">
            Page {pageInfo.page} of {Math.ceil(pageInfo.total / pageInfo.limit)}
          </span>
          {pageInfo.page * pageInfo.limit < pageInfo.total ? (
            <Button
              href={`/candidate/applications?page=${pageInfo.page + 1}`}
              variant="secondary"
            >
              Next
            </Button>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
