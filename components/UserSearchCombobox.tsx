"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X, User } from "lucide-react";

export interface UserOption {
  id: string;
  name: string;
  login_id?: string;
  office_name?: string;
  role?: string;
  status?: string;
}

interface UserSearchComboboxProps {
  users: UserOption[];
  value: string;           // 선택된 userId
  onChange: (userId: string, user: UserOption | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function UserSearchCombobox({
  users,
  value,
  onChange,
  placeholder = "이름으로 검색...",
  className = "",
  disabled = false,
}: UserSearchComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = users.find((u) => u.id === value) ?? null;

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.trim()
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(query.toLowerCase()) ||
          (u.login_id && u.login_id.toLowerCase().includes(query.toLowerCase())) ||
          (u.office_name && u.office_name.toLowerCase().includes(query.toLowerCase()))
      )
    : users;

  const handleSelect = (user: UserOption) => {
    onChange(user.id, user);
    setOpen(false);
    setQuery("");
  };

  const handleClear = () => {
    onChange("", null);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {selected && !open ? (
        // 선택된 유저 표시
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs w-full">
          <div className="w-5 h-5 rounded bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px] font-bold shrink-0">
            {selected.name[0]}
          </div>
          <span className="font-semibold text-white flex-1 truncate">{selected.name}</span>
          {selected.login_id && (
            <span className="text-slate-500 shrink-0">{selected.login_id}</span>
          )}
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-500 hover:text-red-400 shrink-0 transition-colors"
              aria-label="선택 취소"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        // 검색 input
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 disabled:opacity-50"
          />
        </div>
      )}

      {/* 드롭다운 */}
      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-xs text-slate-500 text-center">
                검색 결과가 없습니다
              </div>
            ) : (
              filtered.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleSelect(u)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-800 transition-colors text-left"
                >
                  <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {u.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{u.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {u.login_id && <span className="mr-1.5">{u.login_id}</span>}
                      {u.office_name && <span>{u.office_name}</span>}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
          {filtered.length > 5 && (
            <div className="px-3 py-1.5 border-t border-slate-800 text-[10px] text-slate-600 text-right">
              {filtered.length}명
            </div>
          )}
        </div>
      )}
    </div>
  );
}
