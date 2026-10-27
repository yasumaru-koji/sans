import { beforeAll, describe, expect, it } from "vitest";
import {
  applicantsForJob,
  applyOpenCall,
  candidatesForJob,
  completeJob,
  confirmJob,
  confirmMonth,
  createOffers,
  createShop,
  createStaff,
  generateMonthJobs,
  getAvailability,
  getJob,
  interestedOffersForStaff,
  inviteMonth,
  listJobs,
  openCallJobsForStaff,
  payoutSummary,
  pendingOffersForStaff,
  checkIn,
  reportComplete,
  reportPhotos,
  staffPayMonths,
  respondOffer,
  saveAvailability,
  staffMonthMarks,
  startOpenCall,
} from "./repo";

const month = "2026-11";
let a: number;
let b: number;
let c: number;
const jobOn = (date: string) => listJobs(month).find((j) => j.date === date)!;

beforeAll(() => {
  createShop({
    name: "サロンA 渋谷店",
    area: "渋谷区",
    address: "渋谷区神南1-1-1",
    start_time: 21 * 60,
    work_minutes: 60,
    closed_weekdays: [2], // 火曜定休
    key_method: "keybox",
    fee_per_job: 6000,
    pay_per_job: 3000,
    note: "",
    active: 1,
  });
  const base = {
    kana: "", phone: "", email: "", chatwork_room_id: "", status: "active" as const,
    contract_date: null, invoice_no: "", bank_info: "", note: "",
  };
  a = createStaff({ ...base, name: "佐藤" });
  b = createStaff({ ...base, name: "鈴木" });
  c = createStaff({ ...base, name: "高橋" }); // 予定未登録
  const av = { month, areas: ["渋谷区"], weekdays: [], timeFrom: 20 * 60, timeTo: 25 * 60, maxJobs: null, note: "", dayTimes: {} };
  saveAvailability(a, { ...av, dates: ["2026-11-02", "2026-11-05"] });
  // 鈴木は11/6だけ22時以降
  saveAvailability(b, { ...av, dates: ["2026-11-02", "2026-11-06"], dayTimes: { "2026-11-06": { from: 22 * 60, to: 25 * 60 } } });
});

describe("稼働登録", () => {
  it("日ごとの時間帯を保存する（月の時間帯と同じなら保存しない）", () => {
    expect(getAvailability(b, month)!.dayTimes).toEqual({ "2026-11-06": { from: 22 * 60, to: 25 * 60 } });
    expect(getAvailability(a, month)!.dayTimes).toEqual({});
  });
});

describe("案内から確定まで", () => {
  it("定休日を除いて月の案件を作る", () => {
    expect(generateMonthJobs(month)).toBe(30 - 4); // 2026年11月の火曜は4回
    expect(generateMonthJobs(month)).toBe(0);
  });

  it("マッチングで条件に合う全員に案内する", () => {
    const r = inviteMonth(month);
    // 11/2 は佐藤・鈴木、11/5 は佐藤。11/6 は開始21時で鈴木の時間外なので案内なし
    expect(r).toMatchObject({ invites: 3, jobs: 2 });
    expect(r.staffIds.sort()).toEqual([a, b].sort());
    expect(getJob(jobOn("2026-11-02").id)!.status).toBe("offered");
    expect(getJob(jobOn("2026-11-06").id)!.status).toBe("open");
    expect(inviteMonth(month).invites).toBe(0); // 2回目は誰にも送らない
  });

  it("スタッフの希望だけでは確定せず、本部が選んで確定する", () => {
    const job = jobOn("2026-11-02");
    const offerA = pendingOffersForStaff(a).find((o) => o.id === job.id)!;
    const offerB = pendingOffersForStaff(b).find((o) => o.id === job.id)!;
    expect(respondOffer(a, offerA.offer_id, true)).toBe("interested");
    expect(respondOffer(b, offerB.offer_id, true)).toBe("interested");
    expect(getJob(job.id)!.status).toBe("offered");
    expect(applicantsForJob(job.id).map((x) => x.name).sort()).toEqual(["佐藤", "鈴木"]);

    const r = confirmJob(job.id, b);
    expect(r).toEqual({ result: "committed", notChosen: [a] });
    expect(getJob(job.id)).toMatchObject({ status: "committed", staff_id: b });
    expect(interestedOffersForStaff(a)).toEqual([]);
  });

  it("見送りで案内中の人がいなくなれば未案内に戻る", () => {
    const job = jobOn("2026-11-05");
    expect(respondOffer(a, pendingOffersForStaff(a)[0].offer_id, false)).toBe("declined");
    expect(getJob(job.id)!.status).toBe("open");
    expect(candidatesForJob(job.id).find((x) => x.staffId === a)!.blockers).toContain("この案件は見送り済み");
  });

  it("適任がいない案件を全体募集にすると、予定未登録の人も希望できる", () => {
    const job = jobOn("2026-11-06");
    expect(startOpenCall(job.id)).toBe(true);
    expect(openCallJobsForStaff(c, "2026-11-01").map((j) => j.id)).toContain(job.id);
    expect(applyOpenCall(c, job.id)).toBe("interested");
    expect(openCallJobsForStaff(c, "2026-11-01").map((j) => j.id)).not.toContain(job.id);
    expect(applicantsForJob(job.id)).toMatchObject([{ name: "高橋", eligible: true }]);
  });

  it("一括確定で希望者のいる案件を確定する", () => {
    const r = confirmMonth(month);
    expect(r.confirmed).toEqual([{ jobId: jobOn("2026-11-06").id, staffId: c }]);
    expect(getJob(jobOn("2026-11-06").id)).toMatchObject({ status: "committed", open_call: 0 });
  });

  it("同じ夜に確定済みの人は確定できない", () => {
    const other = createShop({
      name: "サロンB", area: "渋谷区", address: "", start_time: 21 * 60 + 30, work_minutes: 60,
      closed_weekdays: [], key_method: "keybox", fee_per_job: 6000, pay_per_job: 3000, note: "", active: 1,
    });
    generateMonthJobs(month, other);
    const job = listJobs(month, { shopId: other }).find((j) => j.date === "2026-11-02")!;
    createOffers(job.id, [b]);
    respondOffer(b, pendingOffersForStaff(b).find((o) => o.id === job.id)!.offer_id, true);
    expect(confirmJob(job.id, b).result).toBe("clash");
  });

  it("シフト表用に、入れる日と決定待ちの希望を返す", () => {
    const { available, interested } = staffMonthMarks(month);
    expect([...available.get(a)!].sort()).toEqual(["2026-11-02", "2026-11-05"]);
    expect(available.has(c)).toBe(false);
    // 鈴木はサロンBの11/2に希望を出したまま（同じ夜に確定済みのため確定できなかった）
    expect(interested.get(b)?.get("2026-11-02")).toBe(1);
  });

  it("完了した案件だけ報酬に集計する", () => {
    expect(payoutSummary(month)).toEqual([]);
    completeJob(jobOn("2026-11-02").id);
    expect(payoutSummary(month)).toMatchObject([{ name: "鈴木", jobs: 1, amount: 3000 }]);
  });

  it("担当者本人だけが入店・完了報告でき、報告すると完了になる", () => {
    const job = listJobs(month).find((j) => j.status === "committed")!;
    const other = [a, b, c].find((id) => id !== job.staff_id)!;
    expect(checkIn(job.id, other)).toBe(false);
    expect(checkIn(job.id, job.staff_id!)).toBe(true);
    expect(getJob(job.id)!.checked_in_at).not.toBeNull();
    expect(reportComplete(job.id, other, "", [])).toBe(false);
    expect(reportComplete(job.id, job.staff_id!, "洗剤が残りわずか", ["abc.jpg"])).toBe(true);
    const done = getJob(job.id)!;
    expect(done.status).toBe("completed");
    expect(done.report_note).toBe("洗剤が残りわずか");
    expect(reportPhotos(done)).toEqual(["abc.jpg"]);
    // 2回目の報告は受け付けない
    expect(reportComplete(job.id, job.staff_id!, "", [])).toBe(false);
    expect(staffPayMonths(job.staff_id!, [month])[0]).toMatchObject({ month, done: expect.any(Number) });
    expect(staffPayMonths(job.staff_id!, [month])[0].doneAmount).toBeGreaterThanOrEqual(3000);
  });
});
