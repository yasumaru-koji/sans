import { beforeAll, describe, expect, it } from "vitest";
import {
  autoAssignMonth,
  createShop,
  createStaff,
  declineAssignment,
  declinedOpenJobs,
  generateMonthJobs,
  listJobs,
  previewAutoAssign,
  saveAvailability,
} from "./repo";

const month = "2026-11";
let a: number;
let b: number;
const jobOn = (date: string) => listJobs(month).find((j) => j.date === date)!;

beforeAll(() => {
  createShop({
    name: "サロンA", area: "渋谷区", address: "渋谷区神南1-1-1", start_time: 21 * 60, work_minutes: 60,
    closed_weekdays: [], key_method: "keybox", fee_per_job: 6000, pay_per_job: 3000, note: "", active: 1,
  });
  const base = {
    kana: "", phone: "", email: "", chatwork_room_id: "", status: "active" as const,
    contract_date: null, invoice_no: "", bank_info: "", note: "",
  };
  a = createStaff({ ...base, name: "佐藤" });
  b = createStaff({ ...base, name: "鈴木" });
  const av = { month, areas: ["渋谷区"], weekdays: [], timeFrom: 20 * 60, timeTo: 25 * 60, maxJobs: 2, note: "", dayTimes: {} };
  saveAvailability(a, { ...av, dates: ["2026-11-02", "2026-11-03", "2026-11-20"] });
  saveAvailability(b, { ...av, dates: ["2026-11-03", "2026-11-20"] });
  generateMonthJobs(month);
});

describe("稼働登録からのシフト自動作成", () => {
  it("登録した日に入れ、件数を平準化する", () => {
    expect(previewAutoAssign(month)).toBe(3);
    const r = autoAssignMonth(month);
    expect(r.assigned).toHaveLength(3);
    expect(jobOn("2026-11-02")).toMatchObject({ status: "committed", staff_id: a });
    // 11/3は今月の件数が少ない鈴木、11/20は同点なので先に登録した佐藤
    expect(jobOn("2026-11-03").staff_id).toBe(b);
    expect(jobOn("2026-11-20").staff_id).toBe(a);
    expect(listJobs(month).filter((j) => j.status === "open").length).toBe(30 - 3);
    expect(previewAutoAssign(month)).toBe(0);
  });

  it("作業日の7日前を過ぎたシフトは不可で返せない", () => {
    expect(declineAssignment(a, jobOn("2026-11-02").id, "2026-10-27")).toBe("too_late");
    expect(declineAssignment(a, jobOn("2026-11-02").id, "2026-10-26", "体調不良")).toBe("declined");
    // 他人のシフトは返せない
    expect(declineAssignment(a, jobOn("2026-11-03").id, "2026-10-20")).toBe("invalid");
  });

  it("不可で返した案件は未割当に戻り、その人には自動で入れ直さない", () => {
    const job = jobOn("2026-11-02");
    expect(job).toMatchObject({ status: "open", staff_id: null });
    expect(declinedOpenJobs("2026-10-27").find((j) => j.id === job.id)).toMatchObject({ declined_by: "佐藤", decline_note: "体調不良" });
    autoAssignMonth(month);
    expect(jobOn("2026-11-02").status).toBe("open");
  });
});
