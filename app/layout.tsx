import type { Metadata } from "next";
import { Geist, Inter, JetBrains_Mono } from "next/font/google";
import "./sapienworx.css";
import "./data-dense-ux.css";
import "./reference-snapshot-theme.css";
import "./master-admin-snapshot.css";
import "./role-page-snapshots.css";
import "./remaining-portal-snapshots.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const geist = Geist({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-ibm-plex-mono", weight: ["400", "500", "600"], display: "swap" });

export const metadata: Metadata = { title: "Sapienworx", description: "Smarter Hiring. Better Talent. Faster Growth." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body className={`${inter.variable} ${geist.variable} ${jetBrainsMono.variable}`}>{children}</body></html>; }
