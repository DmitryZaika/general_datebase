import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "react-router";
import { useLoaderData, useNavigate, useLocation   } from "react-router";
import { selectId } from "~/utils/queryHelpers";
import { deleteFile } from "~/utils/s3.server";
import { DeleteRow } from "~/components/pages/DeleteRow";

import { db } from "~/db.server";
import { commitSession, getSession } from "~/sessions";
import { forceRedirectError, toastData } from "~/utils/toastHelpers";
import { getAdminUser } from "~/utils/session.server";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";

export async function action({ params, request }: ActionFunctionArgs) {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  try {
    await csrf.validate(request);
  } catch (error) {
    return { error: "Invalid CSRF token" };
  }
  if (!params.stone) {
    return forceRedirectError(request.headers, "No document id provided");
  }
  const stoneId = parseInt(params.stone);
  const stone = await selectId<{ url: string }>(
    db,
    "select url from stones WHERE id = ?",
    stoneId,
  );
  if (stone?.url) {
    deleteFile(stone.url);
  }

  try {
    await db.execute(`DELETE FROM main.stones WHERE id = ?`, [stoneId]);
  } catch (error) {
    console.error("Error connecting to the database: ", error);
  }

  const url = new URL(request.url);
  const searchParams = url.searchParams.toString();
  const searchString = searchParams ? `?${searchParams}` : '';
  
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Stone Deleted"));
  return redirect(`..${searchString}`, {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  if (!params.stone) {
    return forceRedirectError(request.headers, "No image id provided");
  }
  const stoneId = parseInt(params.stone);

  const stone = await selectId<{ name: string }>(
    db,
    "select name from stones WHERE id = ?",
    stoneId,
  );
  return {
    name: stone?.name,
  };
};

export default function StonesAdd() {
  const navigate = useNavigate();
  const location = useLocation();
  const { name } = useLoaderData<typeof loader>();

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate(`..${location.search}`);
    }
  };
  return (<DeleteRow 
            handleChange={handleChange}
            title='Delete stone'
            description={`Are you sure you want to delete ${name}?`}
          />);
}
