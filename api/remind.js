const admin = require('firebase-admin');

function initAdmin() {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  return admin.firestore();
}

function getIstanbulNow() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]));
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
  const minutesOfDay = parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10);
  return { dateKey, minutesOfDay };
}

function parseMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

module.exports = async (req, res) => {
  // Güvenlik: Sadece kendi belirlediğiniz gizli anahtarla çalışsın
  if (process.env.CRON_SECRET && req.query.secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const db = initAdmin();
    const { dateKey, minutesOfDay } = getIstanbulNow();
    const familiesSnap = await db.collection('families').get();
    let sentCount = 0;

    for (const famDoc of familiesSnap.docs) {
      const data = famDoc.data();
      const routines = data.routines || [];
      const tokens = Object.values(data.tokens || {}).filter(Boolean);
      if (tokens.length === 0) continue;

      const logRef = famDoc.ref.collection('logs').doc(dateKey);
      const logSnap = await logRef.get();
      const dayLog = logSnap.exists ? logSnap.data() : {};
      const sentReminders = dayLog._reminders || {};
      const newReminders = {};

      for (const r of routines) {
        if (dayLog[r.id]) continue; // Zaten verilmiş veya es geçilmişse dokunma!

        let slotToSend = null;
        let title = '';
        let body = '';

        // 1. Sabit saatli rutinler (Örn: 07:45, 08:00, 19:45)
        const exactMin = parseMinutes(r.time);
        if (exactMin !== null) {
          const diff = minutesOfDay - exactMin;
          if (diff >= 0 && diff < 7 && !sentReminders[`${r.id}_0`]) {
            slotToSend = `${r.id}_0`;
            title = `${r.name} vakti (${r.time})`;
            body = r.priority === 'critical'
              ? 'Kritik doz zamanı geldi. Uygulamayı açıp basılı tutarak onaylayın.'
              : 'Günlük doz zamanı geldi.';
          } else if (diff >= 10 && diff < 18 && !sentReminders[`${r.id}_10`]) {
            slotToSend = `${r.id}_10`;
            title = `Hala işaretlenmedi: ${r.name}`;
            body = `Saat ${r.time} dozunun üzerinden 10 dakika geçti. Verildi mi?`;
          } else if (diff >= 20 && diff < 35 && r.priority === 'critical' && !sentReminders[`${r.id}_20`]) {
            slotToSend = `${r.id}_20`;
            title = `KRİTİK HATIRLATMA: ${r.name}`;
            body = `20 dakikadır onay bekleniyor! Lütfen kontrol edin.`;
          }
        } else if (r.time.includes('–') || r.time.includes('-')) {
          // 2. Aralık rutinleri (Örn: 10:00–17:00)
          const [startStr, endStr] = r.time.split(/[–-]/);
          const startMin = parseMinutes(startStr);
          const endMin = parseMinutes(endStr);
          if (startMin !== null && endMin !== null) {
            if (minutesOfDay >= startMin && minutesOfDay < startMin + 10 && !sentReminders[`${r.id}_start`]) {
              slotToSend = `${r.id}_start`;
              title = `${r.name} zamanı başladı`;
              body = `Bugün ${r.time} aralığında verebilirsiniz.`;
            } else if (minutesOfDay >= endMin - 90 && minutesOfDay < endMin - 75 && !sentReminders[`${r.id}_late`]) {
              slotToSend = `${r.id}_late`;
              title = `${r.name} unutulmasın`;
              body = `Gün içi penceresi kapanmak üzere (${r.time}).`;
            }
          }
        }

        if (slotToSend) {
          newReminders[slotToSend] = true;
          await admin.messaging().sendEachForMulticast({
            tokens,
            notification: { title, body },
            webpush: {
              headers: { Urgency: 'high' },
              notification: {
                title,
                body,
                icon: '/icon-192.png',
                badge: '/badge-96.png',
                tag: `dozaj-${r.id}`,
                renotify: true,
                requireInteraction: true, // Android'de dokunana kadar ekranda asılı kalır!
                vibrate: [250, 100, 250, 100, 350]
              }
            }
          });
          sentCount++;
        }
      }

      if (Object.keys(newReminders).length > 0) {
        await logRef.set({ _reminders: { ...sentReminders, ...newReminders } }, { merge: true });
      }
    }

    return res.status(200).json({ ok: true, dateKey, sentCount });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};