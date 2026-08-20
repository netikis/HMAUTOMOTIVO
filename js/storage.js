'use strict';
/* HM Automotivo — storage local (carregar/salvar/excluidos) */

        function empresaPadrao() {
            return {
                nome: 'HM Centro Automotivo',
                cnpj: '',
                ie: '',
                telefone: '',
                email: '',
                cep: '',
                rua: '',
                numero: '',
                bairro: '',
                cidade: '',
                estado: '',
                complemento: '',
                logo: '',
                logoNaMidia: false,
                atualizadoEm: ''
            };
        }

        function empresaEstaPadrao(emp) {
            var e = emp || {};
            return !e.atualizadoEm &&
                (!e.nome || e.nome === 'HM Centro Automotivo') &&
                !e.cnpj && !e.ie && !e.telefone && !e.email &&
                !e.cep && !e.rua && !e.numero && !e.bairro &&
                !e.cidade && !e.estado && !e.complemento &&
                !e.logo && !e.logoNaMidia;
        }

        function mesclarEmpresa(localEmp, nuvemEmp, baseAtualizadoEm) {
            var L = Object.assign(empresaPadrao(), localEmp || {});
            var N = nuvemEmp ? Object.assign(empresaPadrao(), nuvemEmp) : null;
            if (!N) return L;
            if (empresaEstaPadrao(L)) return N;
            var tL = new Date(L.atualizadoEm || 0).getTime();
            var tN = new Date(N.atualizadoEm || baseAtualizadoEm || 0).getTime();
            if (!tL && tN) return N;
            return tN >= tL ? N : L;
        }

        function estadoVazio() {
            return {
                empresa: empresaPadrao(),
                clientes: [],
                atendimentos: [],
                produtos: [],
                orcamentos: [],
                caixa: [],
                caixaBanco: [],
                pendentes: [],
                caixaConfig: { inicialBalcao: 0, inicialBanco: 0 },
                excluidos: excluidosVazio()
            };
        }

        function excluidosVazio() {
            return {
                clientes: {},
                atendimentos: {},
                produtos: {},
                orcamentos: {},
                caixa: {},
                caixaBanco: {},
                pendentes: {}
            };
        }

        function excluidosInternoVazio() {
            return {
                orcamentos: {},
                caixa: {},
                caixaBanco: {},
                pendentes: {},
                funcionarios: {},
                pagamentosFuncionarios: {}
            };
        }

        function garantirExcluidosInterno(db) {
            if (!db.excluidos || typeof db.excluidos !== 'object') db.excluidos = excluidosInternoVazio();
            var base = excluidosInternoVazio();
            Object.keys(base).forEach(function (k) {
                if (!db.excluidos[k] || typeof db.excluidos[k] !== 'object' || Array.isArray(db.excluidos[k])) {
                    db.excluidos[k] = {};
                }
            });
            return db.excluidos;
        }

        function mesclarExcluidosInterno(localEx, nuvemEx) {
            var base = excluidosInternoVazio();
            var L = localEx || {};
            var N = nuvemEx || {};
            Object.keys(base).forEach(function (k) {
                base[k] = mesclarMapaExcluidos(L[k], N[k]);
            });
            return base;
        }

        function garantirExcluidos(db) {
            if (!db.excluidos || typeof db.excluidos !== 'object') db.excluidos = excluidosVazio();
            var base = excluidosVazio();
            Object.keys(base).forEach(function (k) {
                if (!db.excluidos[k] || typeof db.excluidos[k] !== 'object' || Array.isArray(db.excluidos[k])) {
                    db.excluidos[k] = {};
                }
            });
            return db.excluidos;
        }

        function marcarExcluido(db, colecao, id) {
            if (!db || !colecao || !id) return;
            /* Atendimentos, clientes e produtos ficam sempre no banco oficial */
            if (colecao === 'atendimentos' || colecao === 'clientes' || colecao === 'produtos') {
                marcarExcluidoMain(colecao, id);
                return;
            }
            var ex = canalVendas === 'interno' ? garantirExcluidosInterno(db) : garantirExcluidos(db);
            if (!ex[colecao]) ex[colecao] = {};
            ex[colecao][id] = new Date().toISOString();
        }

        function marcarExcluidoMain(colecao, id) {
            if (!colecao || !id) return;
            var main = carregarMain();
            var ex = garantirExcluidos(main);
            if (!ex[colecao]) ex[colecao] = {};
            ex[colecao][id] = new Date().toISOString();
            main.excluidos = ex;
            salvarMain(main);
        }

        function marcarExcluidoInterno(intDb, colecao, id) {
            if (!intDb || !colecao || !id) return;
            var ex = garantirExcluidosInterno(intDb);
            if (!ex[colecao]) ex[colecao] = {};
            ex[colecao][id] = new Date().toISOString();
        }

        function limparExcluido(db, colecao, id) {
            if (!db || !colecao || !id) return;
            var ex = garantirExcluidos(db);
            if (ex[colecao] && ex[colecao][id]) delete ex[colecao][id];
        }

        function mesclarMapaExcluidos(a, b) {
            var out = {};
            [a || {}, b || {}].forEach(function (map) {
                Object.keys(map).forEach(function (id) {
                    var t = new Date(map[id] || 0).getTime();
                    var tOut = new Date(out[id] || 0).getTime();
                    if (!out[id] || t >= tOut) out[id] = map[id];
                });
            });
            return out;
        }

        function mesclarExcluidos(localEx, nuvemEx) {
            var base = excluidosVazio();
            var L = localEx || {};
            var N = nuvemEx || {};
            Object.keys(base).forEach(function (k) {
                base[k] = mesclarMapaExcluidos(L[k], N[k]);
            });
            return base;
        }

        function aplicarExcluidosNaLista(lista, mapaEx) {
            if (!mapaEx) return lista || [];
            return (lista || []).filter(function (item) {
                if (!item || !item.id) return true;
                if (!mapaEx[item.id]) return true;
                var tItem = new Date(item.atualizadoEm || item.criadoEm || 0).getTime();
                var tEx = new Date(mapaEx[item.id] || 0).getTime();
                return tItem > tEx;
            });
        }

        function estadoInternoVazio() {
            return {
                produtos: [],
                orcamentos: [],
                caixa: [],
                caixaBanco: [],
                pendentes: [],
                caixaConfig: { inicialBalcao: 0, inicialBanco: 0 },
                funcionarios: [],
                pagamentosFuncionarios: [],
                excluidos: excluidosInternoVazio()
            };
        }

        function carregarInternoRaw() {
            try {
                var raw = localStorage.getItem(STORAGE_INTERNO);
                if (!raw) return estadoInternoVazio();
                return Object.assign(estadoInternoVazio(), JSON.parse(raw) || {});
            } catch (e) {
                return estadoInternoVazio();
            }
        }

        function salvarInternoRaw(data) {
            localStorage.setItem(STORAGE_INTERNO, JSON.stringify(data));
        }

        function atualizarBadgeCanal() {
            var badge = document.getElementById('badgeDb');
            var interno = canalVendas === 'interno';
            document.body.classList.toggle('canal-interno', interno);
            if (!badge) return;
            badge.classList.toggle('interno', interno);
            badge.textContent = interno
                ? 'INTERNO · hm_automotivo_interno_v1'
                : 'DB isolado · hm_automotivo_v1';
        }

        function getEmpresa(db) {
            var base = empresaPadrao();
            var emp = (db && db.empresa) ? db.empresa : (carregar().empresa || {});
            return Object.assign(base, emp || {});
        }

        function logoSrc(emp) {
            var e = emp || getEmpresa();
            return (e.logo && String(e.logo).trim()) ? e.logo : LOGO_PADRAO;
        }

        function enderecoCompleto(emp) {
            var e = emp || getEmpresa();
            var partes = [];
            var linha1 = [e.rua, e.numero].filter(Boolean).join(', ');
            if (e.complemento) linha1 += (linha1 ? ' — ' : '') + e.complemento;
            if (linha1) partes.push(linha1);
            if (e.bairro) partes.push(e.bairro);
            var cid = [e.cidade, e.estado].filter(Boolean).join('/');
            if (cid) partes.push(cid);
            if (e.cep) partes.push('CEP ' + e.cep);
            return partes.join(' · ') || '';
        }

        function htmlDadosEmpresaCabecalho(emp) {
            var e = emp || getEmpresa();
            var linhas = [];
            var stLinha = 'display:block;overflow:visible;line-height:1.3;color:#222;';

            /* 1) Endereço completo em UMA linha (no desktop; no celular quebra via CSS) */
            var endParts = [];
            var ruaNum = [e.rua, e.numero].filter(Boolean).join(', ');
            if (e.complemento) ruaNum += (ruaNum ? ' — ' : '') + e.complemento;
            if (ruaNum) endParts.push(ruaNum);
            if (e.bairro) endParts.push(e.bairro);
            var cidUf = [e.cidade, e.estado].filter(Boolean).join('/');
            if (cidUf) endParts.push(cidUf);
            if (e.cep) endParts.push('CEP ' + e.cep);
            if (endParts.length) {
                linhas.push('<span class="linha linha-end" style="' + stLinha + 'font-size:9pt;">' + esc(endParts.join(' - ')) + '</span>');
            }

            /* 2) CNPJ + Inscrição Estadual na mesma linha */
            var docs = [];
            if (e.cnpj) docs.push('CNPJ: ' + e.cnpj);
            if (e.ie) docs.push('Inscrição Estadual: ' + e.ie);
            if (docs.length) {
                linhas.push('<span class="linha linha-docs" style="' + stLinha + 'font-size:9.5pt;">' + esc(docs.join(' / ')) + '</span>');
            }

            /* 3) Telefone */
            if (e.telefone) {
                linhas.push('<span class="linha linha-tel" style="' + stLinha + 'font-size:9.5pt;font-weight:600;">Tel: ' + esc(e.telefone) + '</span>');
            }

            /* 4) E-mail */
            if (e.email) {
                linhas.push('<span class="linha linha-email" style="' + stLinha + 'font-size:9.5pt;">' + esc(e.email) + '</span>');
            }

            return linhas.join('');
        }

        function htmlCabecalhoNotaEmpresa(emp, extrasHtml) {
            var dados = htmlDadosEmpresaCabecalho(emp);
            return '<div class="nota-topo">' +
                '<table class="nota-topo-linha" style="width:100%;border-collapse:collapse;table-layout:fixed;margin:0;padding:0;">' +
                '<tr>' +
                '<td class="nota-topo-logo" style="width:42%;vertical-align:middle;padding:0 10px 0 0;">' +
                '<img src="' + esc(logoSrc(emp)) + '" alt="' + esc((emp && emp.nome) || 'HM Centro Automotivo') + '" ' +
                'style="display:block;width:100%;max-width:100%;max-height:120px;height:auto;object-fit:contain;object-position:left center;">' +
                '</td>' +
                '<td class="nota-topo-dados" style="width:58%;vertical-align:middle;padding:0;margin:0;text-align:left;' +
                'font-family:Arial,Helvetica,sans-serif;color:#222;font-size:9.5pt;line-height:1.3;">' +
                (dados || '') +
                '</td>' +
                '</tr></table>' +
                (extrasHtml || '') +
                '</div>';
        }

        function aplicarIdentidadeVisual() {
            var emp = getEmpresa();
            var src = logoSrc(emp);
            var alt = (emp.nome || 'HM Centro Automotivo') + ' — Funilaria e Pintura';
            ['logoSidebar', 'logoHero', 'previewLogoEmpresa'].forEach(function (id) {
                var el = document.getElementById(id);
                if (!el) return;
                el.src = src;
                el.alt = alt;
                el.onerror = function () { el.src = LOGO_PADRAO; };
            });
            document.title = (emp.nome || 'HM Centro Automotivo');
        }

        function preencherFormEmpresa() {
            var emp = getEmpresa();
            document.getElementById('empNome').value = emp.nome || '';
            document.getElementById('empCnpj').value = emp.cnpj || '';
            document.getElementById('empIe').value = emp.ie || '';
            document.getElementById('empTelefone').value = emp.telefone || '';
            document.getElementById('empEmail').value = emp.email || '';
            document.getElementById('empCep').value = emp.cep || '';
            document.getElementById('empRua').value = emp.rua || '';
            document.getElementById('empNumero').value = emp.numero || '';
            document.getElementById('empBairro').value = emp.bairro || '';
            document.getElementById('empCidade').value = emp.cidade || '';
            document.getElementById('empEstado').value = emp.estado || '';
            document.getElementById('empComplemento').value = emp.complemento || '';
            document.getElementById('empLogoUrl').value = (emp.logo && /^https?:\/\//i.test(emp.logo)) ? emp.logo : '';
            document.getElementById('previewLogoEmpresa').src = logoSrc(emp);
        }

        function lerEmpresaDoForm(logoAtual) {
            var atual = getEmpresa();
            var logo = logoAtual != null ? logoAtual : (atual.logo || '');
            return {
                nome: document.getElementById('empNome').value.trim() || 'HM Centro Automotivo',
                cnpj: document.getElementById('empCnpj').value.trim(),
                ie: document.getElementById('empIe').value.trim(),
                telefone: document.getElementById('empTelefone').value.trim(),
                email: document.getElementById('empEmail').value.trim(),
                cep: document.getElementById('empCep').value.trim(),
                rua: document.getElementById('empRua').value.trim(),
                numero: document.getElementById('empNumero').value.trim(),
                bairro: document.getElementById('empBairro').value.trim(),
                cidade: document.getElementById('empCidade').value.trim(),
                estado: (document.getElementById('empEstado').value || '').trim().toUpperCase(),
                complemento: document.getElementById('empComplemento').value.trim(),
                logo: logo,
                logoNaMidia: !!(logo && String(logo).startsWith('data:')),
                atualizadoEm: atual.atualizadoEm || ''
            };
        }

        function salvarEmpresaObj(emp, opts) {
            opts = opts || {};
            emp = Object.assign(empresaPadrao(), emp || {});
            emp.atualizadoEm = new Date().toISOString();
            emp.logoNaMidia = !!(emp.logo && String(emp.logo).startsWith('data:'));
            var db = carregarMain();
            db.empresa = emp;
            salvarMain(db);
            aplicarIdentidadeVisual();
            preencherFormEmpresa();
            if (!opts.semNuvem) agendarEnvioEmpresaNuvem(emp);
        }

        function carregarMain() {
            try {
                var raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) return estadoVazio();
                var data = JSON.parse(raw);
                return Object.assign(estadoVazio(), data || {});
            } catch (e) {
                return estadoVazio();
            }
        }

        function salvarMain(db) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
        }

        /* carregar/salvar: no modo interno, vendas/caixa ficam no banco interno.
           Produtos/estoque são UNIFICADOS (sempre no banco oficial). */
        function carregar() {
            var main = carregarMain();
            if (canalVendas !== 'interno') return main;
            var int = carregarInternoRaw();
            var db = Object.assign({}, main, {
                orcamentos: int.orcamentos || [],
                caixa: int.caixa || [],
                caixaBanco: int.caixaBanco || [],
                pendentes: int.pendentes || [],
                caixaConfig: int.caixaConfig || { inicialBalcao: 0, inicialBanco: 0 },
                funcionarios: int.funcionarios || [],
                pagamentosFuncionarios: int.pagamentosFuncionarios || []
            });
            db.excluidos = mesclarExcluidosInterno(int.excluidos, null);
            return db;
        }

        function salvar(db) {
            if (canalVendas !== 'interno') {
                salvarMain(db);
            } else {
                var intAtual = carregarInternoRaw();
                var exclInterno = db.excluidos
                    ? mesclarExcluidosInterno(db.excluidos, intAtual.excluidos)
                    : mesclarExcluidosInterno(intAtual.excluidos, null);
                salvarInternoRaw({
                    produtos: [], /* estoque unificado no oficial */
                    orcamentos: db.orcamentos || [],
                    caixa: db.caixa || [],
                    caixaBanco: db.caixaBanco || [],
                    pendentes: db.pendentes || [],
                    caixaConfig: db.caixaConfig || { inicialBalcao: 0, inicialBanco: 0 },
                    funcionarios: db.funcionarios != null ? db.funcionarios : (intAtual.funcionarios || []),
                    pagamentosFuncionarios: db.pagamentosFuncionarios != null
                        ? db.pagamentosFuncionarios
                        : (intAtual.pagamentosFuncionarios || []),
                    excluidos: exclInterno
                });
                var main = carregarMain();
                main.empresa = db.empresa || main.empresa;
                main.clientes = db.clientes || main.clientes;
                main.atendimentos = db.atendimentos || main.atendimentos;
                main.produtos = db.produtos || [];
                salvarMain(main);
            }
            agendarSyncAutomatico('salvar');
        }

        /* Migra produtos que estavam só no interno para o estoque oficial (uma vez) */
        function migrarProdutosInternoParaEstoqueUnificado() {
            var int = carregarInternoRaw();
            var listaInt = int.produtos || [];
            if (!listaInt.length) return 0;
            var main = carregarMain();
            var map = {};
            var porCodigo = {};

            function normCod(c) {
                return String(c || '').replace(/\D/g, '').toLowerCase();
            }
            function tempo(p) {
                return new Date((p && (p.atualizadoEm || p.criadoEm)) || 0).getTime() || 0;
            }
            function preferirNumero(a, b) {
                var na = Number(a) || 0;
                var nb = Number(b) || 0;
                return nb > na ? nb : na;
            }
            function registrar(p) {
                if (!p || !p.id) return;
                map[p.id] = p;
                var cod = normCod(p.codigo);
                if (cod) porCodigo[cod] = p.id;
            }

            (main.produtos || []).forEach(registrar);

            listaInt.forEach(function (n) {
                if (!n) return;
                var cod = normCod(n.codigo);
                var idAlvo = (n.id && map[n.id]) ? n.id : (cod && porCodigo[cod] ? porCodigo[cod] : null);
                if (!idAlvo) {
                    if (!n.id) n.id = 'hm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
                    if (!n.criadoEm) n.criadoEm = new Date().toISOString();
                    if (!n.atualizadoEm) n.atualizadoEm = n.criadoEm;
                    registrar(n);
                    return;
                }
                var L = map[idAlvo];
                var usarN = tempo(n) > tempo(L);
                var m = usarN ? Object.assign({}, L, n, { id: idAlvo }) : Object.assign({}, n, L, { id: idAlvo });
                /* preço: não ficar com zero se o outro lado tem valor */
                m.venda = preferirNumero(L.venda, n.venda);
                m.custo = preferirNumero(L.custo, n.custo);
                /* estoque: prioriza o mais recente; se ambos sem data, usa o maior */
                if (tempo(n) || tempo(L)) {
                    m.qtd = usarN ? (Number(n.qtd) || 0) : (Number(L.qtd) || 0);
                } else {
                    m.qtd = preferirNumero(L.qtd, n.qtd);
                }
                if (!m.nome) m.nome = L.nome || n.nome || '';
                if (!m.codigo) m.codigo = L.codigo || n.codigo || '';
                if (!m.unidade) m.unidade = L.unidade || n.unidade || 'un';
                m.atualizadoEm = new Date().toISOString();
                registrar(m);
            });

            main.produtos = Object.keys(map).map(function (k) { return map[k]; });
            salvarMain(main);
            int.produtos = [];
            salvarInternoRaw(int);
            return listaInt.length;
        }

