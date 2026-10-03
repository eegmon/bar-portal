"use client";

import { FileText, Filter, RefreshCw } from "lucide-react";
import { formatDbUtcAsKst } from "@/lib/kst";

interface AssemblyAuditPanelProps {
  assemblies: any[];
  selectedAssemblyId: string;
  auditLogs: any[];
  isLoading: boolean;
  loadAuditLogs: () => Promise<void>;
  auditFilterAssembly: string;
  onAuditFilterAssemblyChange: (value: string) => void;
  auditFilterAction: string;
  onAuditFilterActionChange: (value: string) => void;
  expandedAuditId: string | null;
  onToggleExpandedAudit: (logId: string) => void;
}

export default function AssemblyAuditPanel({
  assemblies,
  selectedAssemblyId,
  auditLogs,
  isLoading,
  loadAuditLogs,
  auditFilterAssembly,
  onAuditFilterAssemblyChange,
  auditFilterAction,
  onAuditFilterActionChange,
  expandedAuditId,
  onToggleExpandedAudit,
}: AssemblyAuditPanelProps) {
  const uniqueActions = [
    ...new Set(auditLogs.map((log) => String(log.action))),
  ].sort();
  const filteredAuditLogs = auditLogs.filter(
    (log) => !auditFilterAction || log.action === auditFilterAction,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-950 border border-slate-800 rounded-xl">
        <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <select
          value={auditFilterAssembly}
          onChange={(e) => onAuditFilterAssemblyChange(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white min-w-[160px]"
        >
          <option value="">전체 총회</option>
          {assemblies.map((assembly) => (
            <option key={assembly.id} value={assembly.id}>
              {assembly.title}
            </option>
          ))}
        </select>
        <select
          value={auditFilterAction}
          onChange={(e) => onAuditFilterActionChange(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white min-w-[140px]"
        >
          <option value="">전체 액션</option>
          {uniqueActions.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>
        <button
          onClick={loadAuditLogs}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg font-bold disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
          />
          {isLoading ? "로딩 중..." : "새로고침"}
        </button>
        <a
          href={`/api/assembly/audit?format=csv${auditFilterAssembly ? `&assemblyId=${auditFilterAssembly}` : ""}`}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg font-bold ml-auto"
        >
          <FileText className="w-3.5 h-3.5" /> CSV
        </a>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "전체 로그",
            value: filteredAuditLogs.length,
            cls: "text-white",
          },
          {
            label: "이번 총회",
            value: filteredAuditLogs.filter(
              (log) => log.assembly_id === selectedAssemblyId,
            ).length,
            cls: "text-emerald-400",
          },
          {
            label: "오늘",
            value: filteredAuditLogs.filter((log) =>
              String(log.created_at).startsWith(
                new Date().toISOString().slice(0, 10),
              ),
            ).length,
            cls: "text-blue-400",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center"
          >
            <div className="text-[11px] text-slate-500 mb-0.5">
              {stat.label}
            </div>
            <div className={`text-xl font-extrabold font-mono ${stat.cls}`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] text-[10px] font-bold text-slate-400 bg-slate-900 px-4 py-2 border-b border-slate-800">
          <span className="w-20">시각</span>
          <span>총회</span>
          <span>안건</span>
          <span>액션</span>
          <span className="w-24 text-right">처리자</span>
        </div>
        <div className="divide-y divide-slate-800/50 max-h-[480px] overflow-y-auto">
          {filteredAuditLogs.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              조건에 맞는 로그가 없습니다.
            </div>
          ) : (
            filteredAuditLogs.map((log) => (
              <div key={log.id}>
                <button
                  onClick={() => onToggleExpandedAudit(log.id)}
                  className="w-full grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 px-4 py-2.5 text-xs hover:bg-slate-900/60 transition-colors text-left"
                >
                  <span className="w-20 text-slate-500 font-mono text-[10px] truncate">
                    {formatDbUtcAsKst(log.created_at)}
                  </span>
                  <span className="text-slate-400 truncate">
                    {String(log.assembly_title || log.assembly_id || "-")}
                  </span>
                  <span className="text-slate-400 truncate">
                    {String(log.agenda_title || "-")}
                  </span>
                  <span
                    className={`font-bold truncate ${
                      String(log.action).includes("START") ||
                      String(log.action).includes("OPEN")
                        ? "text-emerald-400"
                        : String(log.action).includes("CLOSE") ||
                            String(log.action).includes("DELETE")
                          ? "text-red-400"
                          : String(log.action).includes("CONFIRM")
                            ? "text-blue-400"
                            : "text-amber-300"
                    }`}
                  >
                    {String(log.action)}
                  </span>
                  <span className="w-24 text-right text-slate-500 text-[10px] truncate">
                    {String(log.actor_id || "-")}
                  </span>
                </button>
                {expandedAuditId === log.id && log.details && (
                  <div className="px-4 pb-3 bg-slate-900/40">
                    <pre className="text-[11px] text-slate-300 font-mono bg-slate-950 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                      {(() => {
                        try {
                          return JSON.stringify(
                            JSON.parse(String(log.details)),
                            null,
                            2,
                          );
                        } catch {
                          return String(log.details);
                        }
                      })()}
                    </pre>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
