import { ArrowUpDown } from "lucide-react";
import { Column } from "@tanstack/react-table";
import { Button } from "~/components/ui/button";

interface IProps<T> {
  column: Column<T, unknown>;
  title: string;
}

export const SortableHeader = <T,>({ column, title }: IProps<T>) => (
  <Button
    variant="ghost"
    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
  >
    {title}
    <ArrowUpDown className="ml-2 h-4 w-4" />
  </Button>
);
