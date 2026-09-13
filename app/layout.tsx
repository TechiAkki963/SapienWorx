import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Source_Serif_4 } from "next/font/google";
import { InteractionAccessibility } from "../components/interaction-accessibility";
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
import "./secondary-routes-canonical.css";
import "./recruiter-secondary-canonical.css";
import "./hiring-lifecycle.css";
import "./human-signal-refresh.css";

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
  title: "SapienWorx | Human-first hiring, intelligently structured",
  description: "SapienWorx connects people, employers and structured hiring workflows in one human-first recruitment platform.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${inter.variable} ${sourceSerif.variable} ${plexMono.variable}`}>
        <InteractionAccessibility />
        {children}
      </body>
    </html>
  );
}
