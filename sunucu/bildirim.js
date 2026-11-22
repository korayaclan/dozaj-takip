// Dozaj Takip bildirim gönderici (Oracle sunucusunda cron ile her dakika çalışır).
// Gizli anahtar repoda YOK: dosya yolu SERVIS_HESABI ortam değişkeniyle verilir.
const admin = require('firebase-admin');
const fs = require('fs');
const keyPath = process.env.SERVIS_HESABI || '/etc/dozaj/servis-hesabi.json';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))) });
const db = admin.firestore();

function istanbul() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { gun: `${p.year}-${p.month}-${p.day}`, dk: (+p.hour % 24) * 60 + +p.minute };
}
const dak = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim()); return m ? +m[1] * 60 + +m[2] : null; };

async function gonder(tokens, title, body, tag) {
  if (!tokens.length) return;
  const r = await admin.messaging().sendEachForMulticast({
    tokens, notification: { title, body },
    webpush: { headers: { Urgency: 'high' }, notification: { title, body, icon: '/dozaj-takip/icon-192.png', tag, renotify: true, requireInteraction: true, vibrate: [250, 100, 250] }, fcmOptions: { link: 'https://korayaclan.github.io/dozaj-takip/' } }
  });
  console.log(new Date().toISOString(), tag, `${r.successCount}/${tokens.length}`);
}

(async () => {
  const { gun, dk } = istanbul();
  const fams = await db.collection('families').get();
  for (const f of fams.docs) {
    const d = f.data(), routines = d.routines || [], tk = d.tokens || {};
    const hepsi = Object.values(tk).filter(Boolean);
    if (!hepsi.length) continue;
    const ref = f.ref.collection('logs').doc(gun), snap = await ref.get();
    const log = snap.exists ? snap.data() : {}, sent = log._reminders || {}, yeni = {};

    for (const r of routines) {
      if ((r.endedOn && r.endedOn < gun) || r.asNeeded || !r.time) continue;
      if (r.courseDays && r.startedOn) {
        const e = new Date(r.startedOn + 'T00:00:00Z'); e.setUTCDate(e.getUTCDate() + r.courseDays - 1);
        if (gun > e.toISOString().slice(0, 10) || gun < r.startedOn) continue;
      }
      if (log[r.id]) continue;
      let slot = '', title = '', body = '';
      const t = dak(r.time);
      if (t !== null) {
        const fark = dk - t;
        if (fark >= 0 && fark < 7 && !sent[r.id + '_0']) { slot = r.id + '_0'; title = `${r.name} vakti (${r.time})`; body = r.priority === 'critical' ? 'Kritik doz zamanı. Uygulamayı açıp basılı tutarak onaylayın.' : 'Doz zamanı geldi.'; }
        else if (fark >= 10 && fark < 18 && !sent[r.id + '_10']) { slot = r.id + '_10'; title = `Hâlâ işaretlenmedi: ${r.name}`; body = `${r.time} dozunun üzerinden 10 dakika geçti. Verildi mi?`; }
        else if (fark >= 20 && fark < 35 && r.priority === 'critical' && !sent[r.id + '_20']) { slot = r.id + '_20'; title = `Kritik hatırlatma: ${r.name}`; body = '20 dakikadır onay bekleniyor.'; }
      } else if (/[–-]/.test(r.time)) {
        const [a, b] = r.time.split(/[–-]/), s = dak(a), e = dak(b);
        if (s !== null && e !== null) {
          if (dk >= s && dk < s + 10 && !sent[r.id + '_start']) { slot = r.id + '_start'; title = `${r.name} zamanı başladı`; body = `Bugün ${r.time} aralığında verebilirsiniz.`; }
          else if (dk >= e - 90 && dk < e - 75 && !sent[r.id + '_late']) { slot = r.id + '_late'; title = `${r.name} unutulmasın`; body = `Zaman aralığı kapanmak üzere (${r.time}).`; }
        }
      }
      if (slot) { yeni[slot] = true; await gonder(hepsi, title, body, 'dozaj-' + r.id); }
    }

    // Kalp (teşekkür): dozu veren kişiye
    const thx = log._thx || {}, yeniThx = {};
    for (const r of routines) {
      const e = log[r.id];
      if (!e || !e.thanks || !e.thanks.by) continue;
      const key = r.id + '_' + (e.thanks.ts || 1);
      if (thx[key]) continue;
      yeniThx[key] = true;
      const alici = e.by && tk[e.by] ? [tk[e.by]] : [];
      await gonder(alici, `${e.thanks.by} teşekkür ediyor ♥`, r.name, 'kalp-' + r.id);
    }

    const yaz = {};
    if (Object.keys(yeni).length) yaz._reminders = { ...sent, ...yeni };
    if (Object.keys(yeniThx).length) yaz._thx = { ...thx, ...yeniThx };
    if (Object.keys(yaz).length) await ref.set(yaz, { merge: true });
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
