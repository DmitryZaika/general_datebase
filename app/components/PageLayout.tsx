// components/PageLayout.tsx
import React from "react";

interface PageLayoutProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function PageLayout({ title, children, className }: PageLayoutProps) {
  return (
    <main className="flex-1 sm:p-5 bg-gray-100">
      <h1 className="text-3xl text-center sm:text-left font-bold mb-8">
        {title}
      </h1>
      <section className={`flex flex-col gap-3 ${className}`}>
        {children}
      </section>
    </main>
  );
}
