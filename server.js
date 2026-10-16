/*
 * AK BLOCH — Pairing website backend
 * -----------------------------------
 * POST /api/pair { phone } -> uses Baileys to request an official WhatsApp
 * pairing code for the given number and returns it as JSON.
 * Temp sessions are deleted automatically a few minutes after creation.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const pino = require('pino');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const app = express();
app.set('trust proxy', 1); // correct client IP behind Render/Railway proxies

const PORT = process.env.PORT || 3000;
const SESSION_ROOT = path.join(__dirname, 'tmp-sessions');
const SESSION_TTL_MS = 3 * 60 * 1000; // temp session lives ~3 minutes

// ---- rate limiting: max 5 pairing requests per IP per 10 minutes ----
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const hits = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > RATE_LIMIT;
}

// sweep expired rate-limit entries every minute (unref: never blocks exit)
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of hits) {
    if (now > rec.resetAt) hits.delete(ip);
  }
}, 60 * 1000).unref();

// ---- phone validation: digits only, 10-15 chars, strip + and trunk zeros ----
function cleanPhone(raw) {
  if (typeof raw !== 'string') return null;
  let digits = raw.replace(/\D/g, '');
  digits = digits.replace(/^0+/, ''); // e.g. 0300... -> 300...
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

function ensureSessionRoot() {
  fs.mkdirSync(SESSION_ROOT, { recursive: true });
}

// ---- core: open a throwaway Baileys socket and request a pairing code ----
async function requestPairingCode(phone) {
  const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    Browsers,
  } = require('@whiskeysockets/baileys');

  ensureSessionRoot();
  const sessionId = crypto.randomBytes(8).toString('hex');
  const dir = path.join(SESSION_ROOT, sessionId);
  fs.mkdirSync(dir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(dir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: Browsers.macOS('AK BLOCH Pair'),
  });
  sock.ev.on('creds.update', saveCreds);

  const cleanup = () => {
    try {
      sock.end(undefined);
    } catch (_) {
      /* already closed */
    }
    fs.rm(dir, { recursive: true, force: true }, () => {});
    logger.info({ sessionId }, 'temp session cleaned up');
  };
  // auto-cleanup after TTL; unref so it never keeps the process alive alone
  const ttlTimer = setTimeout(cleanup, SESSION_TTL_MS);
  if (typeof ttlTimer.unref === 'function') ttlTimer.unref();

  // wait until the socket is connected to WhatsApp
  await new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('CONNECT_TIMEOUT')), 45000);
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === 'open') {
        clearTimeout(to);
        resolve();
      } else if (connection === 'close') {
        clearTimeout(to);
        const status = lastDisconnect?.error?.output?.statusCode;
        const err = new Error('CONNECTION_CLOSED');
        err.statusCode = status;
        reject(err);
      }
    });
  });

  // NOTE: phone numbers are never logged
  const code = await sock.requestPairingCode(phone);
  logger.info({ sessionId }, 'pairing code issued');
  return code;
}

// ---- routes ----
app.use(express.json({ limit: '10kb' }));
// Static files: works whether index.html is in public/ or uploaded flat at root
// (mobile uploads sometimes flatten folders — this keeps the site working either way)
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (_req, res) => {
  const p1 = path.join(__dirname, 'public', 'index.html');
  const p2 = path.join(__dirname, 'index.html');
  try {
    res.sendFile(fs.existsSync(p1) ? p1 : p2);
  } catch { res.status(404).send('index.html not found'); }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/pair', async (req, res) => {
  const ip = req.ip || 'unknown';

  if (isRateLimited(ip)) {
    return res.status(429).json({
      error: 'Bahut zyada requests! 10 minute ruk kar dobara koshish karein.',
    });
  }

  const phone = cleanPhone(req.body && req.body.phone);
  if (!phone) {
    return res.status(400).json({
      error: 'Number theek nahi hai. Country code ke saath likhein, masalan 923001234567.',
    });
  }

  try {
    const code = await requestPairingCode(phone);
    if (!code) throw new Error('NO_CODE');
    return res.json({ code });
  } catch (err) {
    logger.warn({ err: err.message }, 'pairing request failed');
    if (err.message === 'CONNECT_TIMEOUT') {
      return res.status(504).json({
        error: 'WhatsApp se connect nahi ho saka. Thodi dair baad dobara koshish karein.',
      });
    }
    if (err.statusCode === 429) {
      return res.status(429).json({
        error: 'WhatsApp ne request rok di hai. Kuch dair ruk kar dobara koshish karein.',
      });
    }
    return res.status(500).json({
      error: 'Code nahi ban saka. Number check karke dobara koshish karein.',
    });
  }
});

// ---- cleanup of any leftover temp sessions on shutdown ----
function shutdown() {
  try {
    fs.rmSync(SESSION_ROOT, { recursive: true, force: true });
  } catch (_) {
    /* ignore */
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

app.listen(PORT, () => {
  logger.info(`AK BLOCH pairing site listening on port ${PORT}`);
});
