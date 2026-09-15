"use client";
export default function AdminError({reset}:{reset:()=>void}){
 return <main style={{maxWidth:540,margin:"80px auto",padding:24}}><h1>Yönetim ekranına bağlanamadık.</h1><p>Geçici bir bağlantı sorunu olabilir. Verilerin silinmedi.</p><button onClick={reset}>Tekrar dene</button><p><a href="/yonetim">Yönetim girişine dön</a></p></main>;
}
