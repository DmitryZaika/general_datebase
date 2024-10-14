import React from "react";

interface ImageListProps {
  children: React.ReactNode;
}

export function ImageList({ children }: ImageListProps) {
  return (
    <div
      className="
        grid 
        grid-cols-2
        gap-2.5 
        
        p-1
        sm:p-2.5 
        border 
        border-gray-300 
        rounded 
        bg-gray-100 
        w-full 
        mt-5
        overflow-x-auto
        sm:grid-cols-3
        md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]
      "
    >
      {children}
    </div>
  );
}
