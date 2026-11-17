import React from "react";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      data-theme="light"
      style={{ colorScheme: "light" }}
      className="relative min-h-screen w-full flex items-center justify-center bg-[#E3E5EA] text-[#0A0B0D] overflow-hidden select-none"
    >
      {children}
    </div>
  );
}
