import "./globals.css";
import PWARegister from "./pwa-register";

export const metadata = {
  title: "BON PINARD AI Inventory",
  description: "PDF・写真からワイン在庫をAI自動登録",
  manifest: "/manifest.json",
  themeColor: "#241c15",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BON PINARD"
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.svg"
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#241c15"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="BON PINARD" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
