"use client";
import {GuestLanguageSwitch,useGuestLanguage} from "@/components/guest-language";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { loginGuest } from "@/app/misafir/actions";
export function GuestLogin() {
 const {language,t}=useGuestLanguage();
 const router=useRouter();
 const [code,setCode]=useState(""); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
 return <div className="gp gp-login" lang={language}><header className="gp-header"><Link href="/" className="gp-brand"><Image src="/assets/brand-mark.png" alt="" width={32} height={40}/><span>Soul Collective</span></Link><div className="gp-header-actions"><GuestLanguageSwitch/><Link href="/" className="gp-home-link">{t("Siteye dön ↗")}</Link></div></header><main className="gp-login-shell"><div className="gp-login-photo"><Image src="/assets/web/house-1.webp" alt={t("Etkinlik evinin bahçesinden gün batımı")} fill sizes="(max-width:850px) 100vw, 500px" priority/><div><span>{t("19 EYLÜL 2026")}</span><h2>{t("Birlikte güzel")}<br/> {t("bir gün.")}</h2><p>{t("Atölyeler, karşılaşmalar ve kendine ayırdığın zaman.")}</p></div></div><div className="gp-login-form"><span className="gp-eyebrow">{t("BİLETİNE ÖZEL ALAN")}</span><h1>{t("Hoş geldin.")}</h1><p>{t("Yolculuğunu planla, atölyelerini seç.")}<br/>{t("Günün sana uygun şekillensin.")}</p><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");try{const result=await loginGuest(code);if(result.error)setError(result.error);else router.refresh();}catch{setError("Bağlantı kurulamadı. Tekrar deneyebilirsin.");}finally{setBusy(false);}}}><label htmlFor="guest-code"><LockKeyhole size={15}/> {t("Kişisel giriş kodun")}</label><input id="guest-code" value={code} onChange={e=>setCode(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder={t("Sana gönderilen kod")} required maxLength={100} aria-describedby="code-help"/><small id="code-help">{t("Bilet ödemen onaylandıktan sonra sana özel ilettiğimiz kodu kullan.")}</small>{error&&<p role="alert" className="gp-error">{t(error)}</p>}<button className="gp-next" disabled={busy}>{busy?t("Kontrol ediliyor…"):t("Planıma gir")}<ArrowRight size={17}/></button></form><p className="gp-login-help">{t("Kodun eline ulaşmadı mı?")}<br/><a href="mailto:collectivebysoul@gmail.com">{t("Bize yaz ↗")}</a></p></div></main></div>;
}
