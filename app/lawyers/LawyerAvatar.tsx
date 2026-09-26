"use client";

import { useState } from "react";

interface LawyerAvatarProps {
  name: string;
  isActive: boolean;
  size?: number;
}

export default function LawyerAvatar({ name, isActive, size = 48 }: LawyerAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const skinUrl = `https://crafthead.net/avatar/${encodeURIComponent(name)}`;

  const baseClass = `w-full h-full flex items-center justify-center font-bold overflow-hidden ${
    isActive
      ? "bg-slate-800 border-slate-700 text-amber-400"
      : "bg-slate-800/50 border-slate-700/50 text-slate-500"
  }`;

  const fontSize = size >= 56 ? "text-2xl" : "text-lg";

  if (!imgFailed) {
    return (
      <div className={baseClass} style={{ width: size, height: size }}>
        <img
          src={skinUrl}
          alt={`${name} 스킨`}
          width={size}
          height={size}
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
          style={isActive ? {} : { filter: "grayscale(60%) opacity(0.6)" }}
        />
      </div>
    );
  }

  return (
    <div className={`${baseClass} border rounded-xl ${fontSize}`} style={{ width: size, height: size }}>
      {name[0]}
    </div>
  );
}
