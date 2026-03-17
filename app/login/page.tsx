"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });

      if (res.ok) {
        router.push("/admin");
      } else {
        setError("Неверный логин или пароль");
      }
    } catch {
      setError("Ошибка подключения");
    } finally {
      setLoading(false);
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
                Scroll
              </h1>
              <p className="text-slate-500 text-xs sm:text-sm truncate">
                Панель администратора
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push("/")}
            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-slate-300 text-xs sm:text-sm text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap flex-shrink-0"
          >
            На сайт
          </button>
        </div>
      </header>

      <main className="flex-1 w-full flex justify-center px-3 sm:px-4 lg:px-5 py-4 sm:py-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              Вход в систему
            </h2>
            <p className="text-slate-500 mt-1 text-sm sm:text-base">
              Введите логин и пароль администратора
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Логин
              </label>
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-slate-300 focus:border-blue-500 focus:outline-none transition-colors text-sm sm:text-base min-h-[44px] bg-slate-50"
                placeholder="Введите логин"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-slate-300 focus:border-blue-500 focus:outline-none transition-colors text-sm sm:text-base min-h-[44px] bg-slate-50"
                placeholder="Введите пароль"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold disabled:opacity-50 transition-colors text-sm sm:text-base min-h-[44px]"
            >
              {loading ? "Вход..." : "Войти"}
            </button>
          </form>

          <div className="mt-5 sm:mt-6 text-center">
            <button
              onClick={() => router.push("/")}
              className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm"
            >
              ← Вернуться на главную
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}


