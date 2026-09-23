import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Wordmark } from "@/components/brand/wordmark";

const columns = [
  { title:"For Candidates", links:[["Find Jobs","/jobs"],["Knowledge Hub","/#knowledge-hub"],["Career Resources","/#knowledge-hub"],["Create Account","/signup"]] },
  { title:"For Recruiters", links:[["Post a Job","/recruiter/login"],["Recruiter Signup","/recruiter/signup"],["Recruiter Login","/recruiter/login"],["Recruiter Workspace","/recruiter"]] },
  { title:"Company", links:[["About Us","/#about"],["Find Jobs","/jobs"],["Knowledge Hub","/resources"],["Candidate Login","/login"]] },
  { title:"Legal", links:[["Privacy Policy","/privacy"],["Subprocessors","/subprocessors"]] },
];

export function LandingFooter() {
  return (
    <footer className="swx4-footer"><Container><div className="swx4-footer-grid"><div className="swx4-footer-brand"><Wordmark /><p>People. Potential. Progress.</p><span>A career platform for what’s next.</span></div>{columns.map((column)=><div key={column.title}><h2>{column.title}</h2><ul>{column.links.map(([label,href])=><li key={label}><Link href={href}>{label}</Link></li>)}</ul></div>)}</div><div className="swx4-footer-bottom"><p>© 2026 SapienWorx. All rights reserved.</p><p>People make a brighter tomorrow.</p></div></Container></footer>
  );
}
