# HM Centro Automotivo — Deploy (GitHub + Vercel)

## Estrutura modular (igual Joninha / M3)

O `index.html` ficou **só com HTML**. Para alterar um bloco, mexa no arquivo certo:

| O que mudar | Arquivo |
|---|---|
| Visual / CSS | `css/app.css` |
| Caixa / Banco / Relatórios | `js/caixa.js` |
| Venda / Orçamento | `js/orcamento.js` |
| OS / Histórico / PDF / Assinatura | `js/os.js` |
| Produtos / estoque | `js/produtos.js` |
| Despesas OS / Funcionários / Finalizado | `js/interno.js` |
| Clientes | `js/clientes.js` |
| Login | `js/auth.js` |
| Nuvem / sync | `js/nuvem.js` |
| Menu / toast / KPIs | `js/ui.js` |
| Banco local | `js/storage.js` |
| Config / backup | `js/app.js` |

Guia completo: `ESTRUTURA-MODULOS.txt`

## Segurança Firebase (igual M3)

A chave em `firebase-config.js` pode ir no GitHub (é pública no navegador).  
A proteção real é **login + regras**:

| Arquivo | Função |
|---|---|
| `firestore.rules` | Fecha o banco; só usuário logado lê/grava dados HM |
| `storage.rules` | Só logado no Storage |
| `firebase.json` | Liga as regras ao Firebase CLI |
| `SEGURO-FIREBASE.txt` | Passo a passo no Console |

### Publicar as regras (obrigatório)

1. [Firebase Console](https://console.firebase.google.com/) → projeto `hmautomotivo-f29dc`
2. **Firestore → Regras** → cole `firestore.rules` → **Publicar**
3. **Storage → Regras** → cole `storage.rules` → **Publicar**
4. **Authentication** → e-mail/senha ativo + usuário da oficina
5. **Authorized domains** → `hmautomotivo.vercel.app`
6. (Recomendado) restringir a chave API aos domínios da Vercel — veja `SEGURO-FIREBASE.txt`

Sem o passo 2, qualquer pessoa com a chave Web poderia tentar ler o banco.  
Com as regras, **só quem fez login** acessa `hm_automotivo_base`, atendimentos, mídia e despesas.

## Subir para o GitHub

**Forma mais fácil:** duplo clique em **`SUBIR GITHUB.bat`**

- **Repositório:** https://github.com/netikis/HMAUTOMOTIVO  
- **Site:** https://hmautomotivo.vercel.app  

## Segredos

| Arquivo | Vai pro GitHub? |
|---|---|
| `.env` | **Não** |
| `firebase-env.js` | **Não** |
| `FIREBASE/` | **Não** |
| `firebase-config.js` | Sim (config pública Web) |
| `firestore.rules` / `storage.rules` | Sim |

## Vercel

Variáveis: `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID` (+ e-mail/senha opcionais).

Build: `npm run build` (gera `firebase-env.js` no servidor).
