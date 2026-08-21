import { CandidateDomainGate } from "../../components/candidate-domain";

export default function CandidateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <CandidateDomainGate>{children}</CandidateDomainGate>;
}
