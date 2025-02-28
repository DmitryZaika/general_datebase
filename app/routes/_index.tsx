import { LoaderFunction, redirect } from "react-router";
import { getSession } from "~/sessions";
import { getEmployeeUser } from "~/utils/session.server";

export const loader: LoaderFunction = async ({ request }) => {
  try {
    await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login`);
  }
  return redirect("/employee");
};
