import { StaffFields } from "@/components/StaffFields";
import { createStaffAction } from "../../actions";

export default function NewStaff() {
  return (
    <main className="page">
      <h1>スタッフを登録</h1>
      <form action={createStaffAction} className="card stack">
        <StaffFields />
        <p className="small muted">登録すると、このスタッフ専用のURLが発行されます。LINEなどで本人に送ると、稼働予定の登録と案件への回答ができます。</p>
        <div><button type="submit">登録する</button></div>
      </form>
    </main>
  );
}
