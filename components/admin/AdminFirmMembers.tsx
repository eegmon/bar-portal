"use client";

import { useEffect, useState, type FormEvent } from "react";

interface AdminFirmMembersProps {
  firmId: string;
  firmRepresentativeId: string;
}

export default function AdminFirmMembers({
  firmId,
  firmRepresentativeId,
}: AdminFirmMembersProps) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addLoginId, setAddLoginId] = useState("");
  const [addIsPartner, setAddIsPartner] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/firms?firmId=${firmId}&members=1`)
      .then((r) => r.json())
      .then((d) => {
        if (d.members) setMembers(d.members);
      })
      .finally(() => setLoading(false));
  }, [firmId]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!addLoginId.trim()) return;
    setIsAdding(true);
    try {
      const res = await fetch("/api/firms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_MEMBER",
          firmId,
          lawyerLoginId: addLoginId.trim(),
          isPartner: addIsPartner,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "추가 실패");
      alert(`✅ ${data.message}`);
      setAddLoginId("");
      setAddIsPartner(false);
      const r2 = await fetch(`/api/firms?firmId=${firmId}&members=1`);
      const d2 = await r2.json();
      if (d2.members) setMembers(d2.members);
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (lawyerId: string, name: string) => {
    if (!confirm(`${name} 변호사를 구성원에서 제거하시겠습니까?`)) return;
    try {
      const res = await fetch("/api/firms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REMOVE_MEMBER", firmId, lawyerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMembers((prev) => prev.filter((m) => m.id !== lawyerId));
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    }
  };

  const handleTogglePartner = async (
    lawyerId: string,
    currentIsPartner: boolean,
  ) => {
    setTogglingId(lawyerId);
    try {
      const res = await fetch("/api/firms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "TOGGLE_PARTNER",
          firmId,
          lawyerId,
          isPartner: !currentIsPartner,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMembers((prev) =>
        prev.map((m) =>
          m.id === lawyerId
            ? { ...m, is_partner: !currentIsPartner ? 1 : 0 }
            : m,
        ),
      );
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setTogglingId(null);
    }
  };

  if (loading)
    return <p className="text-xs text-slate-500 py-2">불러오는 중...</p>;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-slate-300">
        구성원 변호사 ({members.length}명)
      </h4>
      {members.length === 0 ? (
        <p className="text-xs text-slate-500">등록된 구성원이 없습니다.</p>
      ) : (
        <div className="space-y-1.5">
          {members.map((m: any) => (
            <div
              key={m.id}
              className="flex items-center gap-2 p-2 bg-slate-900 border border-slate-800 rounded-lg text-xs"
            >
              <span className="font-bold text-slate-200">{m.name}</span>
              <span className="text-slate-500 font-mono">({m.login_id})</span>
              {firmRepresentativeId === m.id && (
                <span className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 rounded text-[10px] font-bold">
                  대표
                </span>
              )}
              <button
                onClick={() => handleTogglePartner(m.id, !!m.is_partner)}
                disabled={togglingId === m.id}
                className={`ml-auto px-2 py-0.5 rounded text-[10px] font-bold border transition-colors disabled:opacity-50 ${
                  m.is_partner
                    ? "bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                }`}
              >
                {togglingId === m.id
                  ? "..."
                  : m.is_partner
                    ? "구성원 변호사"
                    : "소속 변호사"}
              </button>
              {firmRepresentativeId !== m.id && (
                <button
                  onClick={() => handleRemove(m.id, m.name)}
                  className="text-red-400 hover:text-red-300 p-0.5"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={handleAdd}
        className="flex items-center gap-2 pt-2 border-t border-slate-800"
      >
        <input
          type="text"
          value={addLoginId}
          onChange={(e) => setAddLoginId(e.target.value)}
          placeholder="추가할 변호사 login_id"
          className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
        />
        <label className="flex items-center gap-1 text-[11px] text-slate-400 whitespace-nowrap cursor-pointer">
          <input
            type="checkbox"
            checked={addIsPartner}
            onChange={(e) => setAddIsPartner(e.target.checked)}
            className="rounded text-amber-500 w-3 h-3"
          />
          파트너
        </label>
        <button
          type="submit"
          disabled={isAdding}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded disabled:opacity-50"
        >
          {isAdding ? "..." : "추가"}
        </button>
      </form>
    </div>
  );
}
