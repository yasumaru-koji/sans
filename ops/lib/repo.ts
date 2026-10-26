// 画面とサーバーアクションから使うデータ操作。SQLはここに集める。
import crypto from "node:crypto";
import { all, get, run, tx } from "./db";
import type { JobStatus, KeyMethod, OfferStatus, StaffStatus } from "./constants";
import { planAssignments, rankCandidates, type MatchJob, type MatchStaff } from "./matching";
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
  pending_offers: number;
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
  const dates = all<{ date: string }>(
    `SELECT date FROM availability_dates WHERE staff_id = ? AND date LIKE ? ORDER BY date`,
    staffId,
    `${month}-%`,
  ).map((d) => d.date);
  return {
    month,
    areas: JSON.parse(row.areas),
    weekdays: JSON.parse(row.weekdays),
    timeFrom: row.time_from,
    timeTo: row.time_to,
    maxJobs: row.max_jobs,
    note: row.note,
    dates,
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
    for (const d of dates) run(`INSERT INTO availability_dates (staff_id, date) VALUES (?, ?)`, staffId, d);
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
    (SELECT COUNT(*) FROM offers o WHERE o.job_id = j.id AND o.status = 'pending') AS pending_offers
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
    run(`UPDATE jobs SET status = 'cancelled', staff_id = NULL WHERE id = ? AND status != 'completed'`, jobId);
    run(`UPDATE offers SET status = 'withdrawn' WHERE job_id = ? AND status = 'pending'`, jobId);
  });
}

/** 確定を外して未割当に戻す（スタッフが行けなくなったとき） */
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

type SlotRow = { job_id: number; staff_id: number; shop_id: number; date: string; start_time: number; work_minutes: number };

/** 月内の全スタッフのマッチング用データを読み込む */
function loadMatchStaff(month: string): MatchStaff[] {
  const like = `${month}-%`;
  const staff = all<Staff>(`SELECT * FROM staff`);
  const avRows = all<AvailabilityRow & { staff_id: number }>(
    `SELECT * FROM availability_months WHERE month = ?`,
    month,
  );
  const dateRows = all<{ staff_id: number; date: string }>(
    `SELECT staff_id, date FROM availability_dates WHERE date LIKE ?`,
    like,
  );
  // 確定・完了・回答待ちの枠
  const slotRows = all<SlotRow>(
    `SELECT j.id AS job_id, j.staff_id, j.shop_id, j.date, j.start_time, j.work_minutes FROM jobs j
       WHERE j.date LIKE ? AND j.status IN ('committed', 'completed') AND j.staff_id IS NOT NULL
     UNION ALL
     SELECT j.id, o.staff_id, j.shop_id, j.date, j.start_time, j.work_minutes FROM offers o JOIN jobs j ON j.id = o.job_id
       WHERE j.date LIKE ? AND o.status = 'pending'`,
    like,
    like,
  );
  const expRows = all<{ staff_id: number; shop_id: number; n: number }>(
    `SELECT staff_id, shop_id, COUNT(*) AS n FROM jobs WHERE status IN ('committed', 'completed')
       AND staff_id IS NOT NULL GROUP BY staff_id, shop_id`,
  );
  const offerRows = all<{ staff_id: number; job_id: number; status: string }>(
    `SELECT o.staff_id, o.job_id, o.status FROM offers o JOIN jobs j ON j.id = o.job_id
       WHERE j.date LIKE ? AND o.status IN ('pending', 'declined')`,
    like,
  );

  return staff.map((s) => {
    const av = avRows.find((a) => a.staff_id === s.id);
    const slots = slotRows
      .filter((r) => r.staff_id === s.id)
      .map((r) => ({ jobId: r.job_id, date: r.date, start: r.start_time, end: r.start_time + r.work_minutes }));
    return {
      id: s.id,
      name: s.name,
      active: s.status === "active",
      availability: av
        ? {
            areas: JSON.parse(av.areas),
            timeFrom: av.time_from,
            timeTo: av.time_to,
            maxJobs: av.max_jobs,
            dates: new Set(dateRows.filter((d) => d.staff_id === s.id).map((d) => d.date)),
          }
        : null,
      slots,
      monthCount: slots.length,
      experience: new Map(expRows.filter((e) => e.staff_id === s.id).map((e) => [e.shop_id, e.n])),
      declinedJobIds: new Set(offerRows.filter((o) => o.staff_id === s.id && o.status === "declined").map((o) => o.job_id)),
      pendingJobIds: new Set(offerRows.filter((o) => o.staff_id === s.id && o.status === "pending").map((o) => o.job_id)),
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

export function candidatesForJob(jobId: number) {
  const job = getJob(jobId);
  if (!job) return [];
  const staff = loadMatchStaff(job.date.slice(0, 7)).map((s) => ({
    ...s,
    // この案件自身の確定枠は重複チェックから外す
    slots: s.slots.filter((x) => x.jobId !== jobId),
  }));
  return rankCandidates(toMatchJob(job), staff);
}

/** 打診を作り、新しく打診したスタッフのIDを返す */
export function createOffers(jobId: number, staffIds: number[]): number[] {
  const offered: number[] = [];
  tx(() => {
    const job = get<{ status: JobStatus }>(`SELECT status FROM jobs WHERE id = ?`, jobId);
    if (!job || !["open", "offered"].includes(job.status)) return;
    for (const staffId of staffIds) {
      const dup = get(`SELECT 1 FROM offers WHERE job_id = ? AND staff_id = ? AND status = 'pending'`, jobId, staffId);
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
    const o = get<{ job_id: number }>(`SELECT job_id FROM offers WHERE id = ? AND status = 'pending'`, offerId);
    if (!o) return;
    run(`UPDATE offers SET status = 'withdrawn', responded_at = datetime('now') WHERE id = ?`, offerId);
    resetIfNoPending(o.job_id);
  });
}

function resetIfNoPending(jobId: number) {
  run(
    `UPDATE jobs SET status = 'open' WHERE id = ? AND status = 'offered'
       AND NOT EXISTS (SELECT 1 FROM offers WHERE job_id = ? AND status = 'pending')`,
    jobId,
    jobId,
  );
}

/** 月次の割当案を作り、未割当の案件に1人ずつ打診する */
export function planAndOfferMonth(month: string): { offered: number; unfilled: number; staffIds: number[] } {
  const open = listJobs(month, { status: "open" });
  const plan = planAssignments(open.map(toMatchJob), loadMatchStaff(month));
  const staffIds = new Set<number>();
  let offered = 0;
  for (const p of plan) {
    const ids = createOffers(p.jobId, [p.staffId]);
    offered += ids.length;
    ids.forEach((id) => staffIds.add(id));
  }
  return { offered, unfilled: open.length - plan.length, staffIds: [...staffIds] };
}

export type RespondResult = "committed" | "declined" | "taken" | "invalid";

/** スタッフが打診に回答する。最初に「参加」した人で確定し、他の打診は締め切る。 */
export function respondOffer(staffId: number, offerId: number, accept: boolean): RespondResult {
  return tx(() => {
    const o = get<{ job_id: number; status: OfferStatus }>(
      `SELECT job_id, status FROM offers WHERE id = ? AND staff_id = ?`,
      offerId,
      staffId,
    );
    if (!o || o.status !== "pending") return "invalid";
    if (!accept) {
      run(`UPDATE offers SET status = 'declined', responded_at = datetime('now') WHERE id = ?`, offerId);
      resetIfNoPending(o.job_id);
      return "declined";
    }
    const job = get<{ status: JobStatus }>(`SELECT status FROM jobs WHERE id = ?`, o.job_id);
    if (!job || job.status !== "offered") {
      run(`UPDATE offers SET status = 'closed', responded_at = datetime('now') WHERE id = ?`, offerId);
      return "taken";
    }
    run(`UPDATE offers SET status = 'accepted', responded_at = datetime('now') WHERE id = ?`, offerId);
    run(
      `UPDATE offers SET status = 'closed', responded_at = datetime('now') WHERE job_id = ? AND status = 'pending'`,
      o.job_id,
    );
    run(
      `UPDATE jobs SET status = 'committed', staff_id = ?, committed_at = datetime('now') WHERE id = ?`,
      staffId,
      o.job_id,
    );
    return "committed";
  });
}

/* ---------- スタッフ画面 ---------- */

export type StaffOffer = Job & { offer_id: number; sent_at: string };

export function pendingOffersForStaff(staffId: number): StaffOffer[] {
  return all(
    `SELECT j2.*, o.id AS offer_id, o.sent_at FROM offers o
       JOIN (${JOB_SELECT}) j2 ON j2.id = o.job_id
     WHERE o.staff_id = ? AND o.status = 'pending' ORDER BY j2.date, j2.start_time`,
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
