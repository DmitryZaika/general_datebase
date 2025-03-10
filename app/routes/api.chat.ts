import { LoaderFunctionArgs } from "react-router";
import { eventStream } from "remix-utils/sse/server";
import { getSession } from "../sessions";
import OpenAI from "openai";
import { getUserBySessionId } from "../utils/session.server";
import { selectMany } from "../utils/queryHelpers";
import { InstructionSlim } from "~/types";
import { db } from "~/db.server";
import { DONE_KEY } from "~/utils/constants";

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
});

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

async function getContext(
  user_id: number,
  query: string
): Promise<{ messages: Message[]; id: number }> {
  const history = await selectMany<{ history: Message[]; id: number }>(
    db,
    "SELECT id, history from chat_history WHERE user_id = ?",
    [user_id]
  );
  const currentConvo = history[0].history;
  currentConvo.push({ role: "user", content: query });
  return { messages: currentConvo, id: history[0].id };
}

async function newContext(
  user_id: number,
  company_id: number,
  query: string
): Promise<{ history: Message[]; id: number | undefined }> {
  const instructions = await selectMany<InstructionSlim>(
    db,
    "SELECT id, title, rich_text from instructions WHERE company_id = ?",
    [company_id]
  );
  const chatHistory = await selectMany<{ id: number }>(
    db,
    "SELECT id from chat_history WHERE user_id = ?",
    [user_id]
  );
  let chatHistoryId = undefined;
  if (chatHistory.length > 0) {
    chatHistoryId = chatHistory[0].id;
  }
  return {
    history: [
      {
        role: "system",
        content: `Here is your context: ${JSON.stringify(instructions)}`,
      },
      {
        role: "user",
        content: `Answer the question as best as you can.\n\nQuestion: ${query}\n\nAnswer:`,
      },
    ],
    id: chatHistoryId,
  };
}

async function insertContext(
  user_id: number,
  messages: Message[],
  answer: string
) {
  messages.push({ role: "assistant", content: answer });
  await db.execute(
    `INSERT INTO main.chat_history (history, user_id) VALUES (?, ?);`,
    [JSON.stringify(messages), user_id]
  );
}

async function updateContext(
  userId: number,
  chatHistoryId: number,
  messages: Message[],
  answer: string
) {
  messages.push({ role: "assistant", content: answer });
  await db.execute(
    `UPDATE main.chat_history SET history = ? WHERE id = ? AND user_id = ?;`,
    [JSON.stringify(messages), chatHistoryId, userId]
  );
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const activeSession = session.data.sessionId || null;
  const url = new URL(request.url).searchParams;
  let query = url.get("query") || "";
  let isNew = url.get("isNew") === "true";

  if (!activeSession) {
    return new Response("Unauthorized", { status: 401 });
  }
  let user = (await getUserBySessionId(activeSession)) || null;
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  let messages: Message[] = [];
  let chatHistoryId: number | undefined = undefined;

  if (isNew) {
    const result = await newContext(user.id, user.company_id, query);
    messages = result.history;
    chatHistoryId = result.id;
  } else {
    const result = await getContext(user.id, query);
    messages = result.messages;
    chatHistoryId = result.id;
  }

  let response = await openai.chat.completions.create({
    model: "gpt-4o-mini-2024-07-18",
    messages: messages,
    temperature: 0,
    max_tokens: 1024,
    stream: true,
  });

  return eventStream(request.signal, function setup(send) {
    (async () => {
      let answer = "";
      for await (const chunk of response) {
        const message = chunk.choices[0].delta.content;
        if (message) {
          send({ data: message });
          answer += message;
        }
      }
      send({ data: DONE_KEY });
      if (chatHistoryId) {
        updateContext(user.id, chatHistoryId, messages, answer);
      } else {
        insertContext(user.id, messages, answer);
      }
    })();

    return function clear() {};
  });
}
