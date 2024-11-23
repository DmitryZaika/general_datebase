import type { ActionFunctionArgs } from "@remix-run/node";
import { getChatStream } from "../utils/chat.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  return new Response(
    await getChatStream({
      messages: (await request.json()).messages,
    })
  );
};
