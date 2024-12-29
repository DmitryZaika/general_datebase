interface ModuleListProps {
  children: React.ReactNode;
  className?: string;
}

export default function ModuleList({ children, className }: ModuleListProps) {
  return (
    <div
      className={`
      grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8 2xl:grid-cols-10
      gap-2 p-2 select-none
   
      ${className}
    `}
    >
      {children}
    </div>
  );
}
