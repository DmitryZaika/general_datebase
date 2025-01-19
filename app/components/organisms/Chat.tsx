import React, { useState, useEffect, FormEvent } from "react";
import { useChat, useInput } from "~/hooks/chat";
import { ask, processChatResponse } from "~/utils/chat.client";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { InstructionSlim } from "~/types";
import { reminders, help } from "~/lib/instructions";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatMessagesProps {
  messages: Message[];
  isThinking: boolean;
}

/*
const processHTML = (text: string): string => {
  const markdown = marked(text);
  const cleanHTML = DOMPurify.sanitize(markdown);
  return cleanHTML;
};
*/

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const [formattedContent, setFormattedContent] = useState<string>("");

  useEffect(() => {
    const formatContent = async () => {
      // const content = processHTML(message.content);
      setFormattedContent(message.content);
    };
    formatContent();
  }, [message.content]);

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
        <div
          className="prose"
          dangerouslySetInnerHTML={{ __html: formattedContent }}
        />
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

export const Chat: React.FC<{ instructions: InstructionSlim[] }> = ({
  instructions,
}) => {
  const { messages, addMessage } = useChat();
  const { input: question, handleInputChange, resetInput } = useInput();

  const [answer, setAnswer] = useState<string>("");
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isThinking, setIsThinking] = useState<boolean>(false);

  const askQuestion = async (event: FormEvent) => {
    event.preventDefault();

    if (question.trim().length === 0) return;

    const userMessage: Message = { role: "user", content: question as string };
    addMessage(userMessage);
    resetInput();

    setIsThinking(true);
    const response = await ask({
      messages: [...messages, userMessage],
      context: { instructions /* help, reminders */ },
    });

    if (!response) {
      setIsThinking(false);
      return;
    }

    const assistantMessageContent = await processChatResponse({
      response,
      onChunk: (value: string) => {
        setIsThinking(false);
        setAnswer((prev) => prev + value);
      },
    });

    // const formattedContent = await processHTML(assistantMessageContent);
    const formattedContent = assistantMessageContent;
    setAnswer("");
    addMessage({ role: "assistant", content: formattedContent });
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 bg-blue-500 text-white p-4 rounded-full shadow-lg hover:bg-blue-600 transition"
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
      )}

      <div
        className={`fixed bottom-0 right-0 h-[100%] w-[100%] md:w-[40%] md:h-full bg-white border-l border-gray-300 shadow-lg transform transition-transform duration-300 flex flex-col ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="bg-gray-100 text-gray-800 font-semibold text-lg py-3 px-4 border border-gray-300 flex justify-between items-center">
          <span>Chat</span>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-500 hover:text-gray-800 transition"
          >
            ✖
          </button>
        </div>

        <ChatMessages
          messages={[
            ...messages,
            ...(answer
              ? [{ role: "assistant" as const, content: answer }]
              : []),
          ]}
          isThinking={isThinking}
        />

        <form
          onSubmit={askQuestion}
          className="p-4 bg-gray-100 border-t border-gray-300 flex items-center gap-2"
        >
          <input
            value={question}
            onChange={handleInputChange}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
          />
          <button
            disabled={question.trim().length === 0}
            type="submit"
            className={`px-4 py-2 font-semibold rounded-full shadow-md transition-all ${
              question.trim().length === 0
                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                : "bg-blue-500 text-white hover:bg-blue-600"
            }`}
          >
            Send
          </button>
        </form>
      </div>
    </>
  );
};
