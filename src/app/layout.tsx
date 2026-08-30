import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const heebo = Heebo({
  variable: "--font-sans",
  subsets: ["hebrew", "latin"],
});

export const metadata: Metadata = {
  title: "סרנגה ושומן | ניהול לקוחות ומשימות",
  description: "מערכת ניהול לקוחות ומשימות למשרד סרנגה ושומן רואות חשבון",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={cn("h-full", "antialiased", heebo.variable)}>
      <body className="min-h-full flex flex-col font-sans">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="top-center" dir="rtl" />
      </body>
    </html>
  );
}
