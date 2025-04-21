import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { selectId } from "~/utils/queryHelpers";

import { db } from "~/db.server";
import { commitSession, getSession } from "~/sessions";
import { forceRedirectError, toastData } from "~/utils/toastHelpers";
import { getAdminUser } from "~/utils/session.server";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { DeleteRow } from "~/components/pages/DeleteRow";

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
  const documentId = params.document;
  try {
    await db.execute(`DELETE FROM main.documents WHERE id = ?`, [documentId]);
  } catch (error) {
    console.error("Error connecting to the database: ", error);
  }
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "document Deleted"));
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
  if (!params.document) {
    return forceRedirectError(request.headers, "No document id provided");
  }
  const documentId = parseInt(params.document);

  const document = await selectId<{ name: string }>(
    db,
    "select name from documents WHERE id = ?",
    documentId,
  );
  return {
    name: document?.name,
  };
};

export default function DocumentsAdd() {
  const navigate = useNavigate();
  const { name } = useLoaderData<typeof loader>();

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate("..");
    }
  };
  return (<DeleteRow 
            handleChange={handleChange}
            title='Delete document'
            description={`Are you sure you want to delete ${name}?`}
          />);
}
