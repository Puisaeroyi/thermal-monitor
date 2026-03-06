import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { TempUnitProvider } from "@/contexts/temp-unit-context";
import { Toaster } from "@/components/ui/sonner";
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`
          ${geistSans.variable}
          ${geistMono.variable}
          bg-background
          text-foreground
          antialiased
        `}
      >
        <ThemeProvider attribute="class" defaultTheme="system">
          <TempUnitProvider>

            {children}

            <Toaster />

          </TempUnitProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}