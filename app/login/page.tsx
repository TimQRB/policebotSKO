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
    <div className="min-h-screen flex items-center justify-center p-3 sm:p-4">
      <div className="admin-card w-full max-w-md p-6 sm:p-8">
        <div className="text-center mb-6 sm:mb-8">
          <img
            src="/assets/images/download.png"
            alt="Scroll"
            className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 sm:mb-4 rounded-full object-cover gold-border"
          />
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
            Вход в систему
          </h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Scroll</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Логин
            </label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-colors text-sm sm:text-base min-h-[44px]"
              placeholder="Введите логин"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-colors text-sm sm:text-base min-h-[44px]"
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
            className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold disabled:opacity-50 hover:from-blue-700 hover:to-blue-800 transition-all text-sm sm:text-base min-h-[44px]"
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
    </div>
  );
}


