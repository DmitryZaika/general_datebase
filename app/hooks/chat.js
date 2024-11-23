import { useState } from "react";

export const useChat = () => {
  const [messages, setMessages] = useState([]);

  const addMessage = (message) =>
    setMessages((prevMessages) => [...prevMessages, message]);

  return { messages, addMessage };
};

export const useInput = () => {
  const [input, setInput] = useState("");

  const handleInputChange = (event) => setInput(event.target.value);
  const resetInput = () => setInput("");

  return { input, handleInputChange, resetInput };
};
