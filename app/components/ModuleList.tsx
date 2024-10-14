// ModuleList.tsx
import { useState } from "react";

interface ModuleListProps {
  name: string;
  children: JSX.Element | JSX.Element[];
}

export default function ModuleList({ name, children }: ModuleListProps) {
  const [open, setOpen] = useState(false);

  return (
    <li className="mb-2">
      {/* Увеличенный и жирный шрифт для модуля */}
      <h3
        onClick={() => setOpen(!open)}
        className="pl-4 text-lg font-bold cursor-pointer select-none"
      >
        {name}
      </h3>
      <div
        className={`mt-2 pl-4 overflow-hidden transition-all ${
          open
            ? "duration-[2000ms] max-h-[5000px] opacity-100"
            : "duration-[500ms] max-h-0 opacity-0"
        }`}
      >
        {/* Увеличенный и жирный шрифт для подмодулей */}
        <div className="text-lg font-bold">{children}</div>
      </div>
    </li>
  );
}
