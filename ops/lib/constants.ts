// 初期展開エリア。エリアを増やすときはここに追加する
export const AREAS = [
  "渋谷区",
  "新宿区",
  "港区",
  "目黒区",
  "世田谷区",
  "品川区",
  "中央区",
  "千代田区",
  "豊島区",
  "中野区",
  "杉並区",
  "文京区",
] as const;

export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export const KEY_METHODS = {
  key_station: "KEY STATION",
  keybox: "店前キーボックス",
  existing: "店舗の既存設備",
} as const;
export type KeyMethod = keyof typeof KEY_METHODS;

export const JOB_STATUS = {
  open: "未案内",
  offered: "募集中",
  committed: "確定",
  completed: "完了",
  cancelled: "中止",
} as const;
export type JobStatus = keyof typeof JOB_STATUS;

export const OFFER_STATUS = {
  pending: "回答待ち",
  interested: "希望",
  accepted: "確定",
  declined: "見送り",
  closed: "締切",
  withdrawn: "取り下げ",
} as const;
export type OfferStatus = keyof typeof OFFER_STATUS;

export const STAFF_STATUS = {
  active: "稼働中",
  paused: "休止",
  ended: "契約終了",
} as const;
export type StaffStatus = keyof typeof STAFF_STATUS;

// 同じ夜に2件入れるときの移動時間（分）
export const TRAVEL_BUFFER_MIN = 30;
