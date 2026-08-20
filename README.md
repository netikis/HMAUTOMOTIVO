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

## Vercel

Variáveis: `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID` (+ e-mail/senha opcionais).

Build: `npm run build` (gera `firebase-env.js` no servidor).
