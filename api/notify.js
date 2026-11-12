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

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const db = initAdmin();
    const { familyCode, senderProfile, routineName, status, time } = req.body;
    if (!familyCode || !senderProfile) return res.status(400).json({ error: 'Missing fields' });

    const partner = senderProfile === 'Anne' ? 'Baba' : 'Anne';
    const famDoc = await db.collection('families').doc(familyCode).get();
    if (!famDoc.exists) return res.status(404).json({ error: 'Family not found' });

    const tokens = famDoc.data().tokens || {};
    const targetToken = tokens[partner];

    if (!targetToken) {
      return res.status(200).json({ ok: true, skipped: 'Partner has no push token yet' });
    }

    const title = status === 'skipped'
      ? `${routineName} es geçildi`
      : `${routineName} verildi`;
    const body = status === 'skipped'
      ? `${senderProfile}, ${time} itibarıyla bugünlük es geçti.`
      : `${senderProfile} tarafından ${time}'de onaylandı.`;

    await admin.messaging().send({
      token: targetToken,
      notification: { title, body },
      webpush: {
        headers: { Urgency: 'high' },
        notification: {
          title,
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'dozaj-sync',
          renotify: true,
          vibrate: [120, 60, 120]
        }
      }
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};