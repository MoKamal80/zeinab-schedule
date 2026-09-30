/* Firebase Messaging Service Worker — must sit next to index.html */
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyB412cUA2Tb0zEzsZTCq9kEv0oGeFECPxU",
  authDomain: "zeinab-tutoring.firebaseapp.com",
  projectId: "zeinab-tutoring",
  storageBucket: "zeinab-tutoring.firebasestorage.app",
  messagingSenderId: "57119759563",
  appId: "1:57119759563:web:107fd4d113841d41e78f4e"
});

const messaging = firebase.messaging();

// Data-only messages: we build the notification ourselves so the text is exactly as sent.
messaging.onBackgroundMessage(payload => {
  const d = payload.data || {};
  return self.registration.showNotification(d.title || "🌸 Good morning! Today's Schedule", {
    body: d.body || '',
    tag: 'daily-schedule',
    renotify: true,
    data: { url: d.url || (self.registration.scope + '?focus=today') }
  });
});

// Tap → open (or focus) the site and jump to today's highlighted row.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || (self.registration.scope + '?focus=today');
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) {
          c.postMessage({ type: 'FOCUS_TODAY' });
          return c.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
