// 画面確認用のサンプルデータを入れる。実データのDBには実行しないこと。
//   npm run seed           … data/ops.db に投入（既存データがあれば中止）
import { all } from "../lib/db";
import * as repo from "../lib/repo";
import { addMonths, currentMonth, daysOfMonth, weekdayOf } from "../lib/time";

if (all<{ n: number }>("SELECT COUNT(*) AS n FROM staff")[0].n > 0) {
  console.error("すでにデータがあるため中止しました。サンプルを入れ直すときは data/ops.db を削除してください。");
  process.exit(1);
}

const shops = [
  { name: "サンプル美容室 渋谷店", area: "渋谷区", start: 21 * 60, closed: [2] },
  { name: "サンプル美容室 表参道店", area: "港区", start: 21 * 60 + 30, closed: [2] },
  { name: "サンプルヘア 新宿店", area: "新宿区", start: 22 * 60, closed: [1] },
];
for (const s of shops) {
  repo.createShop({
    name: s.name,
    area: s.area,
    address: `${s.area}サンプル町1-2-3 4F`,
    start_time: s.start,
    work_minutes: 60,
    closed_weekdays: s.closed,
    key_method: "keybox",
    fee_per_job: 6000,
    pay_per_job: 3000,
    note: "キーボックスは入口右手。退店時に警備をセットし、施錠の写真を送ってください。",
    active: 1,
  });
}

const people = [
  { name: "サンプル 一郎", kana: "さんぷる いちろう", areas: ["渋谷区", "港区"], days: [1, 3, 5], from: 20 * 60, to: 24 * 60 },
  { name: "サンプル 花子", kana: "さんぷる はなこ", areas: ["渋谷区", "新宿区"], days: [0, 4, 5, 6], from: 21 * 60, to: 25 * 60 },
  { name: "サンプル 次郎", kana: "さんぷる じろう", areas: ["港区", "新宿区"], days: [1, 2, 3, 4], from: 21 * 60, to: 24 * 60 },
  { name: "サンプル 桜", kana: "さんぷる さくら", areas: ["新宿区"], days: [0, 3, 6], from: 22 * 60, to: 26 * 60 },
];
const base = { phone: "", email: "", chatwork_room_id: "", status: "active" as const, contract_date: null, invoice_no: "", bank_info: "", note: "サンプル" };
const month = addMonths(currentMonth(), 1);
for (const p of people) {
  const id = repo.createStaff({ ...base, name: p.name, kana: p.kana });
  repo.saveAvailability(id, {
    month,
    areas: p.areas,
    weekdays: p.days,
    timeFrom: p.from,
    timeTo: p.to,
    maxJobs: 16,
    note: "",
    dayTimes: {},
    dates: daysOfMonth(month).filter((d) => p.days.includes(weekdayOf(d))),
  });
}
repo.createStaff({ ...base, name: "サンプル 未登録", kana: "さんぷる みとうろく" });

console.log(`サンプルの店舗${shops.length}件・スタッフ${people.length + 1}人を登録し、${month}の予定を入れました。`);
