import { NavLink } from "react-router";
import { TabsTrigger } from "../ui/tabs";

export function NavTab({ name }: { name: string }) {
  return (
    <NavLink to={name.toLowerCase()}>
      <TabsTrigger value={name.toLowerCase()}>{name}</TabsTrigger>
    </NavLink>
  );
}
