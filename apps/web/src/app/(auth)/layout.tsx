import React from "react";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-full w-full flex items-center justify-center bg-bg-app">
      {children}
    </div>
  );
}
