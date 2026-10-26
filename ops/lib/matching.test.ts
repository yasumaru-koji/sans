import { describe, expect, it } from "vitest";
import { evaluate, planConfirmations, rankCandidates, type MatchJob, type MatchStaff } from "./matching";

const job: MatchJob = { id: 1, shopId: 10, date: "2026-11-02", start: 21 * 60, workMinutes: 60, area: "渋谷区" };
const win = { from: 20 * 60, to: 24 * 60 };

function staff(over: Partial<MatchStaff> = {}): MatchStaff {
  return {
    id: 1,
    name: "佐藤",
    active: true,
    availability: {
      areas: ["渋谷区"],
      maxJobs: null,
      dates: new Map([
        ["2026-11-02", win],
        ["2026-11-03", win],
      ]),
    },
    slots: [],
    monthCount: 0,
    experience: new Map(),
    declinedJobIds: new Set(),
    invitedJobIds: new Set(),
    ...over,
  };
}

describe("evaluate（案内）", () => {
  it("登録した日・エリア・時間帯に合えば候補になる", () => {
    expect(evaluate(job, staff()).eligible).toBe(true);
  });

  it("稼働予定が未登録なら対象外", () => {
    const c = evaluate(job, staff({ availability: null }));
    expect(c.eligible).toBe(false);
    expect(c.blockers).toContain("この月の稼働予定が未登録");
  });

  it("日付・エリア・時間帯のどれかが外れたら対象外", () => {
    expect(evaluate({ ...job, date: "2026-11-04" }, staff()).blockers).toContain("この日は稼働不可");
    expect(evaluate({ ...job, area: "港区" }, staff()).blockers).toContain("港区は対応エリア外");
    expect(evaluate({ ...job, start: 23 * 60 + 30 }, staff()).eligible).toBe(false);
  });

  it("日ごとに登録した時間帯で判定する", () => {
    const s = staff();
    s.availability!.dates.set("2026-11-02", { from: 22 * 60, to: 25 * 60 });
    expect(evaluate(job, s).blockers[0]).toMatch(/^時間帯外/);
    expect(evaluate({ ...job, start: 23 * 60 }, s).eligible).toBe(true);
  });

  it("同じ夜の確定案件と移動時間込みで重なると対象外", () => {
    const busy = staff({ slots: [{ jobId: 9, date: job.date, start: 22 * 60 + 15, end: 23 * 60 + 15 }] });
    expect(evaluate(job, busy).blockers).toContain("同じ夜の確定案件と時間が重なる");
    const ok = staff({ slots: [{ jobId: 9, date: job.date, start: 22 * 60 + 30, end: 23 * 60 + 30 }] });
    expect(evaluate(job, ok).eligible).toBe(true);
  });

  it("月の上限に達したら対象外", () => {
    const s = staff({ monthCount: 8 });
    s.availability!.maxJobs = 8;
    expect(evaluate(job, s).blockers).toContain("今月の上限 8件に到達");
  });

  it("案内済み・見送り済みの案件には出さない", () => {
    expect(evaluate(job, staff({ declinedJobIds: new Set([1]) })).eligible).toBe(false);
    expect(evaluate(job, staff({ invitedJobIds: new Set([1]) })).eligible).toBe(false);
  });
});

describe("evaluate（確定）", () => {
  it("本人が希望していれば登録外の日やエリアでも確定できる", () => {
    const c = evaluate({ ...job, date: "2026-11-20", area: "港区" }, staff({ invitedJobIds: new Set([1]) }), "confirm");
    expect(c.eligible).toBe(true);
  });

  it("同じ夜の確定案件と重なる人は確定できない", () => {
    const busy = staff({ slots: [{ jobId: 9, date: job.date, start: 21 * 60, end: 22 * 60 }] });
    expect(evaluate(job, busy, "confirm").eligible).toBe(false);
  });
});

describe("rankCandidates", () => {
  it("その店の経験が多く、今月の件数が少ない人を上にする", () => {
    const a = staff({ id: 1, name: "A", monthCount: 5 });
    const b = staff({ id: 2, name: "B", monthCount: 5, experience: new Map([[10, 3]]) });
    const c = staff({ id: 3, name: "C", monthCount: 0 });
    const d = staff({ id: 4, name: "D", availability: null });
    expect(rankCandidates(job, [a, b, c, d]).map((x) => x.name)).toEqual(["B", "C", "A", "D"]);
  });
});

describe("planConfirmations", () => {
  it("希望者の中から、同じ夜に重ねず月の上限を守って選ぶ", () => {
    const jobs: MatchJob[] = [
      job,
      { ...job, id: 2, shopId: 11, start: 21 * 60 + 30 },
      { ...job, id: 3, date: "2026-11-03" },
      { ...job, id: 4, date: "2026-11-05" },
    ];
    const a = staff({ id: 1, name: "A" });
    a.availability!.maxJobs = 2;
    const b = staff({ id: 2, name: "B" });
    const interested = new Map([
      [1, new Set([1, 2])],
      [2, new Set([1])], // Aは同じ夜の1件目で確定するので、2件目は確定できない
      [3, new Set([1, 2])],
      // 4は希望者なし
    ]);
    expect(planConfirmations(jobs, [a, b], interested)).toEqual([
      { jobId: 1, staffId: 1 },
      { jobId: 3, staffId: 2 },
    ]);
  });
});
