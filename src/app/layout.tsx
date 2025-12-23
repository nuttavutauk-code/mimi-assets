import "./globals.css";
import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import { Toaster } from "sonner";
import NextAuthProvider from "@/providers/SessionProvider";

// ✅ โหลดฟอนต์ Prompt จาก Google (Next.js จะ host เอง)
const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-prompt",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MiMi Assets – We Hear Every Asset",
  description: "Asset Management System by MiMi",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={prompt.variable} suppressHydrationWarning>
      <body className={prompt.className} suppressHydrationWarning>
        {/* ✅ ครอบด้วย SessionProvider จาก Client Component */}
        <NextAuthProvider>
          <Toaster richColors position="top-right" />
          {children}
        </NextAuthProvider>
      </body>
    </html>
  );
}