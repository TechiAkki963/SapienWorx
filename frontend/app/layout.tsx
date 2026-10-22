import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ThemeRuntime } from "@/components/theme/theme-runtime";

import "./globals.css";

const inter = localFont({ src: "../public/fonts/inter/InterVariable.woff2", variable: "--font-inter", weight: "100 900", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://sapienworx.com"),
  title: {
    default: "SapienWorx | AI Recruitment Platform, ATS & Talent Intelligence",
    template: "%s · SapienWorx",
  },
  description: "Hire smarter with SapienWorx, an AI-powered recruitment platform for candidate sourcing, matching, applicant tracking, recruiter CRM, outreach, interviews and hiring analytics.",
  applicationName: "SapienWorx",
  category: "Recruitment technology",
  openGraph: {
    type: "website",
    siteName: "SapienWorx",
    title: "SapienWorx | AI Recruitment Platform, ATS & Talent Intelligence",
    description: "AI-powered recruitment for candidate sourcing, matching, applicant tracking, recruiter CRM, outreach, interviews and hiring analytics.",
    url: "https://sapienworx.com/",
  },
  twitter: {
    card: "summary_large_image",
    title: "SapienWorx | AI Recruitment Platform, ATS & Talent Intelligence",
    description: "AI-powered recruitment for candidate sourcing, matching, applicant tracking, recruiter CRM, outreach, interviews and hiring analytics.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fbfaf7",
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "SapienWorx",
  url: "https://sapienworx.com/",
  description: "AI-powered recruitment platform for candidate sourcing, matching, applicant tracking, recruiter CRM, outreach, interviews and hiring analytics.",
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "SapienWorx",
  url: "https://sapienworx.com/",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://sapienworx.com/jobs?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var m=localStorage.getItem("swx-theme")||"system";var d=m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=m;document.documentElement.classList.toggle("swx-dark",d);}catch(e){}})();` }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c") }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c") }} />
        <ThemeRuntime />
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
