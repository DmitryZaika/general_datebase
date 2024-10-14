// Title.tsx
import React from "react";
import { Collapsible } from "./Collapsible";

interface TitleProps {
  children: React.ReactNode;
  text: string;
  state: boolean;
  setState: React.Dispatch<React.SetStateAction<boolean>>;
}

export function Title({ children, text, state, setState }: TitleProps) {
  return (
    <div className="bg-white p-5 rounded-md shadow-[-5px_-5px_15px_rgba(0,0,0,0.1)] select-none">
      <h2
        className="text-2xl font-bold cursor-pointer"
        onClick={() => setState(!state)}
      >
        {text}
      </h2>
      <Collapsible isOpen={state}>{children}</Collapsible>
    </div>
  );
}
