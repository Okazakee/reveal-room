import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Reveal Room",
    template: "%s · Reveal Room",
  },
  description:
    "Make them earn the reveal. Hide a message behind a few quick puzzles, share the room, and reveal it together.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
