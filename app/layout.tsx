import "./globals.css";
import PWARegister from "./pwa-register";
import { Playfair_Display, EB_Garamond } from "next/font/google";

const displayFont = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
});

const wineSerifFont = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-wine-serif",
  display: "swap",
});

export const metadata = {
  title: "BON PINARD AI Inventory",
  description: "PDF・写真からワイン在庫をAI自動登録",
  manifest: "/manifest.json",

  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BON PINARD",
  },

  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.svg",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#241c15",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <meta
          name="mobile-web-app-capable"
          content="yes"
        />

        <meta
          name="apple-mobile-web-app-capable"
          content="yes"
        />

        <meta
          name="apple-mobile-web-app-title"
          content="BON PINARD"
        />

        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
      </head>

      <body
        className={`${displayFont.variable} ${wineSerifFont.variable}`}
      >
        <PWARegister />
        {children}
      </body>
    </html>
  );
}