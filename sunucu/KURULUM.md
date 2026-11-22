# Bildirim sunucusu kurulumu (Oracle)

1. Firebase konsolu → Proje ayarları → Hizmet hesapları → "Yeni özel anahtar oluştur". İnen JSON'u SADECE sunucuya koy:
   `sudo mkdir -p /etc/dozaj && sudo mv anahtar.json /etc/dozaj/servis-hesabi.json && sudo chmod 600 /etc/dozaj/servis-hesabi.json`
2. `mkdir -p ~/dozaj && cd ~/dozaj && npm i firebase-admin` ve `bildirim.js` dosyasını buraya kopyala.
3. Deneme: `node bildirim.js` (hata vermemeli).
4. Her dakika çalıştır: `crontab -e` → `* * * * * cd ~/dozaj && /usr/bin/node bildirim.js >> bildirim.log 2>&1`
Anahtarı sohbete, repoya veya e-postaya koyma.
