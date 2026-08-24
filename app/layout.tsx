import type { Metadata } from "next";
import { DM_Sans, Bebas_Neue, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bebasNeue = Bebas_Neue({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["700", "800"],
});

export const metadata: Metadata = {
  title: "Menú al Día",
  description:
    "Actualiza tu menú del día en 2 minutos, genera flyers para WhatsApp y recibe pedidos sin comisiones.",
  icons: {
    icon: [
      { url: "/brand/menualdia-icon.svg", type: "image/svg+xml" },
      {
        url: "/brand/menualdia-favicon-32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/brand/menualdia-favicon-16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        url: "/brand/menualdia-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/brand/menualdia-apple-180.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-MX"
      className={`${dmSans.variable} ${bebasNeue.variable} ${plusJakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
