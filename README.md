# Dozaj Takip

Şurup ve takviye dozlarını takip eden, telefona yüklenebilen (PWA) bir web uygulaması. Tek başına ya da eşle/aileyle iki telefonda anlık senkronize kullanılır.

**Canlı site:** https://korayaclan.github.io/dozaj-takip/

## Özellikler

- **Günlük rutin:** Sabah/akşam dozları saat sırasıyla listelenir; verildi / es geçildi olarak işaretlenir, geri alınabilir.
- **Kritik dozlar:** Yanlışlıkla işaretlenmesin diye basılı tutarak onaylanır.
- **Kayıt defteri:** Son 14 günün tablosu ve akışı. Geçmiş günler kilitlidir; kritik olmayan, kaydı olmayan dozlar "Bugün yok (otomatik)" sayılır.
- **Doz yönetimi:** Ekle, düzenle, sil; süresi belirsiz kürler için "Dozu sonlandır" ve "Yeniden başlat".
- **Tek başına ya da aileyle:** "Hemen başla" ile bireysel kullanım; sonradan eş/aile eklenebilir. Aile modunda Anne/Baba profilleri ortak kodla (`123-456`) eşleşir.
- **Giriş:** Aile koduyla, Google ile ya da e-posta bağlantısıyla. Hesap bağlanırsa yeni telefonda kod aramadan girilir.
- **Tek oturum:** Bir profil aynı anda tek telefonda açık kalır; "Bu telefon geçsin" ile devredilir.
- **Bildirimler:** Web push ile hatırlatma ve eşin onay bildirimi (bkz. Bilinen sınırlar).

## Teknoloji

| Katman | Kullanılan |
| --- | --- |
| Arayüz | Tek dosya `index.html`, Tailwind (CDN), vanilla JS |
| Veri ve giriş | Firebase Authentication (anonim, Google, e-posta bağlantısı), Cloud Firestore |
| Bildirim | Firebase Cloud Messaging, `firebase-messaging-sw.js` |
| Sunucu işleri | Vercel serverless fonksiyonları (`api/`) |
| Yayın | GitHub Pages (`.github/workflows/pages.yml`) |

## Dosyalar

```
index.html                 Uygulamanın tamamı
manifest.json, icon-*.png  PWA ayarları ve ikonlar
firebase-messaging-sw.js   Arka plan bildirimleri
api/notify.js              Eş onayı bildirimi gönderir
api/remind.js              Zamanı gelen doz hatırlatmalarını gönderir
api/test-push.js           "Bildirimi test et" paneli için tanı aracı
```

## Veri modeli (Firestore)

```
families/{kod}              routines[], tokens{Anne,Baba}, sessions{...}, mode?
families/{kod}/logs/{gün}   { rutinId: { status, by, time } }
users/{uid}                 { email, familyCode, profile, mode }   (hesap -> aile işaretçisi)
```

Örnek güvenlik kuralları: `users/{uid}` yalnızca sahibine açıktır; `families` ve altı giriş yapmış (anonim dahil) kullanıcılara açıktır; geri kalan her şey kapalıdır.

## Kurulum

1. Bir Firebase projesi açın; Authentication'da **Anonymous**, **Google** ve **Email/Password (Email link)** yöntemlerini etkinleştirin. Authorized domains listesine yayın alan adını ekleyin.
2. Firestore'u oluşturup yukarıdaki kuralları yayınlayın.
3. `index.html` içindeki `FIREBASE_CONFIG` ve `VAPID_KEY` değerlerini kendi projenize göre değiştirin.
4. GitHub'da **Settings → Pages → Source: GitHub Actions** seçin; `main`'e her push otomatik yayınlanır.
5. (İsteğe bağlı) Bildirimler için `api/` klasörünü Vercel'e bağlayın ve ortam değişkenlerini tanımlayın: `FIREBASE_SERVICE_ACCOUNT` (servis hesabı JSON'u) ve `/api/remind` için `CRON_SECRET`; `/api/remind`'i dakikada bir çağıracak harici bir zamanlayıcı ekleyin.

Yerelde denemek için `index.html`'i herhangi bir statik sunucuyla açmak yeterlidir.

## Bilinen sınırlar

- GitHub Pages yalnızca statik dosya sunar; bu yüzden orada çalışan sürümde `/api` bildirim sunucusu yoktur.
- Web push token kaydı bazı cihazlarda `messaging/token-subscribe-failed` hatası veriyor; araştırılıyor.
- Aile kodu 6 hanelidir; kodu bilen kişi aileye katılabilir.
- Ücretsiz Firebase planında e-posta bağlantısı günlük kotaya tabidir; Google girişi bu sınıra takılmaz.

## Lisans

Kişisel proje; henüz bir lisans belirtilmedi. Bu tıbbi bir cihaz ya da tavsiye değildir; doz bilgisi için doktorunuza ve ilaç prospektüsüne bakın.
