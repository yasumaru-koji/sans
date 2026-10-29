import { describe, expect, it } from "vitest";
import { ownerMessage, ownerPageUrl } from "./notify";
import {
  checkIn,
  createShop,
  createStaff,
  getJob,
  getShop,
  getShopByToken,
  listJobs,
  reportComplete,
  shopHasPhoto,
  shopReports,
  assignJob,
  generateMonthJobs,
} from "./repo";

const shopBase = {
  area: "港区", address: "港区1-1", start_time: 21 * 60, work_minutes: 60, closed_weekdays: [],
  key_method: "keybox" as const, fee_per_job: 6000, pay_per_job: 3000, note: "", active: 1,
};
const photo = "0123456789abcdef0123456789abcdef.jpg";

describe("サロンオーナーへの報告", () => {
  it("店ごとのURLで日報を見られ、写真はその店のものだけ返す", () => {
    const x = createShop({ ...shopBase, name: "サロンX", owner_chatwork_room_id: "123" });
    const y = createShop({ ...shopBase, name: "サロンY" });
    const staff = createStaff({
      name: "田中", kana: "", phone: "", email: "", chatwork_room_id: "", status: "active",
      contract_date: null, invoice_no: "", bank_info: "", note: "",
    });
    generateMonthJobs("2026-12", x);
    const job = listJobs("2026-12", { shopId: x }).find((j) => j.date === "2026-12-01")!;
    assignJob(job.id, staff);
    const sx = getShop(x)!;
    expect(sx.token).toMatch(/^[\w-]{20,}$/);
    expect(getShop(y)!.owner_chatwork_room_id).toBe("");
    expect(getShopByToken(sx.token)?.id).toBe(x);
    expect(getShopByToken("nope")).toBeUndefined();

    expect(shopReports(x)).toEqual([]);
    checkIn(job.id, staff);
    expect(shopReports(x).map((j) => j.id)).toEqual([job.id]);
    expect(ownerMessage("https://ex", sx, getJob(job.id)!, "start")).toContain("清掃を開始しました");

    reportComplete(job.id, staff, "鏡に傷あり", [photo], { condition: ["きれい"], supplies: ["タオル"] });
    const msg = ownerMessage("https://ex", sx, getJob(job.id)!, "end");
    expect(msg).toContain("清掃が終了しました");
    expect(msg).toContain("補充が必要な備品：タオル");
    expect(msg).toContain("連絡：鏡に傷あり");
    expect(msg).toContain("写真：1枚");
    expect(msg).toContain(ownerPageUrl("https://ex", sx));

    expect(shopHasPhoto(x, photo)).toBe(true);
    expect(shopHasPhoto(y, photo)).toBe(false);
    expect(shopHasPhoto(x, "../secret.jpg")).toBe(false);
  });
});
