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

export type MatchStaff = {
  id: number;
  name: string;
  active: boolean;
  /** その月の稼働登録。未登録なら null */
  availability: {
    areas: string[];
    timeFrom: number;
    timeTo: number;
    maxJobs: number | null;
    dates: Set<string>;
  } | null;
  /** 確定済み・完了・回答待ちの案件（同じ夜の重複チェック用） */
  slots: Slot[];
  /** その月の確定＋回答待ちの件数 */
  monthCount: number;
  /** 店舗IDごとの過去の担当回数 */
  experience: Map<number, number>;
  /** この案件をすでに辞退した案件ID */
  declinedJobIds: Set<number>;
  /** この案件に回答待ちの打診がある案件ID */
  pendingJobIds: Set<number>;
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

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start < b.end + TRAVEL_BUFFER_MIN && b.start < a.end + TRAVEL_BUFFER_MIN;
}

export function evaluate(job: MatchJob, s: MatchStaff): Candidate {
  const blockers: string[] = [];
  const notes: string[] = [];
  const end = job.start + job.workMinutes;
  const av = s.availability;

  if (!s.active) blockers.push("稼働中ではない");
  if (!av) {
    blockers.push("この月の稼働予定が未登録");
  } else {
    if (!av.dates.has(job.date)) blockers.push("この日は稼働不可");
    if (!av.areas.includes(job.area)) blockers.push(`${job.area}は対応エリア外`);
    if (job.start < av.timeFrom || end > av.timeTo) {
      blockers.push(`時間帯外（登録 ${minutesToLabel(av.timeFrom)}〜${minutesToLabel(av.timeTo)}）`);
    }
    if (av.maxJobs != null && s.monthCount >= av.maxJobs) {
      blockers.push(`今月の上限 ${av.maxJobs}件に到達`);
    }
  }
  if (s.declinedJobIds.has(job.id)) blockers.push("この案件は辞退済み");
  if (s.pendingJobIds.has(job.id)) blockers.push("この案件に回答待ち");
  const clash = s.slots.find(
    (o) => o.jobId !== job.id && o.date === job.date && overlaps(o, { start: job.start, end }),
  );
  if (clash) blockers.push("同じ夜の別案件と時間が重なる");

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

export function rankCandidates(job: MatchJob, staff: MatchStaff[]): Candidate[] {
  return staff
    .map((s) => evaluate(job, s))
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score || a.staffId - b.staffId);
}

/**
 * 月次の割当案。日付・時刻の早い案件から順に最上位の候補を1人ずつ選び、
 * 選んだ分を次の案件の判定に反映する（同じ夜の重複と月の上限を守る）。
 */
export function planAssignments(jobs: MatchJob[], staff: MatchStaff[]): { jobId: number; staffId: number }[] {
  const ordered = [...jobs].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  const plan: { jobId: number; staffId: number }[] = [];
  for (const job of ordered) {
    const top = rankCandidates(job, staff).find((c) => c.eligible);
    if (!top) continue;
    plan.push({ jobId: job.id, staffId: top.staffId });
    const s = staff.find((x) => x.id === top.staffId)!;
    s.slots.push({ jobId: job.id, date: job.date, start: job.start, end: job.start + job.workMinutes });
    s.monthCount += 1;
    s.pendingJobIds.add(job.id);
  }
  return plan;
}
