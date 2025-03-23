interface ModuleListProps {
  children: React.ReactNode;
  className?: string;
}

export default function ModuleList({ children, className }: ModuleListProps) {
  return (
    <div
      className={`
      grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7
      gap-2 p-2 select-none
   
      ${className}
    `}
    >
      {children}
    </div>
  );
}
