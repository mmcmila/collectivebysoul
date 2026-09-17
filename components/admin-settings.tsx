"use client";
import { useState } from "react";
import { changeAdminPassword } from "@/app/yonetim/actions";
import { useAction } from "@/hooks/use-action";
import Link from "next/link";
import { StaffCodes } from "@/components/staff-codes";
export function AdminSettings() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [remember, setRemember] = useState(true);
  const [message, setMessage] = useState("");
  const { busy, error, setError, run } = useAction();
  return (
    <section
      className="ad-create ad-settings"
      id="account-settings"
      aria-labelledby="settings-title"
    >
      <h2 id="settings-title">Hesap ayarları</h2>
      <p>
        Buradan giriş şifreni değiştirebilirsin. Değişiklikten sonra diğer
        cihazlardaki oturumlar kapanır; bu cihazda açık kalırsın.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMessage("");
          if (next !== again) return setError("Yeni şifreler eşleşmiyor.");
          void run(
            "Bağlantı kurulamadı. Tekrar deneyebilirsin.",
            () => changeAdminPassword(current, next, remember),
            () => {
              setCurrent("");
              setNext("");
              setAgain("");
              setMessage(
                "Şifren değiştirildi. Bir sonraki girişte yeni şifreni kullan.",
              );
            },
          );
        }}
      >
        <label htmlFor="current-password">Mevcut şifre veya yönetim kodu</label>
        <input
          id="current-password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={120}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <label htmlFor="new-password">Yeni şifre · en az 12 karakter</label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={120}
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <label htmlFor="repeat-password">Yeni şifre tekrar</label>
        <input
          id="repeat-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={120}
          value={again}
          onChange={(e) => setAgain(e.target.value)}
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
        {message && (
          <p className="ad-success" role="status">
            {message}
          </p>
        )}
        <button className="ad-primary" disabled={busy}>
          {busy ? "Kaydediliyor…" : "Şifremi değiştir"}
        </button>
      </form>
      <div className="ad-section-heading ad-staff-heading">
        <h2 id="staff-title">Açık Hesap girişleri</h2>
        <Link href="/yonetim/hesap" className="ad-module-link">
          Açık Hesap’ı aç →
        </Link>
      </div>
      <StaffCodes />
    </section>
  );
}
