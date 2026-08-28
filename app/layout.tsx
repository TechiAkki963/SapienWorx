import type { Metadata } from "next";
import "./globals.css";
import "./logout.css";
import "./recruiter-search-redesign.css";
import "./ui-spec.css";
import "./workflow.css";
import "./reports.css";
import "./master-governance.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SAPIENWORX_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Sapienworx | Recruitment that works",
  description: "A candidate-first recruitment workspace for modern hiring teams.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
