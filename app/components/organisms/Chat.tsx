import React, { useEffect, useRef, useState } from "react";
import { DONE_KEY } from "~/utils/constants";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatMessagesProps {
  messages: Message[];
  isThinking: boolean;
}

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  return (
    <div
      className={`flex ${
        message.role === "user" ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`rounded-xl p-3 m-2 max-w-xl ${
          message.role === "user"
            ? "bg-blue-500 text-white"
            : "bg-gray-200 text-gray-900"
        }`}
      >
        <div>{message.content}</div>
      </div>
    </div>
  );
};

const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  isThinking,
}) => (
  <div className="flex flex-col p-4 overflow-y-auto h-full text-wrap whitespace-pre-wrap">
    {messages.map((message, index) => (
      <MessageBubble key={index} message={message} />
    ))}
    {isThinking && (
      <div className="flex items-center justify-start m-2">
        <div className="animate-pulse bg-gray-200 text-gray-900 rounded-xl p-4">
          Typing...
        </div>
      </div>
    )}
  </div>
);

export const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isThinking, setIsThinking] = useState<boolean>(false);

  const addMessage = (message: Message) =>
    setMessages((prevMessages) => [...prevMessages, message]);

  const handleFormSubmit = async (event: React.FormEvent) => {
    setIsThinking(true);
    setInput("");
    event.preventDefault();

    const formData = new FormData(event.target as HTMLFormElement);
    const query = formData.get("query") as string | null;
    if (answer) {
      addMessage({ role: "assistant", content: answer });
      setAnswer("");
    }
    addMessage({ role: "user", content: query || "" });

    const sse = new EventSource(
      `/api/chat?query=${query}&isNew=${messages.length === 0}`
    );

    sse.addEventListener("message", (event) => {
      if (event.data === DONE_KEY) {
        sse.close();
        setIsThinking(false);
      } else {
        setAnswer((prevResults) => prevResults + event.data);
      }
    });

    sse.addEventListener("error", (event) => {
      sse.close();
    });
  };

  return (
    <>
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 cursor-pointer bg-blue-500 text-white p-4 rounded-full shadow-lg hover:bg-blue-600 transition"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 20.25c4.97 0 9-3.813 9-8.504 0-4.692-4.03-8.496-9-8.496S3 7.054 3 11.746c0 1.846.728 3.559 1.938 4.875L3 20.25l5.455-2.224a10.5 10.5 0 003.545.624z"
            />
          </svg>
        </button>
      ) : (
        <div
          className={`fixed bottom-0 right-0 h-[100%] w-[100%] md:w-[40%] md:h-full bg-white border-l border-gray-300 shadow-lg transform transition-transform duration-300 flex flex-col ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="bg-gray-100 text-gray-800 font-semibold text-lg py-3 px-4 border border-gray-300 flex justify-between items-center">
            <span>Chat</span>
            <Button
              onClick={() => setIsOpen(false)}
              variant="ghost"
              aria-label="Close"
              size="icon"
              className="text-2xl"
            >
              ✕
            </Button>
          </div>

          <ChatMessages
            messages={[
              ...messages,
              ...(answer
                ? [{ role: "assistant" as const, content: answer }]
                : []),
            ]}
            isThinking={isThinking && !answer}
          />

          <form
            onSubmit={handleFormSubmit}
            className="p-4 bg-gray-100 border-t border-gray-300 flex items-center gap-2"
          >
            <Input
              name="query"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Type your message..."
              className="rounded-full"
              autoFocus={true}
            />
            <Button
              disabled={input.length === 0 || isThinking}
              variant="blue"
              type="submit"
              className="rounded-full"
            >
              Send
            </Button>
          </form>
        </div>
      )}
    </>
  );
};
