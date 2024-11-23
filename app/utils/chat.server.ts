import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
});

export const getChatStream = async ({ messages }) => {
  const response = await openai.chat.completions.create(
    {
      model: "gpt-4",
      messages,
      stream: true,
    }
  );

  // Handle the streaming response
  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of response) {
        const text = chunk.choices[0]?.delta?.content || "";
        controller.enqueue(encoder.encode(`data: ${text}\n\n`));
      }
      controller.close();
    },
  });

  return readableStream;
};
