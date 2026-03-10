export interface Message {
  role: "user" | "bot";
  content: string;
}

export type Language = "ru" | "kz" | "en";

export const translations = {
  ru: {
    title: "Scroll",
    subtitle: "Информационный помощник",
    login: "Вход",
    welcome: "Здравствуйте! Я виртуальный помощник полиции СКО.",
    welcomeText: "Спросите, на что я могу ответить или с чем могу помочь, либо просто опишите вашу ситуацию простыми словами.",
    placeholder: "Введите ваш вопрос...",
    footer: "© 2026 Информационный портал полицейского департамента СКО",
  },
  kz: {
    title: "Scroll",
    subtitle: "Ақпараттық көмекші",
    login: "Кіру",
    welcome: "Сәлеметсіз бе! Мен СҚО полициясының виртуалды көмекшісімін.",
    welcomeText: "Мен қандай сұрақтарға жауап бере алатынымды немесе немен көмектесе алатынымды сұраңыз, не жай ғана жағдайыңызды қарапайым тілде сипаттаңыз.",
    placeholder: "Сұрағыңызды енгізіңіз...",
    footer: "© 2026 СКО полиция департаментінің ақпараттық порталы",
  },
  en: {
    title: "Scroll",
    subtitle: "Information assistant",
    login: "Login",
    welcome: "Hello! I’m the virtual assistant of the North Kazakhstan Police Department.",
    welcomeText: "Ask what I can help you with or what kind of questions I can answer, or simply describe your situation in simple words.",
    placeholder: "Enter your question...",
    footer: "© 2026 Information portal of the North Kazakhstan Region Police Department",
  },
};

export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  const storedSessionId = localStorage.getItem('chat_session_id');
  if (storedSessionId) {
    return storedSessionId;
  }
  
  const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('chat_session_id', newSessionId);
  return newSessionId;
}

export async function sendChatMessage(
  message: string,
  language: Language,
  sessionId: string
): Promise<{ response: string }> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, language, sessionId }),
  });

  if (!res.ok) {
    throw new Error('Failed to send message');
  }

  return res.json();
}

