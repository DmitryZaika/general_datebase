export const ask = ({ messages, context }) => {
  const contextMessage = {
    role: "system",
    content: `Here is the context for this conversation:\n${JSON.stringify(context)}`,
  };
  return fetch("/api/chat", {
    method: "POST",
    body: JSON.stringify({ messages: [contextMessage, ...messages] }),
  });
};

export const processChatResponse = async ({ response, onChunk }) => {
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let string = "";
  while (true) {
    const stream = await reader.read();
    if (stream.done) break;

    const chunks = stream?.value
      .replaceAll(/^data: /gm, "")
      .split("\n")
      .filter((c) => Boolean(c.length) && c !== "[DONE]")

    const composed = chunks.join('')
    string += composed
    onChunk(composed)
  }
  return string;
};
