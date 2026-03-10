import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scroll - Информационный помощник",
  description: "Официальный информационный портал полицейского департамента СКО",
  keywords: ["полиция", "ПДД", "правила дорожного движения", "Казахстан", "СКО"],
  icons: {
    icon: [
      { url: "/assets/images/download.png", sizes: "16x16", type: "image/png" },
      { url: "/assets/images/download.png", sizes: "32x32", type: "image/png" },
      { url: "/assets/images/download.png", sizes: "48x48", type: "image/png" },
      { url: "/assets/images/download.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/assets/images/download.png",
    apple: "/assets/images/download.png",
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
