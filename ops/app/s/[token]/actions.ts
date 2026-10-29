"use server";
import { redirect } from "next/navigation";
import { CLOSING_CHECKS, REPORT_QUESTIONS, type ReportAnswers } from "@/lib/constants";
import { parseAvailability } from "@/lib/form";
import { savePhotos } from "@/lib/photos";
import { notifyAdminDeclined, notifyAdminProgress, notifyShopOwner } from "@/lib/notify";
import { baseUrl } from "@/lib/url";
import { todayJst } from "@/lib/time";
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
  redirect(`/s/${token}/shifts?r=${r}`);
}

export async function applyOpenCallAction(token: string, jobId: number) {
  const s = staffOrThrow(token);
  const r = repo.applyOpenCall(s.id, jobId);
  redirect(`/s/${token}/shifts?r=${r}`);
}

export async function saveAvailabilityAction(token: string, fd: FormData) {
  const s = staffOrThrow(token);
  const a = parseAvailability(fd);
  repo.saveAvailability(s.id, a);
  redirect(`/s/${token}/availability?month=${a.month}&saved=1`);
}

export async function checkInAction(token: string, jobId: number) {
  const s = staffOrThrow(token);
  if (repo.checkIn(jobId, s.id)) {
    await notifyAdminProgress(jobId, "start");
    await notifyShopOwner(await baseUrl(), jobId, "start");
  }
  redirect(`/s/${token}/jobs/${jobId}?r=in`);
}

/** 完了報告。チェック項目・アンケート・写真（1枚以上）がそろわないと受け付けない */
export async function reportAction(token: string, jobId: number, fd: FormData) {
  const s = staffOrThrow(token);
  const checked = fd.getAll("check").length;
  if (checked < CLOSING_CHECKS.length) redirect(`/s/${token}/jobs/${jobId}?r=unchecked`);
  const note = String(fd.get("note") ?? "").slice(0, 1000);
  const answers: ReportAnswers = {};
  for (const q of REPORT_QUESTIONS) {
    const picked = fd.getAll(`q_${q.key}`).map(String).filter((v) => (q.options as readonly string[]).includes(v));
    if (picked.length === 0) redirect(`/s/${token}/jobs/${jobId}?r=unanswered`);
    answers[q.key] = q.multi ? picked : picked.slice(0, 1);
  }
  // 写真は必須（KOJIさん 2026-10-29）。画像として保存できたものが1枚もなければ受け付けない
  const photos = await savePhotos(fd.getAll("photos").filter((f): f is File => f instanceof File));
  if (photos.length === 0) redirect(`/s/${token}/jobs/${jobId}?r=nophoto`);
  const ok = repo.reportComplete(jobId, s.id, note, photos, answers);
  if (ok) {
    await notifyAdminProgress(jobId, "end");
    await notifyShopOwner(await baseUrl(), jobId, "end");
  }
  redirect(`/s/${token}/jobs/${jobId}?r=${ok ? "done" : "invalid"}`);
}

/** 入ったシフトのうち、チェックした日を不可で本部に返す（作業日の7日前まで） */
export async function declineShiftsAction(token: string, fd: FormData) {
  const s = staffOrThrow(token);
  const note = String(fd.get("note") ?? "").slice(0, 200);
  const today = todayJst();
  const done: number[] = [];
  let late = 0;
  for (const id of new Set(fd.getAll("ng").map(Number))) {
    const r = repo.declineAssignment(s.id, id, today, note);
    if (r === "declined") done.push(id);
    if (r === "too_late") late++;
  }
  // 戻った案件は未割当になるので、本部に知らせる
  await notifyAdminDeclined(s, done, note);
  redirect(`/s/${token}/shifts?ng=${done.length}&late=${late}`);
}
