import { LoaderFunctionArgs } from "@remix-run/node";
import { eventStream } from "remix-utils/sse/server";
import { commitSession, getSession } from "../sessions";
import OpenAI from "openai";
import { getEmployeeUser, getUserBySessionId } from "../utils/session.server";
import { selectMany } from "../utils/queryHelpers";
import { Todo, InstructionSlim } from "~/types";
import { db } from "~/db.server";
import { DONE_KEY } from "~/utils/constants";

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
});

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const activeSession = session.data.sessionId || null;
  let query = new URL(request.url).searchParams.get("query");

  let instructions: InstructionSlim[] = [];

  let user = null;
  if (activeSession) {
    user = (await getUserBySessionId(activeSession)) || null;
    if (user) {
      instructions = await selectMany<InstructionSlim>(
        db,
        "SELECT id, title, rich_text from instructions WHERE company_id = ?",
        [user.company_id]
      );
    }
  }

  let messages: any[] = [
    {
      role: "system",
      content: `Here is your context: ${JSON.stringify(instructions)}`,
    },
    {
      role: "user",
      content: `Answer the question as best yoyu can.\n\nQuestion: ${query}\n\nAnswer:`,
    },
  ];

  let response = await openai.chat.completions.create({
    model: "gpt-4o-mini-2024-07-18",
    messages: messages,
    temperature: 0,
    max_tokens: 1024,
    stream: true,
  });

  return eventStream(request.signal, function setup(send) {
    (async () => {
      for await (const chunk of response) {
        send({ data: chunk.choices[0].delta.content || "" });
      }
      send({ data: DONE_KEY });
    })();

    return function clear() {};
  });
}
