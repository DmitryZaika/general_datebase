import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { selectId } from "~/utils/queryHelpers";
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
  const supportId = params.support;
  try {
    const result = await db.execute(`DELETE FROM main.supports WHERE id = ?`, [
      supportId,
    ]);
  } catch (error) {
    console.error("Error connecting to the database: ", error);
  }
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "support Deleted"));
  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  if (!params.support) {
    return forceRedirectError(request.headers, "No image id provided");
  }
  const supportId = parseInt(params.support);

  const support = await selectId<{ name: string }>(
    db,
    "select name from supports WHERE id = ?",
    supportId,
  );
  return {
    name: support?.name,
  };
};

export default function SupportsAdd() {
  const navigate = useNavigate();
  const { name } = useLoaderData<typeof loader>();

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate("..");
    }
  };
  return (<DeleteRow 
            handleChange={handleChange}
            title='Delete support'
            description={`Are you sure you want to delete ${name}?`}
          />);
}
