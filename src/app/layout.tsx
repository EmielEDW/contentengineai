import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ContentEngineAI",
  description: "Produce longform YouTube videos via a 22-state AI pipeline.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
