import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser, canManageSettings } from "@/lib/auth";
import { sendDiscordWebhook } from "@/lib/discord";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || !canManageSettings(user)) {
      return NextResponse.json({ error: "시스템 설정 관리 권한(협회장/사무총장/ADMIN)이 필요합니다." }, { status: 403 });
    }

    const res = await db.execute("SELECT key, value, updated_at FROM settings");
    const settingsMap: Record<string, string> = {};
    for (const row of res.rows) {
      settingsMap[row.key as string] = row.value as string;
    }

    return NextResponse.json({
      success: true,
      settings: {
        // 웹훅
        webhook_notice: settingsMap["webhook_notice"] || process.env.DISCORD_WEBHOOK_NOTICE || "",
        webhook_exam: settingsMap["webhook_exam"] || process.env.DISCORD_WEBHOOK_EXAM || "",
        webhook_assembly: settingsMap["webhook_assembly"] || process.env.DISCORD_WEBHOOK_ASSEMBLY || "",
        webhook_discipline: settingsMap["webhook_discipline"] || process.env.DISCORD_WEBHOOK_DISCIPLINE || "",
        webhook_admin: settingsMap["webhook_admin"] || process.env.DISCORD_WEBHOOK_ADMIN || "",

        // 디스코드 봇 & 자동 역할 지급 설정
        discord_bot_token: settingsMap["discord_bot_token"] || process.env.DISCORD_BOT_TOKEN || "",
        discord_guild_id: settingsMap["discord_guild_id"] || process.env.DISCORD_GUILD_ID || "",
        discord_role_lawyer: settingsMap["discord_role_lawyer"] || process.env.DISCORD_ROLE_LAWYER || "",
        discord_role_trainee: settingsMap["discord_role_trainee"] || process.env.DISCORD_ROLE_TRAINEE || "",
        discord_role_president: settingsMap["discord_role_president"] || process.env.DISCORD_ROLE_PRESIDENT || "",
        discord_role_speaker: settingsMap["discord_role_speaker"] || process.env.DISCORD_ROLE_SPEAKER || "",
        discord_role_exam_comm: settingsMap["discord_role_exam_comm"] || process.env.DISCORD_ROLE_EXAM_COMM || "",
        discord_role_discipline_comm: settingsMap["discord_role_discipline_comm"] || process.env.DISCORD_ROLE_DISCIPLINE_COMM || "",
        discord_role_staff: settingsMap["discord_role_staff"] || process.env.DISCORD_ROLE_STAFF || "",
      },
    });
  } catch (err: any) {
    console.error("Settings GET Error:", err);
    return NextResponse.json({ error: err.message || "서버 오류" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || !canManageSettings(user)) {
      return NextResponse.json({ error: "시스템 설정 관리 권한(협회장/사무총장/ADMIN)이 필요합니다." }, { status: 403 });
    }

    const body = await req.json();
    const { action, settings, testType } = body;

    // 테스트 웹훅 발송 액션
    if (action === "TEST_WEBHOOK") {
      const type = (testType || "ADMIN") as any;
      await sendDiscordWebhook(type, {
        embeds: [
          {
            title: `🔔 [테스트 발송] 디스코드 웹훅 연동 정상 (${type})`,
            description: `관리자 **${user.name}** 님이 웹훅 테스트를 요청하였습니다.\n도스변호사협회 시스템과 디스코드 채널이 정상적으로 연동되어 있습니다.`,
            color: 0x10B981,
            timestamp: new Date().toISOString(),
          },
        ],
      });
      return NextResponse.json({ success: true, message: `${type} 채널로 테스트 웹훅이 발송되었습니다.` });
    }

    // 설정 일괄 저장
    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ error: "유효하지 않은 설정 데이터입니다." }, { status: 400 });
    }

    for (const [key, value] of Object.entries(settings)) {
      await db.execute({
        sql: `INSERT INTO settings (key, value, updated_at)
              VALUES (?, ?, datetime('now'))
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
        args: [key, String(value || "").trim()],
      });
    }

    // 디스코드 관리자 알림
    await sendDiscordWebhook("ADMIN", {
      embeds: [
        {
          title: "⚙️ [시스템 관리] 포털 시스템 설정 및 디스코드 연동 갱신",
          description: `관리자 **${user.name}** 님이 디스코드 웹훅 및 봇 역할 설정을 업데이트하였습니다.`,
          color: 0x3B82F6,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    return NextResponse.json({
      success: true,
      message: "시스템 설정 및 디스코드 연동 정보가 성공적으로 저장되었습니다.",
    });
  } catch (err: any) {
    console.error("Settings POST Error:", err);
    return NextResponse.json({ error: err.message || "서버 오류" }, { status: 500 });
  }
}
