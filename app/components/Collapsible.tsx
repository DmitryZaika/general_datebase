import React from "react";

interface CollapsibleProps {
  isOpen: boolean;
  openDuration?: string;
  closeDuration?: string;
  maxHeight?: string;
  children: React.ReactNode;
  className?: string;
}

export function Collapsible({
  isOpen,
  openDuration = "duration-[1500ms]",
  closeDuration = "duration-[1000ms]",
  maxHeight = "max-h-[5000px]",
  children,
  className = " pl-4",
}: CollapsibleProps) {
  return (
    <div
      className={`overflow-hidden transition-all ${
        isOpen ? `${openDuration} ${maxHeight}` : `${closeDuration} max-h-0`
      } ${className}`}
    >
      {children}
    </div>
  );
}
