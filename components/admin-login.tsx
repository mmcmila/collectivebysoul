"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { loginAdmin } from "@/app/yonetim/actions";
import { useAction } from "@/hooks/use-action";
export function AdminLogin() {
  const router = useRouter();
  const [remember, setRemember] = useState(true);
  const [code, setCode] = useState("");
  const { busy, error, run } = useAction();
  return (
    <main className="ad ad-login">
      <Link href="/" className="ad-brand">
        <Image src="/assets/brand-mark.png" alt="" width={32} height={40} />
        Soul Collective
      </Link>
      <section>
        <span className="ad-kicker">ORGANİZASYON EKİBİ</span>
        <h1>Her şey bir arada.</h1>
        <p>Katılımcılar, planlar, atölyeler ve Adisyon.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              "Bağlantı kurulamadı. Yeniden deneyebilirsin.",
              () => loginAdmin(code, remember),
              () => router.refresh(),
            );
          }}
        >
          <label htmlFor="admin-code">Şifre veya giriş kodu</label>
          <input
            id="admin-code"
            type="password"
            autoComplete="current-password"
            required
            maxLength={120}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <label className="ad-check">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Bu cihazda beni 30 gün hatırla
          </label>
          {error && (
            <p className="ad-error" role="alert">
              {error}
            </p>
          )}
          <button className="ad-primary" disabled={busy}>
            {busy ? "Kontrol ediliyor…" : "Yönetime gir →"}
          </button>
        </form>
        <small>
          İlk girişte mevcut yönetim kodunu kullan. Giriş yaptıktan sonra Hesap
          ayarları bölümünden kendi şifreni belirleyebilirsin.
        </small>
      </section>
    </main>
  );
}
