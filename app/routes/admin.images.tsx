import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { json } from "@remix-run/node";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { useLoaderData, Outlet, Link } from "@remix-run/react";
import { Button } from "~/components/ui/button";

interface Image {
  id: number;
  name: string;
}

export const loader = async () => {
  const images = await selectMany<Image>(db, "select id, name from images");
  return json({
    images,
  });
};

export default function Images() {
  const { images } = useLoaderData<typeof loader>();

  return (
    <>
      <Link to={`add`} relative="path">
        <Button>Add</Button>
      </Link>
      <Table>
        <TableCaption>A list of available images.</TableCaption>
        <TableHeader>
          <TableRow className="text-xl">
            <TableHead className="w-[200px]">Image Name</TableHead>
            <TableHead className="text-right ">Edit</TableHead>
            <TableHead className="text-right ">Delete</TableHead>
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
