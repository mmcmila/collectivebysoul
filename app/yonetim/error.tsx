"use client";
import Link from "next/link";

export default function AdminError({ retry }: { retry: () => void }) {
  return (
    <main style={{ maxWidth: 540, margin: "80px auto", padding: 24 }}>
      <h1>Yönetim ekranına bağlanamadık.</h1>
      <p>Geçici bir bağlantı sorunu olabilir. Verilerin silinmedi.</p>
      <button onClick={() => retry()}>Tekrar dene</button>
      <p>
        <Link href="/yonetim">Yönetim girişine dön</Link>
      </p>
    </main>
  );
}
