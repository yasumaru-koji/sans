import { STAFF_STATUS } from "@/lib/constants";
import type { Staff } from "@/lib/repo";

export function StaffFields({ staff }: { staff?: Staff }) {
  return (
    <>
      <div className="fields">
        <label>氏名（必須）<input id="name" name="name" type="text" required defaultValue={staff?.name} /></label>
        <label>ふりがな<input id="kana" name="kana" type="text" defaultValue={staff?.kana} /></label>
        <label>電話<input id="phone" name="phone" type="tel" defaultValue={staff?.phone} /></label>
        <label>メール<input id="email" name="email" type="email" defaultValue={staff?.email} /></label>
        <label>
          状態
          <select id="status" name="status" defaultValue={staff?.status ?? "active"}>
            {Object.entries(STAFF_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>業務委託契約日<input id="contract_date" name="contract_date" type="date" defaultValue={staff?.contract_date ?? ""} /></label>
        <label>インボイス登録番号<input id="invoice_no" name="invoice_no" type="text" placeholder="T1234567890123" defaultValue={staff?.invoice_no} /></label>
        <label>振込先<input id="bank_info" name="bank_info" type="text" placeholder="銀行・支店・口座番号・名義" defaultValue={staff?.bank_info} /></label>
      </div>
      <label>メモ<textarea id="staff_note" name="note" defaultValue={staff?.note} /></label>
    </>
  );
}
