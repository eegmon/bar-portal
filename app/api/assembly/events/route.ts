import db from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 2_000;
const HEARTBEAT_INTERVAL_MS = 15_000;

type AgendaSnapshot = {
  id: string;
  title: string;
  description?: string;
  status: string;
  is_secret: number;
  voting_method: string;
  choice_config: string;
  voting_deadline?: string;
  result_status?: string;
  result_method?: string;
};

type AgendaEvent = { initial: boolean; agendas: AgendaSnapshot[] };
type AssemblyWatcher = {
  subscribers: Set<(event: AgendaEvent) => void>;
  agendas: AgendaSnapshot[] | null;
  pollTimer: ReturnType<typeof setInterval>;
  polling: boolean;
};

const watchers = new Map<string, AssemblyWatcher>();

async function readAgendas(assemblyId: string): Promise<AgendaSnapshot[]> {
  const result = await db.execute({
    sql: `SELECT id, title, description, status, is_secret, voting_method,
                 choice_config, voting_deadline, result_status, result_method
          FROM agendas
          WHERE assembly_id = ?
          ORDER BY agenda_order ASC, created_at ASC`,
    args: [assemblyId],
  });
  return result.rows.map((row) => ({
    id: String(row.id),
    title: String(row.title ?? ""),
    description: row.description == null ? undefined : String(row.description),
    status: String(row.status ?? ""),
    is_secret: Number(row.is_secret ?? 0),
    voting_method: String(row.voting_method ?? ""),
    choice_config: String(row.choice_config ?? "[]"),
    voting_deadline:
      row.voting_deadline == null ? undefined : String(row.voting_deadline),
    result_status:
      row.result_status == null ? undefined : String(row.result_status),
    result_method:
      row.result_method == null ? undefined : String(row.result_method),
  }));
}

function getWatcher(assemblyId: string): AssemblyWatcher {
  const existing = watchers.get(assemblyId);
  if (existing) return existing;

  const watcher: AssemblyWatcher = {
    subscribers: new Set(),
    agendas: null,
    polling: false,
    pollTimer: setInterval(
      () => void pollWatcher(assemblyId),
      POLL_INTERVAL_MS,
    ),
  };
  watchers.set(assemblyId, watcher);
  void pollWatcher(assemblyId);
  return watcher;
}

async function pollWatcher(assemblyId: string) {
  const watcher = watchers.get(assemblyId);
  if (!watcher || watcher.polling) return;

  watcher.polling = true;
  try {
    const agendas = await readAgendas(assemblyId);
    const changed = JSON.stringify(agendas) !== JSON.stringify(watcher.agendas);
    if (!changed) return;

    const initial = watcher.agendas === null;
    watcher.agendas = agendas;
    for (const subscriber of watcher.subscribers) {
      subscriber({ initial, agendas });
    }
  } catch {
    // Keep the watcher alive and retry on the next interval.
  } finally {
    watcher.polling = false;
  }
}

export async function GET(request: Request) {
  const assemblyId = new URL(request.url).searchParams.get("assemblyId");
  if (!assemblyId) {
    return Response.json({ error: "총회 ID가 필요합니다." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (message: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(message));
        } catch {
          closed = true;
          unsubscribe?.();
          if (heartbeatTimer) clearInterval(heartbeatTimer);
        }
      };
      const watcher = getWatcher(assemblyId);
      const onAgendaChange = (event: AgendaEvent) =>
        send(`data: ${JSON.stringify(event)}\n\n`);
      watcher.subscribers.add(onAgendaChange);
      unsubscribe = () => {
        watcher.subscribers.delete(onAgendaChange);
        if (watcher.subscribers.size === 0) {
          clearInterval(watcher.pollTimer);
          watchers.delete(assemblyId);
        }
      };
      if (watcher.agendas) {
        onAgendaChange({ initial: true, agendas: watcher.agendas });
      }
      heartbeatTimer = setInterval(
        () => send(": keepalive\n\n"),
        HEARTBEAT_INTERVAL_MS,
      );
    },
    cancel() {
      closed = true;
      unsubscribe?.();
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
