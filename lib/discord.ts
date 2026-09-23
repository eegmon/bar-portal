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

export async function getWebhookUrl(type: string): Promise<string> {
  const dbKey = `webhook_${type.toLowerCase()}`;
  const envKey = `DISCORD_WEBHOOK_${type.toUpperCase()}`;
  return getSettingValue(dbKey, envKey);
}

export async function sendDiscordWebhook(
  type: "NOTICE" | "DISCIPLINE" | "EXAM" | "ASSEMBLY" | "ADMIN",
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
 * 디스코드 봇을 통한 유저 역할(Role) 추가
 */
export async function addDiscordRole(discordUserId: string, roleId: string): Promise<boolean> {
  if (!discordUserId || !roleId) return false;
  // 숫자만 추출 (만약 닉네임이나 형식이 섞여 있는 경우 정제)
  const cleanUserId = discordUserId.replace(/[^0-9]/g, "");
  const cleanRoleId = roleId.replace(/[^0-9]/g, "");

  if (!cleanUserId || !cleanRoleId) {
    console.warn(`[Discord Bot] 유효하지 않은 유저ID(${discordUserId}) 또는 역할ID(${roleId})`);
    return false;
  }

  const { token, guildId } = await getBotConfig();
  if (!token || !guildId) {
    console.warn("[Discord Bot] Bot Token 또는 Guild ID가 설정되지 않았습니다.");
    return false;
  }

  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${cleanUserId}/roles/${cleanRoleId}`,
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
export async function removeDiscordRole(discordUserId: string, roleId: string): Promise<boolean> {
  if (!discordUserId || !roleId) return false;
  const cleanUserId = discordUserId.replace(/[^0-9]/g, "");
  const cleanRoleId = roleId.replace(/[^0-9]/g, "");

  if (!cleanUserId || !cleanRoleId) return false;

  const { token, guildId } = await getBotConfig();
  if (!token || !guildId) return false;

  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${cleanUserId}/roles/${cleanRoleId}`,
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

  const lawyerRoleId = await getSettingValue("discord_role_lawyer", "DISCORD_ROLE_LAWYER");
  const traineeRoleId = await getSettingValue("discord_role_trainee", "DISCORD_ROLE_TRAINEE");
  const presidentRoleId = await getSettingValue("discord_role_president", "DISCORD_ROLE_PRESIDENT");
  const speakerRoleId = await getSettingValue("discord_role_speaker", "DISCORD_ROLE_SPEAKER");
  const examCommRoleId = await getSettingValue("discord_role_exam_comm", "DISCORD_ROLE_EXAM_COMM");
  const disciplineCommRoleId = await getSettingValue("discord_role_discipline_comm", "DISCORD_ROLE_DISCIPLINE_COMM");
  const staffRoleId = await getSettingValue("discord_role_staff", "DISCORD_ROLE_STAFF");

  // 1. 변호사/견습 역할 동기화
  if (status === "ACTIVE" && role === "LAWYER") {
    if (lawyerRoleId) await addDiscordRole(discordUserId, lawyerRoleId);
    if (isTrainee && traineeRoleId) await addDiscordRole(discordUserId, traineeRoleId);
    if (!isTrainee && traineeRoleId) await removeDiscordRole(discordUserId, traineeRoleId);
  } else if (status === "SUSPENDED" || status === "EXPIRED" || status === "EXPELLED") {
    if (lawyerRoleId) await removeDiscordRole(discordUserId, lawyerRoleId);
    if (traineeRoleId) await removeDiscordRole(discordUserId, traineeRoleId);
  }

  // 2. 직책별 디스코드 역할 부여
  if (presidentRoleId) {
    if (positions.includes("PRESIDENT")) await addDiscordRole(discordUserId, presidentRoleId);
    else await removeDiscordRole(discordUserId, presidentRoleId);
  }

  if (speakerRoleId) {
    if (positions.includes("ASSEMBLY_SPEAKER")) await addDiscordRole(discordUserId, speakerRoleId);
    else await removeDiscordRole(discordUserId, speakerRoleId);
  }

  if (examCommRoleId) {
    if (positions.includes("EXAM_COMM_MEMBER")) await addDiscordRole(discordUserId, examCommRoleId);
    else await removeDiscordRole(discordUserId, examCommRoleId);
  }

  if (disciplineCommRoleId) {
    if (positions.includes("DISCIPLINE_COMM_MEMBER")) await addDiscordRole(discordUserId, disciplineCommRoleId);
    else await removeDiscordRole(discordUserId, disciplineCommRoleId);
  }

  if (staffRoleId) {
    if (positions.includes("SECRETARY_GENERAL") || positions.includes("SECRETARIAT_STAFF")) {
      await addDiscordRole(discordUserId, staffRoleId);
    } else {
      await removeDiscordRole(discordUserId, staffRoleId);
    }
  }
}
