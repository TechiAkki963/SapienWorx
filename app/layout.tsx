import type { Metadata } from "next";
import { IBM_Plex_Mono, Newsreader, Nunito_Sans } from "next/font/google";
import "./ui-v1.css";
import "./public-auth-v1.css";
import "./admin-auth-v2.css";
import "./candidate-v1.css";
import "./candidate-applications-v2.css";
import "./candidate-profile-v2.css";
import "./complete-v1.css";
import "./ui-v1-final.css";
import "./canonical-redesign.css";
import "./auth-canonical.css";
import "./auth-greenhouse-qa.css";
// Canonical secondary layers keep deep Candidate, Recruiter and Admin routes in the same product system.
import "./secondary-routes-canonical.css";
import "./recruiter-secondary-canonical.css";
import "./hiring-lifecycle.css";

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-nunito-sans",
  weight: ["400", "500", "600", "700"],
});

// Newsreader provides a lighter editorial rhythm for public and auth surfaces.
// Keep the existing variable name so older token-backed CSS remains compatible.
const editorialSerif = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-merriweather",
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ibm-plex-mono",
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
      <body className={`${nunitoSans.variable} ${editorialSerif.variable} ${plexMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
