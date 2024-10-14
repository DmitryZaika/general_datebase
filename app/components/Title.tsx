// Title.tsx
import React from "react";

interface TitleProps {
  children: React.ReactNode;
  text: string;
  state: boolean;
  setState: React.Dispatch<React.SetStateAction<boolean>>;
}

export function Title({ children, text, state, setState }: TitleProps) {
  return (
    <div className="bg-white p-5 rounded-lg shadow-lg select-none">
      <h2
        className="text-2xl font-bold cursor-pointer"
        onClick={() => setState(!state)}
      >
        {text}
      </h2>
      <div
        className={`overflow-hidden transition-all ${
          state
            ? "duration-[2500ms] max-h-[5000px] opacity-100"
            : "duration-[500ms] max-h-0 opacity-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
