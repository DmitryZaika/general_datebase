// components/PageLayout.tsx
import type React from 'react'

interface PageLayoutProps {
  title: string
  children: React.ReactNode
  className?: string
}

export function PageLayout({ title, children, className }: PageLayoutProps) {
  return (
    <div className='flex-1 p-2 sm:p-5'>
      <h1 className='text-3xl text-center sm:text-left font-bold mb-8'>{title}</h1>
      <section className={`flex flex-col gap-3 ${className}`}>{children}</section>
    </div>
  )
}
