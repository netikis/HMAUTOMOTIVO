/**
 * Gera firebase-env.js a partir de variáveis de ambiente (.env local ou Vercel).
 * As chaves NÃO ficam no repositório GitHub.
 */
const fs = require('fs');
const path = require('path');

function loadDotEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  text.split(/\r?\n/).forEach(function (line) {
    const t = line.trim();
    if (!t || t.charAt(0) === '#') return;
    const i = t.indexOf('=');
    if (i < 0) return;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === '') process.env[key] = val;
  });
}

loadDotEnv();

function env() {
  for (let i = 0; i < arguments.length; i++) {
    const v = process.env[arguments[i]];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

const config = {
  apiKey: env('FIREBASE_API_KEY', 'VITE_FIREBASE_API_KEY'),
  authDomain: env('FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: env('FIREBASE_PROJECT_ID', 'VITE_FIREBASE_PROJECT_ID'),
  storageBucket: env('FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: env('FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: env('FIREBASE_APP_ID', 'VITE_FIREBASE_APP_ID'),
  email: env('FIREBASE_AUTH_EMAIL'),
  senha: env('FIREBASE_AUTH_PASSWORD')
};

const out = path.join(__dirname, '..', 'firebase-env.js');
const body =
  '/* GERADO AUTOMATICAMENTE — não edite nem commite */\n' +
  'window.HM_FIREBASE_CONFIG = ' + JSON.stringify(config, null, 2) + ';\n';

fs.writeFileSync(out, body, 'utf8');

if (!config.apiKey || !config.projectId) {
  console.warn('[build-firebase-env] Aviso: FIREBASE_API_KEY / FIREBASE_PROJECT_ID vazios.');
  process.exitCode = 1;
} else {
  console.log('[build-firebase-env] OK — projeto:', config.projectId);
}
