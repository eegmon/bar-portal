/**
 * 도스변호사협회 Discord Webhook & Bot API 연동 헬퍼
 */
import db from "./db";

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string; icon_url?: string };
  timestamp?: string;
}

export async function getSettingValue(key: string, envFallbackKey?: string): Promise<string> {
  try {
    const res = await db.execute({
      sql: "SELECT value FROM settings WHERE key = ?",
      args: [key],
    });
    if (res.rows.length > 0 && (res.rows[0].value as string).trim()) {
      return (res.rows[0].value as string).trim();
    }
  } catch (err) {
    console.error(`DB 설정 조회 오류 (${key}):`, err);
  }

  if (envFallbackKey && process.env[envFallbackKey]) {
    return process.env[envFallbackKey] || "";
  }
  return "";
}

export type WebhookType =
  | "NOTICE"
  | "LAWYER_APPROVAL"
  | "DISCIPLINE"
  | "EXAM"
  | "EXAM_ADMIN"
  | "ASSEMBLY"
  | "ASSEMBLY_NOTICE"
  | "ASSEMBLY_VOTE"
  | "ADMIN";

export async function getWebhookUrl(type: WebhookType | string): Promise<string> {
  const dbKey = `webhook_${type.toLowerCase()}`;
  const envKey = `DISCORD_WEBHOOK_${type.toUpperCase()}`;
  let url = await getSettingValue(dbKey, envKey);
  
  // 1. LAWYER_APPROVAL 전용 웹훅이 없으면 NOTICE 웹훅으로 fallback
  if (!url && type === "LAWYER_APPROVAL") {
    url = await getSettingValue("webhook_notice", "DISCORD_WEBHOOK_NOTICE");
  }

  // 2. 총회 소집/일정 공고 (ASSEMBLY_NOTICE) 없으면 기존 ASSEMBLY 웹훅으로 fallback
  if (!url && type === "ASSEMBLY_NOTICE") {
    url = await getSettingValue("webhook_assembly", "DISCORD_WEBHOOK_ASSEMBLY");
    if (!url) {
      url = await getSettingValue("webhook_notice", "DISCORD_WEBHOOK_NOTICE");
    }
  }

  // 3. 총회 의사진행 및 표결 (ASSEMBLY_VOTE) 없으면 기존 ASSEMBLY 웹훅으로 fallback
  if (!url && type === "ASSEMBLY_VOTE") {
    url = await getSettingValue("webhook_assembly", "DISCORD_WEBHOOK_ASSEMBLY");
  }

  // 4. ASSEMBLY 기본 호출 시 ASSEMBLY_NOTICE 우선 참조
  if (!url && type === "ASSEMBLY") {
    url = await getSettingValue("webhook_assembly_notice", "DISCORD_WEBHOOK_ASSEMBLY_NOTICE");
  }

  // 5. 변호사시험 관리자 전용 웹훅 (EXAM_ADMIN) 없으면 ADMIN 관리자 웹훅으로 fallback
  if (!url && type === "EXAM_ADMIN") {
    url = await getSettingValue("webhook_admin", "DISCORD_WEBHOOK_ADMIN");
  }

  return url;
}

/**
 * 디스코드 API 레이트리밋(429)을 감지해 자동으로 대기 후 재시도하는 fetch 래퍼.
 * 요청 사이에도 최소 간격을 둬서 전역 레이트리밋(Cloudflare 차단)을 예방합니다.
 */
const DISCORD_MIN_INTERVAL_MS = 300;
let lastDiscordCallAt = 0;
let discordRequestQueue = Promise.resolve();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function discordFetch(
  url: string,
  init: RequestInit,
  maxRetries = 3
): Promise<Response> {
  const request = discordRequestQueue.then(async () => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const elapsed = Date.now() - lastDiscordCallAt;
      if (elapsed < DISCORD_MIN_INTERVAL_MS) {
        await sleep(DISCORD_MIN_INTERVAL_MS - elapsed);
      }
      lastDiscordCallAt = Date.now();

      const res = await fetch(url, init);

      if (res.status !== 429) return res;

      let retryAfterSec: number | undefined;
      let isGlobalLimit = res.headers.get("x-ratelimit-global") === "true";
      try {
        const body = await res.clone().json();
        if (typeof body?.retry_after === "number") retryAfterSec = body.retry_after;
        if (body?.global === true) isGlobalLimit = true;
        if (typeof body?.message === "string" && body.message.includes("global rate limits")) {
          isGlobalLimit = true;
        }
      } catch {
        // 응답 본문이 JSON이 아니면 헤더 값을 사용합니다.
      }
      if (retryAfterSec === undefined) {
        const header = res.headers.get("retry-after");
        if (header) retryAfterSec = Number(header);
      }

      // 전역 차단은 재시도가 차단 시간을 늘릴 수 있으므로 즉시 호출자에게 반환합니다.
      if (isGlobalLimit || attempt >= maxRetries) return res;

      const waitMs = Math.min(Math.max((retryAfterSec || 1) * 1000 + 250, 1000), 60000);
      console.warn(
        `[Discord Bot] 429 레이트리밋 감지, ${waitMs}ms 대기 후 재시도 (${attempt + 1}/${maxRetries})`
      );
      await sleep(waitMs);
    }

    throw new Error("Discord API 요청 재시도 횟수를 초과했습니다.");
  });

  // 한 요청의 실패가 다음 요청의 큐를 막지 않도록 큐 상태만 정상화합니다.
  discordRequestQueue = request.then(() => undefined, () => undefined);
  return request;
}

export async function sendDiscordWebhook(
  type: WebhookType,
  payload: { content?: string; embeds?: DiscordEmbed[] }
) {
  const url = await getWebhookUrl(type);
  if (!url) {
    console.warn(`[Discord Webhook] ${type} Webhook URL이 설정되지 않아 콘솔에만 출력합니다.`, payload);
    return;
  }

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error(`[Discord Webhook Error] ${type} 전송 실패:`, err);
  }
}

/**
 * 디스코드 봇 설정 조회 (DB 또는 환경변수)
 */
export async function getBotConfig() {
  const token = (await getSettingValue("discord_bot_token")) || process.env.DISCORD_BOT_TOKEN || "";
  const guildId = (await getSettingValue("discord_guild_id")) || process.env.DISCORD_GUILD_ID || "";
  return { token, guildId };
}

/**
 * 디스코드 유저 ID 해석 (숫자 ID, 멘션 태그, 또는 닉네임/사용자명 자동 검색)
 */
export async function resolveDiscordUserId(discordInput: string): Promise<string | null> {
  if (!discordInput) return null;
  const trimmed = discordInput.trim();

  // 1. 순수 17~20자리 숫자 ID인 경우
  if (/^\d{17,20}$/.test(trimmed)) {
    return trimmed;
  }

  // 2. <@123456789012345678> 멘션 포맷인 경우
  const mentionMatch = trimmed.match(/\d{17,20}/);
  if (mentionMatch) {
    return mentionMatch[0];
  }

  // 3. 닉네임/사용자명 문자열인 경우 서버 멤버 검색 API로 ID 자동 조회
  const { token, guildId } = await getBotConfig();
  if (!token || !guildId) return null;

  try {
    const res = await discordFetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/search?query=${encodeURIComponent(trimmed)}&limit=1`,
      {
        headers: {
          Authorization: `Bot ${token}`,
        },
      }
    );
    if (res.ok) {
      const members = await res.json();
      if (Array.isArray(members) && members.length > 0 && members[0]?.user?.id) {
        return members[0].user.id;
      }
    }
  } catch (err) {
    console.warn("[Discord Bot] 유저 검색 오류:", err);
  }

  return null;
}

/**
 * 디스코드 봇을 통한 유저 역할(Role) 추가
 */
export async function addDiscordRole(
  discordUserId: string,
  roleId: string,
  resolvedUserId?: string
): Promise<boolean> {
  if (!discordUserId || !roleId) return false;
  const cleanRoleId = roleId.replace(/[^0-9]/g, "");
  if (!cleanRoleId) return false;

  const userId = resolvedUserId || (await resolveDiscordUserId(discordUserId));
  if (!userId) {
    console.warn(`[Discord Bot] 유효한 유저 ID를 찾을 수 없습니다: ${discordUserId}`);
    return false;
  }

  const { token, guildId } = await getBotConfig();
  if (!token || !guildId) {
    console.warn("[Discord Bot] Bot Token 또는 Guild ID가 설정되지 않았습니다.");
    return false;
  }

  try {
    const res = await discordFetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${cleanRoleId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Discord Bot] 역할 부여 실패 (${res.status}): ${errText}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Discord Bot] 역할 추가 네트워크 에러:", err);
    return false;
  }
}

/**
 * 디스코드 봇을 통한 유저 역할(Role) 제거
 */
export async function removeDiscordRole(
  discordUserId: string,
  roleId: string,
  resolvedUserId?: string
): Promise<boolean> {
  if (!discordUserId || !roleId) return false;
  const cleanRoleId = roleId.replace(/[^0-9]/g, "");
  if (!cleanRoleId) return false;

  const userId = resolvedUserId || (await resolveDiscordUserId(discordUserId));
  if (!userId) return false;

  const { token, guildId } = await getBotConfig();
  if (!token || !guildId) return false;

  try {
    const res = await discordFetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${cleanRoleId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bot ${token}`,
        },
      }
    );
    return res.ok;
  } catch (err) {
    console.error("[Discord Bot] 역할 제거 실패:", err);
    return false;
  }
}

/**
 * 유저의 역할(Role) 및 직책(Positions)에 따른 디스코드 역할 자동 동기화
 */
export async function syncUserDiscordRoles(params: {
  discordUserId?: string;
  role?: string;
  status?: string;
  isTrainee?: number;
  positions?: string[];
}) {
  const { discordUserId, role, status, isTrainee, positions = [] } = params;
  if (!discordUserId) return;

  const resolvedUserId = await resolveDiscordUserId(discordUserId);
  if (!resolvedUserId) return;
  const addRole = (roleId: string) => addDiscordRole(discordUserId, roleId, resolvedUserId);
  const removeRole = (roleId: string) => removeDiscordRole(discordUserId, roleId, resolvedUserId);

  const lawyerRoleId = await getSettingValue("discord_role_lawyer", "DISCORD_ROLE_LAWYER");
  const traineeRoleId = await getSettingValue("discord_role_trainee", "DISCORD_ROLE_TRAINEE");
  
  // 이사회 & 임원 그룹
  const groupExecutiveRoleId = await getSettingValue("discord_role_group_executive", "DISCORD_ROLE_GROUP_EXECUTIVE");
  const presidentRoleId = await getSettingValue("discord_role_president", "DISCORD_ROLE_PRESIDENT");
  const vicePresidentRoleId = await getSettingValue("discord_role_vice_president", "DISCORD_ROLE_VICE_PRESIDENT");
  const directorRoleId = await getSettingValue("discord_role_director", "DISCORD_ROLE_DIRECTOR");
  const boardRoleId = await getSettingValue("discord_role_board", "DISCORD_ROLE_BOARD");

  // 총회 그룹
  const groupAssemblyRoleId = await getSettingValue("discord_role_group_assembly", "DISCORD_ROLE_GROUP_ASSEMBLY");
  const speakerRoleId = await getSettingValue("discord_role_speaker", "DISCORD_ROLE_SPEAKER");
  const viceSpeakerRoleId = await getSettingValue("discord_role_vice_speaker", "DISCORD_ROLE_VICE_SPEAKER");

  // 사무국 그룹
  const groupSecretariatRoleId = await getSettingValue("discord_role_group_secretariat", "DISCORD_ROLE_GROUP_SECRETARIAT");
  const secretaryGeneralRoleId = await getSettingValue("discord_role_secretary_general", "DISCORD_ROLE_SECRETARY_GENERAL");
  const staffRoleId = await getSettingValue("discord_role_staff", "DISCORD_ROLE_STAFF");

  // 위원회
  const examCommRoleId = await getSettingValue("discord_role_exam_comm", "DISCORD_ROLE_EXAM_COMM");
  const disciplineCommRoleId = await getSettingValue("discord_role_discipline_comm", "DISCORD_ROLE_DISCIPLINE_COMM");

  // 1. 변호사/견습 역할 동기화
  if (status === "ACTIVE" && role === "LAWYER") {
    if (lawyerRoleId) await addRole(lawyerRoleId);
    if (isTrainee && traineeRoleId) await addRole(traineeRoleId);
    if (!isTrainee && traineeRoleId) await removeRole(traineeRoleId);
  } else if (status === "SUSPENDED" || status === "EXPIRED" || status === "EXPELLED") {
    if (lawyerRoleId) await removeRole(lawyerRoleId);
    if (traineeRoleId) await removeRole(traineeRoleId);
  }

  // 2. 이사회 & 【 🎓 · 임원 】 그룹
  const isExecutive = positions.some((p) => ["PRESIDENT", "VICE_PRESIDENT", "DIRECTOR"].includes(p));
  if (groupExecutiveRoleId) {
    if (isExecutive) await addRole(groupExecutiveRoleId);
    else await removeRole(groupExecutiveRoleId);
  }
  if (boardRoleId) {
    if (isExecutive) await addRole(boardRoleId);
    else await removeRole(boardRoleId);
  }
  if (presidentRoleId) {
    if (positions.includes("PRESIDENT")) await addRole(presidentRoleId);
    else await removeRole(presidentRoleId);
  }
  if (vicePresidentRoleId) {
    if (positions.includes("VICE_PRESIDENT")) await addRole(vicePresidentRoleId);
    else await removeRole(vicePresidentRoleId);
  }
  if (directorRoleId) {
    if (positions.includes("DIRECTOR")) await addRole(directorRoleId);
    else await removeRole(directorRoleId);
  }

  // 3. 총회 의장단 & 【 📜 · 총회 】 그룹
  const isAssemblyLeader = positions.some((p) => ["ASSEMBLY_SPEAKER", "ASSEMBLY_VICE_SPEAKER"].includes(p));
  if (groupAssemblyRoleId) {
    if (isAssemblyLeader) await addRole(groupAssemblyRoleId);
    else await removeRole(groupAssemblyRoleId);
  }
  if (speakerRoleId) {
    if (positions.includes("ASSEMBLY_SPEAKER")) await addRole(speakerRoleId);
    else await removeRole(speakerRoleId);
  }
  if (viceSpeakerRoleId) {
    if (positions.includes("ASSEMBLY_VICE_SPEAKER")) await addRole(viceSpeakerRoleId);
    else await removeRole(viceSpeakerRoleId);
  }

  // 4. 사무국 & 【 📂 · 사무국 】 그룹
  const isSecretariat = positions.some((p) => ["SECRETARY_GENERAL", "SECRETARIAT_STAFF"].includes(p));
  if (groupSecretariatRoleId) {
    if (isSecretariat) await addRole(groupSecretariatRoleId);
    else await removeRole(groupSecretariatRoleId);
  }
  if (secretaryGeneralRoleId) {
    if (positions.includes("SECRETARY_GENERAL")) await addRole(secretaryGeneralRoleId);
    else await removeRole(secretaryGeneralRoleId);
  }
  if (staffRoleId) {
    if (positions.includes("SECRETARIAT_STAFF")) await addRole(staffRoleId);
    else await removeRole(staffRoleId);
  }

  // 5. 위원회
  if (examCommRoleId) {
    if (positions.includes("EXAM_COMM_MEMBER")) await addRole(examCommRoleId);
    else await removeRole(examCommRoleId);
  }
  if (disciplineCommRoleId) {
    if (positions.includes("DISCIPLINE_COMM_MEMBER")) await addRole(disciplineCommRoleId);
    else await removeRole(disciplineCommRoleId);
  }
}

/**
 * 디스코드 서버로부터 유저의 최신 역할(Role) 및 닉네임을 조회하여 포털 직책/권한 동기화 (Discord -> Site)
 */
export async function syncUserFromDiscord(userId: string, customDiscordId?: string): Promise<{
  success: boolean;
  message?: string;
  updatedPositions?: string[];
  updatedRole?: string;
  isTrainee?: number;
  discordNick?: string;
}> {
  try {
    // 1. DB에서 사용자 정보 조회
    const userRes = await db.execute({
      sql: "SELECT id, login_id, name, role, status, is_trainee, positions, discord_id, phone FROM users WHERE id = ?",
      args: [userId],
    });

    if (userRes.rows.length === 0) {
      return { success: false, message: "사용자를 찾을 수 없습니다." };
    }

    const user = userRes.rows[0];
    const targetDiscordInput = customDiscordId || (user.discord_id as string) || (user.phone as string) || "";
    if (!targetDiscordInput) {
      return { success: false, message: "등록된 디스코드 ID 또는 닉네임이 없습니다." };
    }

    const resolvedDiscordUserId = await resolveDiscordUserId(targetDiscordInput);
    if (!resolvedDiscordUserId) {
      return { success: false, message: `디스코드 사용자를 찾을 수 없습니다: ${targetDiscordInput}` };
    }

    const { token, guildId } = await getBotConfig();
    if (!token || !guildId) {
      return { success: false, message: "디스코드 봇 토큰 또는 서버 ID가 설정되지 않았습니다." };
    }

    // 2. 디스코드 Guild Member 정보 조회
    const memberRes = await discordFetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${resolvedDiscordUserId}`,
      {
        headers: {
          Authorization: `Bot ${token}`,
        },
      }
    );

    if (!memberRes.ok) {
      const errText = await memberRes.text();
      return { success: false, message: `디스코드 서버 멤버 조회 실패 (${memberRes.status}): ${errText}` };
    }

    const memberData = await memberRes.json();
    const discordRoles: string[] = Array.isArray(memberData.roles) ? memberData.roles : [];
    const discordNick: string = memberData.nick || memberData.user?.global_name || memberData.user?.username || "";

    // 3. 시스템에 등록된 디스코드 역할 ID 매핑 조회
    const lawyerRoleId = await getSettingValue("discord_role_lawyer", "DISCORD_ROLE_LAWYER");
    const traineeRoleId = await getSettingValue("discord_role_trainee", "DISCORD_ROLE_TRAINEE");
    const presidentRoleId = await getSettingValue("discord_role_president", "DISCORD_ROLE_PRESIDENT");
    const vicePresidentRoleId = await getSettingValue("discord_role_vice_president", "DISCORD_ROLE_VICE_PRESIDENT");
    const directorRoleId = await getSettingValue("discord_role_director", "DISCORD_ROLE_DIRECTOR");
    const speakerRoleId = await getSettingValue("discord_role_speaker", "DISCORD_ROLE_SPEAKER");
    const viceSpeakerRoleId = await getSettingValue("discord_role_vice_speaker", "DISCORD_ROLE_VICE_SPEAKER");
    const secretaryGeneralRoleId = await getSettingValue("discord_role_secretary_general", "DISCORD_ROLE_SECRETARY_GENERAL");
    const staffRoleId = await getSettingValue("discord_role_staff", "DISCORD_ROLE_STAFF");
    const examCommRoleId = await getSettingValue("discord_role_exam_comm", "DISCORD_ROLE_EXAM_COMM");
    const disciplineCommRoleId = await getSettingValue("discord_role_discipline_comm", "DISCORD_ROLE_DISCIPLINE_COMM");

    // 4. 역할 매핑 계산
    const newPositions: string[] = [];
    if (presidentRoleId && discordRoles.includes(presidentRoleId)) newPositions.push("PRESIDENT");
    if (vicePresidentRoleId && discordRoles.includes(vicePresidentRoleId)) newPositions.push("VICE_PRESIDENT");
    if (directorRoleId && discordRoles.includes(directorRoleId)) newPositions.push("DIRECTOR");
    if (speakerRoleId && discordRoles.includes(speakerRoleId)) newPositions.push("ASSEMBLY_SPEAKER");
    if (viceSpeakerRoleId && discordRoles.includes(viceSpeakerRoleId)) newPositions.push("ASSEMBLY_VICE_SPEAKER");
    if (secretaryGeneralRoleId && discordRoles.includes(secretaryGeneralRoleId)) newPositions.push("SECRETARY_GENERAL");
    if (staffRoleId && discordRoles.includes(staffRoleId)) newPositions.push("SECRETARIAT_STAFF");
    if (examCommRoleId && discordRoles.includes(examCommRoleId)) newPositions.push("EXAM_COMM_MEMBER");
    if (disciplineCommRoleId && discordRoles.includes(disciplineCommRoleId)) newPositions.push("DISCIPLINE_COMM_MEMBER");

    const isTrainee = (traineeRoleId && discordRoles.includes(traineeRoleId)) ? 1 : 0;
    const hasLawyerRole = (lawyerRoleId && discordRoles.includes(lawyerRoleId));

    // 참고: 임원/의장단(PRESIDENT, ASSEMBLY_SPEAKER 등)의 관리자 권한은
    // lib/types.ts의 hasAdminPanelAccess/canManageUsers 등이 positions 배열을
    // 별도로 확인해 이미 부여하므로, 여기서 role을 "ADMIN"으로 덮어쓸 필요가 없습니다.
    // role을 ADMIN으로 바꾸면 "LAWYER"를 요구하는 화면(예: 법인 등록 신청)에서
    // 정작 변호사인 임원이 접근하지 못하는 부작용이 있어 제거했습니다.
    let newRole = user.role as string;
    if (hasLawyerRole) {
      newRole = "LAWYER";
    }

    // 5. DB 업데이트
    await db.execute({
      sql: `UPDATE users 
            SET positions = ?, 
                is_trainee = ?, 
                role = ?,
                discord_id = COALESCE(NULLIF(discord_id, ''), ?),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
      args: [
        JSON.stringify(newPositions),
        isTrainee,
        newRole,
        resolvedDiscordUserId,
        userId,
      ],
    });

    return {
      success: true,
      message: "디스코드 역할과 사이트 정보가 성공적으로 동기화되었습니다.",
      updatedPositions: newPositions,
      updatedRole: newRole,
      isTrainee,
      discordNick,
    };
  } catch (err: any) {
    console.error("[Discord -> Site Sync Error]:", err);
    return { success: false, message: err.message || "동기화 중 오류가 발생했습니다." };
  }
}

/**
 * 전체 회원의 디스코드 역할을 일괄 동기화 (배치 작업)
 */
export async function syncAllUsersFromDiscord(): Promise<{
  total: number;
  synced: number;
  failed: number;
  logs: string[];
}> {
  const usersRes = await db.execute("SELECT id, name, login_id, discord_id, phone FROM users");
  let synced = 0;
  let failed = 0;
  const logs: string[] = [];

  for (const user of usersRes.rows) {
    const userId = user.id as string;
    const userName = (user.name as string) || (user.login_id as string);
    const targetDiscord = (user.discord_id as string) || (user.phone as string) || "";

    if (!targetDiscord) {
      failed++;
      logs.push(`⏭️ [${userName}] 건너뜀 (등록된 디스코드 정보 없음)`);
      continue;
    }

    const result = await syncUserFromDiscord(userId, targetDiscord);
    if (result.success) {
      synced++;
      logs.push(`✅ [${userName}] 동기화 완료 (직책: ${result.updatedPositions?.join(", ") || "없음"}, 등급: ${result.updatedRole})`);
    } else {
      failed++;
      logs.push(`❌ [${userName}] 실패: ${result.message}`);
    }

    // 회원 간 간격을 둬서 디스코드 전역 레이트리밋(Cloudflare 차단)을 예방합니다.
    await sleep(400);
  }

  return {
    total: usersRes.rows.length,
    synced,
    failed,
    logs,
  };
}
