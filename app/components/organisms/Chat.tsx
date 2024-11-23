import { useState } from "react";
import { useChat, useInput } from "~/hooks/chat";
import { ask, processChatResponse } from "~/utils/chat.client";

interface Message {
    sender: "user" | "chatgpt";
    text: string;
}

const context = {
  "Instructions": {
    "Leading a Customer": {
      "After Template": "1. Check difference between customer sqft on the contract and on the template.\n2. If it's a difference more than 1 sqft (For example, 0.99 we don't notify a customer, or 1 we notify a customer).\n3. Send to Tanya [Name] extra 6 sqft, total 58 sqft - $367 Sealer for 6 sqft - $36 Товар/услуга - кол-во sqft (если нужно) - сумма.",
      "After Install": "1. Call to the customer, ask about their experience.\nExample: \"Hello, [Client's Name]. I wanted to check in and see how the installation went. Did everything meet your expectations, and are you satisfied with the results? If you have any questions or concerns, please let me know. Thank you!\"",
      "Before Template": "Details about how to handle special or custom orders for customers..."
    },
    "Special Order": {
      "Custom Order": "Details about how to handle special or custom orders for customers...",
      "Fabrication": "Granite: $60 per sqft\nQuartz: $70 per sqft\nPorcelain: $70 per sqft\nQuartzite: $80 per sqft\nMarble: $80 per sqft"
    },
    "Discounts": {
      "Customers": {
        "content": "You can give these discounts to accommodate situations where providing a discount could be a decisive factor in securing a deal. Follow the prices outlined in the inventory spreadsheet or price list.",
        "scenarios": {
          "$1200-$2000": "Discount up to $100, rounding to nearest hundred.",
          "$2000-$3500": "Discount up to $150, rounding to nearest hundred.",
          "$3500-$5000": "Discount up to $200, rounding to nearest hundred.",
          "$5000+": "Discuss additional discounts with George."
        },
        "notes": [
          "Discounts are not applied to specials.",
          "Apply discounts during price discussion.",
          "Charge a 3% card fee when discounts are given.",
          "Call/text George or Dasha if a customer disagrees with fees."
        ]
      },
      "Builders": {
        "Discounts": {
          "Quartz and Granite Levels 1-3": "$3 off per sqft",
          "Quartz and Granite Levels 4+": "$5 off per sqft"
        },
        "Sink & Cutout Charges": {
          "Farm Sink": "$150",
          "Regular Sinks": "$150",
          "Customer-Provided Sink Cutouts": "$175",
          "Cooktop Cutout": "$125",
          "Vanity Sink Cutout": "$75",
          "Small/Zero Radius Sinks": "$300",
          "Granite Composite Sinks": "$500"
        },
        "Sealer Offer": "10-year sealer: $3 per sqft when purchased with countertops.",
        "Project Threshold": "Projects exceeding $10,000 may be discussed with George for additional discounts.",
        "Deadlines": "Builder's projects can be installed in 5-7 days without additional discounts.",
        "Example": "Calacatta Laza: $80, builder price: $75. Quoted at $5200, reduce to $5000 if builder asks. ASAP installations do not qualify for discounts."
      }
    },
    "Layout": "Follow steps for layout creation, including uploading slab images, labeling pieces, maximizing material use, and marking paperwork. Ensure layout completion after template creation.",
    "Selling Steps": {
      "Walk In": "How to approach and communicate with the customer during the first contact...",
      "Lead": "Techniques for presenting products and highlighting key benefits...",
      "Closing": "Strategies to close the sale and ensure customer satisfaction..."
    },
    "Responsibilities": {
      "Customer Communications": "Guidelines for clear and effective communication with customers...",
      "Order Accuracy": "Ensure all orders and customer data are processed accurately...",
      "Timely Delivery": "Adhering to deadlines and making sure orders are delivered on time..."
    },
    "Remnants": {
      "Policy and Procedure": {
        "Minimum Price": "Remnants start at $35 per sqft."
      }
    },
    "Objections": {
      "Custom Order": "Details about how to handle special or custom orders for customers..."
    }
  }
}

const ChatMessages = ({ messages }) => (
  <div className="space-y-4">
    {messages.map((message, index) => (
      <div
        key={index}
        className={`p-2 rounded-lg ${
          message.role === "user"
            ? "bg-blue-500 text-white self-end"
            : "bg-gray-300 text-black self-start"
        }`}
      >
        {message.content}
      </div>
    ))}
  </div>
);

export function Chat() {
    const { messages, addMessage } = useChat();
    const { input: question, handleInputChange, resetInput } = useInput();

  const [answer, setAnswer] = useState("");

  const askQuestion = async (event) => {
    event.preventDefault();

    const messageNew = { role: "user", content: question };
    addMessage(messageNew);
    resetInput();

    const response = await ask({ messages: [...messages, messageNew], context });
    if (!response) return;

    const assistantMessageContent = await processChatResponse({
      response,
        onChunk: (value) => setAnswer(answer + value),
    });
    setAnswer("");
    addMessage({ role: "assistant", content: assistantMessageContent });
  };


    return (
            <div className="bg-gray-500 absolute h-screen top-0 right-0 w-[30vw] flex flex-col">
        {/* Messages Section */}
        <div className="flex-1 overflow-y-auto p-4">
            <ChatMessages
                messages={[...messages, { role: "assistant", content: answer }].filter(
                    (m) => Boolean(m.content)
                )}
            />
        </div>

        {/* Input Section */}
        <form
            onSubmit={askQuestion}
            className="p-4 border-t border-gray-400 bg-gray-600 flex items-center gap-2"
        >
            <label className="flex-1">
                <input
                    value={question}
                    onChange={handleInputChange}
                    placeholder="Type your question..."
                    className="w-full p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring focus:ring-blue-500"
                />
            </label>
            <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
                Ask
            </button>
        </form>
    </div>
    );
}
