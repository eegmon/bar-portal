import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser, canManageDiscipline } from "@/lib/auth";
import { sendDiscordWebhook, syncUserDiscordRoles } from "@/lib/discord";

export async function GET() {
  try {
    const user = await getSessionUser();
    const canViewUnpublished = user ? canManageDiscipline(user) : false;
    const res = await db.execute({
      sql: `
      SELECT d.*, u.name as lawyer_name, u.office_name, u.discord_id, u.role as lawyer_role
      FROM disciplines d
      LEFT JOIN users u ON d.lawyer_id = u.id
      ${canViewUnpublished ? "" : "WHERE d.is_published = 1"}
      ORDER BY d.ruled_at DESC
    `,
      args: [],
    });

    return NextResponse.json({
      success: true,
      disciplines: res.rows,
    });
  } catch (err: any) {
    console.error("Discipline GET error:", err);
    return NextResponse.json(
      { error: err.message || "서버 오류" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || !canManageDiscipline(user)) {
      return NextResponse.json(
        {
          error:
            "변호사징계위원회 위원, 협회장 또는 검찰총장 권한이 필요합니다.",
        },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { action } = body;

    // 1. 신규 징계처분 심의 및 의결/공시
    if (action === "CREATE_DISCIPLINE") {
      const {
        lawyerId,
        petitionerType,
        type,
        reason,
        durationMonths,
        fineAmount,
        isPublished = true,
      } = body;

      if (!lawyerId || !type || !reason) {
        return NextResponse.json(
          { error: "피징계 변호사, 징계 종류 및 처분 사유는 필수입니다." },
          { status: 400 },
        );
      }

      // 대상 변호사 정보 조회
      const lawyerRes = await db.execute({
        sql: "SELECT * FROM users WHERE id = ?",
        args: [lawyerId],
      });
      if (lawyerRes.rows.length === 0) {
        return NextResponse.json(
          { error: "해당 변호사를 찾을 수 없습니다." },
          { status: 404 },
        );
      }

      const targetLawyer = lawyerRes.rows[0];
      const disciplineId = `disc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const dur = Number(durationMonths || 0);
      const fine = Number(fineAmount || 0);

      // 징계 DB 등록
      await db.execute({
        sql: `INSERT INTO disciplines (id, lawyer_id, petitioner_type, type, reason, duration_months, fine_amount, is_published, status, ruled_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', datetime('now'))`,
        args: [
          disciplineId,
          lawyerId,
          petitionerType || "협회장 청구",
          type,
          reason,
          dur,
          fine,
          isPublished ? 1 : 0,
        ],
      });

      // 변호사 자격 상태 갱신
      let newStatus = targetLawyer.status as string;
      if (type === "PERMANENT_EXPULSION" || type === "EXPULSION") {
        newStatus = "EXPELLED";
      } else if (type === "SUSPENSION") {
        newStatus = "SUSPENDED";
      }

      if (newStatus !== targetLawyer.status) {
        await db.execute({
          sql: "UPDATE users SET status = ? WHERE id = ?",
          args: [newStatus, lawyerId],
        });

        // 디스코드 역할 회수 동기화
        if (targetLawyer.discord_id) {
          await syncUserDiscordRoles({
            discordUserId: targetLawyer.discord_id as string,
            role: targetLawyer.role as string,
            status: newStatus,
            isTrainee: Number(targetLawyer.is_trainee || 0),
          });
        }
      }

      // 디스코드 징계 공시 웹훅 발송 (isPublished인 경우)
      if (isPublished) {
        const typeLabels: Record<string, string> = {
          PERMANENT_EXPULSION: "영구제명 (자격 박탈)",
          EXPULSION: "제명",
          SUSPENSION: `정직 ${dur}개월 (업무정지)`,
          FINE: `과태료 ${fine.toLocaleString()}원`,
          REPRIMAND: "견책",
        };

        const typeLabel = typeLabels[type] || type;

        await sendDiscordWebhook("DISCIPLINE", {
          content: `⚖️ **[변호사 징계처분 공시] 변호사법 제60조 및 회칙 제36조에 따른 징계 공시**`,
          embeds: [
            {
              title: `🚨 도스변호사협회 변호사징계위원회 처분 공시`,
              description: `도스변호사협회 변호사징계위원회는 **${targetLawyer.name}** 변호사에 대하여 다음과 같이 징계처분을 의결하고 공시합니다.\n\n• **피징계자:** ${targetLawyer.name} (${targetLawyer.office_name || "개인개업"})\n• **징계 종류:** **${typeLabel}**\n• **청구 구분:** ${petitionerType || "협회장 청구"}\n• **처분 사유:** ${reason}\n${dur > 0 ? `• **업무정지 기간:** ${dur}개월\n` : ""}${fine > 0 ? `• **과태료:** ${fine.toLocaleString()}원\n` : ""}• **자격 상태 변경:** **${newStatus}**\n• **처분 일자:** ${new Date().toISOString().split("T")[0]}`,
              color: type.includes("EXPULSION") ? 0xdc2626 : 0xf59e0b,
              footer: { text: "도스변호사협회 변호사징계위원회" },
              timestamp: new Date().toISOString(),
            },
          ],
        });
      }

      return NextResponse.json({
        success: true,
        disciplineId,
        message: "징계처분이 정상적으로 의결 및 공시되었습니다.",
      });
    }

    // 2. 징계 처분 상태 변경 (철회 / 복권 / 집행완료)
    if (action === "UPDATE_STATUS") {
      const { disciplineId, status } = body; // status: 'ACTIVE' | 'COMPLETED' | 'REVOKED'
      if (!disciplineId || !status) {
        return NextResponse.json(
          { error: "징계 ID와 변경할 상태가 필요합니다." },
          { status: 400 },
        );
      }
      if (!["ACTIVE", "COMPLETED", "REVOKED"].includes(status)) {
        return NextResponse.json(
          { error: "유효하지 않은 징계 상태입니다." },
          { status: 400 },
        );
      }

      const discRes = await db.execute({
        sql: "SELECT * FROM disciplines WHERE id = ?",
        args: [disciplineId],
      });
      if (discRes.rows.length === 0) {
        return NextResponse.json(
          { error: "징계 기록을 찾을 수 없습니다." },
          { status: 404 },
        );
      }

      const disc = discRes.rows[0];

      // 제명/영구제명은 집행완료 처리 불가 (복권은 REVOKED로만)
      if (status === "COMPLETED" && ["EXPULSION", "PERMANENT_EXPULSION"].includes(disc.type as string)) {
        return NextResponse.json(
          { error: "제명 및 영구제명 처분은 집행완료 처리할 수 없습니다. 복권이 필요한 경우 '처분 철회'를 사용하세요." },
          { status: 400 },
        );
      }

      await db.execute({
        sql: "UPDATE disciplines SET status = ? WHERE id = ?",
        args: [status, disciplineId],
      });

      // 처분 철회/복권 시 자격 복구
      // REVOKED: 모든 종류 철회 → ACTIVE 복구
      // COMPLETED: 정직(SUSPENSION) 기간 만료만 → ACTIVE 복구
      //            제명/영구제명은 집행완료 개념 없음 (API 레벨에서도 차단)
      if (status === "REVOKED" || (status === "COMPLETED" && disc.type === "SUSPENSION")) {
        await db.execute({
          sql: "UPDATE users SET status = 'ACTIVE' WHERE id = ?",
          args: [disc.lawyer_id],
        });

        const lawyerRes = await db.execute({
          sql: "SELECT * FROM users WHERE id = ?",
          args: [disc.lawyer_id],
        });
        if (lawyerRes.rows.length > 0 && lawyerRes.rows[0].discord_id) {
          await syncUserDiscordRoles({
            discordUserId: lawyerRes.rows[0].discord_id as string,
            role: lawyerRes.rows[0].role as string,
            status: "ACTIVE",
            isTrainee: Number(lawyerRes.rows[0].is_trainee || 0),
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: `징계 상태가 [${status}]로 변경되었습니다.`,
      });
    }

    // 3. 공시 여부 토글
    if (action === "TOGGLE_PUBLISH") {
      const { disciplineId, isPublished } = body;
      await db.execute({
        sql: "UPDATE disciplines SET is_published = ? WHERE id = ?",
        args: [isPublished ? 1 : 0, disciplineId],
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "알 수 없는 작업입니다." },
      { status: 400 },
    );
  } catch (err: any) {
    console.error("Discipline POST error:", err);
    return NextResponse.json(
      { error: err.message || "서버 오류" },
      { status: 500 },
    );
  }
}
