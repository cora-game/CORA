import type { Metadata } from "next";
import { Caprasimo, Gabarito } from "next/font/google";
import "./globals.css";
import { Providers } from "../components/Providers";

// DESIGN.md: Caprasimo = headline/logo, Gabarito = body/UI
const caprasimo = Caprasimo({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-caprasimo",
  display: "swap",
});

const gabarito = Gabarito({
  weight: ["400", "500", "700", "900"],
  subsets: ["latin"],
  variable: "--font-gabarito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CORA - Cognitive Arena",
  description: "High-stakes Wager-Fi esports for General Aptitude Tests.",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${caprasimo.variable} ${gabarito.variable}`}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

