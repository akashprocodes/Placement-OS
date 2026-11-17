import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Placement OS",
  description: "Placement preparation platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="color-scheme" content="light" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try {
                var t = localStorage.getItem("theme");
                if (!t || t === "dark") {
                  localStorage.setItem("theme", "light");
                  t = "light";
                }
                document.documentElement.setAttribute("data-theme", t);
                document.documentElement.classList.remove("dark");
                document.documentElement.classList.add(t);
                var m = document.querySelector('meta[name="color-scheme"]');
                if (m) m.content = t;
              } catch(e) {}
            })()`,
          }}
        />
      </head>
      <body className="h-full bg-bg-app text-text-primary transition-colors duration-200">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
