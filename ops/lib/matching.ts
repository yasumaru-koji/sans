// 案件に対する候補スタッフの判定と並び順。DBに依存しない純粋関数だけを置く。
import { TRAVEL_BUFFER_MIN } from "./constants";
import { minutesToLabel } from "./time";

export type MatchJob = {
  id: number;
  shopId: number;
  date: string;
  start: number;
  workMinutes: number;
  area: string;
};

export type Slot = { jobId: number; date: string; start: number; end: number };

export type TimeWindow = { from: number; to: number };

export type MatchStaff = {
  id: number;
  name: string;
  active: boolean;
  /** その月の稼働登録。未登録なら null */
  availability: {
    areas: string[];
    maxJobs: number | null;
    /** 入れる日と、その日に入れる時間帯 */
    dates: Map<string, TimeWindow>;
  } | null;
  /** 確定済み・完了の案件（同じ夜の重複チェック用） */
  slots: Slot[];
  /** その月の確定件数 */
  monthCount: number;
  /** 店舗IDごとの過去の担当回数 */
  experience: Map<number, number>;
  /** 見送った・不可で返した案件ID */
  declinedJobIds: Set<number>;
  /** すでに案内した（回答待ち・希望あり）案件ID */
  invitedJobIds: Set<number>;
};

export type Candidate = {
  staffId: number;
  name: string;
  eligible: boolean;
  /** 対象外の理由 */
  blockers: string[];
  /** 並び順の根拠 */
  notes: string[];
  score: number;
};

/**
 * invite：案内を送る相手を選ぶ。登録した日・エリア・時間帯に合う人だけ。
 * assign：本部が稼働登録からシフトを入れる。条件は invite と同じだが、案内済みかどうかは問わない。
 * confirm：希望を出した人から確定する人を選ぶ。本人が希望しているので登録内容は問わず、
 *          同じ夜の重複と月の上限だけを見る。
 */
export type MatchMode = "invite" | "confirm" | "assign";

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start < b.end + TRAVEL_BUFFER_MIN && b.start < a.end + TRAVEL_BUFFER_MIN;
}

export function evaluate(job: MatchJob, s: MatchStaff, mode: MatchMode = "invite"): Candidate {
  const blockers: string[] = [];
  const notes: string[] = [];
  const end = job.start + job.workMinutes;
  const av = s.availability;

  if (!s.active) blockers.push("稼働中ではない");
  if (mode !== "confirm") {
    if (!av) {
      blockers.push("この月の稼働予定が未登録");
    } else {
      const win = av.dates.get(job.date);
      if (!win) blockers.push("この日は稼働不可");
      if (!av.areas.includes(job.area)) blockers.push(`${job.area}は対応エリア外`);
      if (win && (job.start < win.from || end > win.to)) {
        blockers.push(`時間帯外（登録 ${minutesToLabel(win.from)}〜${minutesToLabel(win.to)}）`);
      }
    }
    if (s.declinedJobIds.has(job.id)) blockers.push("この案件は見送り・不可");
    if (mode === "invite" && s.invitedJobIds.has(job.id)) blockers.push("案内済み");
  }
  if (av?.maxJobs != null && s.monthCount >= av.maxJobs) {
    blockers.push(`今月の上限 ${av.maxJobs}件に到達`);
  }
  const clash = s.slots.find(
    (o) => o.jobId !== job.id && o.date === job.date && overlaps(o, { start: job.start, end }),
  );
  if (clash) blockers.push("同じ夜の確定案件と時間が重なる");

  // スコア：その店の経験（最大50点）＋稼働の平準化（最大30点）
  const exp = s.experience.get(job.shopId) ?? 0;
  const expScore = Math.min(exp, 10) * 5;
  if (exp > 0) notes.push(`この店の経験 ${exp}回`);
  let levelScore: number;
  if (av?.maxJobs) {
    levelScore = Math.max(0, (1 - s.monthCount / av.maxJobs) * 30);
    notes.push(`今月 ${s.monthCount}/${av.maxJobs}件`);
  } else {
    levelScore = Math.max(0, 30 - s.monthCount * 2);
    notes.push(`今月 ${s.monthCount}件`);
  }

  return {
    staffId: s.id,
    name: s.name,
    eligible: blockers.length === 0,
    blockers,
    notes,
    score: Math.round(expScore + levelScore),
  };
}

export function rankCandidates(job: MatchJob, staff: MatchStaff[], mode: MatchMode = "invite"): Candidate[] {
  return staff
    .map((s) => evaluate(job, s, mode))
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score || a.staffId - b.staffId);
}

/**
 * 希望者からの一括確定案。日付・時刻の早い案件から順に、希望者のうち最上位の人を選び、
 * 選んだ分を次の案件の判定に反映する（同じ夜の重複と月の上限を守る）。
 */
export function planConfirmations(
  jobs: MatchJob[],
  staff: MatchStaff[],
  interested: Map<number, Set<number>>,
): { jobId: number; staffId: number }[] {
  const ordered = [...jobs].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  const plan: { jobId: number; staffId: number }[] = [];
  for (const job of ordered) {
    const wants = interested.get(job.id);
    if (!wants?.size) continue;
    const pool = staff.filter((s) => wants.has(s.id));
    const top = rankCandidates(job, pool, "confirm").find((c) => c.eligible);
    if (!top) continue;
    plan.push({ jobId: job.id, staffId: top.staffId });
    const s = pool.find((x) => x.id === top.staffId)!;
    s.slots.push({ jobId: job.id, date: job.date, start: job.start, end: job.start + job.workMinutes });
    s.monthCount += 1;
  }
  return plan;
}

/**
 * 稼働登録からのシフト自動作成。日付・時刻の早い案件から順に、登録した日・エリア・時間帯に合う人のうち
 * 最上位の人を入れ、入れた分を次の案件の判定に反映する（同じ夜の重複と月の上限を守る）。
 * その案件を不可で返した人には入れない。
 */
export function planAssignments(jobs: MatchJob[], staff: MatchStaff[]): { jobId: number; staffId: number }[] {
  const ordered = [...jobs].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  const plan: { jobId: number; staffId: number }[] = [];
  for (const job of ordered) {
    const top = rankCandidates(job, staff, "assign").find((c) => c.eligible);
    if (!top) continue;
    plan.push({ jobId: job.id, staffId: top.staffId });
    const s = staff.find((x) => x.id === top.staffId)!;
    s.slots.push({ jobId: job.id, date: job.date, start: job.start, end: job.start + job.workMinutes });
    s.monthCount += 1;
  }
  return plan;
}
