"use client";

import { useState } from "react";
import { BookOpen, Edit, Save } from "lucide-react";

const TAB_LABELS: Record<string, string> = {
  rules_charter: "📜 회칙 전문",
  rules_discipline: "⚖️ 징계 규정",
  rules_exam: "📝 시험 관리 규정",
};

interface RulesClientProps {
  rules: Record<string, string>;
  isAdmin: boolean;
}

export default function RulesClient({ rules: initialRules, isAdmin }: RulesClientProps) {
  const [activeKey, setActiveKey] = useState("rules_charter");
  const [rules, setRules] = useState(initialRules);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const keys = Object.keys(TAB_LABELS);

  const startEdit = () => {
    setEditContent(rules[activeKey] || "");
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditContent("");
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: { [activeKey]: editContent } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");
      setRules((prev) => ({ ...prev, [activeKey]: editContent }));
      setEditMode(false);
      alert("✅ 규정집이 저장되었습니다.");
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 탭 선택 */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl">
        {keys.map((key) => (
          <button
            key={key}
            onClick={() => { setActiveKey(key); setEditMode(false); }}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeKey === key
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {TAB_LABELS[key]}
          </button>
        ))}
      </div>

      {/* 내용 카드 */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            {TAB_LABELS[activeKey]}
          </h2>

          {isAdmin && !editMode && (
            <button
              onClick={startEdit}
              className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Edit className="w-3.5 h-3.5" />
              내용 수정
            </button>
          )}

          {isAdmin && editMode && (
            <div className="flex items-center gap-2">
              <button
                onClick={cancelEdit}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? "저장중..." : "저장"}
              </button>
            </div>
          )}
        </div>

        {editMode ? (
          <textarea
            rows={30}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs text-slate-100 font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none leading-relaxed"
          />
        ) : (
          <div className="bg-slate-950 rounded-xl p-5 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed max-h-[70vh] overflow-y-auto border border-slate-800">
            {rules[activeKey] || "(내용 없음 — 관리자가 내용을 입력해 주세요)"}
          </div>
        )}

        <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
          <span>* 공식 시행 규정으로 협회 포털에 상시 열람 가능합니다.</span>
          <span className="font-semibold text-slate-400">도스변호사협회</span>
        </div>
      </div>
    </div>
  );
}
