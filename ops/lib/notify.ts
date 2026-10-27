// スタッフへのチャットワーク通知の文面と送信
import { sendChatwork, type SendResult } from "./chatwork";
import { DECLINE_DEADLINE_DAYS, KEY_METHODS, REPORT_QUESTIONS } from "./constants";
import * as repo from "./repo";
import { dateLabel, minutesToLabel, yen } from "./time";

export type NotifySummary = { sent: number; noRoom: number; failed: number; noToken: boolean };

function summarize(results: SendResult[]): NotifySummary {
  return {
    sent: results.filter((r) => r === "sent").length,
    noRoom: results.filter((r) => r === "no_room").length,
    failed: results.filter((r) => r === "failed").length,
    noToken: results.includes("no_token"),
  };
}

export function staffPageUrl(base: string, staff: repo.Staff): string {
  return `${base}/s/${staff.token}`;
}

export function inviteMessage(base: string, staff: repo.Staff): string {
  return [
    `${staff.name}さん`,
    "締め作業スタッフのマイページです。毎月の稼働できる日時の登録と、案件への稼働希望はここからお願いします。",
    staffPageUrl(base, staff),
  ].join("\n");
}

export function offersMessage(base: string, staff: repo.Staff, offers: repo.StaffOffer[]): string {
  const lines = offers.map(
    (o) => `・${dateLabel(o.date)} ${minutesToLabel(o.start_time)}〜 ${o.area} ${yen(o.pay + o.bonus)}`,
  );
  return [
    `[info][title]${staff.name}さん 締め作業のご案内（${offers.length}件）[/title]${lines.join("\n")}[/info]`,
    "稼働を希望する案件は、マイページで「希望する」を押してください。希望者の中から本部が担当を決めてご連絡します。",
    staffPageUrl(base, staff),
  ].join("\n");
}

/** 指定したスタッフに、まだ回答していない案内をまとめて送る */
export async function notifyPendingOffers(base: string, staffIds: number[]): Promise<NotifySummary> {
  const results: SendResult[] = [];
  for (const id of new Set(staffIds)) {
    const staff = repo.getStaff(id);
    if (!staff) continue;
    const offers = repo.pendingOffersForStaff(id);
    if (offers.length === 0) continue;
    results.push(await sendChatwork(staff.chatwork_room_id, offersMessage(base, staff, offers)));
  }
  return summarize(results);
}

/** 担当に決まったことを本人に送る（住所と鍵の情報つき） */
export async function notifyCommitted(base: string, staff: repo.Staff, jobIds: number[]): Promise<void> {
  const jobs = jobIds.map((id) => repo.getJob(id)).filter((j): j is repo.Job => !!j);
  if (jobs.length === 0) return;
  const lines = jobs.map(
    (j) => `・${dateLabel(j.date)} ${minutesToLabel(j.start_time)}〜 ${j.shop_name}（${j.address}）鍵：${KEY_METHODS[j.key_method]}`,
  );
  await sendChatwork(
    staff.chatwork_room_id,
    [`[info][title]担当が決まりました（${jobs.length}件）[/title]${lines.join("\n")}[/info]`, `詳細：${staffPageUrl(base, staff)}`].join("\n"),
  );
}

/** 希望を出したが別の人で確定した案件を知らせる */
export async function notifyNotChosen(base: string, items: { jobId: number; staffId: number }[]): Promise<void> {
  const byStaff = new Map<number, number[]>();
  for (const i of items) byStaff.set(i.staffId, [...(byStaff.get(i.staffId) ?? []), i.jobId]);
  for (const [staffId, jobIds] of byStaff) {
    const staff = repo.getStaff(staffId);
    if (!staff) continue;
    const lines = jobIds
      .map((id) => repo.getJob(id))
      .filter((j): j is repo.Job => !!j)
      .map((j) => `・${dateLabel(j.date)} ${minutesToLabel(j.start_time)}〜 ${j.area}`);
    await sendChatwork(
      staff.chatwork_room_id,
      [`ご希望いただいた次の案件は、今回は別のスタッフで決まりました。またのご希望をお待ちしています。`, ...lines, staffPageUrl(base, staff)].join("\n"),
    );
  }
}

/** 全体募集を告知する。全員参加のルームがあればそこへ、なければ稼働中の全員に個別に送る */
export async function notifyOpenCall(base: string, jobIds: number[]): Promise<NotifySummary> {
  const jobs = jobIds.map((id) => repo.getJob(id)).filter((j): j is repo.Job => !!j);
  if (jobs.length === 0) return summarize([]);
  const lines = jobs.map((j) => `・${dateLabel(j.date)} ${minutesToLabel(j.start_time)}〜 ${j.area} 報酬${yen(j.pay + j.bonus)}`);
  const head = [
    `[info][title]【全体募集】締め作業のスタッフを募集しています（${jobs.length}件）[/title]${lines.join("\n")}[/info]`,
    "稼働できる方は、マイページの「全体募集」から「希望する」を押してください。",
  ].join("\n");
  const room = process.env.CHATWORK_ALL_STAFF_ROOM_ID;
  if (room) return summarize([await sendChatwork(room, head)]);
  const results: SendResult[] = [];
  for (const s of repo.listStaff().filter((x) => x.status === "active")) {
    results.push(await sendChatwork(s.chatwork_room_id, `${head}\n${staffPageUrl(base, s)}`));
  }
  return summarize(results);
}

/** 画面に出す送信結果の一文 */
export function summaryText(s: NotifySummary): string {
  if (s.noToken) return "チャットワーク連携が未設定のため、通知は送っていません。";
  const parts = [`チャットワークで${s.sent}件送りました。`];
  if (s.noRoom) parts.push(`ルームID未登録の${s.noRoom}人には送れていません。`);
  if (s.failed) parts.push(`${s.failed}人は送信に失敗しました（ルームIDと、本部アカウントがそのチャットに入っているかを確認してください）。`);
  return parts.join("");
}

/** 送信結果を画面遷移のクエリで受け渡す */
export function encodeSummary(s: NotifySummary): string {
  return [s.sent, s.noRoom, s.failed, s.noToken ? 1 : 0].join("-");
}

export function decodeSummary(v: string | undefined): NotifySummary | null {
  const m = v?.match(/^(\d+)-(\d+)-(\d+)-([01])$/);
  if (!m) return null;
  return { sent: Number(m[1]), noRoom: Number(m[2]), failed: Number(m[3]), noToken: m[4] === "1" };
}

/**
 * 担当スタッフに作業のリマインドを送る。前日（eve）は明日の作業、当日（day）は今夜の作業。
 * 送れた案件だけ送信済みにするので、ルームIDを直してから送り直せる
 */
export async function remindStaff(base: string, date: string, kind: repo.RemindKind): Promise<NotifySummary> {
  const results: SendResult[] = [];
  for (const j of repo.jobsToRemind(date, kind)) {
    const staff = j.staff_id != null ? repo.getStaff(j.staff_id) : undefined;
    if (!staff) continue;
    const title = kind === "eve" ? "明日の締め作業のお知らせ" : "今夜の締め作業のお知らせ";
    const body = [
      `[info][title]${title}[/title]${dateLabel(j.date)} ${minutesToLabel(j.start_time)}〜 ${j.shop_name}\n${j.address}\n鍵：${KEY_METHODS[j.key_method]}[/info]`,
      "お店に着いたら作業画面の「清掃を開始する」を、終わったら日報で終了を報告してください。行けなくなった場合はすぐに本部へ連絡してください。",
      `${base}/s/${staff.token}/jobs/${j.id}`,
    ].join("\n");
    const r = await sendChatwork(staff.chatwork_room_id, body);
    if (r === "sent") repo.markReminded(j.id, kind);
    results.push(r);
  }
  return summarize(results);
}

/** 清掃開始・終了を本部のチャットワークに知らせる（CHATWORK_ADMIN_ROOM_ID がある場合だけ） */
export async function notifyAdminProgress(jobId: number, kind: "start" | "end"): Promise<void> {
  const room = process.env.CHATWORK_ADMIN_ROOM_ID;
  const j = repo.getJob(jobId);
  if (!room || !j) return;
  const what = kind === "start" ? "清掃を開始しました" : "清掃を終了し、日報を提出しました";
  await sendChatwork(room, `${dateLabel(j.date)} ${j.shop_name}：${j.staff_name}さんが${what}。`);
}

/** 本部が入れたシフトを本人にまとめて知らせる。不可の返し方と期限も添える */
export async function notifyAssigned(base: string, items: { jobId: number; staffId: number }[]): Promise<NotifySummary> {
  const byStaff = new Map<number, number[]>();
  for (const i of items) byStaff.set(i.staffId, [...(byStaff.get(i.staffId) ?? []), i.jobId]);
  const results: SendResult[] = [];
  for (const [staffId, jobIds] of byStaff) {
    const staff = repo.getStaff(staffId);
    if (!staff) continue;
    const lines = jobIds
      .map((id) => repo.getJob(id))
      .filter((j): j is repo.Job => !!j)
      .sort((a, b) => a.date.localeCompare(b.date) || a.start_time - b.start_time)
      .map((j) => `・${dateLabel(j.date)} ${minutesToLabel(j.start_time)}〜 ${j.shop_name}（${j.area}）`);
    results.push(
      await sendChatwork(
        staff.chatwork_room_id,
        [
          `[info][title]${staff.name}さん シフトが入りました（${lines.length}件）[/title]${lines.join("\n")}[/info]`,
          `ご登録いただいた日時からシフトを組みました。都合が悪い日は、作業日の${DECLINE_DEADLINE_DAYS}日前までにマイページの「シフト」でチェックして「不可」を送ってください。それ以降は本部へ直接ご連絡ください。`,
          `${staffPageUrl(base, staff)}/shifts`,
        ].join("\n"),
      ),
    );
  }
  return summarize(results);
}

/** スタッフから不可が返ってきたことを本部のチャットワークに知らせる（CHATWORK_ADMIN_ROOM_ID がある場合だけ） */
export async function notifyAdminDeclined(staff: repo.Staff, jobIds: number[], note: string): Promise<void> {
  const room = process.env.CHATWORK_ADMIN_ROOM_ID;
  if (!room || jobIds.length === 0) return;
  const lines = jobIds
    .map((id) => repo.getJob(id))
    .filter((j): j is repo.Job => !!j)
    .map((j) => `・${dateLabel(j.date)} ${j.shop_name}`);
  await sendChatwork(room, [`${staff.name}さんから不可の連絡がありました（${lines.length}件）。代わりの人を入れてください。`, ...lines, note && `理由：${note}`].filter(Boolean).join("\n"));
}

export function ownerPageUrl(base: string, shop: Pick<repo.Shop, "token">): string {
  return `${base}/r/${shop.token}`;
}

/** サロンオーナーへの開始・終了の文面。終了は日報（アンケートの答え・連絡・写真の枚数）つき */
export function ownerMessage(base: string, shop: repo.Shop, j: repo.Job, kind: "start" | "end"): string {
  const head = `${dateLabel(j.date)} ${shop.name}`;
  if (kind === "start") return `[info][title]${head} 清掃を開始しました[/title]担当：${j.staff_name}[/info]`;
  const answers = repo.reportAnswers(j);
  const lines = REPORT_QUESTIONS.filter((q) => answers[q.key]?.length).map((q) => `${q.label}：${answers[q.key].join("、")}`);
  if (j.report_note) lines.push(`連絡：${j.report_note}`);
  const photos = repo.reportPhotos(j).length;
  if (photos) lines.push(`写真：${photos}枚`);
  return [
    `[info][title]${head} 清掃が終了しました[/title]担当：${j.staff_name}${lines.length ? `\n${lines.join("\n")}` : ""}[/info]`,
    `日報と写真はこちら：${ownerPageUrl(base, shop)}`,
  ].join("\n");
}

/** 清掃開始・終了をサロンオーナーのチャットワークに知らせる（店舗にルームIDがある場合だけ） */
export async function notifyShopOwner(base: string, jobId: number, kind: "start" | "end"): Promise<SendResult | null> {
  const j = repo.getJob(jobId);
  const shop = j && repo.getShop(j.shop_id);
  if (!j || !shop?.owner_chatwork_room_id) return null;
  return sendChatwork(shop.owner_chatwork_room_id, ownerMessage(base, shop, j, kind));
}
