import type { Metadata } from "next";
import { DatabaseProvider } from "@/contexts/DatabaseProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finanzas",
  description: "Aplicacion personal de finanzas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <DatabaseProvider>{children}</DatabaseProvider>
      </body>
    </html>
  );
}
