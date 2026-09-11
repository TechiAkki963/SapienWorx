import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";
import "./sapienworx.css";
import "./data-dense-ux.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-ibm-plex-mono", weight: ["400", "500", "600"], display: "swap" });

export const metadata: Metadata = { title: "Sapienworx", description: "Smarter Hiring. Better Talent. Faster Growth." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body className={`${inter.variable} ${spaceGrotesk.variable} ${ibmPlexMono.variable}`}>{children}</body></html>; }
