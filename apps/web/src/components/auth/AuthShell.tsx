import React from "react";

interface AuthShellProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <div className="flex flex-col gap-24 w-full max-w-[400px] px-16 mx-auto py-32">
      {/* Branding & Welcome */}
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="w-40 h-40 bg-brand-primary rounded-lg flex items-center justify-center shadow-subtle mb-8">
          <span className="text-text-inverse font-bold text-h4">P</span>
        </div>
        <h1 className="text-h3 font-bold text-text-primary">
          {title}
        </h1>
        {description && (
          <p className="text-body-small text-text-secondary">
            {description}
          </p>
        )}
      </div>

      {/* Main Card */}
      <div className="flex flex-col w-full glass-panel border border-border-default rounded-xl shadow-subtle p-24 sm:p-32">
        {children}
      </div>
    </div>
  );
}
