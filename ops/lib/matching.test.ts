import { describe, expect, it } from "vitest";
import { evaluate, planAssignments, rankCandidates, type MatchJob, type MatchStaff } from "./matching";

const job: MatchJob = { id: 1, shopId: 10, date: "2026-11-02", start: 21 * 60, workMinutes: 60, area: "渋谷区" };

function staff(over: Partial<MatchStaff> = {}): MatchStaff {
  return {
    id: 1,
    name: "佐藤",
    active: true,
    availability: {
      areas: ["渋谷区"],
      timeFrom: 20 * 60,
      timeTo: 24 * 60,
      maxJobs: null,
      dates: new Set(["2026-11-02", "2026-11-03"]),
    },
    slots: [],
    monthCount: 0,
    experience: new Map(),
    declinedJobIds: new Set(),
    pendingJobIds: new Set(),
    ...over,
  };
}

describe("evaluate", () => {
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

  it("同じ夜の別案件と移動時間込みで重なると対象外", () => {
    const busy = staff({ slots: [{ jobId: 9, date: job.date, start: 22 * 60 + 15, end: 23 * 60 + 15 }] });
    expect(evaluate(job, busy).blockers).toContain("同じ夜の別案件と時間が重なる");
    const ok = staff({ slots: [{ jobId: 9, date: job.date, start: 22 * 60 + 30, end: 23 * 60 + 30 }] });
    expect(evaluate(job, ok).eligible).toBe(true);
  });

  it("月の上限に達したら対象外", () => {
    const s = staff({ monthCount: 8 });
    s.availability!.maxJobs = 8;
    expect(evaluate(job, s).blockers).toContain("今月の上限 8件に到達");
  });

  it("辞退済みの案件には出さない", () => {
    expect(evaluate(job, staff({ declinedJobIds: new Set([1]) })).eligible).toBe(false);
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

describe("planAssignments", () => {
  it("同じ夜に重ねず、月の上限を守って割り振る", () => {
    const jobs: MatchJob[] = [
      job,
      { ...job, id: 2, shopId: 11, start: 21 * 60 + 30 },
      { ...job, id: 3, date: "2026-11-03" },
    ];
    const a = staff({ id: 1, name: "A" });
    a.availability!.maxJobs = 1;
    const b = staff({ id: 2, name: "B" });
    const plan = planAssignments(jobs, [a, b]);
    expect(plan).toEqual([
      { jobId: 1, staffId: 1 },
      { jobId: 2, staffId: 2 },
      { jobId: 3, staffId: 2 },
    ]);
  });
});
