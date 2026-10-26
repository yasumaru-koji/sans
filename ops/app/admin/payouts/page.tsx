import { MonthNav } from "@/components/ui";
import * as repo from "@/lib/repo";
import { addMonths, currentMonth, isMonth, monthLabel, yen } from "@/lib/time";
import { paidAction } from "../actions";

export default async function Payouts({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month : addMonths(currentMonth(), -1);
  const rows = repo.payoutSummary(month);
  const total = rows.reduce((a, r) => a + r.amount, 0);
  const unpaid = rows.filter((r) => !r.paid_at || r.paid_amount !== r.amount);

  return (
    <main className="page">
      <div className="head">
        <h1>報酬</h1>
        <MonthNav month={month} base="/admin/payouts" />
      </div>
      <p className="muted">
        {monthLabel(month)}に「完了」にした案件の委託報酬です。合計 <b className="num">{yen(total)}</b>、未払い {unpaid.length}人。
        フリーランス法により、支払いは成果物の受領から60日以内に行います。
      </p>
      {rows.length === 0 ? (
        <p className="card muted">この月に完了した案件はありません。</p>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>スタッフ</th><th className="r">件数</th><th className="r">金額</th><th>振込先</th><th>インボイス</th><th>支払い</th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const paid = !!r.paid_at && r.paid_amount === r.amount;
                  return (
                    <tr key={r.staff_id}>
                      <td>{r.name}</td>
                      <td className="r">{r.jobs}</td>
                      <td className="r">{yen(r.amount)}</td>
                      <td className="small">{r.bank_info || <span className="pill open">未登録</span>}</td>
                      <td className="small">{r.invoice_no || "なし"}</td>
                      <td>
                        {paid ? (
                          <form action={paidAction.bind(null, r.staff_id, month, false)} className="row">
                            <span className="pill committed">支払済</span>
                            <span className="small muted num">{r.paid_at}</span>
                            <button type="submit" className="secondary">取消</button>
                          </form>
                        ) : (
                          <form action={paidAction.bind(null, r.staff_id, month, true)} className="row">
                            {r.paid_at && <span className="pill offered">金額が変わりました</span>}
                            <button type="submit">支払済にする</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div><a className="btn secondary" href={`/admin/payouts/csv?month=${month}`}>CSVをダウンロード</a></div>
        </>
      )}
    </main>
  );
}
