import { LoaderFunctionArgs } from "@remix-run/node";
import { eventStream } from "remix-utils/sse/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
});

let processData = function (data: { toString: () => string }, send: Function) {
  const lines = data
    .toString()
    .split("\n")
    .filter((line: string) => line.trim() !== "");

  for (const line of lines) {
    const message = line.toString().replace(/^data: /, "");
    if (message === "[DONE]") {
      return; // Stream finished
    }
    try {
      // console.log("Message", message);
      const parsed = JSON.parse(message);
      let delta = parsed.choices[0].delta?.content;
      if (delta) send({ data: delta });
    } catch (error) {
      console.error("Could not JSON parse stream message", message, error);
    }
  }
};

export async function loader({ request }: LoaderFunctionArgs) {
  let query = new URL(request.url).searchParams.get("query");

  console.log(`GET: Completion Loader called with query: ${query}`);

  let messages: any[] = [];
  messages.push({
    role: "user",
    content: `Answer the question as best yoyu can.\n\nQuestion: ${query}\n\nAnswer:`,
  });

  let response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: messages,
    temperature: 0,
    max_tokens: 1024,
    stream: true,
  });

  return eventStream(request.signal, function setup(send) {
    (async () => {
      for await (const chunk of response) {
        processData(chunk, send);
      }
    })();

    return function clear() {};
  });
}
