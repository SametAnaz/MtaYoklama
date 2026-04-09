import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const titleFont = Space_Grotesk({
  variable: "--font-title",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "MTA Vardiya ve Yoklama",
  description: "Milli Teknoloji Atölyesi vardiya ve yoklama yönetim paneli",
};

// No-FOUC (flash of unstyled content) script — sets theme BEFORE React hydrates
const themeScript = `
(function(){
  try{
    var t=localStorage.getItem('theme');
    var p=window.matchMedia('(prefers-color-scheme: dark)').matches;
    var d=t==='dark'||(t===null&&p);
    document.documentElement.setAttribute('data-theme',d?'dark':'light');
  }catch(e){}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${titleFont.variable} ${monoFont.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
