import { NextResponse } from "next/server";
import db from "@/lib/db";
import { canManageAssembly, getSessionUser } from "@/lib/auth";
import { signVoteAccessToken } from "@/lib/vote-access";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    }

    const url = new URL(req.url);
    const targetUserId = url.searchParams.get("userId") || user.id;
    const assemblyId = url.searchParams.get("assemblyId") || undefined;
    const agendaId = url.searchParams.get("agendaId") || undefined;
    const expiresInDays = Number(url.searchParams.get("expiresInDays") || 30);

    if (targetUserId !== user.id && !canManageAssembly(user)) {
      return NextResponse.json(
        { error: "다른 회원의 투표 링크는 총회 관리자만 발급할 수 있습니다." },
        { status: 403 },
      );
    }

    if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 365) {
      return NextResponse.json(
        { error: "링크 만료일은 1~365일 범위에서 지정해 주세요." },
        { status: 400 },
      );
    }

    const targetRes = await db.execute({
      sql: "SELECT id, role, status FROM users WHERE id = ? LIMIT 1",
      args: [targetUserId],
    });

    if (targetRes.rows.length === 0) {
      return NextResponse.json(
        { error: "대상 회원을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const target = targetRes.rows[0];
    if (
      (target.role !== "LAWYER" && target.role !== "ADMIN") ||
      target.status !== "ACTIVE"
    ) {
      return NextResponse.json(
        { error: "활성 상태의 변호사/관리자 회원만 투표 링크를 발급할 수 있습니다." },
        { status: 400 },
      );
    }

    if (agendaId) {
      const agendaRes = await db.execute({
        sql: "SELECT id, assembly_id FROM agendas WHERE id = ? LIMIT 1",
        args: [agendaId],
      });
      if (agendaRes.rows.length === 0) {
        return NextResponse.json(
          { error: "안건을 찾을 수 없습니다." },
          { status: 404 },
        );
      }

      const agendaAssemblyId = String(agendaRes.rows[0].assembly_id || "");
      if (assemblyId && assemblyId !== agendaAssemblyId) {
        return NextResponse.json(
          { error: "지정한 총회와 안건이 일치하지 않습니다." },
          { status: 400 },
        );
      }
    }

    if (assemblyId) {
      const assemblyRes = await db.execute({
        sql: "SELECT id FROM assemblies WHERE id = ? LIMIT 1",
        args: [assemblyId],
      });
      if (assemblyRes.rows.length === 0) {
        return NextResponse.json(
          { error: "총회를 찾을 수 없습니다." },
          { status: 404 },
        );
      }
    }

    const token = signVoteAccessToken({
      userId: targetUserId,
      assemblyId,
      agendaId,
      expiresIn: `${expiresInDays}d`,
    });

    const voteUrl = new URL("/assembly/vote", url.origin);
    if (assemblyId) voteUrl.searchParams.set("assemblyId", assemblyId);
    if (agendaId) voteUrl.searchParams.set("agendaId", agendaId);
    voteUrl.searchParams.set("accessToken", token);

    return NextResponse.json({
      success: true,
      targetUserId,
      assemblyId: assemblyId || null,
      agendaId: agendaId || null,
      expiresInDays,
      voteLink: voteUrl.toString(),
      accessToken: token,
    });
  } catch (err: any) {
    console.error("투표 링크 발급 에러:", err);
    return NextResponse.json(
      { error: err.message || "서버 오류" },
      { status: 500 },
    );
  }
}
