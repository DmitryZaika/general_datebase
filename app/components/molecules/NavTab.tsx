import { NavLink } from "@remix-run/react";
import { TabsTrigger } from "../ui/tabs";

export function NavTab({ name }: { name: string }) {
  return (
    <NavLink to={name.toLowerCase()}>
      <TabsTrigger value={name.toLowerCase()}>{name}</TabsTrigger>
    </NavLink>
  );
}
