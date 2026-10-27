"use server";
import { redirect } from "next/navigation";
import { CLOSING_CHECKS } from "@/lib/constants";
import { parseAvailability } from "@/lib/form";
import { savePhotos } from "@/lib/photos";
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

/** 案内が届いている案件すべてに稼働を希望する */
export async function interestAllAction(token: string) {
  const s = staffOrThrow(token);
  let n = 0;
  for (const o of repo.pendingOffersForStaff(s.id)) {
    if (repo.respondOffer(s.id, o.offer_id, true) === "interested") n++;
  }
  redirect(`/s/${token}/offers?all=${n}`);
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
  repo.checkIn(jobId, s.id);
  redirect(`/s/${token}/jobs/${jobId}?r=in`);
}

/** 完了報告。チェック項目がすべて付いていないと受け付けない */
export async function reportAction(token: string, jobId: number, fd: FormData) {
  const s = staffOrThrow(token);
  const checked = fd.getAll("check").length;
  if (checked < CLOSING_CHECKS.length) redirect(`/s/${token}/jobs/${jobId}?r=unchecked`);
  const photos = await savePhotos(fd.getAll("photos").filter((f): f is File => f instanceof File));
  const note = String(fd.get("note") ?? "").slice(0, 1000);
  const ok = repo.reportComplete(jobId, s.id, note, photos);
  redirect(`/s/${token}/jobs/${jobId}?r=${ok ? "done" : "invalid"}`);
}
