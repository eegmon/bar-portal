import { redirect } from "next/navigation";
import db from "@/lib/db";
import {
  getSessionUser,
  hasAdminPanelAccess,
  canManageSettings,
  canManageUsers,
  canManageAssembly,
  canManageExam,
  canManageDiscipline,
} from "@/lib/auth";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const user = await getSessionUser();

  if (!user || !hasAdminPanelAccess(user)) {
    redirect("/login");
  }

  // 1. 설정 데이터 조회
  const settingsMap: Record<string, string> = {};
  try {
    const sRes = await db.execute("SELECT key, value FROM settings");
    for (const row of sRes.rows) {
      settingsMap[row.key as string] = row.value as string;
    }
  } catch (err) {
    console.error("Admin settings fetch error:", err);
  }

  // 2. 전체 회원 목록 조회
  let users: any[] = [];
  try {
    const uRes = await db.execute(`
      SELECT 
        u.id, u.login_id, u.discord_id, u.name, u.role, u.status, u.is_trainee, 
        u.phone, u.office_name, u.office_address, u.bio, u.specialties,
        u.positions, u.bar_exam_round, u.last_renewed_at, u.created_at
      FROM users u
      ORDER BY u.created_at DESC
    `);
    users = uRes.rows.map((row) => {
      let parsedPositions: string[] = [];
      try {
        parsedPositions = JSON.parse((row.positions as string) || "[]");
      } catch {
        parsedPositions = [];
      }
      return {
        ...row,
        positions: parsedPositions,
      };
    });
  } catch (err) {
    console.error("Admin users fetch error:", err);
  }

  // 3. 총회 및 안건 데이터 조회
  let assemblies: any[] = [];
  let agendas: any[] = [];
  let attendances: any[] = [];
  let votingRights: any[] = [];
  let auditLogs: any[] = [];
  try {
    const aRes = await db.execute("SELECT * FROM assemblies ORDER BY round_number DESC");
    assemblies = aRes.rows;

    const agRes = await db.execute("SELECT * FROM agendas ORDER BY agenda_order ASC, created_at ASC");
    agendas = agRes.rows;
    const attRes = await db.execute(`
      SELECT aa.*, u.name as grantor_name, p.name as proxy_name
      FROM assembly_attendances aa
      LEFT JOIN users u ON u.id = aa.user_id
      LEFT JOIN users p ON p.id = aa.proxy_to_user_id
      ORDER BY aa.created_at DESC
    `);
    attendances = attRes.rows;
    const rightsRes = await db.execute({
      sql: `SELECT r.*, u.name as user_name, u.login_id
            FROM assembly_voting_rights r
            LEFT JOIN users u ON u.id = r.user_id
            ORDER BY r.updated_at DESC`,
    });
    votingRights = rightsRes.rows;
    const logsRes = await db.execute("SELECT * FROM assembly_audit_logs ORDER BY created_at DESC");
    auditLogs = logsRes.rows;
  } catch (err) {
    console.error("Admin assemblies fetch error:", err);
  }

  // 4. 시험 및 응시 통계 조회
  let exams: any[] = [];
  let submissionsCount = 0;
  try {
    const exRes = await db.execute("SELECT * FROM exams ORDER BY round_number DESC");
    exams = exRes.rows;

    const subRes = await db.execute("SELECT COUNT(*) as count FROM exam_submissions");
    submissionsCount = (subRes.rows[0]?.count as number) || 0;
  } catch (err) {
    console.error("Admin exams fetch error:", err);
  }

  const permissions = {
    canSettings: canManageSettings(user),
    canUsers: canManageUsers(user),
    canAssembly: canManageAssembly(user),
    canExam: canManageExam(user),
    canDiscipline: canManageDiscipline(user),
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      <AdminClient
        currentUser={user}
        permissions={permissions}
        initialSettings={{
          webhook_notice: settingsMap["webhook_notice"] || process.env.DISCORD_WEBHOOK_NOTICE || "",
          webhook_exam: settingsMap["webhook_exam"] || process.env.DISCORD_WEBHOOK_EXAM || "",
          webhook_assembly: settingsMap["webhook_assembly"] || process.env.DISCORD_WEBHOOK_ASSEMBLY || "",
          webhook_discipline: settingsMap["webhook_discipline"] || process.env.DISCORD_WEBHOOK_DISCIPLINE || "",
          webhook_admin: settingsMap["webhook_admin"] || process.env.DISCORD_WEBHOOK_ADMIN || "",
          discord_bot_token: settingsMap["discord_bot_token"] || process.env.DISCORD_BOT_TOKEN || "",
          discord_guild_id: settingsMap["discord_guild_id"] || process.env.DISCORD_GUILD_ID || "",
          discord_role_lawyer: settingsMap["discord_role_lawyer"] || process.env.DISCORD_ROLE_LAWYER || "",
          discord_role_trainee: settingsMap["discord_role_trainee"] || process.env.DISCORD_ROLE_TRAINEE || "",
          discord_role_president: settingsMap["discord_role_president"] || process.env.DISCORD_ROLE_PRESIDENT || "",
          discord_role_speaker: settingsMap["discord_role_speaker"] || process.env.DISCORD_ROLE_SPEAKER || "",
          discord_role_exam_comm: settingsMap["discord_role_exam_comm"] || process.env.DISCORD_ROLE_EXAM_COMM || "",
          discord_role_discipline_comm: settingsMap["discord_role_discipline_comm"] || process.env.DISCORD_ROLE_DISCIPLINE_COMM || "",
          discord_role_staff: settingsMap["discord_role_staff"] || process.env.DISCORD_ROLE_STAFF || "",
        }}
        initialUsers={users}
        initialAssemblies={assemblies}
        initialAgendas={agendas}
        initialAttendances={attendances}
        initialVotingRights={votingRights}
        initialAuditLogs={auditLogs}
        stats={{
          totalUsers: users.length,
          activeLawyers: users.filter((u) => u.role === "LAWYER" && u.status === "ACTIVE").length,
          pendingUsers: users.filter((u) => u.status === "PENDING").length,
          totalAssemblies: assemblies.length,
          totalExams: exams.length,
          totalSubmissions: submissionsCount,
        }}
      />
    </div>
  );
}
