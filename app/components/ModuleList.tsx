import { useState } from "react";

interface ModuleListProps {
  name: string;
  children: JSX.Element | JSX.Element[];
}

export default function ModuleList({ name, children }: ModuleListProps) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <h3 onClick={() => setOpen(!open)}>{name}</h3>
      {open && <div>{children}</div>}
    </li>
  );
}
