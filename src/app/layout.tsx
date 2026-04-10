import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppHeader } from "../components/auth/AppHeader";
import { SessionResetBridge } from "../components/auth/SessionResetBridge";
import { getCurrentUserProfile } from "../lib/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Payroll Coretax",
  description: "Internal payroll and PPh21 management",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentUser = await getCurrentUserProfile();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-950">
        <SessionResetBridge authenticated={Boolean(currentUser)} />
        {currentUser ? <AppHeader currentUser={currentUser} /> : null}
        {children}
      </body>
    </html>
  );
}
