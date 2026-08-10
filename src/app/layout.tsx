import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AutorProvider } from "@/lib/autor-context";
import { AutorGate } from "@/components/AutorGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Synergy CRM",
  description: "CRM de Synergy Unlimited — clientes, accesos y línea de tiempo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} noise antialiased`}>
        <AutorProvider>
          <AutorGate>{children}</AutorGate>
        </AutorProvider>
      </body>
    </html>
  );
}
