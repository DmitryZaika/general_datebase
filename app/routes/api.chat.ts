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
  query: string,
): Promise<{ messages: Message[]; id: number }> {
  console.time('db:get-context');
  const history = await selectMany<{ history: Message[]; id: number }>(
    db,
    "SELECT id, history from chat_history WHERE user_id = ?",
    [user_id],
  );
  console.timeEnd('db:get-context');
  
  const currentConvo = history[0].history;
  currentConvo.push({ role: "user", content: query });
  return { messages: currentConvo, id: history[0].id };
}

async function newContext(
  user_id: number,
  company_id: number,
  query: string,
): Promise<{ history: Message[]; id: number | undefined }> {
  console.time('db:new-context');
  const instructions = await selectMany<InstructionSlim>(
    db,
    "SELECT id, title, rich_text from instructions WHERE company_id = ?",
    [company_id],
  );
  const chatHistory = await selectMany<{ id: number }>(
    db,
    "SELECT id from chat_history WHERE user_id = ?",
    [user_id],
  );
  console.timeEnd('db:new-context');
  
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
  answer: string,
) {
  console.time('db:insert-context');
  messages.push({ role: "assistant", content: answer });
  await db.execute(
    `INSERT INTO main.chat_history (history, user_id) VALUES (?, ?);`,
    [JSON.stringify(messages), user_id],
  );
  console.timeEnd('db:insert-context');
}

async function updateContext(
  userId: number,
  chatHistoryId: number,
  messages: Message[],
  answer: string,
) {
  console.time('db:update-context');
  messages.push({ role: "assistant", content: answer });
  await db.execute(
    `UPDATE main.chat_history SET history = ? WHERE id = ? AND user_id = ?;`,
    [JSON.stringify(messages), chatHistoryId, userId],
  );
  console.timeEnd('db:update-context');
}

export async function loader({ request }: LoaderFunctionArgs) {
  console.time('chat:total-request');
  console.log('Chat request started:', new Date().toISOString());
  
  const session = await getSession(request.headers.get("Cookie"));
  const activeSession = session.data.sessionId || null;
  const url = new URL(request.url).searchParams;
  let query = url.get("query") || "";
  let isNew = url.get("isNew") === "true";

  if (!activeSession) {
    console.log('Unauthorized: No active session');
    return new Response("Unauthorized", { status: 401 });
  }
  
  console.time('auth:get-user');
  let user = (await getUserBySessionId(activeSession)) || null;
  console.timeEnd('auth:get-user');
  
  if (!user) {
    console.log('Unauthorized: User not found');
    return new Response("Unauthorized", { status: 401 });
  }

  let messages: Message[] = [];
  let chatHistoryId: number | undefined = undefined;

  console.time('context:prepare');
  if (isNew) {
    const result = await newContext(user.id, user.company_id, query);
    messages = result.history;
    chatHistoryId = result.id;
  } else {
    const result = await getContext(user.id, query);
    messages = result.messages;
    chatHistoryId = result.id;
  }
  console.timeEnd('context:prepare');
  console.log('Context prepared, message count:', messages.length);

  console.time('openai:request');
  let response = await openai.chat.completions.create({
    model: "gpt-4o-mini-2024-07-18",
    messages: messages,
    temperature: 0,
    max_tokens: 1024,
    stream: true,
  });
  console.timeEnd('openai:request');
  console.log('OpenAI connection established');

  return eventStream(
    request.signal, 
    function setup(send) {
      console.log('SSE connection established');
      
      // Используем SSE комментарии для заполнения буфера
      // Комментарии начинаются с ':' и не отображаются клиенту
      for (let i = 0; i < 30; i++) {
        send({ event: 'ping', data: '' });
      }
      
      // Информационное сообщение отправляем как комментарий (не будет видно пользователю)
      send({ event: 'info', data: 'Connecting to AI...' });
      
      (async () => {
        console.time('openai:streaming');
        let answer = "";
        let chunkCount = 0;
        let firstChunkReceived = false;
        let requestStartTime = Date.now();
        
        try {
          for await (const chunk of response) {
            chunkCount++;
            if (chunkCount === 1) {
              firstChunkReceived = true;
              console.log('First chunk received after', Date.now() - requestStartTime, 'ms');
            }
            
            const message = chunk.choices[0].delta.content;
            if (message) {
              send({ data: message });
              answer += message;
            }
          }
          console.log('Total chunks received:', chunkCount);
          console.timeEnd('openai:streaming');
          
          send({ data: DONE_KEY });
          
          console.time('db:save-context');
          if (chatHistoryId) {
            updateContext(user.id, chatHistoryId, messages, answer);
          } else {
            insertContext(user.id, messages, answer);
          }
          console.timeEnd('db:save-context');
        } catch (error) {
          console.error('Error during streaming:', error);
          send({ data: 'Error: ' + (error instanceof Error ? error.message : 'Unknown error') });
        }
        
        console.timeEnd('chat:total-request');
        console.log('Chat request completed:', new Date().toISOString());
      })();

      return function clear() {
        console.log('SSE connection closed by client');
      };
    },
    {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
      }
    }
  );
}
