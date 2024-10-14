// ModuleList.tsx
import { useState } from "react";
import { Collapsible } from "./Collapsible";

interface ModuleListProps {
  name: string;
  children: React.ReactNode;
}

export default function ModuleList({ name, children }: ModuleListProps) {
  const [open, setOpen] = useState(false);

  return (
    <li className="mb-2">
      <h3
        onClick={() => setOpen(!open)}
        className="sm:pl-4 text-lg font-bold cursor-pointer select-none"
      >
        {name}
      </h3>
      <Collapsible isOpen={open} className="mt-2 sm:pl-4">
        <div className="text-md select-text">{children}</div>
      </Collapsible>
    </li>
  );
}
