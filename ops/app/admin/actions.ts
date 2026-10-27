"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, signOut } from "@/lib/auth";
import { normalizeRoomId, sendChatwork } from "@/lib/chatwork";
import { KEY_METHODS, STAFF_STATUS, type KeyMethod, type StaffStatus } from "@/lib/constants";
import { int, ints, parseAvailability, str } from "@/lib/form";
import {
  encodeSummary,
  inviteMessage,
  notifyCommitted,
  notifyNotChosen,
  notifyOpenCall,
  notifyPendingOffers,
  notifyAssigned,
  remindStaff,
} from "@/lib/notify";
import * as repo from "@/lib/repo";
import { isMonth, todayJst } from "@/lib/time";
import { baseUrl } from "@/lib/url";

function staffInput(fd: FormData): repo.StaffInput {
  const status = str(fd, "status") as StaffStatus;
  return {
    name: str(fd, "name"),
    kana: str(fd, "kana"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    chatwork_room_id: normalizeRoomId(str(fd, "chatwork_room_id")),
    status: status in STAFF_STATUS ? status : "active",
    contract_date: str(fd, "contract_date") || null,
    invoice_no: str(fd, "invoice_no"),
    bank_info: str(fd, "bank_info"),
    note: str(fd, "note"),
  };
}

export async function createStaffAction(fd: FormData) {
  await requireAdmin();
  const input = staffInput(fd);
  if (!input.name) redirect("/admin/staff/new?error=name");
  const id = repo.createStaff(input);
  redirect(`/admin/staff/${id}?created=1`);
}

export async function updateStaffAction(id: number, fd: FormData) {
  await requireAdmin();
  repo.updateStaff(id, staffInput(fd));
  revalidatePath(`/admin/staff/${id}`);
  redirect(`/admin/staff/${id}?tab=info&saved=1`);
}

export async function sendInviteAction(id: number) {
  await requireAdmin();
  const staff = repo.getStaff(id);
  if (!staff) redirect("/admin/staff");
  const r = await sendChatwork(staff.chatwork_room_id, inviteMessage(await baseUrl(), staff));
  redirect(`/admin/staff/${id}?invite=${r}`);
}

export async function regenerateTokenAction(id: number) {
  await requireAdmin();
  repo.regenerateToken(id);
  redirect(`/admin/staff/${id}?token=1`);
}

export async function saveStaffAvailabilityAction(staffId: number, fd: FormData) {
  await requireAdmin();
  const a = parseAvailability(fd);
  repo.saveAvailability(staffId, a);
  redirect(`/admin/staff/${staffId}?tab=avail&month=${a.month}&saved=1`);
}

function shopInput(fd: FormData): repo.ShopInput {
  const key = str(fd, "key_method") as KeyMethod;
  return {
    name: str(fd, "name"),
    area: str(fd, "area"),
    address: str(fd, "address"),
    start_time: int(fd, "start_time", 21 * 60),
    work_minutes: int(fd, "work_minutes", 60),
    closed_weekdays: ints(fd, "closed_weekdays"),
    key_method: key in KEY_METHODS ? key : "keybox",
    fee_per_job: int(fd, "fee_per_job", 6000),
    pay_per_job: int(fd, "pay_per_job", 3000),
    note: str(fd, "note"),
    active: fd.get("active") ? 1 : 0,
  };
}

export async function createShopAction(fd: FormData) {
  await requireAdmin();
  const input = shopInput(fd);
  if (!input.name || !input.area) redirect("/admin/shops/new?error=1");
  const id = repo.createShop(input);
  redirect(`/admin/shops/${id}?tab=info&created=1`);
}

export async function updateShopAction(id: number, fd: FormData) {
  await requireAdmin();
  repo.updateShop(id, shopInput(fd));
  redirect(`/admin/shops/${id}?tab=info&saved=1`);
}

export async function generateJobsAction(fd: FormData) {
  await requireAdmin();
  const month = str(fd, "month");
  if (!isMonth(month)) throw new Error("月の指定が正しくありません");
  const shopId = int(fd, "shop_id") || undefined;
  const n = repo.generateMonthJobs(month, shopId);
  redirect(`/admin/jobs?month=${month}&generated=${n}`);
}

function monthOf(fd: FormData): string {
  const month = str(fd, "month");
  if (!isMonth(month)) throw new Error("月の指定が正しくありません");
  return month;
}

/** マッチング：未案内の案件を、条件に合うスタッフ全員に案内する */
export async function inviteMonthAction(fd: FormData) {
  await requireAdmin();
  const month = monthOf(fd);
  const r = repo.inviteMonth(month);
  const cw = await notifyPendingOffers(await baseUrl(), r.staffIds);
  redirect(`/admin/jobs?month=${month}&invited=${r.invites}&jobs=${r.jobs}&nomatch=${r.noMatch}&cw=${encodeSummary(cw)}`);
}

/** 希望者のいる案件を、最適な人でまとめて確定する */
export async function confirmMonthAction(fd: FormData) {
  await requireAdmin();
  const month = monthOf(fd);
  const r = repo.confirmMonth(month);
  const base = await baseUrl();
  const byStaff = new Map<number, number[]>();
  for (const c of r.confirmed) byStaff.set(c.staffId, [...(byStaff.get(c.staffId) ?? []), c.jobId]);
  for (const [staffId, jobIds] of byStaff) {
    const staff = repo.getStaff(staffId);
    if (staff) await notifyCommitted(base, staff, jobIds);
  }
  await notifyNotChosen(base, r.notChosen);
  redirect(`/admin/jobs?month=${month}&confirmed=${r.confirmed.length}`);
}

/** まだ誰にも案内できていない案件を、まとめて全スタッフに再募集する */
export async function openCallMonthAction(fd: FormData) {
  await requireAdmin();
  const month = monthOf(fd);
  const ids = repo.listJobs(month, { status: "open" }).map((j) => j.id).filter((id) => repo.startOpenCall(id));
  const cw = await notifyOpenCall(await baseUrl(), ids);
  redirect(`/admin/jobs?month=${month}&opencall=${ids.length}&cw=${encodeSummary(cw)}`);
}

export async function addJobAction(fd: FormData) {
  await requireAdmin();
  const date = str(fd, "date");
  repo.addJob(int(fd, "shop_id"), date);
  redirect(`/admin/jobs?month=${date.slice(0, 7)}`);
}

export async function offerAction(jobId: number, fd: FormData) {
  await requireAdmin();
  const ids = repo.createOffers(jobId, ints(fd, "staff_id"));
  const cw = await notifyPendingOffers(await baseUrl(), ids);
  redirect(`/admin/jobs/${jobId}?offered=${ids.length}&cw=${encodeSummary(cw)}`);
}

/** シフト管理の右パネルから操作したときは、そのパネルに戻す */
function backTo(fd: FormData | undefined, params: string): string | null {
  const back = fd?.get("back");
  if (typeof back !== "string" || !back.startsWith("/admin/jobs?")) return null;
  return `${back}&${params}`;
}

export async function confirmAction(jobId: number, staffId: number, fd?: FormData) {
  await requireAdmin();
  const r = repo.confirmJob(jobId, staffId);
  if (r.result === "committed") {
    const base = await baseUrl();
    const staff = repo.getStaff(staffId);
    if (staff) await notifyCommitted(base, staff, [jobId]);
    await notifyNotChosen(base, r.notChosen.map((id) => ({ jobId, staffId: id })));
  }
  redirect(backTo(fd, `confirm=${r.result}`) ?? `/admin/jobs/${jobId}?confirm=${r.result}`);
}

export async function openCallAction(jobId: number, fd?: FormData) {
  await requireAdmin();
  const ok = repo.startOpenCall(jobId);
  const cw = ok ? await notifyOpenCall(await baseUrl(), [jobId]) : null;
  const q = `opencall=1${cw ? `&cw=${encodeSummary(cw)}` : ""}`;
  redirect(backTo(fd, q) ?? `/admin/jobs/${jobId}?${q}`);
}

export async function withdrawOfferAction(jobId: number, offerId: number) {
  await requireAdmin();
  repo.withdrawOffer(offerId);
  redirect(`/admin/jobs/${jobId}`);
}

export async function jobStatusAction(jobId: number, op: "complete" | "cancel" | "release" | "reopen", fd?: FormData) {
  await requireAdmin();
  if (op === "complete") repo.completeJob(jobId);
  if (op === "cancel") repo.cancelJob(jobId);
  if (op === "release") repo.releaseJob(jobId);
  if (op === "reopen") repo.reopenJob(jobId);
  redirect(backTo(fd, `done=${op}`) ?? `/admin/jobs/${jobId}`);
}

export async function bonusAction(jobId: number, fd: FormData) {
  await requireAdmin();
  repo.setBonus(jobId, Math.max(0, int(fd, "bonus")));
  redirect(`/admin/jobs/${jobId}`);
}

export async function paidAction(staffId: number, month: string, paid: boolean) {
  await requireAdmin();
  if (paid) repo.markPaid(staffId, month);
  else repo.unmarkPaid(staffId, month);
  redirect(`/admin/payouts?month=${month}`);
}

export async function signOutAction() {
  await signOut();
  redirect("/login");
}

/** ホームの「完了にする」。画面はホームに戻す */
export async function completeFromHomeAction(jobId: number) {
  await requireAdmin();
  repo.completeJob(jobId);
  redirect("/admin");
}

/** ホームから前日・当日のリマインドを手動で送る */
export async function remindAction(kind: "eve" | "day") {
  await requireAdmin();
  const today = todayJst();
  const date = kind === "eve" ? new Date(Date.parse(`${today}T00:00:00Z`) + 864e5).toISOString().slice(0, 10) : today;
  const cw = await remindStaff(await baseUrl(), date, kind);
  redirect(`/admin?remind=${kind}&cw=${encodeSummary(cw)}`);
}

/** 稼働登録から月のシフトを自動で組み、入った人に知らせる */
export async function autoAssignAction(fd: FormData) {
  await requireAdmin();
  const month = str(fd, "month");
  if (!isMonth(month)) redirect("/admin/jobs");
  const r = repo.autoAssignMonth(month);
  const cw = await notifyAssigned(await baseUrl(), r.assigned);
  redirect(`/admin/jobs?month=${month}&assigned=${r.assigned.length}&left=${r.left}&cw=${encodeSummary(cw)}`);
}

/** 右パネル・案件詳細から、この人をシフトに入れる */
export async function assignAction(jobId: number, staffId: number, fd?: FormData) {
  await requireAdmin();
  const ok = repo.assignJob(jobId, staffId);
  if (ok) await notifyAssigned(await baseUrl(), [{ jobId, staffId }]);
  const q = `confirm=${ok ? "committed" : "invalid"}`;
  redirect(backTo(fd, q) ?? `/admin/jobs/${jobId}?${q}`);
}
