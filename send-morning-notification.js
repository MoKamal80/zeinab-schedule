// Sends the 9:00 AM (Cairo) push via FCM. Runs free on GitHub Actions (no Blaze plan needed).
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();

const TZ = 'Africa/Cairo';
const SITE = process.env.SITE_URL || 'https://mokamal80.github.io/zeinab-schedule';
const ORDER = ['1 PM','2 PM','3 PM','4 PM','5 PM','6 PM','7 PM','8 PM','9 PM'];
const pretty = t => t.replace(' ', ':00 '); // "3 PM" -> "3:00 PM"

(async () => {
  const now = new Date();
  const hour = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(now), 10);
  // GitHub's scheduler can run late, so accept 9:00-11:59 Cairo time and send only once per day.
  const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now); // YYYY-MM-DD
  const sentRef = db.collection('meta').doc('lastSent');
  if (!process.env.FORCE) {
    if (hour < 9 || hour > 11) { console.log(`Cairo hour is ${hour}, outside 9-11 — skipping.`); return; }
    const prev = await sentRef.get();
    if (prev.exists && prev.data().date === todayISO) { console.log('Already sent today — skipping.'); return; }
  }

  const real = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long' }).format(now);
  const today = (process.env.TEST_DAY || '').trim() || real; // manual test: type e.g. Saturday
  const items = [];
  (await db.collection('students').get()).forEach(doc => {
    const s = doc.data();
    (s.slots || []).filter(x => x.day === today).forEach(x => items.push({ name: s.name, time: x.time, academy: s.academy }));
  });
  if (!items.length) { console.log('No classes today — no notification.'); return; }
  items.sort((a, b) => ORDER.indexOf(a.time) - ORDER.indexOf(b.time));

  const title = "🌸 Good morning! Today's Schedule";
  const body =
    `You have ${items.length} ${items.length === 1 ? 'class' : 'classes'} scheduled for today:\n` +
    items.map(i => `• ${i.name} — ${pretty(i.time)} (${i.academy})`).join('\n') +
    `\n\nTap to view your full schedule.`;

  const tokenDocs = (await db.collection('fcmTokens').get()).docs;
  if (!tokenDocs.length) { console.log('No registered devices.'); return; }

  const res = await admin.messaging().sendEachForMulticast({
    tokens: tokenDocs.map(d => d.id),
    data: { title, body, url: `${SITE}/?focus=today` },
    webpush: { headers: { Urgency: 'high', TTL: '3600' } }
  });

  // remove dead tokens
  await Promise.all(res.responses.map((r, i) =>
    !r.success && /registration-token-not-registered|invalid-argument/.test(r.error?.code || '')
      ? tokenDocs[i].ref.delete() : null));
  if (res.successCount > 0 && !process.env.FORCE) await sentRef.set({ date: todayISO, at: new Date().toISOString() });
  console.log(`Sent: ${res.successCount} ok, ${res.failureCount} failed.`);
})().catch(e => { console.error(e); process.exit(1); });
