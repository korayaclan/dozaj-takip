const admin = require('firebase-admin');

// Tanı ucu: sırları göstermez, yalnızca adım adım "tamam / hata" döner.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const steps = [];
  const add = (ok, label, detail) => steps.push({ ok, label, detail: detail || '' });
  const { familyCode, profile, target } = req.body || {};
  if (!familyCode || !['Anne', 'Baba'].includes(profile) || !['self', 'partner'].includes(target)) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  // 1) Servis hesabı
  let db;
  try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      add(false, 'Sunucu: FIREBASE_SERVICE_ACCOUNT', 'Tanımlı değil');
      return res.status(200).json({ steps });
    }
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
    }
    db = admin.firestore();
    add(true, 'Sunucu: servis hesabı yüklendi');
  } catch (e) {
    add(false, 'Sunucu: servis hesabı geçersiz', e.message);
    return res.status(200).json({ steps });
  }

  // 2) Aile belgesi ve token'lar
  let fam;
  try {
    fam = await db.collection('families').doc(familyCode).get();
  } catch (e) {
    add(false, 'Sunucu: Firestore okunamadı', e.code || e.message);
    return res.status(200).json({ steps });
  }
  if (!fam.exists) {
    add(false, 'Aile kodu bulunamadı');
    return res.status(200).json({ steps });
  }
  const tokens = fam.data().tokens || {};
  const partner = profile === 'Anne' ? 'Baba' : 'Anne';
  add(!!tokens[profile], `Kayıtlı token: ${profile} (sen)`, tokens[profile] ? '' : 'Yok');
  add(!!tokens[partner], `Kayıtlı token: ${partner} (eşin)`, tokens[partner] ? '' : 'Yok');

  const who = target === 'self' ? profile : partner;
  const token = tokens[who];
  if (!token) {
    add(false, `Test gönderilemedi: ${who} için token yok`);
    return res.status(200).json({ steps });
  }

  // 3) Gerçek gönderim
  try {
    await admin.messaging().send({
      token,
      notification: { title: 'Test bildirimi', body: `${profile} bu bildirimi test için gönderdi.` },
      webpush: {
        headers: { Urgency: 'high' },
        notification: { icon: '/icon-192.png', badge: '/badge-96.png', tag: 'dozaj-test' }
      }
    });
    add(true, `FCM gönderimi kabul edildi → ${who}`);
  } catch (e) {
    add(false, `FCM gönderimi başarısız → ${who}`, e.code || e.message);
  }
  return res.status(200).json({ steps });
};
