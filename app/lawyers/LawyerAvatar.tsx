"use client";

import { useState } from "react";

interface LawyerAvatarProps {
  name: string;
  isActive: boolean;
}

export default function LawyerAvatar({ name, isActive }: LawyerAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  // crafthead.net은 닉네임으로 직접 요청 지원
  const skinUrl = `https://crafthead.net/avatar/${encodeURIComponent(name)}`;

  const baseClass = `w-12 h-12 rounded-xl border overflow-hidden flex items-center justify-center font-bold text-lg shrink-0 ${
    isActive
      ? "bg-slate-800 border-slate-700 text-amber-400"
      : "bg-slate-800/50 border-slate-700/50 text-slate-500"
  }`;

  if (!imgFailed) {
    return (
      <div className={baseClass}>
        <img
          src={skinUrl}
          alt={`${name} 스킨`}
          width={48}
          height={48}
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
          style={isActive ? {} : { filter: "grayscale(60%) opacity(0.6)" }}
        />
      </div>
    );
  }

  // 스킨 로드 실패 시 이름 첫 글자 폴백
  return (
    <div className={baseClass}>
      {name[0]}
    </div>
  );
}
