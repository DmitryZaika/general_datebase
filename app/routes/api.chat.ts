import { LoaderFunctionArgs } from "@remix-run/node";
import { eventStream } from "remix-utils/sse/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
});

export async function loader({ request }: LoaderFunctionArgs) {
  let query = new URL(request.url).searchParams.get("query");

  console.log(`GET: Completion Loader called with query: ${query}`);

  let messages: any[] = [];
  messages.push({
    role: "user",
    content: `Answer the question as best yoyu can.\n\nQuestion: ${query}\n\nAnswer:`,
  });

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
    })();

    return function clear() {};
  });
}
