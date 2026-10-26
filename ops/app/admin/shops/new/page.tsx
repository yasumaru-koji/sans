import { ShopFields } from "@/components/ShopFields";
import { createShopAction } from "../../actions";

export default function NewShop() {
  return (
    <main className="page">
      <h1>店舗を登録</h1>
      <form action={createShopAction} className="card stack">
        <ShopFields />
        <div><button type="submit">登録する</button></div>
      </form>
    </main>
  );
}
