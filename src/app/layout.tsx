import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SonarAudio | The scene is yours.",
  description: "Direct a two-character audio conversation, switch performance settings, and let the audience choose the next turn.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
