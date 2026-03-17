"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { getSessionId, sendChatMessage, translations, type Language, type Message } from "@/assets/scripts/chat";
import { scrollToBottom } from "@/assets/scripts/utils";

const ChatInput = dynamic(() => import("@/components/ChatInput"), { ssr: false });
const ChatMessages = dynamic(() => import("@/components/ChatMessages"), { ssr: false });

export default function Home() {
  const [language, setLanguage] = useState<Language>("ru");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const t = translations[language];

  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    setSessionId(getSessionId());
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    scrollToBottom(messagesEndRef.current);
  }, [messages]);

  useEffect(() => {
    const resetTimer = () => {
      lastActivityRef.current = Date.now();
      
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      
      inactivityTimerRef.current = setTimeout(() => {
        window.location.reload();
      }, 3 * 60 * 1000);
    };

    const handleActivity = () => {
      resetTimer();
    };

    resetTimer();

    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('input', handleActivity);

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('input', handleActivity);
    };
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);
    
    lastActivityRef.current = Date.now();
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(() => {
      window.location.reload();
    }, 3 * 60 * 1000);

    try {
      const data = await sendChatMessage(userMessage, language, sessionId);
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content: data.response || "",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { 
          role: "bot",
          content:
            language === "ru"
              ? "Произошла ошибка. Попробуйте позже."
              : language === "kz"
              ? "Қате орын алды. Кейінірек көріңіз."
              : "An error occurred. Please try again later.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f6f8]">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto py-3 sm:py-4 px-3 sm:px-6 flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <img
              src="/assets/images/download.png"
              alt="Scroll"
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover flex-shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                {t.title}
              </h1>
              <p className="text-slate-500 text-xs sm:text-sm truncate">
                {t.subtitle}
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push("/login")}
            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-slate-300 text-xs sm:text-base text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap flex-shrink-0"
          >
            {t.login}
          </button>
        </div>
      </header>

      <main className="flex-1 w-full flex justify-center px-3 sm:px-4 lg:px-5 py-4 sm:py-6">
        <div className="chat-container w-full max-w-5xl flex-1 rounded-2xl bg-white border border-slate-200 shadow-sm p-4 sm:p-6 flex flex-col min-h-[calc(100dvh-190px)] sm:min-h-[480px]">
          <ChatMessages
            messages={messages}
            loading={loading}
            language={language}
            messagesEndRef={messagesEndRef}
          />

          <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] bg-white/95 backdrop-blur border-t border-gray-200">
            <ChatInput
              input={input}
              setInput={setInput}
              language={language}
              setLanguage={setLanguage}
              onSend={sendMessage}
              loading={loading}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-gray-400 text-sm">
        {t.footer}
      </footer>
    </div>
  );
}
