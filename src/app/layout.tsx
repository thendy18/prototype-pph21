import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionResetBridge } from "../components/auth/SessionResetBridge";
import { getCurrentUserProfile } from "../lib/auth";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Taxeling",
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
        <TooltipProvider>
          <SessionResetBridge authenticated={Boolean(currentUser)} />
          {currentUser ? (
            <SidebarProvider>
              <AppSidebar currentUser={currentUser} />
              <SidebarInset>
                <header className="flex h-16 shrink-0 items-center gap-2 border-b border-[#6CA6C1]/20 bg-[#343434] text-[#F7FFF7] transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                  <div className="flex items-center gap-2 px-4">
                    <SidebarTrigger className="-ml-1 text-[#F7FFF7]/75 hover:bg-[#2F3061] hover:text-[#FFE66D]" />
                    <Separator
                      orientation="vertical"
                      className="mr-2 bg-[#6CA6C1]/30 data-[orientation=vertical]:h-4"
                    />
                    <AppBreadcrumb />
                  </div>
                </header>
                {children}
              </SidebarInset>
            </SidebarProvider>
          ) : (
            children
          )}
        </TooltipProvider>
      </body>
    </html>
  );
}
