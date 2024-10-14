// BlockList.tsx
import React from "react";

interface BlockListProps {
  children: React.ReactNode;
}

export default function BlockList({ children }: BlockListProps) {
  return <ul className="pt-3">{children}</ul>;
}
