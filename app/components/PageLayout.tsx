// components/PageLayout.tsx
import React from "react";

interface PageLayoutProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function PageLayout({ title, children, className }: PageLayoutProps) {
  return (
    <main className="flex-1 p-5 bg-gray-100">
      <h1 className="text-3xl font-bold mb-8">{title}</h1>
      <section className={`flex flex-col gap-5 ${className}`}>
        {children}
      </section>
    </main>
  );
}
