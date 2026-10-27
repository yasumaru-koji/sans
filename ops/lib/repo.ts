// 画面とサーバーアクションから使うデータ操作。SQLはここに集める。
import crypto from "node:crypto";
import { all, get, run, tx } from "./db";
import { TRAVEL_BUFFER_MIN, type JobStatus, type KeyMethod, type OfferStatus, type StaffStatus } from "./constants";
import { planConfirmations, rankCandidates, type Candidate, type MatchJob, type MatchStaff } from "./matching";
import { daysOfMonth, weekdayOf } from "./time";

export type Staff = {
  id: number;
  name: string;
  kana: string;
  phone: string;
  email: string;
  chatwork_room_id: string;
  status: StaffStatus;
  contract_date: string | null;
  invoice_no: string;
  bank_info: string;
  note: string;
  token: string;
  created_at: string;
};

export type Availability = {
  month: string;
  areas: string[];
  weekdays: number[];
  timeFrom: number;
  timeTo: number;
  maxJobs: number | null;
  note: string;
  dates: string[];
  /** 月の時間帯と違う時間で入れる日 */
  dayTimes: Record<string, { from: number; to: number }>;
  updatedAt: string | null;
};

export type Shop = {
  id: number;
  name: string;
  area: string;
  address: string;
  start_time: number;
  work_minutes: number;
  closed_weekdays: number[];
  key_method: KeyMethod;
  fee_per_job: number;
  pay_per_job: number;
  note: string;
  active: number;
};

export type Job = {
  id: number;
  shop_id: number;
  shop_name: string;
  area: string;
  address: string;
  key_method: KeyMethod;
  shop_note: string;
  date: string;
  start_time: number;
  work_minutes: number;
  status: JobStatus;
  staff_id: number | null;
  staff_name: string | null;
  pay: number;
  bonus: number;
  note: string;
  open_call: number;
  checked_in_at: string | null;
  completed_at: string | null;
  report_note: string;
  /** 完了報告の写真のファイル名（JSON配列の文字列） */
  report_photos: string;
  pending_offers: number;
  interested_offers: number;
};

export type Offer = {
  id: number;
  job_id: number;
  staff_id: number;
  staff_name: string;
  staff_token: string;
  status: OfferStatus;
  sent_at: string;
  responded_at: string | null;
};

/* ---------- スタッフ ---------- */

export type StaffInput = Omit<Staff, "id" | "token" | "created_at">;

export function listStaff(): Staff[] {
  return all(`SELECT * FROM staff ORDER BY status = 'active' DESC, kana, name`);
}

export function listStaffWithMonth(month: string): (Staff & { month_registered: number; month_dates: number })[] {
  return all(
    `SELECT s.*,
       EXISTS (SELECT 1 FROM availability_months a WHERE a.staff_id = s.id AND a.month = ?) AS month_registered,
       (SELECT COUNT(*) FROM availability_dates d WHERE d.staff_id = s.id AND d.date LIKE ?) AS month_dates
     FROM staff s ORDER BY s.status = 'active' DESC, s.kana, s.name`,
    month,
    `${month}-%`,
  );
}

export function getStaff(id: number): Staff | undefined {
  return get(`SELECT * FROM staff WHERE id = ?`, id);
}

export function getStaffByToken(token: string): Staff | undefined {
  return get(`SELECT * FROM staff WHERE token = ?`, token);
}

export function createStaff(input: StaffInput): number {
  const token = crypto.randomBytes(18).toString("base64url");
  const r = run(
    `INSERT INTO staff (name, kana, phone, email, chatwork_room_id, status, contract_date, invoice_no, bank_info, note, token)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.name, input.kana, input.phone, input.email, input.chatwork_room_id, input.status, input.contract_date,
    input.invoice_no, input.bank_info, input.note, token,
  );
  return Number(r.lastInsertRowid);
}

export function updateStaff(id: number, input: StaffInput) {
  run(
    `UPDATE staff SET name = ?, kana = ?, phone = ?, email = ?, chatwork_room_id = ?, status = ?, contract_date = ?,
       invoice_no = ?, bank_info = ?, note = ? WHERE id = ?`,
    input.name, input.kana, input.phone, input.email, input.chatwork_room_id, input.status, input.contract_date,
    input.invoice_no, input.bank_info, input.note, id,
  );
}

export function regenerateToken(id: number) {
  run(`UPDATE staff SET token = ? WHERE id = ?`, crypto.randomBytes(18).toString("base64url"), id);
}

/* ---------- 稼働登録 ---------- */

type AvailabilityRow = {
  month: string;
  areas: string;
  weekdays: string;
  time_from: number;
  time_to: number;
  max_jobs: number | null;
  note: string;
  updated_at: string;
};

export function getAvailability(staffId: number, month: string): Availability | null {
  const row = get<AvailabilityRow>(
    `SELECT * FROM availability_months WHERE staff_id = ? AND month = ?`,
    staffId,
    month,
  );
  if (!row) return null;
  const rows = all<{ date: string; time_from: number | null; time_to: number | null }>(
    `SELECT date, time_from, time_to FROM availability_dates WHERE staff_id = ? AND date LIKE ? ORDER BY date`,
    staffId,
    `${month}-%`,
  );
  const dayTimes: Availability["dayTimes"] = {};
  for (const r of rows) {
    if (r.time_from != null && r.time_to != null) dayTimes[r.date] = { from: r.time_from, to: r.time_to };
  }
  return {
    month,
    areas: JSON.parse(row.areas),
    weekdays: JSON.parse(row.weekdays),
    timeFrom: row.time_from,
    timeTo: row.time_to,
    maxJobs: row.max_jobs,
    note: row.note,
    dates: rows.map((r) => r.date),
    dayTimes,
    updatedAt: row.updated_at,
  };
}

export function saveAvailability(staffId: number, a: Omit<Availability, "updatedAt">) {
  const valid = new Set(daysOfMonth(a.month));
  const dates = [...new Set(a.dates)].filter((d) => valid.has(d)).sort();
  tx(() => {
    run(
      `INSERT INTO availability_months (staff_id, month, areas, weekdays, time_from, time_to, max_jobs, note, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (staff_id, month) DO UPDATE SET areas = excluded.areas, weekdays = excluded.weekdays,
         time_from = excluded.time_from, time_to = excluded.time_to, max_jobs = excluded.max_jobs,
         note = excluded.note, updated_at = excluded.updated_at`,
      staffId, a.month, JSON.stringify(a.areas), JSON.stringify(a.weekdays), a.timeFrom, a.timeTo,
      a.maxJobs, a.note,
    );
    run(`DELETE FROM availability_dates WHERE staff_id = ? AND date LIKE ?`, staffId, `${a.month}-%`);
    for (const d of dates) {
      const t = a.dayTimes[d];
      const custom = t && t.to > t.from && (t.from !== a.timeFrom || t.to !== a.timeTo);
      run(
        `INSERT INTO availability_dates (staff_id, date, time_from, time_to) VALUES (?, ?, ?, ?)`,
        staffId, d, custom ? t.from : null, custom ? t.to : null,
      );
    }
  });
}

/* ---------- 店舗 ---------- */

type ShopRow = Omit<Shop, "closed_weekdays"> & { closed_weekdays: string };
const toShop = (r: ShopRow): Shop => ({ ...r, closed_weekdays: JSON.parse(r.closed_weekdays) });

export type ShopInput = Omit<Shop, "id">;

export function listShops(): Shop[] {
  return all<ShopRow>(`SELECT * FROM shops ORDER BY active DESC, area, name`).map(toShop);
}

export function getShop(id: number): Shop | undefined {
  const r = get<ShopRow>(`SELECT * FROM shops WHERE id = ?`, id);
  return r && toShop(r);
}

export function createShop(s: ShopInput): number {
  const r = run(
    `INSERT INTO shops (name, area, address, start_time, work_minutes, closed_weekdays, key_method,
       fee_per_job, pay_per_job, note, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    s.name, s.area, s.address, s.start_time, s.work_minutes, JSON.stringify(s.closed_weekdays),
    s.key_method, s.fee_per_job, s.pay_per_job, s.note, s.active,
  );
  return Number(r.lastInsertRowid);
}

export function updateShop(id: number, s: ShopInput) {
  run(
    `UPDATE shops SET name = ?, area = ?, address = ?, start_time = ?, work_minutes = ?, closed_weekdays = ?,
       key_method = ?, fee_per_job = ?, pay_per_job = ?, note = ?, active = ? WHERE id = ?`,
    s.name, s.area, s.address, s.start_time, s.work_minutes, JSON.stringify(s.closed_weekdays),
    s.key_method, s.fee_per_job, s.pay_per_job, s.note, s.active, id,
  );
}

/* ---------- 案件 ---------- */

const JOB_SELECT = `
  SELECT j.*, sh.name AS shop_name, sh.area, sh.address, sh.key_method, sh.note AS shop_note,
    st.name AS staff_name,
    (SELECT COUNT(*) FROM offers o WHERE o.job_id = j.id AND o.status = 'pending') AS pending_offers,
    (SELECT COUNT(*) FROM offers o WHERE o.job_id = j.id AND o.status = 'interested') AS interested_offers
  FROM jobs j JOIN shops sh ON sh.id = j.shop_id LEFT JOIN staff st ON st.id = j.staff_id`;

/** 店舗の定休日を除いた日に案件を作る。既にある日はそのまま。 */
export function generateMonthJobs(month: string, shopId?: number): number {
  const shops = listShops().filter((s) => s.active && (shopId == null || s.id === shopId));
  let created = 0;
  tx(() => {
    for (const s of shops) {
      for (const date of daysOfMonth(month)) {
        if (s.closed_weekdays.includes(weekdayOf(date))) continue;
        const r = run(
          `INSERT OR IGNORE INTO jobs (shop_id, date, start_time, work_minutes, pay) VALUES (?, ?, ?, ?, ?)`,
          s.id, date, s.start_time, s.work_minutes, s.pay_per_job,
        );
        created += Number(r.changes);
      }
    }
  });
  return created;
}

export function listJobs(month: string, filter: { shopId?: number; status?: JobStatus } = {}): Job[] {
  const where = ["j.date LIKE ?"];
  const params: (string | number)[] = [`${month}-%`];
  if (filter.shopId) {
    where.push("j.shop_id = ?");
    params.push(filter.shopId);
  }
  if (filter.status) {
    where.push("j.status = ?");
    params.push(filter.status);
  }
  return all(`${JOB_SELECT} WHERE ${where.join(" AND ")} ORDER BY j.date, j.start_time, sh.name`, ...params);
}

/** シフト表（スタッフ別）用：その月に入れると登録した日と、希望を出している日 */
export function staffMonthMarks(month: string): {
  available: Map<number, Set<string>>;
  interested: Map<number, Map<string, number>>;
} {
  const available = new Map<number, Set<string>>();
  for (const r of all<{ staff_id: number; date: string }>(
    `SELECT staff_id, date FROM availability_dates WHERE date LIKE ?`,
    `${month}-%`,
  )) {
    if (!available.has(r.staff_id)) available.set(r.staff_id, new Set());
    available.get(r.staff_id)!.add(r.date);
  }
  const interested = new Map<number, Map<string, number>>();
  for (const r of all<{ staff_id: number; date: string; n: number }>(
    `SELECT o.staff_id, j.date, COUNT(*) AS n FROM offers o JOIN jobs j ON j.id = o.job_id
     WHERE o.status = 'interested' AND j.date LIKE ? GROUP BY o.staff_id, j.date`,
    `${month}-%`,
  )) {
    if (!interested.has(r.staff_id)) interested.set(r.staff_id, new Map());
    interested.get(r.staff_id)!.set(r.date, r.n);
  }
  return { available, interested };
}

export function getJob(id: number): Job | undefined {
  return get(`${JOB_SELECT} WHERE j.id = ?`, id);
}

export function listOffersForJob(jobId: number): Offer[] {
  return all(
    `SELECT o.*, s.name AS staff_name, s.token AS staff_token FROM offers o JOIN staff s ON s.id = o.staff_id
     WHERE o.job_id = ? ORDER BY o.id DESC`,
    jobId,
  );
}

export function addJob(shopId: number, date: string) {
  const s = getShop(shopId);
  if (!s) throw new Error("店舗が見つかりません");
  run(
    `INSERT OR IGNORE INTO jobs (shop_id, date, start_time, work_minutes, pay) VALUES (?, ?, ?, ?, ?)`,
    s.id, date, s.start_time, s.work_minutes, s.pay_per_job,
  );
}

export function setBonus(jobId: number, bonus: number) {
  run(`UPDATE jobs SET bonus = ? WHERE id = ?`, bonus, jobId);
}

export function completeJob(jobId: number) {
  run(
    `UPDATE jobs SET status = 'completed', completed_at = datetime('now') WHERE id = ? AND status = 'committed'`,
    jobId,
  );
}

export function cancelJob(jobId: number) {
  tx(() => {
    run(`UPDATE jobs SET status = 'cancelled', staff_id = NULL, open_call = 0 WHERE id = ? AND status != 'completed'`, jobId);
    run(`UPDATE offers SET status = 'withdrawn' WHERE job_id = ? AND status IN ('pending', 'interested')`, jobId);
  });
}

/** 確定を外して未案内に戻す（スタッフが行けなくなったとき） */
export function releaseJob(jobId: number) {
  tx(() => {
    run(
      `UPDATE offers SET status = 'withdrawn' WHERE job_id = ? AND staff_id = (SELECT staff_id FROM jobs WHERE id = ?)
         AND status = 'accepted'`,
      jobId, jobId,
    );
    run(
      `UPDATE jobs SET status = 'open', staff_id = NULL, committed_at = NULL WHERE id = ? AND status = 'committed'`,
      jobId,
    );
  });
}

export function reopenJob(jobId: number) {
  run(`UPDATE jobs SET status = 'open' WHERE id = ? AND status = 'cancelled'`, jobId);
}

/* ---------- マッチング ---------- */

type SlotRow = { job_id: number; staff_id: number; date: string; start_time: number; work_minutes: number };

/** 月内の全スタッフのマッチング用データを読み込む */
function loadMatchStaff(month: string): MatchStaff[] {
  const like = `${month}-%`;
  const staff = all<Staff>(`SELECT * FROM staff`);
  const avRows = all<AvailabilityRow & { staff_id: number }>(
    `SELECT * FROM availability_months WHERE month = ?`,
    month,
  );
  const dateRows = all<{ staff_id: number; date: string; time_from: number | null; time_to: number | null }>(
    `SELECT staff_id, date, time_from, time_to FROM availability_dates WHERE date LIKE ?`,
    like,
  );
  const slotRows = all<SlotRow>(
    `SELECT id AS job_id, staff_id, date, start_time, work_minutes FROM jobs
     WHERE date LIKE ? AND status IN ('committed', 'completed') AND staff_id IS NOT NULL`,
    like,
  );
  const expRows = all<{ staff_id: number; shop_id: number; n: number }>(
    `SELECT staff_id, shop_id, COUNT(*) AS n FROM jobs WHERE status IN ('committed', 'completed')
       AND staff_id IS NOT NULL GROUP BY staff_id, shop_id`,
  );
  const offerRows = all<{ staff_id: number; job_id: number; status: string }>(
    `SELECT o.staff_id, o.job_id, o.status FROM offers o JOIN jobs j ON j.id = o.job_id
       WHERE j.date LIKE ? AND o.status IN ('pending', 'interested', 'declined')`,
    like,
  );

  return staff.map((s) => {
    const av = avRows.find((a) => a.staff_id === s.id);
    const slots = slotRows
      .filter((r) => r.staff_id === s.id)
      .map((r) => ({ jobId: r.job_id, date: r.date, start: r.start_time, end: r.start_time + r.work_minutes }));
    const mine = offerRows.filter((o) => o.staff_id === s.id);
    return {
      id: s.id,
      name: s.name,
      active: s.status === "active",
      availability: av
        ? {
            areas: JSON.parse(av.areas),
            maxJobs: av.max_jobs,
            dates: new Map(
              dateRows
                .filter((d) => d.staff_id === s.id)
                .map((d) => [d.date, { from: d.time_from ?? av.time_from, to: d.time_to ?? av.time_to }]),
            ),
          }
        : null,
      slots,
      monthCount: slots.length,
      experience: new Map(expRows.filter((e) => e.staff_id === s.id).map((e) => [e.shop_id, e.n])),
      declinedJobIds: new Set(mine.filter((o) => o.status === "declined").map((o) => o.job_id)),
      invitedJobIds: new Set(mine.filter((o) => o.status !== "declined").map((o) => o.job_id)),
    };
  });
}

const toMatchJob = (j: Job): MatchJob => ({
  id: j.id,
  shopId: j.shop_id,
  date: j.date,
  start: j.start_time,
  workMinutes: j.work_minutes,
  area: j.area,
});

/** この案件の案内先の候補（まだ案内していない人が対象） */
export function candidatesForJob(jobId: number): Candidate[] {
  const job = getJob(jobId);
  if (!job) return [];
  return rankCandidates(toMatchJob(job), loadMatchStaff(job.date.slice(0, 7)), "invite");
}

export type Applicant = Candidate & { offerId: number; respondedAt: string | null };

/** この案件に稼働を希望した人。確定に向く順に並べる */
export function applicantsForJob(jobId: number): Applicant[] {
  const job = getJob(jobId);
  if (!job) return [];
  const offers = all<{ id: number; staff_id: number; responded_at: string | null }>(
    `SELECT id, staff_id, responded_at FROM offers WHERE job_id = ? AND status = 'interested'`,
    jobId,
  );
  const ids = new Set(offers.map((o) => o.staff_id));
  const pool = loadMatchStaff(job.date.slice(0, 7)).filter((s) => ids.has(s.id));
  return rankCandidates(toMatchJob(job), pool, "confirm").map((c) => {
    const o = offers.find((x) => x.staff_id === c.staffId)!;
    return { ...c, offerId: o.id, respondedAt: o.responded_at };
  });
}

/** 案内を作り、新しく案内したスタッフのIDを返す（一度でも案内した人には送らない） */
export function createOffers(jobId: number, staffIds: number[]): number[] {
  const offered: number[] = [];
  tx(() => {
    const job = get<{ status: JobStatus }>(`SELECT status FROM jobs WHERE id = ?`, jobId);
    if (!job || !["open", "offered"].includes(job.status)) return;
    for (const staffId of staffIds) {
      const dup = get(
        `SELECT 1 FROM offers WHERE job_id = ? AND staff_id = ? AND status IN ('pending', 'interested', 'declined', 'accepted')`,
        jobId,
        staffId,
      );
      if (dup) continue;
      run(`INSERT INTO offers (job_id, staff_id) VALUES (?, ?)`, jobId, staffId);
      offered.push(staffId);
    }
    if (offered.length > 0) run(`UPDATE jobs SET status = 'offered' WHERE id = ? AND status = 'open'`, jobId);
  });
  return offered;
}

export function withdrawOffer(offerId: number) {
  tx(() => {
    const o = get<{ job_id: number }>(
      `SELECT job_id FROM offers WHERE id = ? AND status IN ('pending', 'interested')`,
      offerId,
    );
    if (!o) return;
    run(`UPDATE offers SET status = 'withdrawn', responded_at = datetime('now') WHERE id = ?`, offerId);
    resetIfNoOpenOffers(o.job_id);
  });
}

/** 案内中の人も希望者もいなくなった案件は未案内に戻す（全体募集中はそのまま） */
function resetIfNoOpenOffers(jobId: number) {
  run(
    `UPDATE jobs SET status = 'open' WHERE id = ? AND status = 'offered' AND open_call = 0
       AND NOT EXISTS (SELECT 1 FROM offers WHERE job_id = ? AND status IN ('pending', 'interested'))`,
    jobId,
    jobId,
  );
}

/** マッチング：未案内の案件ごとに、条件に合うスタッフ全員へ案内する */
export function inviteMonth(month: string): { invites: number; jobs: number; noMatch: number; staffIds: number[] } {
  const open = listJobs(month, { status: "open" });
  const staff = loadMatchStaff(month);
  const staffIds = new Set<number>();
  let invites = 0;
  let jobs = 0;
  for (const job of open) {
    const ids = rankCandidates(toMatchJob(job), staff, "invite")
      .filter((c) => c.eligible)
      .map((c) => c.staffId);
    const sent = createOffers(job.id, ids);
    sent.forEach((id) => staffIds.add(id));
    invites += sent.length;
    if (sent.length > 0) jobs++;
  }
  return { invites, jobs, noMatch: open.length - jobs, staffIds: [...staffIds] };
}

export type RespondResult = "interested" | "declined" | "closed" | "invalid";

/** スタッフが案内に回答する（希望する／見送る）。希望の取り消しも見送り扱い */
export function respondOffer(staffId: number, offerId: number, interested: boolean): RespondResult {
  return tx(() => {
    const o = get<{ job_id: number; status: OfferStatus }>(
      `SELECT job_id, status FROM offers WHERE id = ? AND staff_id = ?`,
      offerId,
      staffId,
    );
    if (!o || !["pending", "interested"].includes(o.status)) return "invalid";
    const job = get<{ status: JobStatus }>(`SELECT status FROM jobs WHERE id = ?`, o.job_id);
    if (!job || job.status !== "offered") {
      run(`UPDATE offers SET status = 'closed', responded_at = datetime('now') WHERE id = ?`, offerId);
      return "closed";
    }
    run(
      `UPDATE offers SET status = ?, responded_at = datetime('now') WHERE id = ?`,
      interested ? "interested" : "declined",
      offerId,
    );
    if (!interested) resetIfNoOpenOffers(o.job_id);
    return interested ? "interested" : "declined";
  });
}

/** 全体募集の案件に稼働を希望する */
export function applyOpenCall(staffId: number, jobId: number): "interested" | "closed" {
  return tx(() => {
    const job = get<{ status: JobStatus; open_call: number }>(`SELECT status, open_call FROM jobs WHERE id = ?`, jobId);
    if (!job || !job.open_call || job.status !== "offered") return "closed";
    const existing = get<{ id: number }>(
      `SELECT id FROM offers WHERE job_id = ? AND staff_id = ? AND status IN ('pending', 'interested', 'declined')`,
      jobId,
      staffId,
    );
    if (existing) {
      run(`UPDATE offers SET status = 'interested', responded_at = datetime('now') WHERE id = ?`, existing.id);
    } else {
      run(
        `INSERT INTO offers (job_id, staff_id, status, responded_at) VALUES (?, ?, 'interested', datetime('now'))`,
        jobId,
        staffId,
      );
    }
    return "interested";
  });
}

/** 適任がいない案件を全スタッフに再募集する */
export function startOpenCall(jobId: number): boolean {
  const r = run(
    `UPDATE jobs SET open_call = 1, status = 'offered' WHERE id = ? AND status IN ('open', 'offered')`,
    jobId,
  );
  return Number(r.changes) > 0;
}

export type ConfirmResult = { result: "committed" | "clash" | "invalid"; notChosen: number[] };

/** 本部が希望者の中から1人を選んで確定する。他の希望者・回答待ちは締め切る */
export function confirmJob(jobId: number, staffId: number): ConfirmResult {
  return tx(() => {
    const job = get<{ status: JobStatus }>(`SELECT status FROM jobs WHERE id = ?`, jobId);
    const offer = get<{ id: number }>(
      `SELECT id FROM offers WHERE job_id = ? AND staff_id = ? AND status = 'interested'`,
      jobId,
      staffId,
    );
    if (!job || !["open", "offered"].includes(job.status) || !offer) return { result: "invalid", notChosen: [] };
    const clash = get(
      `SELECT 1 FROM jobs j JOIN jobs o ON o.date = j.date AND o.id != j.id
       WHERE j.id = ? AND o.staff_id = ? AND o.status IN ('committed', 'completed')
         AND o.start_time < j.start_time + j.work_minutes + ? AND j.start_time < o.start_time + o.work_minutes + ?`,
      jobId,
      staffId,
      TRAVEL_BUFFER_MIN,
      TRAVEL_BUFFER_MIN,
    );
    if (clash) return { result: "clash", notChosen: [] };
    const notChosen = all<{ staff_id: number }>(
      `SELECT staff_id FROM offers WHERE job_id = ? AND status = 'interested' AND staff_id != ?`,
      jobId,
      staffId,
    ).map((r) => r.staff_id);
    run(`UPDATE offers SET status = 'accepted' WHERE id = ?`, offer.id);
    run(
      `UPDATE offers SET status = 'closed', responded_at = COALESCE(responded_at, datetime('now'))
       WHERE job_id = ? AND status IN ('pending', 'interested')`,
      jobId,
    );
    run(
      `UPDATE jobs SET status = 'committed', staff_id = ?, open_call = 0, committed_at = datetime('now') WHERE id = ?`,
      staffId,
      jobId,
    );
    return { result: "committed", notChosen };
  });
}

/** 希望者のいる案件を、最適な人でまとめて確定する */
export function confirmMonth(month: string): { confirmed: { jobId: number; staffId: number }[]; notChosen: { jobId: number; staffId: number }[] } {
  const jobs = listJobs(month, { status: "offered" }).filter((j) => j.interested_offers > 0);
  const offers = all<{ job_id: number; staff_id: number }>(
    `SELECT o.job_id, o.staff_id FROM offers o JOIN jobs j ON j.id = o.job_id
     WHERE j.date LIKE ? AND o.status = 'interested'`,
    `${month}-%`,
  );
  const interested = new Map<number, Set<number>>();
  for (const o of offers) {
    if (!interested.has(o.job_id)) interested.set(o.job_id, new Set());
    interested.get(o.job_id)!.add(o.staff_id);
  }
  const plan = planConfirmations(jobs.map(toMatchJob), loadMatchStaff(month), interested);
  const confirmed: { jobId: number; staffId: number }[] = [];
  const notChosen: { jobId: number; staffId: number }[] = [];
  for (const p of plan) {
    const r = confirmJob(p.jobId, p.staffId);
    if (r.result !== "committed") continue;
    confirmed.push(p);
    r.notChosen.forEach((staffId) => notChosen.push({ jobId: p.jobId, staffId }));
  }
  return { confirmed, notChosen };
}

/* ---------- スタッフ画面 ---------- */

export type StaffOffer = Job & { offer_id: number; offer_status: OfferStatus; sent_at: string };

function offersForStaff(staffId: number, status: OfferStatus, fromDate: string): StaffOffer[] {
  return all(
    `SELECT j2.*, o.id AS offer_id, o.status AS offer_status, o.sent_at FROM offers o
       JOIN (${JOB_SELECT}) j2 ON j2.id = o.job_id
     WHERE o.staff_id = ? AND o.status = ? AND j2.status = 'offered' AND j2.date >= ?
     ORDER BY j2.date, j2.start_time`,
    staffId,
    status,
    fromDate,
  );
}

/** 案内が届いていて、まだ回答していない案件 */
export function pendingOffersForStaff(staffId: number, fromDate = "0000-00-00"): StaffOffer[] {
  return offersForStaff(staffId, "pending", fromDate);
}

/** 希望を出して、本部の確定を待っている案件 */
export function interestedOffersForStaff(staffId: number, fromDate = "0000-00-00"): StaffOffer[] {
  return offersForStaff(staffId, "interested", fromDate);
}

/** 全体募集中で、まだ希望も案内もしていない案件 */
export function openCallJobsForStaff(staffId: number, fromDate: string): Job[] {
  return all(
    `${JOB_SELECT} WHERE j.open_call = 1 AND j.status = 'offered' AND j.date >= ?
       AND NOT EXISTS (SELECT 1 FROM offers o WHERE o.job_id = j.id AND o.staff_id = ? AND o.status IN ('pending', 'interested'))
     ORDER BY j.date, j.start_time`,
    fromDate,
    staffId,
  );
}

export function jobsForStaff(staffId: number, fromDate: string): Job[] {
  return all(
    `${JOB_SELECT} WHERE j.staff_id = ? AND j.status IN ('committed', 'completed') AND j.date >= ?
     ORDER BY j.date, j.start_time`,
    staffId,
    fromDate,
  );
}

/* ---------- 報酬 ---------- */

export type PayoutRow = {
  staff_id: number;
  name: string;
  bank_info: string;
  invoice_no: string;
  jobs: number;
  amount: number;
  paid_at: string | null;
  paid_amount: number | null;
};

export function payoutSummary(month: string): PayoutRow[] {
  return all(
    `SELECT s.id AS staff_id, s.name, s.bank_info, s.invoice_no,
       COUNT(j.id) AS jobs, COALESCE(SUM(j.pay + j.bonus), 0) AS amount,
       p.paid_at, p.amount AS paid_amount
     FROM jobs j JOIN staff s ON s.id = j.staff_id
     LEFT JOIN payouts p ON p.staff_id = s.id AND p.month = ?
     WHERE j.status = 'completed' AND j.date LIKE ?
     GROUP BY s.id ORDER BY s.kana, s.name`,
    month,
    `${month}-%`,
  );
}

export function markPaid(staffId: number, month: string) {
  const row = payoutSummary(month).find((r) => r.staff_id === staffId);
  if (!row) return;
  run(
    `INSERT INTO payouts (staff_id, month, jobs, amount, paid_at) VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT (staff_id, month) DO UPDATE SET jobs = excluded.jobs, amount = excluded.amount, paid_at = excluded.paid_at`,
    staffId, month, row.jobs, row.amount,
  );
}

export function unmarkPaid(staffId: number, month: string) {
  run(`DELETE FROM payouts WHERE staff_id = ? AND month = ?`, staffId, month);
}

/* ---------- ダッシュボード ---------- */

export function monthStats(month: string) {
  const rows = all<{ status: JobStatus; n: number }>(
    `SELECT status, COUNT(*) AS n FROM jobs WHERE date LIKE ? GROUP BY status`,
    `${month}-%`,
  );
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<JobStatus, number>>;
  const staff = get<{ active: number; registered: number }>(
    `SELECT COUNT(*) AS active,
       SUM(EXISTS (SELECT 1 FROM availability_months a WHERE a.staff_id = s.id AND a.month = ?)) AS registered
     FROM staff s WHERE s.status = 'active'`,
    month,
  )!;
  const revenue = get<{ fee: number; pay: number }>(
    `SELECT COALESCE(SUM(sh.fee_per_job), 0) AS fee, COALESCE(SUM(j.pay + j.bonus), 0) AS pay
     FROM jobs j JOIN shops sh ON sh.id = j.shop_id WHERE j.date LIKE ? AND j.status != 'cancelled'`,
    `${month}-%`,
  )!;
  return { by, staff: { active: staff.active, registered: staff.registered ?? 0 }, revenue };
}

export function unfilledJobs(fromDate: string, toDate: string): Job[] {
  return all(
    `${JOB_SELECT} WHERE j.date BETWEEN ? AND ? AND j.status IN ('open', 'offered') ORDER BY j.date, j.start_time`,
    fromDate,
    toDate,
  );
}

/* ---------- 本部ホーム ---------- */

/** その日の案件（中止を除く）。未確定を先に、あとは開始時刻順 */
export function jobsOnDate(date: string): Job[] {
  return all(
    `${JOB_SELECT} WHERE j.date = ? AND j.status != 'cancelled'
     ORDER BY j.status IN ('committed', 'completed'), j.start_time, sh.name`,
    date,
  );
}

/** 希望者が出ていて、本部の確定を待っている案件 */
export function jobsAwaitingDecision(fromDate: string): Job[] {
  return all(
    `${JOB_SELECT} WHERE j.date >= ? AND j.status = 'offered'
       AND EXISTS (SELECT 1 FROM offers o WHERE o.job_id = j.id AND o.status = 'interested')
     ORDER BY j.date, j.start_time`,
    fromDate,
  );
}

/** 作業日を過ぎたのに完了になっていない確定案件 */
export function jobsAwaitingCompletion(beforeDate: string): Job[] {
  return all(
    `${JOB_SELECT} WHERE j.date < ? AND j.status = 'committed' ORDER BY j.date, j.start_time`,
    beforeDate,
  );
}

/** 稼働中で、その月の予定をまだ登録していないスタッフ */
export function staffWithoutAvailability(month: string): Staff[] {
  return all(
    `SELECT * FROM staff s WHERE s.status = 'active'
       AND NOT EXISTS (SELECT 1 FROM availability_months a WHERE a.staff_id = s.id AND a.month = ?)
     ORDER BY s.kana, s.name`,
    month,
  );
}

/* ---------- スタッフの報酬 ---------- */

export type StaffPayMonth = { month: string; done: number; doneAmount: number; planned: number; plannedAmount: number; paid_at: string | null };

/** スタッフの月ごとの報酬。完了分と、確定済みでまだ作業していない分を分ける */
export function staffPayMonths(staffId: number, months: string[]): StaffPayMonth[] {
  return months.map((month) => {
    const r = get<{ done: number; doneAmount: number; planned: number; plannedAmount: number }>(
      `SELECT
         COALESCE(SUM(status = 'completed'), 0) AS done,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN pay + bonus END), 0) AS doneAmount,
         COALESCE(SUM(status = 'committed'), 0) AS planned,
         COALESCE(SUM(CASE WHEN status = 'committed' THEN pay + bonus END), 0) AS plannedAmount
       FROM jobs WHERE staff_id = ? AND date LIKE ?`,
      staffId,
      `${month}-%`,
    )!;
    const p = get<{ paid_at: string }>(`SELECT paid_at FROM payouts WHERE staff_id = ? AND month = ?`, staffId, month);
    return { month, ...r, paid_at: p?.paid_at ?? null };
  });
}

/* ---------- 当日の入店・完了報告 ---------- */

/** スタッフが入店したことを記録する。本人が担当の確定案件だけ */
export function checkIn(jobId: number, staffId: number): boolean {
  const r = run(
    `UPDATE jobs SET checked_in_at = COALESCE(checked_in_at, datetime('now'))
     WHERE id = ? AND staff_id = ? AND status = 'committed'`,
    jobId,
    staffId,
  );
  return Number(r.changes) > 0;
}

/** スタッフの完了報告。報告した時点で完了にし、報酬に集計する */
export function reportComplete(jobId: number, staffId: number, note: string, photos: string[]): boolean {
  const r = run(
    `UPDATE jobs SET status = 'completed', completed_at = datetime('now'),
       checked_in_at = COALESCE(checked_in_at, datetime('now')), report_note = ?, report_photos = ?
     WHERE id = ? AND staff_id = ? AND status = 'committed'`,
    note,
    JSON.stringify(photos),
    jobId,
    staffId,
  );
  return Number(r.changes) > 0;
}

export function reportPhotos(job: Pick<Job, "report_photos">): string[] {
  try {
    const v = JSON.parse(job.report_photos ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/* ---------- スタッフ詳細・店舗詳細の実績 ---------- */

/** スタッフの累計完了件数と、担当した店（多い順） */
export function staffRecord(staffId: number): { completed: number; shops: { shop_id: number; name: string; n: number }[] } {
  const completed = get<{ n: number }>(`SELECT COUNT(*) AS n FROM jobs WHERE staff_id = ? AND status = 'completed'`, staffId)!.n;
  const shops = all<{ shop_id: number; name: string; n: number }>(
    `SELECT j.shop_id, sh.name, COUNT(*) AS n FROM jobs j JOIN shops sh ON sh.id = j.shop_id
     WHERE j.staff_id = ? AND j.status = 'completed' GROUP BY j.shop_id ORDER BY n DESC, sh.name LIMIT 8`,
    staffId,
  );
  return { completed, shops };
}

/** その店によく入っているスタッフ（完了件数の多い順） */
export function shopTeam(shopId: number): { staff_id: number; name: string; n: number; last: string }[] {
  return all(
    `SELECT j.staff_id, st.name, COUNT(*) AS n, MAX(j.date) AS last FROM jobs j JOIN staff st ON st.id = j.staff_id
     WHERE j.shop_id = ? AND j.status = 'completed' GROUP BY j.staff_id ORDER BY n DESC, last DESC LIMIT 8`,
    shopId,
  );
}

/** その店の直近の作業（新しい順） */
export function shopRecentJobs(shopId: number, beforeDate: string, limit = 10): Job[] {
  return all(
    `${JOB_SELECT} WHERE j.shop_id = ? AND j.date <= ? AND j.status IN ('committed', 'completed')
     ORDER BY j.date DESC LIMIT ?`,
    shopId,
    beforeDate,
    limit,
  );
}
