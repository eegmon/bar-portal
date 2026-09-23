import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL || "file:bar_portal.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

const db = createClient({ url, authToken });

async function init() {
  console.log("⚖️ 도스변호사협회 DB 테이블 초기화 시작...");

  // 1. 유저 및 변호사 자격 명부 (변호사법 제4조~제8조)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      discord_id TEXT UNIQUE,
      login_id TEXT UNIQUE,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'CITIZEN', -- CITIZEN, TRAINEE, LAWYER, ADMIN, PROSECUTOR
      status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED(정직/업무정지), EXPIRED(자격상실), EXPELLED(제명)
      is_trainee INTEGER NOT NULL DEFAULT 0, -- 견습변호사 여부
      bonus_eligible INTEGER NOT NULL DEFAULT 0, -- 법학과정 10% 가산점 대상
      bar_exam_round INTEGER, -- 합격 회차
      phone TEXT DEFAULT '',
      office_name TEXT DEFAULT '',
      office_address TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      specialties TEXT DEFAULT '[]', -- 전문분야 JSON
      positions TEXT DEFAULT '[]', -- 직책 JSON (PRESIDENT, ASSEMBLY_SPEAKER 등)
      last_renewed_at TEXT DEFAULT (datetime('now')), -- 월별 재등록/갱신일
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  console.log("✓ users (변호사 명부) 테이블 생성 완료");

  // 2. 법률사무소 및 법무법인/공증인가 (변호사법 제23조~제40조)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS law_firms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'FIRM', -- INDIVIDUAL, FIRM(법무법인), JOINT(합동)
      representative_id TEXT REFERENCES users(id),
      is_notary INTEGER NOT NULL DEFAULT 0, -- 공증인가 여부
      status TEXT NOT NULL DEFAULT 'APPROVED', -- PENDING, APPROVED, CANCELLED
      address TEXT DEFAULT '',
      contact TEXT DEFAULT '',
      articles_of_inc TEXT DEFAULT '', -- 정관 내용/파일
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  console.log("✓ law_firms (법무법인/공증) 테이블 생성 완료");

  // 법무법인 소속 변호사 매핑
  await db.execute(`
    CREATE TABLE IF NOT EXISTS firm_members (
      firm_id TEXT REFERENCES law_firms(id),
      lawyer_id TEXT REFERENCES users(id),
      is_partner INTEGER DEFAULT 0, -- 구성원 변호사 여부 (5주 경력 등)
      joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (firm_id, lawyer_id)
    )
  `);
  console.log("✓ firm_members 테이블 생성 완료");

  // 3. 변호사시험 (변호사법 제66조~제75조)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      round_number INTEGER NOT NULL UNIQUE,
      title TEXT NOT NULL,
      phase1_start TEXT NOT NULL, -- 1차 120분 시작
      phase1_end TEXT NOT NULL,   -- 1차 120분 종료
      phase2_start TEXT NOT NULL, -- 2차 24시간 시작
      phase2_end TEXT NOT NULL,   -- 2차 24시간 종료
      phase1_questions TEXT NOT NULL DEFAULT '[]', -- 10문 정오표 JSON (복수정답 처리 지원)
      phase1_pdf_url TEXT DEFAULT '',
      phase2_doc1_pdf_url TEXT DEFAULT '', -- 제1문 논술
      phase2_doc2_pdf_url TEXT DEFAULT '', -- 제2문 실무기록
      errata_notices TEXT DEFAULT '[]', -- 실시간 문제 정정 공지 JSON
      status TEXT NOT NULL DEFAULT 'SCHEDULED', -- SCHEDULED, PHASE1, PHASE2, GRADING, FINISHED
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  console.log("✓ exams (변호사시험) 테이블 생성 완료");

  // 시험 응시 및 답안 제출
  await db.execute(`
    CREATE TABLE IF NOT EXISTS exam_submissions (
      id TEXT PRIMARY KEY,
      exam_id TEXT REFERENCES exams(id),
      user_id TEXT REFERENCES users(id),
      security_code TEXT NOT NULL UNIQUE, -- #DOS-XXXX 익명 보안코드
      phase1_answers TEXT DEFAULT '[]',   -- OMR 10문 답안 JSON
      phase1_score INTEGER DEFAULT 0,
      phase1_passed INTEGER DEFAULT 0,
      phase2_file_url TEXT DEFAULT '',
      phase2_text_answer TEXT DEFAULT '',
      is_instant_grade_pledged INTEGER DEFAULT 0, -- 즉시 채점 서약 여부
      phase2_score INTEGER DEFAULT 0,
      phase2_feedback TEXT DEFAULT '',
      bonus_score INTEGER DEFAULT 0,
      total_score INTEGER DEFAULT 0,
      rank INTEGER DEFAULT 0,
      final_passed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      submitted_at TEXT DEFAULT ''
    )
  `);
  console.log("✓ exam_submissions (시험 답안 및 성적) 테이블 생성 완료");

  // 4. 총회 및 전자투표 (도스변협 회칙 제11조~제18조)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS assemblies (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      round_number INTEGER NOT NULL,
      is_regular INTEGER NOT NULL DEFAULT 1, -- 1: 정기총회, 0: 임시총회
      held_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'SCHEDULED', -- SCHEDULED, IN_SESSION, CLOSED
      minutes_text TEXT DEFAULT '', -- 총회 의사록
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 총회 불참자 위임장 및 출석 관리
  await db.execute(`
    CREATE TABLE IF NOT EXISTS assembly_attendances (
      id TEXT PRIMARY KEY,
      assembly_id TEXT REFERENCES assemblies(id),
      user_id TEXT REFERENCES users(id),
      attended INTEGER DEFAULT 0, -- 1: 출석체크 완료
      is_proxy INTEGER DEFAULT 0,  -- 1: 위임장 제출
      proxy_to_user_id TEXT REFERENCES users(id), -- 대리 수임인
      signature TEXT DEFAULT '',
      approval_status TEXT NOT NULL DEFAULT 'APPROVED',
      attended_at TEXT DEFAULT '',
      evidence_url TEXT DEFAULT '',
      rejection_reason TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 총회 안건
  await db.execute(`
    CREATE TABLE IF NOT EXISTS agendas (
      id TEXT PRIMARY KEY,
      assembly_id TEXT REFERENCES assemblies(id),
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      is_secret INTEGER NOT NULL DEFAULT 0, -- 1: 무기명 비밀투표, 0: 기명투표
      status TEXT NOT NULL DEFAULT 'READY', -- READY, VOTING, CLOSED
      agenda_order INTEGER NOT NULL DEFAULT 0,
      choice_config TEXT NOT NULL DEFAULT '[]',
      voting_deadline TEXT DEFAULT '',
      voting_started_at TEXT DEFAULT '',
      voting_closed_at TEXT DEFAULT '',
      quorum_needed INTEGER DEFAULT 0,
      result_status TEXT DEFAULT 'PENDING', -- PASS, REJECT, PENDING
      result_confirmed_at TEXT DEFAULT '',
      result_confirmed_by TEXT DEFAULT '',
      voting_method TEXT NOT NULL DEFAULT 'MAJORITY',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS assembly_audit_logs (
      id TEXT PRIMARY KEY,
      assembly_id TEXT,
      agenda_id TEXT,
      actor_id TEXT,
      action TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS assembly_minutes_versions (
      id TEXT PRIMARY KEY,
      assembly_id TEXT NOT NULL,
      content TEXT NOT NULL,
      editor_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS assembly_voting_rights (
      assembly_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      voting_power INTEGER NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      updated_by TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (assembly_id, user_id)
    )
  `);

  // 기존 DB에도 안건 순서 컬럼을 추가합니다.
  try {
    await db.execute("ALTER TABLE agendas ADD COLUMN agenda_order INTEGER NOT NULL DEFAULT 0");
  } catch {
    // 이미 마이그레이션된 DB에서는 무시합니다.
  }

  // 투표 참여자 명부 (중복 투표 방지용, 무기명 투표 시 선택값은 저장 안 함)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS voter_logs (
      agenda_id TEXT REFERENCES agendas(id),
      user_id TEXT REFERENCES users(id),
      voted_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (agenda_id, user_id)
    )
  `);

  // 전자 투표함 (익명 분리 저장)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ballot_box (
      id TEXT PRIMARY KEY,
      agenda_id TEXT REFERENCES agendas(id),
      choice TEXT NOT NULL, -- 찬성, 반대, 기권 or 후보자ID
      votes_count INTEGER NOT NULL DEFAULT 1, -- 분배/행사된 표 수
      cast_at TEXT DEFAULT (datetime('now'))
    )
  `);
  console.log("✓ assemblies, agendas, ballot_box (총회/투표) 테이블 생성 완료");

  // 5. 징계위원회 & 공시 (변호사법 제51조~제65조)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS disciplines (
      id TEXT PRIMARY KEY,
      lawyer_id TEXT REFERENCES users(id),
      petitioner_type TEXT NOT NULL, -- 협회장청구, 검찰총장지시
      type TEXT NOT NULL, -- PERMANENT_EXPULSION(영구제명), EXPULSION(제명), SUSPENSION(정직), FINE(과태료), REPRIMAND(견책)
      reason TEXT NOT NULL,
      duration_months INTEGER DEFAULT 0,
      fine_amount INTEGER DEFAULT 0,
      is_published INTEGER NOT NULL DEFAULT 1, -- 대국민/디스코드 공시 여부
      status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED, REVOKED
      ruled_at TEXT DEFAULT (datetime('now'))
    )
  `);
  console.log("✓ disciplines (징계 공시) 테이블 생성 완료");

  console.log("✅ 모든 DB 테이블 및 초기 데이터 설정이 완료되었습니다!");
}

init().catch(console.error);
