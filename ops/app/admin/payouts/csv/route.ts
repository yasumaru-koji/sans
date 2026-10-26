import { isAdmin } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { isMonth } from "@/lib/time";

const cell = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const month = new URL(req.url).searchParams.get("month");
  if (!isMonth(month)) return new Response("month is required", { status: 400 });
  const rows = repo.payoutSummary(month);
  const lines = [
    ["スタッフID", "氏名", "件数", "金額", "振込先", "インボイス登録番号", "支払日時"].map(cell).join(","),
    ...rows.map((r) => [r.staff_id, r.name, r.jobs, r.amount, r.bank_info, r.invoice_no, r.paid_at].map(cell).join(",")),
  ];
  // Excelで文字化けしないようにBOMを付ける
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payouts-${month}.csv"`,
    },
  });
}
