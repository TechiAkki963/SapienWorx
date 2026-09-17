import { Container } from "@/components/layout/container";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicHeader } from "@/components/site/public-header";
import { SubprocessorRegister } from "@/components/site/subprocessor-register";

export default function SubprocessorsPage() {
  return (
    <main className="min-h-screen bg-[#f8fbff] text-ink">
      <PublicHeader />
      <Container>
        <section className="mx-auto max-w-5xl py-14 sm:py-20">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-indigo">Transparency register</p>
          <h1 className="mt-4 font-serif text-5xl font-semibold tracking-[-0.05em] text-navy sm:text-6xl">SapienWorx subprocessors</h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-ink-muted">This register lists active service providers recorded as processing personal data on behalf of SapienWorx, including their purpose, relevant data categories and processing locations.</p>
          <div className="mt-10"><SubprocessorRegister /></div>
        </section>
      </Container>
      <PublicFooter />
    </main>
  );
}
