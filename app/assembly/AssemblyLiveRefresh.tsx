"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AssemblyLiveRefresh({
  enabled,
  assemblyId,
}: {
  enabled: boolean;
  assemblyId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled || !assemblyId) return;

    const events = new EventSource(
      `/api/assembly/events?assemblyId=${encodeURIComponent(assemblyId)}`,
    );
    let hasConnected = false;
    events.onopen = () => {
      if (hasConnected) router.refresh();
      hasConnected = true;
    };
    events.onmessage = (event) => {
      const snapshot = JSON.parse(event.data) as { initial: boolean };
      if (!snapshot.initial) router.refresh();
    };

    return () => events.close();
  }, [assemblyId, enabled, router]);

  return null;
}
