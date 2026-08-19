# HM Centro Automotivo — Deploy (GitHub + Vercel)

## Subir para o GitHub (igual M3 e Licitações)

**Forma mais fácil:** duplo clique em **`SUBIR GITHUB.bat`**

1. Digite a mensagem do commit (ou Enter para usar a padrão)
2. O script faz `git add` → `commit` → `push`
3. A Vercel publica sozinha em 1–3 minutos

- **Repositório:** https://github.com/netikis/HMAUTOMOTIVO  
- **Site:** https://hmautomotivo.vercel.app  

Lista completa de arquivos: `ARQUIVOS-PARA-GITHUB.txt`

## Segredos (igual ao sistema de licitação)

| Arquivo | Vai pro GitHub? |
|---|---|
| `.env` | **Não** (gitignore) |
| `firebase-env.js` | **Não** (gerado no build) |
| `FIREBASE/` | **Não** |
| `.env.example` | Sim (só nomes, sem valores) |
| `firebase-config.js` | Sim (config pública Web) |

## 1) Local (PC)

1. Copie `.env.example` → `.env`
2. Preencha as chaves Firebase (+ e-mail/senha do Authentication, opcional)
3. Rode:
   ```bash
   npm run build
   ```
4. Abra `index.html` (ou sirva a pasta). O `firebase-env.js` é criado automaticamente.

## 2) GitHub (manual)

```bash
git init
git add .
git commit -m "HM Automotivo — atualizacao"
git branch -M main
git remote add origin https://github.com/netikis/HMAUTOMOTIVO.git
git push -u origin main
```

Confirme que `.env`, `firebase-env.js` e `FIREBASE/` **não** entraram no commit.

## 3) Vercel

1. Importar o repositório **HMAUTOMOTIVO**
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
- Em Authentication → Settings → Authorized domains: adicionar `hmautomotivo.vercel.app`

## Observação

Chaves Web do Firebase sempre aparecem no navegador depois do deploy (é normal). O que importa é **não versionar senhas no GitHub** e proteger o banco com **login + regras**.
