import { ColumnDef } from "@tanstack/react-table";
import { Stone } from "~/utils/queries";
import { DataTable } from "~/components/ui/data-table";

export function StoneTable({ stones, columns, enableHighlight = false }: { stones: Stone[]; columns: ColumnDef<Stone>[]; enableHighlight?: boolean }) {

    const getHighlight = (stone: Stone) => {
      const imp = stone.samples_importance ?? 1; // 1 low,2 medium,3 high
      const amount = stone.samples_amount ?? 0;

      if (imp === 1) {
        if (amount < 2) return "bg-red-100";
        if (amount < 4) return "bg-yellow-100";
      }
      if (imp === 2) {
        if (amount < 3) return "bg-red-100";
        if (amount < 6) return "bg-yellow-100";
      }
      if (imp === 3) {
        if (amount < 5) return "bg-red-100";
        if (amount < 7) return "bg-yellow-100";
      }
      return "";
    };

    return (
      <div onClick={(e) => e.stopPropagation()}>
        <DataTable
          columns={columns}
          data={stones.map((stone) => ({
            ...stone,
            className: `${enableHighlight ? getHighlight(stone) : ''} cursor-pointer ${enableHighlight ? 'no-hover' : ''} ${stone.is_display ? '' : 'opacity-60'}`.trim(),
          }))}
        />
      </div>
    );
  }