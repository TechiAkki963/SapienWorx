import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Source_Serif_4 } from "next/font/google";
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
import "./secondary-routes-canonical.css";
import "./recruiter-secondary-canonical.css";
import "./hiring-lifecycle.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-source-serif-4",
  weight: ["400", "500", "600"],
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
      <body className={`${inter.variable} ${sourceSerif.variable} ${plexMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
