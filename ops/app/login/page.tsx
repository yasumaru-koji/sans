import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";

async function login(formData: FormData) {
  "use server";
  const ok = await signIn(String(formData.get("password") ?? ""));
  redirect(ok ? "/admin" : "/login?error=1");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="page narrow">
      <h1>本部ログイン</h1>
      <form action={login} className="card stack">
        {error && <p className="notice bad">パスワードが違います。</p>}
        <label>
          パスワード
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit">ログイン</button>
      </form>
      <p className="small muted">スタッフの方は、本部から届いた個人用のURLを開いてください。</p>
    </main>
  );
}
