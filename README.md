# HM Centro Automotivo — Deploy (GitHub + Vercel)

## Segredos (igual ao sistema de licitação)

| Arquivo | Vai pro GitHub? |
|---|---|
| `.env` | **Não** (gitignore) |
| `firebase-env.js` | **Não** (gerado no build) |
| `.env.example` | Sim (só nomes, sem valores) |
| `firebase-env.example.js` | Sim (modelo vazio) |

## 1) Local (PC)

1. Copie `.env.example` → `.env`
2. Preencha as chaves Firebase (+ e-mail/senha do Authentication, opcional)
3. Rode:
   ```bash
   npm run build
   ```
4. Abra `index.html` (ou sirva a pasta). O `firebase-env.js` é criado automaticamente.

## 2) GitHub

```bash
git init
git add .
git commit -m "HM Automotivo — base com Firebase via env"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/hm-automotivo.git
git push -u origin main
```

Confirme que `.env` e `firebase-env.js` **não** entraram no commit.

## 3) Vercel

1. Importar o repositório
2. **Settings → Environment Variables** — criar as mesmas do `.env`:
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`
   - `FIREBASE_AUTH_EMAIL` (opcional)
   - `FIREBASE_AUTH_PASSWORD` (opcional)
3. Deploy — o build roda `npm run build` e gera `firebase-env.js` só no servidor.

## 4) Firebase

- Authentication → E-mail/senha → usuário criado
- Firestore rules: `allow read, write: if request.auth != null;`
- Realtime Database (se existir): `.read/.write: false`
- Em Authentication → Settings → Authorized domains: adicionar o domínio da Vercel

## Observação

Chaves Web do Firebase sempre aparecem no navegador depois do deploy (é normal). O que importa é **não versionar no GitHub** e proteger o banco com **login + regras**.
