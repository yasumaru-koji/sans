import { beforeAll, describe, expect, it } from "vitest";
import {
  candidatesForJob,
  createOffers,
  createShop,
  createStaff,
  generateMonthJobs,
  getJob,
  listJobs,
  payoutSummary,
  planAndOfferMonth,
  completeJob,
  respondOffer,
  saveAvailability,
  pendingOffersForStaff,
} from "./repo";

const month = "2026-11";
let shopId: number;
let a: number;
let b: number;

beforeAll(() => {
  shopId = createShop({
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
  const base = { kana: "", phone: "", email: "", status: "active" as const, contract_date: null, invoice_no: "", bank_info: "", note: "" };
  a = createStaff({ ...base, name: "佐藤" });
  b = createStaff({ ...base, name: "鈴木" });
  const av = { month, areas: ["渋谷区"], weekdays: [], timeFrom: 20 * 60, timeTo: 25 * 60, maxJobs: null, note: "" };
  saveAvailability(a, { ...av, dates: ["2026-11-02", "2026-11-05"] });
  saveAvailability(b, { ...av, dates: ["2026-11-02", "2026-11-06"] });
});

describe("案件の作成とマッチング", () => {
  it("定休日を除いて月の案件を作る", () => {
    expect(generateMonthJobs(month)).toBe(30 - 4); // 2026年11月の火曜は4回
    expect(generateMonthJobs(month)).toBe(0);
  });

  it("最初に参加した人で確定し、他の打診は締め切る", () => {
    const job = listJobs(month).find((j) => j.date === "2026-11-02")!;
    expect(candidatesForJob(job.id).filter((c) => c.eligible).map((c) => c.name).sort()).toEqual(["佐藤", "鈴木"]);
    expect(createOffers(job.id, [a, b])).toBe(2);
    expect(getJob(job.id)!.status).toBe("offered");

    const offerB = pendingOffersForStaff(b)[0];
    const offerA = pendingOffersForStaff(a)[0];
    expect(respondOffer(b, offerB.offer_id, true)).toBe("committed");
    expect(respondOffer(a, offerA.offer_id, true)).toBe("invalid");
    expect(getJob(job.id)).toMatchObject({ status: "committed", staff_id: b });
  });

  it("辞退で回答待ちがなくなれば未割当に戻る", () => {
    const job = listJobs(month).find((j) => j.date === "2026-11-05")!;
    createOffers(job.id, [a]);
    expect(respondOffer(a, pendingOffersForStaff(a)[0].offer_id, false)).toBe("declined");
    expect(getJob(job.id)!.status).toBe("open");
    expect(candidatesForJob(job.id).find((c) => c.staffId === a)!.blockers).toContain("この案件は辞退済み");
  });

  it("月次の割当案で登録済みの日だけ打診する", () => {
    const r = planAndOfferMonth(month);
    expect(r.offered).toBe(1); // 11/6 の鈴木だけ
    expect(pendingOffersForStaff(b).map((o) => o.date)).toEqual(["2026-11-06"]);
  });

  it("完了した案件だけ報酬に集計する", () => {
    const job = listJobs(month).find((j) => j.date === "2026-11-02")!;
    expect(payoutSummary(month)).toEqual([]);
    completeJob(job.id);
    expect(payoutSummary(month)).toMatchObject([{ name: "鈴木", jobs: 1, amount: 3000 }]);
  });
});
