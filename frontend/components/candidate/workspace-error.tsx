import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";

export function WorkspaceError({ title = "We couldn’t load this workspace." }: { title?: string }) {
  return (
    <Surface className="p-8 text-center sm:p-12" tone="peach">
      <p className="text-sm font-bold uppercase tracking-[0.14em] text-indigo">Connection issue</p>
      <h1 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-ink">{title}</h1>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-ink-muted">Your data has not been replaced with demo content. Check that the SapienWorx API and PostgreSQL migrations are running, then try again.</p>
      <div className="mt-6"><Button href="/candidate" variant="secondary">Try dashboard again</Button></div>
    </Surface>
  );
}
