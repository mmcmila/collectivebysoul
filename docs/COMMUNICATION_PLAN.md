# Bilet iletişimi — kararlaştırılan plan
13 Eylül 2026 tarihinde kullanıcıyla kararlaştırıldı. Henüz uygulanmadı.

- Yönetim panelinde ad, e-posta ve telefon girilecek.
- Ödeme onayından sonra tek kişisel kod oluşturulacak ve otomatik markalı e-posta gönderilecek.
- Hedef gönderici: Soul Collective <bilet@collectivebysoul.com>. Resend domain/DNS doğrulaması kurulacak.
- Reply-To: collectivebysoul@gmail.com. Ayrı gelen posta kutusu kurulmuş sayılmayacak.
- Ayrı WhatsApp Business numarası yok. Mevcut numaradan kullanılacak hazır mesaj bağlantısı sohbeti açacak; organizatör Gönder'e basacak. Bu aşamada WhatsApp otomatik değil.
- Tam WhatsApp Business Platform otomasyonu sonraki aşama; numara, hesap ve şablon onayları gerekiyor.
- Gönderim durumu ve tekrar deneme yönetilecek; tekrar deneme ikinci bilet veya farklı kod oluşturmayacak.
- Kullanıcı şimdi yalnızca planın kaydedilmesini istedi; e-posta gönderimi bu değişiklikte etkinleştirilmedi.

## Kişisel kodlar
Yeni misafir kodları 5 rakamdır (10000–99999), rastgele oluşturulur, veritabanında benzersiz hash ile korunur. Çakışmada yeniden üretilir. Eski uzun kodlar geçerliliğini korur. Yönetici şifresi değişmez. Misafir girişinde IP başına 15 dakikada 10 deneme sınırı vardır.
