"use server";
import { redirect } from "next/navigation";
import { parseAvailability } from "@/lib/form";
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
