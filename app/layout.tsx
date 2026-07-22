import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "FillProof — Broker Import QA";
const description =
  "Fixed-scope synthetic regression fixtures and observed-result reports for one existing USD stock or ETF CSV importer.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost ?? requestHeaders.get("host") ?? "localhost:3000";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : host.startsWith("localhost")
        ? "http"
        : "https";
  const origin = new URL(`${protocol}://${host}`);
  const socialCard = new URL("/og.png", origin).toString();

  return {
    metadataBase: origin,
    title,
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title,
      description,
      type: "website",
      url: origin,
      siteName: "FillProof",
      images: [
        {
          url: socialCard,
          width: 1730,
          height: 909,
          alt: "FillProof regression evidence for broker CSV importers",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialCard],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
