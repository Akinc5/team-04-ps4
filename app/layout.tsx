import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeskBot · IT Helpdesk Agent",
  description: "An IT helpdesk agent that fixes common problems from the knowledge base and manages tickets under SLA rules.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
