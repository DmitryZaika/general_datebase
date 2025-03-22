import { LoaderFunctionArgs } from "react-router";
import { db } from "~/db.server";
import { getSession } from "~/sessions";
import { selectMany } from "~/utils/queryHelpers";
import { getUserBySessionId } from "~/utils/session.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const activeSession = session.data.sessionId || null;
  if (!params.sink) {
    return new Response("Bad url", { status: 400 });
  }
  const sinkId = parseInt(params.sink);

  if (!activeSession) {
    return new Response("Unauthorized", { status: 401 });
  }
  let user = (await getUserBySessionId(activeSession)) || null;
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const images = await selectMany<{ id: number; url: string }>(
    db,
    "SELECT id, url FROM installed_sinks WHERE sink_id = ?",
    [sinkId],
  );
  return Response.json({ images });
}
