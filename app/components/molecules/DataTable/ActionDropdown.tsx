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
  editLink?: string;
  deleteLink?: string;
}

export const ActionDropdown = ({ editLink, deleteLink }: IProps) => {
  return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            {editLink && <DropdownMenuItem asChild><Link to={editLink}>Edit</Link></DropdownMenuItem>}
            {deleteLink && <DropdownMenuItem asChild><Link to={deleteLink}>Delete</Link></DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
  )
}
