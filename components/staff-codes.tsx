"use client";
import { useCallback, useEffect, useState } from "react";
import {
  createStaffAccount,
  getStaffAccounts,
  regenerateStaffCode,
  setStaffActive,
} from "@/app/yonetim/adisyon/actions";
import { useAction } from "@/hooks/use-action";
import { staffRoles, type StaffAccount } from "@/lib/tab/types";

/**
 * Bar / pizza login codes. Shared by the management console and the
 * Adisyon settings so the organiser can read, renew or close a code
 * from either place.
 */
export function StaffCodes() {
  const [staff, setStaff] = useState<StaffAccount[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"bar" | "pizza">("bar");
  const [copied, setCopied] = useState<string | null>(null);
  const create = useAction();
  const change = useAction();

  const load = useCallback(
    () =>
      getStaffAccounts().then(
        (r) => {
          if (r.ok) {
            setStaff(r.staff);
            setLoadError("");
          } else setLoadError(r.error);
        },
        () =>
          setLoadError("Personel listesi alınamadı. Bağlantını kontrol et."),
      ),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const copy = async (account: StaffAccount) => {
    if (!account.code) return;
    try {
      await navigator.clipboard.writeText(
        `${account.name} · Adisyon giriş kodu: ${account.code}\nhttps://collectivebysoul.com/yonetim`,
      );
      setCopied(account.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      change.setError("Kopyalanamadı. Kodu seçip kopyalayabilirsin.");
    }
  };

  return (
    <div className="ad-staff">
      <p className="ad-note">
        Bar ve pizza personeli /yonetim ekranındaki şifre alanına bu kodu
        yazar ve doğrudan Adisyon’a girer; başka hiçbir şeyi görmez. Kodlar
        burada açık durur; “Yeni kod” eskisini geçersiz kılar ve o hesabın açık
        oturumlarını kapatır.
      </p>
      {loadError && (
        <p className="ad-error" role="alert">
          {loadError}
        </p>
      )}
      {staff && staff.length > 0 && (
        <ul className="ad-staff-list">
          {staff.map((s) => (
            <li key={s.id} className={s.active ? "" : "inactive"}>
              <div className="ad-staff-main">
                <strong>{s.name}</strong>
                <small>
                  {staffRoles[s.role]} · {s.active ? "Aktif" : "Kapalı"}
                </small>
              </div>
              <code aria-label={`${s.name} giriş kodu`}>{s.code ?? "—"}</code>
              <div className="ad-staff-actions">
                <button
                  type="button"
                  className="ad-detail-button"
                  disabled={!s.code || !s.active}
                  onClick={() => void copy(s)}
                >
                  {copied === s.id ? "Kopyalandı ✓" : "Kopyala"}
                </button>
                <button
                  type="button"
                  className="ad-detail-button"
                  disabled={change.busy}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `${s.name} için yeni kod üretilsin mi? Eski kod çalışmaz.`,
                      )
                    )
                      return;
                    void change.run(
                      "Bağlantı kesildi.",
                      () => regenerateStaffCode(s.id),
                      load,
                    );
                  }}
                >
                  Yeni kod
                </button>
                <button
                  type="button"
                  className="ad-detail-button"
                  disabled={change.busy}
                  onClick={() => {
                    if (
                      s.active &&
                      !window.confirm(
                        `${s.name} girişi kapatılsın mı? Açık oturumları sonlanır.`,
                      )
                    )
                      return;
                    void change.run(
                      "Bağlantı kesildi.",
                      () => setStaffActive(s.id, !s.active),
                      load,
                    );
                  }}
                >
                  {s.active ? "Kapat" : "Aç"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {staff && !staff.length && (
        <p className="ad-note">Henüz personel girişi yok.</p>
      )}
      {change.error && (
        <p className="ad-error" role="alert">
          {change.error}
        </p>
      )}
      <form
        className="ad-staff-form"
        onSubmit={(e) => {
          e.preventDefault();
          void create.run(
            "Bağlantı kesildi. Hesap oluşturulmadı.",
            () => createStaffAccount(name, role),
            async () => {
              setName("");
              await load();
            },
          );
        }}
      >
        <label htmlFor="staff-name">Personel adı</label>
        <input
          id="staff-name"
          required
          minLength={2}
          maxLength={60}
          autoComplete="off"
          placeholder="Örn. Bar · Ece"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label htmlFor="staff-role">İstasyon</label>
        <select
          id="staff-role"
          value={role}
          onChange={(e) => setRole(e.target.value === "pizza" ? "pizza" : "bar")}
        >
          <option value="bar">Bar</option>
          <option value="pizza">Pizza</option>
        </select>
        <button className="ad-primary" disabled={create.busy}>
          {create.busy ? "Oluşturuluyor…" : "Kod oluştur"}
        </button>
        {create.error && (
          <p className="ad-error" role="alert">
            {create.error}
          </p>
        )}
      </form>
    </div>
  );
}
