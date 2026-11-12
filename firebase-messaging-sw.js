importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCL66c_rKSvUGkKxndqtam0xc8E8o9yGMs",
  authDomain: "dozaj-takip.firebaseapp.com",
  projectId: "dozaj-takip",
  storageBucket: "dozaj-takip.firebasestorage.app",
  messagingSenderId: "722903094885",
  appId: "1:722903094885:web:000aa184a96f2e6d1cd88c"
});

const messaging = firebase.messaging();

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});