import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/layout/header";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ThemeProvider } from "@/components/layout/theme-provider";
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
  title: "Thermal Monitor",
  description: "Real-time thermal camera monitoring dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        {/* Desktop: fixed sidebar left + scrollable main content right */}
        <div className="flex h-screen overflow-hidden">
          {/* Fixed sidebar — hidden on mobile, visible md+ */}
          <aside className="hidden md:flex md:flex-col md:w-64 md:shrink-0 border-r bg-background">
            <div className="flex items-center gap-2 border-b px-4 h-14 shrink-0">
              <span className="font-semibold text-sm">Thermal Monitor</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarNav />
            </div>
          </aside>

          {/* Main column: sticky header + scrollable page content */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto bg-muted/40">
              {children}
            </main>
          </div>
        </div>

        <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
