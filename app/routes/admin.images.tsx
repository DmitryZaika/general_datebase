import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { useLoaderData, Outlet, Link } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { getAdminUser } from "~/utils/session.server";
import { csrf } from "~/utils/csrf.server";

interface Image {
  id: number;
  name: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }

  const user = await getAdminUser(request);
  const images = await selectMany<Image>(
    db,
    "SELECT id, name, url FROM images WHERE company_id = ?",
    [user.company_id]
  );
  return { images };
};
export default function Images() {
  const { images } = useLoaderData<typeof loader>();

  return (
    <>
      <Link to={`add`} relative="path">
        <Button>Add Image</Button>
      </Link>
      <Table>
        <TableCaption>A list of available images.</TableCaption>
        <TableHeader>
          <TableRow className="text-xl">
            <TableHead className="w-[200px]">Image Name</TableHead>
            <TableHead className="text-right ">Edit Image</TableHead>
            <TableHead className="text-right ">Delete Image</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {images.map((image) => (
            <TableRow key={image.id}>
              <TableCell className="font-medium ">{image.name}</TableCell>
              <TableCell className="text-right ">
                <Link to={`edit/${image.id}`} className="text-xl">
                  Edit
                </Link>
              </TableCell>
              <TableCell className="text-right w-[200px]">
                <Link to={`delete/${image.id}`} className="text-xl">
                  Delete
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Outlet />
    </>
  );
}
