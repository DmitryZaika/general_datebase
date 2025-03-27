// admin.images.tsx

import React from "react";
import { LoaderFunctionArgs, redirect } from "react-router";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { useLoaderData, Link, Outlet, useNavigation } from "react-router";
import { Button } from "~/components/ui/button";
import { FaPencilAlt, FaTimes } from "react-icons/fa";
import { Image } from "~/components/molecules/Image";
import { getAdminUser } from "~/utils/session.server";
import { useArrowToggle } from "~/hooks/useArrowToggle";
import { LoadingButton } from "~/components/molecules/LoadingButton";
import { useEffect, useState } from "react";

interface ImageItem {
  id: number;
  name: string;
  url: string | null;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${encodeURIComponent(String(error))}`);
  }

  const user = await getAdminUser(request);
  const images = await selectMany<ImageItem>(
    db,
    "SELECT id, name, url FROM images WHERE company_id = ?",
    [user.company_id]
  );
  return { images };
};

export default function AdminImages() {
  const { images } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [isAddingImage, setIsAddingImage] = useState(false);

  useEffect(() => {
    if (navigation.state === "idle") {
      if (isAddingImage) setIsAddingImage(false);
    }
  }, [navigation.state]);

  const handleAddImageClick = () => {
    setIsAddingImage(true);
  };

  const { currentId, setCurrentId } = useArrowToggle(
    (value: number | undefined) => (value ? [value] : [])
  );

  return (
    <>
      <Link to={`add`} relative="path" className="mb-6 inline-block" onClick={handleAddImageClick}>
        <LoadingButton loading={isAddingImage}>Add Image</LoadingButton>
      </Link>
      <div className="pt-24 sm:pt-0">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
          {images
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((image) => (
              <div key={image.id} className="relative group">
                <Image
                  id={image.id}
                  src={image.url}
                  alt={image.name}
                  className="w-full h-48 object-cover rounded"
                  isOpen={currentId === image.id}
                  setImage={setCurrentId}
                />
                <div className="absolute inset-0 flex justify-between items-start p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <Link
                    to={`edit/${image.id}`}
                    className="text-white bg-gray-800 bg-opacity-60 rounded-full p-2 hover:bg-opacity-80 transition"
                    title="Edit Image"
                    aria-label={`Edit ${image.name}`}
                  >
                    <FaPencilAlt />
                  </Link>
                  <Link
                    to={`delete/${image.id}`}
                    className="text-white bg-gray-800 bg-opacity-60 rounded-full p-2 hover:bg-opacity-80 transition"
                    title="Delete Image"
                    aria-label={`Delete ${image.name}`}
                  >
                    <FaTimes />
                  </Link>
                </div>
                <div className="mt-2 text-center">
                  <h3 className="text-lg font-semibold">{image.name}</h3>
                </div>
              </div>
            ))}
        </div>
      </div>
      <Outlet />
    </>
  );
}
