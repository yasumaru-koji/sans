"use server";
import { redirect } from "next/navigation";
import { parseAvailability } from "@/lib/form";
import * as repo from "@/lib/repo";

function staffOrThrow(token: string) {
  const s = repo.getStaffByToken(token);
  if (!s || s.status === "ended") throw new Error("このURLは使えません");
  return s;
}

export async function respondAction(token: string, offerId: number, accept: boolean) {
  const s = staffOrThrow(token);
  const r = repo.respondOffer(s.id, offerId, accept);
  redirect(`/s/${token}?r=${r}`);
}

export async function saveAvailabilityAction(token: string, fd: FormData) {
  const s = staffOrThrow(token);
  const a = parseAvailability(fd);
  repo.saveAvailability(s.id, a);
  redirect(`/s/${token}/availability?month=${a.month}&saved=1`);
}

/** 月次の割当で届いた依頼にまとめて参加する */
export async function acceptAllAction(token: string) {
  const s = staffOrThrow(token);
  let committed = 0;
  let taken = 0;
  for (const o of repo.pendingOffersForStaff(s.id)) {
    const r = repo.respondOffer(s.id, o.offer_id, true);
    if (r === "committed") committed++;
    else taken++;
  }
  redirect(`/s/${token}?all=${committed}&taken=${taken}`);
}
