import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import { Link } from "react-router";

interface IProps {
  actions: Record<string, string>;
  asBlank?: boolean;
  label?: string;
}

export const ActionDropdown = ({ actions, asBlank = false, label = "Actions" }: IProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0" disabled={Object.keys(actions).length === 0}>
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {Object.entries(actions).map(([action, link]) => (
          <DropdownMenuItem asChild>
            <Link to={link} target={asBlank ? "_blank" : "_self"}>
              {action.charAt(0).toUpperCase() + action.slice(1)}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
