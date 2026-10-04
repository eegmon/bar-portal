"use client";

import { useEffect, useState } from "react";
import { AlertCircle, KeyRound, Scale } from "lucide-react";

export default function ResetPasswordForm() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (password !== passwordConfirm) {
      setError("새 비밀번호가 서로 일치하지 않습니다.");
      return;
    }
    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "비밀번호 변경 실패");
      setCompleted(true);
      setPassword("");
      setPasswordConfirm("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "비밀번호 재설정에 실패했습니다.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-6 px-4 py-16">
      <header className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 shadow-lg">
          <Scale className="h-6 w-6 stroke-[2.5]" />
        </div>
        <h1 className="text-2xl font-extrabold text-white">비밀번호 재설정</h1>
        <p className="text-xs text-slate-400">
          새 비밀번호를 입력해 계정에 다시 접속하세요.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {completed ? (
          <div className="space-y-4 text-center">
            <p className="text-sm font-semibold text-emerald-400">
              비밀번호가 변경되었습니다. 기존 로그인 세션은 모두 종료되었습니다.
            </p>
            <a
              href="/login"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
            >
              로그인으로 이동
            </a>
          </div>
        ) : !token ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-slate-300">
              재설정 링크가 올바르지 않습니다. 관리자에게 새 링크를 요청해
              주세요.
            </p>
            <a
              href="/login"
              className="inline-block text-xs font-semibold text-amber-400 hover:text-amber-300"
            >
              로그인으로 돌아가기
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="new-password"
                className="mb-1 block text-xs font-semibold text-slate-300"
              >
                새 비밀번호
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="new-password"
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="8자 이상 입력"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-9 pr-3.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="new-password-confirm"
                className="mb-1 block text-xs font-semibold text-slate-300"
              >
                새 비밀번호 확인
              </label>
              <input
                id="new-password-confirm"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                placeholder="새 비밀번호를 다시 입력"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-amber-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500"
            >
              {loading ? "변경 중..." : "비밀번호 변경"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
