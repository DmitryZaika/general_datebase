import { ColumnDef } from "@tanstack/react-table";
import { LoaderFunctionArgs, redirect } from "react-router";
import { Link, Outlet, useLoaderData, useNavigation } from "react-router";
import { PageLayout } from "~/components/PageLayout";
import { Button } from "~/components/ui/button";
import {
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  Table,
  TableRow,
} from "~/components/ui/table";
import { db } from "~/db.server";
import { selectMany } from "~/utils/queryHelpers";
import { getAdminUser } from "~/utils/session.server";
import { DataTable } from "~/components/ui/data-table";
import { ActionDropdown } from "~/components/molecules/DataTable/ActionDropdown";
import { LoadingButton } from "~/components/molecules/LoadingButton";
import { useEffect, useState } from "react";

interface Instructions {
  id: number;
  title: string;
  parent_id: number;
  after_id: number;
  rich_text: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const user = await getAdminUser(request);
  const instructions = await selectMany<Instructions>(
    db,
    "select id, title, parent_id, after_id, rich_text from instructions WHERE company_id = ?",
    [user.company_id],
  );
  return { instructions };
};

const instructionsColumn: ColumnDef<Instructions>[] = [
  {
    accessorKey: "title",
    header: "Title",
  },
  {
    accessorKey: "parent_id",
    header: "Parent Id",
  },
  {
    accessorKey: "after_id",
    header: "Order",
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return (
        <ActionDropdown
          actions={{
            edit: `edit/${row.original.id}`,
            delete: `delete/${row.original.id}`,
          }}
        />
      );
    },
  },
];

export default function AdminInstructions() {
  const { instructions } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [isAddingInstruction, setIsAddingInstruction] = useState(false);

  useEffect(() => {
    if (navigation.state === "idle") {
      if (isAddingInstruction) setIsAddingInstruction(false);
    }
  }, [navigation.state]);

  const handleAddInstructionClick = () => {
    setIsAddingInstruction(true);
  };

  return (
    <PageLayout title="Instructions">
      <Link to={`add`} relative="path" onClick={handleAddInstructionClick}>
        <LoadingButton loading={isAddingInstruction}>Add Instruction</LoadingButton>
      </Link>
      <DataTable columns={instructionsColumn} data={instructions} />
      <Outlet />
    </PageLayout>
  );
}
