"use client";

import { type Message, translations, type Language } from "@/assets/scripts/chat";

interface ChatMessagesProps {
  messages: Message[];
  loading: boolean;
  language: Language;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export default function ChatMessages({
  messages,
  loading,
  language,
  messagesEndRef,
}: ChatMessagesProps) {
  const t = translations[language];

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin space-y-3 sm:space-y-4 px-1 pb-24 sm:pb-0">
      {messages.length === 0 && (
        <div className="text-center py-8 sm:py-12">
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 sm:mb-4 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
            <svg
              className="w-8 h-8 sm:w-10 sm:h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-700 mb-2 px-4">
            {t.welcome}
          </h2>
          <p className="text-sm sm:text-base text-gray-500 px-4">
            {t.welcomeText}
          </p>
        </div>
      )}

      {messages.map((msg, idx) => (
        <div
          key={idx}
          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[90%] sm:max-w-[85%] lg:max-w-[75%] rounded-xl sm:rounded-2xl px-3 sm:px-5 py-2.5 sm:py-3 ${
              msg.role === "user"
                ? "message-user text-white"
                : "message-bot text-gray-800 border border-gray-200"
            }`}
          >
            <p className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed break-words">{msg.content}</p>
          </div>
        </div>
      ))}

      {loading && (
        <div className="flex justify-start">
          <div className="message-bot rounded-xl sm:rounded-2xl px-3 sm:px-5 py-2.5 sm:py-3 border border-gray-200">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              <span
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: "0.1s" }}
              />
              <span
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: "0.2s" }}
              />
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

