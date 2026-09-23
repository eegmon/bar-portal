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
        webhook_lawyer_approval: settingsMap["webhook_lawyer_approval"] || process.env.DISCORD_WEBHOOK_LAWYER_APPROVAL || "",
        webhook_exam: settingsMap["webhook_exam"] || process.env.DISCORD_WEBHOOK_EXAM || "",
        webhook_assembly: settingsMap["webhook_assembly"] || process.env.DISCORD_WEBHOOK_ASSEMBLY || "",
        webhook_discipline: settingsMap["webhook_discipline"] || process.env.DISCORD_WEBHOOK_DISCIPLINE || "",
        webhook_admin: settingsMap["webhook_admin"] || process.env.DISCORD_WEBHOOK_ADMIN || "",

        // 디스코드 봇 & 자동 역할 지급 설정
        discord_bot_token: settingsMap["discord_bot_token"] || process.env.DISCORD_BOT_TOKEN || "",
        discord_guild_id: settingsMap["discord_guild_id"] || process.env.DISCORD_GUILD_ID || "",
        discord_role_lawyer: settingsMap["discord_role_lawyer"] || process.env.DISCORD_ROLE_LAWYER || "",
        discord_role_trainee: settingsMap["discord_role_trainee"] || process.env.DISCORD_ROLE_TRAINEE || "",
        
        // 카테고리 헤더 역할
        discord_role_group_executive: settingsMap["discord_role_group_executive"] || process.env.DISCORD_ROLE_GROUP_EXECUTIVE || "",
        discord_role_group_assembly: settingsMap["discord_role_group_assembly"] || process.env.DISCORD_ROLE_GROUP_ASSEMBLY || "",
        discord_role_group_secretariat: settingsMap["discord_role_group_secretariat"] || process.env.DISCORD_ROLE_GROUP_SECRETARIAT || "",

        // 이사회
        discord_role_president: settingsMap["discord_role_president"] || process.env.DISCORD_ROLE_PRESIDENT || "",
        discord_role_vice_president: settingsMap["discord_role_vice_president"] || process.env.DISCORD_ROLE_VICE_PRESIDENT || "",
        discord_role_director: settingsMap["discord_role_director"] || process.env.DISCORD_ROLE_DIRECTOR || "",
        discord_role_board: settingsMap["discord_role_board"] || process.env.DISCORD_ROLE_BOARD || "",

        // 총회
        discord_role_speaker: settingsMap["discord_role_speaker"] || process.env.DISCORD_ROLE_SPEAKER || "",
        discord_role_vice_speaker: settingsMap["discord_role_vice_speaker"] || process.env.DISCORD_ROLE_VICE_SPEAKER || "",

        // 사무국
        discord_role_secretary_general: settingsMap["discord_role_secretary_general"] || process.env.DISCORD_ROLE_SECRETARY_GENERAL || "",
        discord_role_staff: settingsMap["discord_role_staff"] || process.env.DISCORD_ROLE_STAFF || "",

        // 위원회
        discord_role_discipline_comm: settingsMap["discord_role_discipline_comm"] || process.env.DISCORD_ROLE_DISCIPLINE_COMM || "",
        discord_role_exam_comm: settingsMap["discord_role_exam_comm"] || process.env.DISCORD_ROLE_EXAM_COMM || "",

        // 팝업 공지 설정
        popup_enabled: settingsMap["popup_enabled"] || "false",
        popup_level: settingsMap["popup_level"] || "INFO",
        popup_title: settingsMap["popup_title"] || "",
        popup_content: settingsMap["popup_content"] || "",
        popup_link: settingsMap["popup_link"] || "",
        popup_updated_at: settingsMap["popup_updated_at"] || "",
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
    const { action, settings, testType, popup, broadcastNotice } = body;

    // 1. 공지 팝업 전용 저장 액션
    if (action === "SAVE_POPUP") {
      if (!popup || typeof popup !== "object") {
        return NextResponse.json({ error: "팝업 데이터가 올바르지 않습니다." }, { status: 400 });
      }

      const nowIso = new Date().toISOString();
      const popupEntries = {
        popup_enabled: popup.enabled ? "true" : "false",
        popup_level: String(popup.level || "INFO"),
        popup_title: String(popup.title || "").trim(),
        popup_content: String(popup.content || "").trim(),
        popup_link: String(popup.link || "").trim(),
        popup_updated_at: nowIso,
      };

      for (const [key, value] of Object.entries(popupEntries)) {
        await db.execute({
          sql: `INSERT INTO settings (key, value, updated_at)
                VALUES (?, ?, datetime('now'))
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
          args: [key, value],
        });
      }

      // 디스코드 공지 채널 동시 방송
      if (broadcastNotice && popup.enabled && popup.title) {
        const color =
          popup.level === "URGENT" ? 0xef4444 : popup.level === "WARNING" ? 0xf59e0b : 0x3b82f6;
        await sendDiscordWebhook("NOTICE", {
          content: popup.level === "URGENT" ? "@everyone 🚨 **[긴급 공지사항]**" : "📢 **[협회 공지사항]**",
          embeds: [
            {
              title: popup.title,
              description: popup.content,
              color,
              fields: popup.link
                ? [{ name: "🔗 관련 링크", value: `[바로가기](${popup.link})` }]
                : undefined,
              footer: { text: "도스변호사협회 사무국" },
              timestamp: nowIso,
            },
          ],
        });
      }

      return NextResponse.json({
        success: true,
        message: "안내사항 팝업 설정이 성공적으로 저장되었습니다.",
        updatedAt: nowIso,
      });
    }

    // 2. 테스트 웹훅 발송 액션
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

    // 3. 설정 일괄 저장
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
