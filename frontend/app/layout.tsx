import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ThemeRuntime } from "@/components/theme/theme-runtime";

import "./globals.css";

const inter = localFont({ src: "../public/fonts/inter/InterVariable.woff2", variable: "--font-inter", weight: "100 900", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://sapienworx.com"),
  title: {
    default: "SapienWorx",
    template: "%s · SapienWorx",
  },
  description: "Human-first hiring for candidates and modern recruitment teams.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fbfaf7",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var m=localStorage.getItem("swx-theme")||"system";var d=m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=m;document.documentElement.classList.toggle("swx-dark",d);}catch(e){}})();` }} />
        <ThemeRuntime />
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
