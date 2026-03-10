"use client";

import { useRef } from "react";
import { translations, type Language } from "@/assets/scripts/chat";

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  onSend: () => void;
  loading: boolean;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export default function ChatInput({
  input,
  setInput,
  language,
  setLanguage,
  onSend,
  loading,
  onKeyDown,
}: ChatInputProps) {
  const t = translations[language];
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2 sm:gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">Язык / Тіл / Language:</span>
        <div className="flex bg-gray-100 rounded-lg overflow-hidden">
          <button
            onClick={() => setLanguage("ru")}
            className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
              language === "ru"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-200"
            }`}
          >
            Русский
          </button>
          <button
            onClick={() => setLanguage("kz")}
            className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
              language === "kz"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-200"
            }`}
          >
            Қазақша
          </button>
          <button
            onClick={() => setLanguage("en")}
            className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
              language === "en"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-200"
            }`}
          >
            English
          </button>
        </div>
      </div>
      <div className="flex gap-2 sm:gap-3">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => {
            const el = inputRef.current;
            if (!el) return;
            setTimeout(() => {
              try {
                el.scrollIntoView({ block: "end", behavior: "smooth" });
              } catch {
                // ignore
              }
            }, 150);
          }}
          placeholder={t.placeholder}
          className="flex-1 px-3 sm:px-5 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-colors text-sm sm:text-base"
          disabled={loading}
        />
        <button
          onClick={onSend}
          disabled={loading || !input.trim()}
          className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg sm:rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-blue-800 transition-all flex-shrink-0 min-h-[44px]"
          aria-label="Отправить сообщение"
        >
          <svg
            className="w-4 h-4 sm:w-5 sm:h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

