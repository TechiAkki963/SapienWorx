import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import "./logout.css";
import "./recruiter-search-redesign.css";
import "./ui-spec.css";
import "./workflow.css";
import "./recruiter-flow.css";
import "./reports.css";
import "./master-governance.css";
import "./editorial-system.css";
import "./portal-improvements.css";
import "./workspace-polish.css";
import "./master-activity.css";
import "./knowledge.css";
import "./mobile-workspaces.css";
import "./workspace-shell-v2.css";
import "./candidate-interviews.css";
import "./legal.css";
import "./ui-v1.css";
import "./public-auth-v1.css";
import "./candidate-v1.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SAPIENWORX_PUBLIC_SITE_URL ?? "https://www.sapienworx.com"),
  title: "Sapienworx | Recruitment that works",
  description: "A candidate-first recruitment workspace for modern hiring teams.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${plexMono.variable}`}>{children}</body>
    </html>
  );
}
