import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "~/components/ui/accordion";
import { Link, useLoaderData } from "react-router";
import { LoaderFunctionArgs, redirect } from "react-router";
import { db } from "~/db.server";
import { selectMany } from "~/utils/queryHelpers";
import { getEmployeeUser } from "~/utils/session.server";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "~/components/ui/data-table";
import { Button } from "~/components/ui/button";
import { FaFile } from "react-icons/fa";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { ActionDropdown } from "~/components/molecules/DataTable/ActionDropdown";


interface Supplier {
  id: number;
  supplier_name: string;
  manager?: string;
  phone?: string;
  notes?: string;
  email?: string;
  website?: string;
}

interface SupplierFile {
  id: number;
  supplier_id: number;
  name: string;
  url: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const user = await getEmployeeUser(request);
  const suppliers = await selectMany<Supplier>(
    db,
    "select id,website, supplier_name,  manager, phone, email, notes from suppliers WHERE company_id = ?",
    [user.company_id],
  );
  const files = await selectMany<SupplierFile>(
    db,
    "select id, name, url from supplier_files WHERE supplier_id = ?",
    [suppliers[0].id],
  );
  const allFiles = await selectMany<{ supplier_id: number } & SupplierFile>(
    db,
    "select id, supplier_id, name, url from supplier_files",
    []
  );

  const filesMap: Record<number, SupplierFile[]> = {};
  allFiles.forEach(file => {
    if (!filesMap[file.supplier_id]) {
      filesMap[file.supplier_id] = [];
    }
    filesMap[file.supplier_id].push({
      id: file.id,
      supplier_id: file.supplier_id,
      name: file.name,
      url: file.url
    });
  });
  return { suppliers, filesMap };
};

function FileDropdown({ files }: { files: SupplierFile[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <FaFile /> Files ({files.length})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {files.length > 0 ? (
          files.map(file => (
            <DropdownMenuItem key={file.id} asChild>
              <a 
                href={file.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full cursor-pointer"
              >
                {file.name}
              </a>
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled>No files</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const getColumns = (filesMap: Record<number, SupplierFile[]>): ColumnDef<Supplier>[] => [
  {
    accessorKey: "supplier_name",
    header: "Supplier Name",
    cell: ({ row }) => (
      <Link
        to={row.original.website || ""}
        className="text-blue-600 hover:underline"
        target="_blank"
      >
        {row.original.supplier_name}
      </Link>
    ),
  },
  {
    accessorKey: "manager",
    header: "Manager",
  },
  {
    accessorKey: "phone",
    header: "Phone Number",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "notes",
    header: "Notes",
  },
  {
    id: "files",
    header: "Files",
    cell: ({ row }) => {
      const files = filesMap[row.original.id] || [];
      const fileObject = files.reduce<Record<string, string>>((acc, file) => {
        acc[file.name] = file.url;
        return acc;
      }, {});
      return (
        <ActionDropdown
          asBlank={true}
        actions={fileObject}
      />
      )
    },
  },
];

export default function Suppliers() {
  const { suppliers, filesMap } = useLoaderData<typeof loader>();
  return <DataTable columns={getColumns(filesMap)} data={suppliers} />;
}
