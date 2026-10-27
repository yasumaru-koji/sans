"use server";
import { redirect } from "next/navigation";
import { CLOSING_CHECKS, REPORT_QUESTIONS, type ReportAnswers } from "@/lib/constants";
import { parseAvailability } from "@/lib/form";
import { savePhotos } from "@/lib/photos";
import { notifyAdminProgress } from "@/lib/notify";
import * as repo from "@/lib/repo";

function staffOrThrow(token: string) {
  const s = repo.getStaffByToken(token);
  if (!s || s.status === "ended") throw new Error("このURLは使えません");
  return s;
}

/** 案内への回答。interested=false は見送り（希望の取り消しも含む） */
export async function respondAction(token: string, offerId: number, interested: boolean) {
  const s = staffOrThrow(token);
  const r = repo.respondOffer(s.id, offerId, interested);
  redirect(`/s/${token}/offers?r=${r}`);
}

export async function applyOpenCallAction(token: string, jobId: number) {
  const s = staffOrThrow(token);
  const r = repo.applyOpenCall(s.id, jobId);
  redirect(`/s/${token}/offers?r=${r}`);
}

export async function saveAvailabilityAction(token: string, fd: FormData) {
  const s = staffOrThrow(token);
  const a = parseAvailability(fd);
  repo.saveAvailability(s.id, a);
  redirect(`/s/${token}/availability?month=${a.month}&saved=1`);
}

export async function checkInAction(token: string, jobId: number) {
  const s = staffOrThrow(token);
  if (repo.checkIn(jobId, s.id)) await notifyAdminProgress(jobId, "start");
  redirect(`/s/${token}/jobs/${jobId}?r=in`);
}

/** 完了報告。チェック項目がすべて付いていないと受け付けない */
export async function reportAction(token: string, jobId: number, fd: FormData) {
  const s = staffOrThrow(token);
  const checked = fd.getAll("check").length;
  if (checked < CLOSING_CHECKS.length) redirect(`/s/${token}/jobs/${jobId}?r=unchecked`);
  const photos = await savePhotos(fd.getAll("photos").filter((f): f is File => f instanceof File));
  const note = String(fd.get("note") ?? "").slice(0, 1000);
  const answers: ReportAnswers = {};
  for (const q of REPORT_QUESTIONS) {
    const picked = fd.getAll(`q_${q.key}`).map(String).filter((v) => (q.options as readonly string[]).includes(v));
    if (picked.length === 0) redirect(`/s/${token}/jobs/${jobId}?r=unanswered`);
    answers[q.key] = q.multi ? picked : picked.slice(0, 1);
  }
  const ok = repo.reportComplete(jobId, s.id, note, photos, answers);
  if (ok) await notifyAdminProgress(jobId, "end");
  redirect(`/s/${token}/jobs/${jobId}?r=${ok ? "done" : "invalid"}`);
}

/** カレンダーでまとめて回答する。選んだ案件は希望、それ以外は見送り */
export async function respondBulkAction(token: string, fd: FormData) {
  const s = staffOrThrow(token);
  const want = new Set(fd.getAll("want").map(Number));
  let yes = 0;
  let no = 0;
  for (const id of new Set(fd.getAll("all").map(Number))) {
    const r = repo.respondOffer(s.id, id, want.has(id));
    if (r === "interested") yes++;
    if (r === "declined") no++;
  }
  redirect(`/s/${token}/offers?yes=${yes}&no=${no}`);
}
