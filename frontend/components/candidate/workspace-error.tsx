import { WorkspaceRetry } from "@/components/candidate/workspace-retry";
import { Surface } from "@/components/ui/surface";

export function WorkspaceError({
  title = "We couldn’t load this workspace.",
  message,
  retryHref = "/candidate",
}: {
  title?: string;
  message?: string;
  retryHref?: string;
}) {
  return (
    <Surface className="p-8 text-center sm:p-12" tone="peach">
      <p className="text-sm font-bold uppercase tracking-[0.14em] text-indigo">
        Connection issue
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-ink">
        {title}
      </h1>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-ink-muted">
        {message ??
          "We couldn’t connect just now. Your account data is unchanged. Try again in a moment."}
      </p>
      <div className="mt-6">
        <WorkspaceRetry href={retryHref} />
      </div>
    </Surface>
  );
}
