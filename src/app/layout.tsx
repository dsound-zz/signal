import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
   title: "SIGNAL - UAP Document Intelligence",
   description: "Credibility-weighted RAG over declassified UAP documents",
};

export default function RootLayout({
   children,
}: Readonly<{
   children: React.ReactNode;
}>) {
   return (
      <html lang="en">
         <body>{children}</body>
      </html>
   );
}
