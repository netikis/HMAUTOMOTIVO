'use strict';
/* HM Automotivo — caixa / banco / pendentes / relatorios */

        /* ---------- Caixa / Relatórios (modelo FH Control) ---------- */
        function getCaixaConfig(db) {
            return Object.assign({ inicialBalcao: 0, inicialBanco: 0 }, (db && db.caixaConfig) || {});
        }

        function somarLista(lista, tipo) {
            return (lista || []).filter(function (x) { return x.tipo === tipo; })
                .reduce(function (s, x) { return s + (Number(x.valor) || 0); }, 0);
        }

        document.getElementById('btnCxInicial').addEventListener('click', function () {
            var db = carregar();
            var cfg = getCaixaConfig(db);
            var v = prompt('Informe o caixa inicial do dia (R$):', String(cfg.inicialBalcao || 0).replace('.', ','));
            if (v == null) return;
            cfg.inicialBalcao = parseMoeda(v);
            db.caixaConfig = cfg;
            salvar(db);
            toast('Caixa inicial do balcão atualizado.');
            renderCaixa();
            atualizarKPIs(db);
        });

        document.getElementById('btnCxFocoEntrada').addEventListener('click', function () {
            document.getElementById('cxTipo').value = 'entrada';
            document.getElementById('cxDesc').focus();
        });

        document.getElementById('formCaixa').addEventListener('submit', function (e) {
            e.preventDefault();
            var db = carregar();
            if (!db.caixa) db.caixa = [];
            db.caixa.push({
                id: uid(),
                tipo: document.getElementById('cxTipo').value,
                descricao: document.getElementById('cxDesc').value.trim(),
                valor: parseMoeda(document.getElementById('cxValor').value),
                forma: document.getElementById('cxForma').value,
                conta: 'balcao',
                criadoEm: new Date().toISOString()
            });
            salvar(db);
            document.getElementById('formCaixa').reset();
            toast('Lançamento no balcão registrado.');
            renderCaixa();
            atualizarKPIs(db);
        });

        function renderCaixa() {
            var db = carregar();
            var cfg = getCaixaConfig(db);
            var lista = db.caixa || [];
            var entradas = somarLista(lista, 'entrada');
            var saidas = somarLista(lista, 'saida');
            var inicial = Number(cfg.inicialBalcao) || 0;
            document.getElementById('cxInicial').textContent = moeda(inicial);
            document.getElementById('cxEntradas').textContent = moeda(entradas);
            document.getElementById('cxSaidas').textContent = moeda(saidas);
            document.getElementById('cxSaldo').textContent = moeda(inicial + entradas - saidas);

            var tb = document.getElementById('tabelaCaixa');
            tb.innerHTML = '';
            if (typeof gerarArvorePastasCaixa === 'function') {
                gerarArvorePastasCaixa({ elId: 'arvorePastasBalcao', filtro: 'balcao', idPrefix: 'pasta_bal' });
            }
            if (!lista.length) {
                tb.innerHTML = '<tr><td colspan="6" class="muted">Sem lançamentos no balcão.</td></tr>';
                return;
            }
            lista.slice().reverse().forEach(function (x) {
                var tr = document.createElement('tr');
                var desc = x.descricao || '—';
                if (x.atendimentoId && x.osResumo) {
                    desc = '[OS ' + (x.osResumo.placa || '') + '] ' + desc;
                }
                tr.innerHTML =
                    '<td>' + esc(fmtData(x.criadoEm)) + '</td>' +
                    '<td>' + esc(x.tipo) + '</td>' +
                    '<td>' + esc(desc) + '</td>' +
                    '<td>' + esc(x.forma) + '</td>' +
                    '<td>' + moeda(x.valor) + '</td>' +
                    '<td class="actions"><button type="button" class="btn btn-danger" data-ex="' + x.id + '">Excluir</button></td>';
                tb.appendChild(tr);
            });
            tb.querySelectorAll('[data-ex]').forEach(function (b) {
                b.addEventListener('click', function () {
                    if (!confirm('Excluir lançamento do balcão?')) return;
                    var db2 = carregar();
                    var idEx = b.getAttribute('data-ex');
                    marcarExcluido(db2, 'caixa', idEx);
                    db2.caixa = (db2.caixa || []).filter(function (x) { return x.id !== idEx; });
                    salvar(db2);
                    renderCaixa();
                    if (canalVendas === 'interno') {
                        renderDespesasOs();
                        if (despesaOsSelecionadaId) renderDespesasOsDetalhe(despesaOsSelecionadaId);
                    }
                    atualizarKPIs(db2);
                });
            });
        }

        document.getElementById('btnBkInicial').addEventListener('click', function () {
            var db = carregar();
            var cfg = getCaixaConfig(db);
            var v = prompt('Informe o saldo inicial do banco (R$):', String(cfg.inicialBanco || 0).replace('.', ','));
            if (v == null) return;
            cfg.inicialBanco = parseMoeda(v);
            db.caixaConfig = cfg;
            salvar(db);
            toast('Saldo inicial do banco atualizado.');
            renderCaixaBanco();
            atualizarKPIs(db);
        });

        document.getElementById('formBanco').addEventListener('submit', function (e) {
            e.preventDefault();
            var db = carregar();
            if (!db.caixaBanco) db.caixaBanco = [];
            db.caixaBanco.push({
                id: uid(),
                tipo: document.getElementById('bkTipo').value,
                descricao: document.getElementById('bkDesc').value.trim(),
                valor: parseMoeda(document.getElementById('bkValor').value),
                forma: document.getElementById('bkForma').value,
                conta: 'banco',
                criadoEm: new Date().toISOString()
            });
            salvar(db);
            document.getElementById('formBanco').reset();
            toast('Lançamento no banco registrado.');
            renderCaixaBanco();
            atualizarKPIs(db);
        });

        function renderCaixaBanco() {
            var db = carregar();
            var cfg = getCaixaConfig(db);
            var lista = db.caixaBanco || [];
            var entradas = somarLista(lista, 'entrada');
            var saidas = somarLista(lista, 'saida');
            var inicial = Number(cfg.inicialBanco) || 0;
            document.getElementById('bkInicial').textContent = moeda(inicial);
            document.getElementById('bkEntradas').textContent = moeda(entradas);
            document.getElementById('bkSaidas').textContent = moeda(saidas);
            document.getElementById('bkSaldo').textContent = moeda(inicial + entradas - saidas);

            var tb = document.getElementById('tabelaBanco');
            tb.innerHTML = '';
            if (typeof gerarArvorePastasCaixa === 'function') {
                gerarArvorePastasCaixa({ elId: 'arvorePastasBanco', filtro: 'banco', idPrefix: 'pasta_ban' });
            }
            if (!lista.length) {
                tb.innerHTML = '<tr><td colspan="6" class="muted">Sem lançamentos no banco.</td></tr>';
                return;
            }
            lista.slice().reverse().forEach(function (x) {
                var tr = document.createElement('tr');
                tr.innerHTML =
                    '<td>' + esc(fmtData(x.criadoEm)) + '</td>' +
                    '<td>' + esc(x.tipo) + '</td>' +
                    '<td>' + esc(x.descricao) + '</td>' +
                    '<td>' + esc(x.forma) + '</td>' +
                    '<td>' + moeda(x.valor) + '</td>' +
                    '<td class="actions"><button type="button" class="btn btn-danger" data-ex="' + x.id + '">Excluir</button></td>';
                tb.appendChild(tr);
            });
            tb.querySelectorAll('[data-ex]').forEach(function (b) {
                b.addEventListener('click', function () {
                    if (!confirm('Excluir lançamento do banco?')) return;
                    var db2 = carregar();
                    var idEx = b.getAttribute('data-ex');
                    marcarExcluido(db2, 'caixaBanco', idEx);
                    db2.caixaBanco = (db2.caixaBanco || []).filter(function (x) { return x.id !== idEx; });
                    salvar(db2);
                    renderCaixaBanco();
                    atualizarKPIs(db2);
                });
            });
        }

        document.getElementById('formPendente').addEventListener('submit', function (e) {
            e.preventDefault();
            var db = carregar();
            if (!db.pendentes) db.pendentes = [];
            db.pendentes.push({
                id: uid(),
                cliente: document.getElementById('pdCliente').value.trim(),
                descricao: document.getElementById('pdDesc').value.trim(),
                valor: parseMoeda(document.getElementById('pdValor').value),
                vencimento: document.getElementById('pdVenc').value,
                status: 'aberto',
                criadoEm: new Date().toISOString()
            });
            salvar(db);
            document.getElementById('formPendente').reset();
            toast('Conta pendente adicionada.');
            renderPendentes();
        });

        function receberPendente(id, destino) {
            var db = carregar();
            var i = (db.pendentes || []).findIndex(function (p) { return p.id === id; });
            if (i < 0) return;
            var p = db.pendentes[i];
            var lanc = {
                id: uid(),
                tipo: 'entrada',
                descricao: p.cliente + ' — ' + p.descricao,
                valor: Number(p.valor) || 0,
                forma: destino === 'banco' ? 'PIX' : 'Dinheiro',
                conta: destino,
                pendenteId: p.id,
                criadoEm: new Date().toISOString()
            };
            if (destino === 'banco') {
                if (!db.caixaBanco) db.caixaBanco = [];
                db.caixaBanco.push(lanc);
            } else {
                if (!db.caixa) db.caixa = [];
                db.caixa.push(lanc);
            }
            marcarExcluido(db, 'pendentes', p.id);
            db.pendentes.splice(i, 1);
            salvar(db);
            toast('Recebido no ' + (destino === 'banco' ? 'banco' : 'balcão') + '.');
            renderPendentes();
            renderCaixa();
            renderCaixaBanco();
            atualizarKPIs(db);
        }

        function renderPendentes() {
            var db = carregar();
            var lista = (db.pendentes || []).filter(function (p) { return p.status !== 'pago'; });
            var total = lista.reduce(function (s, p) { return s + (Number(p.valor) || 0); }, 0);
            document.getElementById('pdTotal').textContent = moeda(total);
            document.getElementById('pdQtd').textContent = String(lista.length);
            var tb = document.getElementById('tabelaPendentes');
            tb.innerHTML = '';
            if (typeof gerarArvorePastasCaixa === 'function') {
                gerarArvorePastasCaixa({ elId: 'arvorePastasPendentes', filtro: 'pendentes', idPrefix: 'pasta_pen' });
            }
            if (!lista.length) {
                tb.innerHTML = '<tr><td colspan="5" class="muted">Nenhuma conta pendente.</td></tr>';
                return;
            }
            lista.slice().reverse().forEach(function (p) {
                var tr = document.createElement('tr');
                tr.innerHTML =
                    '<td>' + esc(p.cliente) + '</td>' +
                    '<td>' + esc(p.descricao) + '</td>' +
                    '<td>' + esc(fmtData(p.vencimento)) + '</td>' +
                    '<td>' + moeda(p.valor) + '</td>' +
                    '<td class="actions">' +
                    '<button type="button" class="btn btn-ok" data-rec-b="' + p.id + '">Receber balcão</button>' +
                    '<button type="button" class="btn btn-primary" data-rec-k="' + p.id + '">Receber banco</button>' +
                    '<button type="button" class="btn btn-danger" data-ex="' + p.id + '">Excluir</button>' +
                    '</td>';
                tb.appendChild(tr);
            });
            tb.querySelectorAll('[data-rec-b]').forEach(function (b) {
                b.addEventListener('click', function () { receberPendente(b.getAttribute('data-rec-b'), 'balcao'); });
            });
            tb.querySelectorAll('[data-rec-k]').forEach(function (b) {
                b.addEventListener('click', function () { receberPendente(b.getAttribute('data-rec-k'), 'banco'); });
            });
            tb.querySelectorAll('[data-ex]').forEach(function (b) {
                b.addEventListener('click', function () {
                    if (!confirm('Excluir pendente?')) return;
                    var db2 = carregar();
                    var idEx = b.getAttribute('data-ex');
                    marcarExcluido(db2, 'pendentes', idEx);
                    db2.pendentes = (db2.pendentes || []).filter(function (x) { return x.id !== idEx; });
                    salvar(db2);
                    renderPendentes();
                });
            });
        }

        /* ---------- Relatório mensal + pastas (modelo FH Control) ---------- */
        var MES_NOMES_CX = {
            '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
            '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
            '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
        };
        var REL_MES_TITULOS = {
            geral: 'RELATÓRIO MENSAL GERAL (BALCÃO + BANCO + CONTAS A RECEBER)',
            balcao: 'RELATÓRIO MENSAL — CAIXA / BALCÃO',
            banco: 'RELATÓRIO MENSAL — CAIXA BANCO (PIX / CARTÕES)',
            pendentes: 'RELATÓRIO MENSAL — CONTAS A RECEBER'
        };
        var REL_MES_PREFIXO = {
            geral: 'Relatorio-Geral',
            balcao: 'Relatorio-Balcao',
            banco: 'Relatorio-Banco',
            pendentes: 'Relatorio-ContasReceber'
        };

        function mesAnoDeIso(iso) {
            if (!iso) return '';
            var s = String(iso).trim();
            if (/^\d{4}-\d{2}/.test(s)) return s.slice(5, 7) + '/' + s.slice(0, 4);
            var limpa = s.split(/[\s,]/)[0];
            var p = limpa.split('/');
            if (p.length === 3) return p[1].padStart(2, '0') + '/' + p[2].slice(0, 4);
            return '';
        }

        function mesAnoAtualPadrao() {
            var d = new Date();
            return String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
        }

        function pastaMesLabel(mesAno) {
            var p = String(mesAno || '').split('/');
            if (p.length !== 2) return mesAno;
            return (MES_NOMES_CX[p[0]] || p[0]) + ' / ' + p[1];
        }

        function coletarItensRelatorioMensal(db, filtro, mesAno) {
            filtro = filtro || 'geral';
            mesAno = String(mesAno || '').trim();
            var itens = [];

            function pushLanc(x, canal) {
                if (!x) return;
                var ma = mesAnoDeIso(x.criadoEm);
                if (ma !== mesAno) return;
                var desc = x.descricao || '';
                if (x.atendimentoId && x.osResumo) {
                    desc = '[OS ' + (x.osResumo.placa || '') + '] ' + desc;
                }
                itens.push({
                    data: fmtData(x.criadoEm),
                    doc: x.atendimentoId ? 'OS' : (canal === 'banco' ? 'BANCO' : 'CX'),
                    tipo: x.tipo === 'saida' ? 'SAÍDA' : 'ENTRADA',
                    descricao: desc,
                    forma: x.forma || '—',
                    valor: Number(x.valor) || 0,
                    natureza: x.tipo === 'saida' ? 'SAIDA' : 'ENTRADA',
                    canal: canal
                });
            }

            (db.caixa || []).forEach(function (x) { pushLanc(x, 'balcao'); });
            (db.caixaBanco || []).forEach(function (x) { pushLanc(x, 'banco'); });

            (db.pendentes || []).forEach(function (p) {
                if (!p || p.status === 'pago') return;
                var ref = p.criadoEm || p.vencimento;
                var ma = mesAnoDeIso(ref);
                if (!ma && p.vencimento) {
                    var v = String(p.vencimento);
                    if (/^\d{4}-\d{2}/.test(v)) ma = v.slice(5, 7) + '/' + v.slice(0, 4);
                }
                if (ma !== mesAno) return;
                itens.push({
                    data: fmtData(ref) || (p.vencimento || '—'),
                    doc: 'PEND',
                    tipo: 'A RECEBER',
                    descricao: (p.cliente ? p.cliente + ' — ' : '') + (p.descricao || ''),
                    forma: p.vencimento ? ('Venc. ' + fmtData(p.vencimento)) : '—',
                    valor: Number(p.valor) || 0,
                    natureza: 'PENDENTE',
                    canal: 'pendente'
                });
            });

            itens = itens.filter(function (it) {
                if (filtro === 'pendentes') return it.natureza === 'PENDENTE';
                if (filtro === 'balcao') return it.canal === 'balcao' && it.natureza !== 'PENDENTE';
                if (filtro === 'banco') return it.canal === 'banco' && it.natureza !== 'PENDENTE';
                return true;
            });

            itens.sort(function (a, b) {
                var da = String(a.data).split('/').reverse().join('');
                var db2 = String(b.data).split('/').reverse().join('');
                return da.localeCompare(db2);
            });
            return itens;
        }

        function montarHtmlSecoesRelatorioMes(itens, filtro) {
            var totE = 0, totS = 0, totP = 0;
            var linE = '', linS = '', linP = '';
            itens.forEach(function (item) {
                var linha =
                    '<tr>' +
                    '<td style="padding:6px;border-bottom:1px solid #ddd;width:70px">' + esc(item.data) + '</td>' +
                    '<td style="padding:6px;border-bottom:1px solid #ddd;width:60px">' + esc(item.doc) + '</td>' +
                    '<td style="padding:6px;border-bottom:1px solid #ddd;font-size:9px;width:80px">' + esc(item.tipo) + '</td>' +
                    '<td style="padding:6px;border-bottom:1px solid #ddd">' + esc(item.descricao) +
                    '<br><small style="color:#777">' + esc(item.forma) + '</small></td>';
                if (item.natureza === 'PENDENTE') {
                    totP += item.valor;
                    linP += linha + '<td style="padding:6px;border-bottom:1px solid #ddd;color:#d35400;font-weight:bold;text-align:right">' +
                        moeda(item.valor) + '</td></tr>';
                } else if (item.natureza === 'ENTRADA') {
                    totE += item.valor;
                    linE += linha + '<td style="padding:6px;border-bottom:1px solid #ddd;color:#27ae60;font-weight:bold;text-align:right">+ ' +
                        moeda(item.valor) + '</td></tr>';
                } else {
                    totS += item.valor;
                    linS += linha + '<td style="padding:6px;border-bottom:1px solid #ddd;color:#e74c3c;font-weight:bold;text-align:right">- ' +
                        moeda(item.valor) + '</td></tr>';
                }
            });
            if (!linE) linE = '<tr><td colspan="5" style="padding:10px;text-align:center;color:#777">Nenhuma entrada neste período.</td></tr>';
            if (!linS) linS = '<tr><td colspan="5" style="padding:10px;text-align:center;color:#777">Nenhuma saída neste período.</td></tr>';
            if (!linP) linP = '<tr><td colspan="5" style="padding:10px;text-align:center;color:#777">Nenhum pendente neste período.</td></tr>';

            var resumo;
            if (filtro === 'pendentes') {
                resumo =
                    '<div class="resumo"><div class="resumo-box" style="color:#f39c12">TOTAL A RECEBER<b>' + moeda(totP) + '</b></div></div>';
            } else {
                resumo =
                    '<div class="resumo">' +
                    '<div class="resumo-box" style="color:#27ae60">RECEBIMENTOS / ENTRADAS<b>' + moeda(totE) + '</b></div>' +
                    '<div class="resumo-box" style="color:#e74c3c">PAGAMENTOS / SAÍDAS<b>' + moeda(totS) + '</b></div>' +
                    '<div class="resumo-box" style="color:#2980b9">SALDO LÍQUIDO DO MÊS<b>' + moeda(totE - totS) + '</b></div>' +
                    '</div>';
            }

            var secE =
                '<div class="section-title entrada"><span>ENTRADAS (RECEBIMENTOS)</span><span>TOTAL: ' + moeda(totE) + '</span></div>' +
                '<table><thead><tr><th>Data</th><th>Doc</th><th>Tipo</th><th>Descrição / Forma</th><th style="text-align:right">Valor</th></tr></thead>' +
                '<tbody>' + linE + '</tbody></table>';
            var secS =
                '<div class="section-title saida"><span>SAÍDAS E DESPESAS</span><span>TOTAL: ' + moeda(totS) + '</span></div>' +
                '<table><thead><tr><th>Data</th><th>Doc</th><th>Tipo</th><th>Descrição / Motivo</th><th style="text-align:right">Valor</th></tr></thead>' +
                '<tbody>' + linS + '</tbody></table>';
            var secP =
                '<div class="section-title pendente"><span>CONTAS A RECEBER</span><span>TOTAL: ' + moeda(totP) + '</span></div>' +
                '<table><thead><tr><th>Data</th><th>Doc</th><th>Tipo</th><th>Cliente / Vencimento</th><th style="text-align:right">Valor</th></tr></thead>' +
                '<tbody>' + linP + '</tbody></table>';

            var secoes;
            if (filtro === 'pendentes') secoes = secP;
            else if (filtro === 'entradas') secoes = secE;
            else if (filtro === 'saidas') secoes = secS;
            else if (filtro === 'geral') secoes = secE + secS + secP;
            else secoes = secE + secS;

            return {
                html: resumo + secoes,
                totEntradas: totE,
                totSaidas: totS,
                totPendentes: totP,
                saldo: totE - totS
            };
        }

        function gerarRelatorioMensalPDF(filtro, mesAnoFixo) {
            filtro = filtro || 'geral';
            var mesAno = mesAnoFixo || prompt('Digite o mês e ano do relatório (Ex: 07/2026):', mesAnoAtualPadrao());
            if (!mesAno) return;
            mesAno = String(mesAno).trim();
            if (!/^\d{2}\/\d{4}$/.test(mesAno)) {
                alert('Use o formato MM/AAAA (Ex: 07/2026).');
                return;
            }
            var db = carregar();
            var emp = getEmpresa(db);
            var itens = coletarItensRelatorioMensal(db, filtro, mesAno);
            if (!itens.length) {
                alert('Nenhum registro encontrado para o período: ' + mesAno);
                return;
            }
            var montado = montarHtmlSecoesRelatorioMes(itens, filtro);
            var titulo = REL_MES_TITULOS[filtro] || REL_MES_TITULOS.geral;
            var html =
                '<div class="nota-espelho relatorio-mensal-print">' +
                htmlCabecalhoNotaEmpresa(emp,
                    '<div class="nota-sub nota-titulo-espelho">' + esc(titulo) + '</div>' +
                    '<div class="nota-sub">Competência: ' + esc(mesAno) + ' · ' + esc(pastaMesLabel(mesAno)) + '</div>'
                ) +
                '<style>' +
                '.relatorio-mensal-print .resumo{display:flex;justify-content:space-around;flex-wrap:wrap;gap:10px;background:#f4f4f4;padding:12px;border:1px solid #ccc;margin:12px 0}' +
                '.relatorio-mensal-print .resumo-box{text-align:center;font-size:11px}' +
                '.relatorio-mensal-print .resumo-box b{display:block;font-size:14px;margin-top:4px}' +
                '.relatorio-mensal-print .section-title{padding:8px 10px;font-size:11px;font-weight:bold;margin-top:18px;text-transform:uppercase;border-radius:4px 4px 0 0;display:flex;justify-content:space-between;color:#fff}' +
                '.relatorio-mensal-print .section-title.entrada{background:#27ae60}' +
                '.relatorio-mensal-print .section-title.saida{background:#e74c3c}' +
                '.relatorio-mensal-print .section-title.pendente{background:#f39c12}' +
                '.relatorio-mensal-print table{width:100%;border-collapse:collapse;margin-bottom:8px;font-size:11px}' +
                '.relatorio-mensal-print th{background:#ecf0f1;color:#111;padding:8px;text-align:left;font-size:10px;border-bottom:2px solid #bdc3c7}' +
                '</style>' +
                montado.html +
                '<div style="text-align:center;margin-top:24px;font-size:9px;color:#777">' +
                'Documento gerado pelo HM Centro Automotivo em ' + esc(new Date().toLocaleString('pt-BR')) +
                '</div></div>';
            executarImpressaoHtml(html);
        }

        function montarArvoreCaixaDados(db) {
            var arvore = {};
            function addDoc(iso, item) {
                var ma = mesAnoDeIso(iso);
                if (!ma) return;
                var p = ma.split('/');
                var ano = p[1];
                var mesNum = p[0];
                var mesNome = MES_NOMES_CX[mesNum] || mesNum;
                if (!arvore[ano]) arvore[ano] = {};
                if (!arvore[ano][mesNome]) {
                    arvore[ano][mesNome] = { mesNum: mesNum, mesAno: ma, entradas: [], saidas: [], pendentes: [] };
                }
                var bucket = arvore[ano][mesNome];
                if (item.natureza === 'ENTRADA') bucket.entradas.push(item);
                else if (item.natureza === 'SAIDA') bucket.saidas.push(item);
                else bucket.pendentes.push(item);
            }

            (db.caixa || []).forEach(function (x) {
                addDoc(x.criadoEm, {
                    data: fmtData(x.criadoEm),
                    descricao: x.descricao || '—',
                    forma: x.forma || '—',
                    valor: Number(x.valor) || 0,
                    natureza: x.tipo === 'saida' ? 'SAIDA' : 'ENTRADA',
                    origem: 'Balcão'
                });
            });
            (db.caixaBanco || []).forEach(function (x) {
                addDoc(x.criadoEm, {
                    data: fmtData(x.criadoEm),
                    descricao: x.descricao || '—',
                    forma: x.forma || '—',
                    valor: Number(x.valor) || 0,
                    natureza: x.tipo === 'saida' ? 'SAIDA' : 'ENTRADA',
                    origem: 'Banco'
                });
            });
            (db.pendentes || []).forEach(function (p) {
                if (!p || p.status === 'pago') return;
                var ref = p.criadoEm || p.vencimento;
                addDoc(ref, {
                    data: fmtData(ref),
                    descricao: (p.cliente ? p.cliente + ' — ' : '') + (p.descricao || '—'),
                    forma: p.vencimento ? ('Venc. ' + fmtData(p.vencimento)) : '—',
                    valor: Number(p.valor) || 0,
                    natureza: 'PENDENTE',
                    origem: 'Pendente'
                });
            });
            return arvore;
        }

        function htmlItensPastaCx(lista, classeValor) {
            if (!lista || !lista.length) {
                return '<div class="muted" style="padding:6px 0">Nenhum lançamento nesta pasta.</div>';
            }
            return lista.map(function (it) {
                return '<div class="pasta-cx-item">' +
                    '<span><strong>[' + esc(it.origem || '') + ']</strong> ' + esc(it.data) + ' · ' + esc(it.descricao) +
                    ' <small class="muted">(' + esc(it.forma) + ')</small></span>' +
                    '<span class="' + classeValor + '">' + moeda(it.valor) + '</span></div>';
            }).join('');
        }

        function togglePastaCaixa(id) {
            var el = document.getElementById(id);
            if (!el) return;
            el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'block' : 'none';
        }
        window.togglePastaCaixa = togglePastaCaixa;

        function filtrarItensArvoreCaixa(lista, filtro) {
            if (!lista) return [];
            if (filtro === 'balcao') return lista.filter(function (x) { return x.origem === 'Balcão'; });
            if (filtro === 'banco') return lista.filter(function (x) { return x.origem === 'Banco'; });
            if (filtro === 'pendentes') return lista.filter(function (x) { return x.origem === 'Pendente'; });
            return lista.slice();
        }

        function gerarArvorePastasCaixa(opts) {
            opts = opts || {};
            var elId = opts.elId || 'arvorePastasCaixa';
            var filtro = opts.filtro || 'geral';
            var idPrefix = opts.idPrefix || 'pasta_cx';
            var el = document.getElementById(elId);
            if (!el) return;
            var db = carregar();
            var arvoreFull = montarArvoreCaixaDados(db);
            var arvore = {};
            Object.keys(arvoreFull).forEach(function (ano) {
                Object.keys(arvoreFull[ano]).forEach(function (mesNome) {
                    var b = arvoreFull[ano][mesNome];
                    var entradas = filtrarItensArvoreCaixa(b.entradas, filtro);
                    var saidas = filtrarItensArvoreCaixa(b.saidas, filtro);
                    var pendentes = filtrarItensArvoreCaixa(b.pendentes, filtro);
                    if (filtro === 'pendentes') {
                        entradas = [];
                        saidas = [];
                    } else if (filtro === 'balcao' || filtro === 'banco') {
                        pendentes = [];
                    }
                    if (!entradas.length && !saidas.length && !pendentes.length) return;
                    if (!arvore[ano]) arvore[ano] = {};
                    arvore[ano][mesNome] = {
                        mesNum: b.mesNum,
                        mesAno: b.mesAno,
                        entradas: entradas,
                        saidas: saidas,
                        pendentes: pendentes
                    };
                });
            });
            var anos = Object.keys(arvore).sort().reverse();
            if (!anos.length) {
                el.innerHTML = '<div class="muted" style="padding:10px;text-align:center">Ainda não há lançamentos para montar as pastas do mês.</div>';
                return;
            }
            var html = '';
            var idc = 0;
            anos.forEach(function (ano) {
                idc++;
                var idAno = idPrefix + '_ano_' + idc;
                html += '<div class="pasta-cx-ano" onclick="togglePastaCaixa(\'' + idAno + '\')">📁 Ano: ' + esc(ano) + '</div>';
                html += '<div id="' + idAno + '" style="display:none">';
                Object.keys(arvore[ano]).forEach(function (mesNome) {
                    var bucket = arvore[ano][mesNome];
                    idc++;
                    var idMes = idPrefix + '_mes_' + idc;
                    var totE = bucket.entradas.reduce(function (s, x) { return s + x.valor; }, 0);
                    var totS = bucket.saidas.reduce(function (s, x) { return s + x.valor; }, 0);
                    var totP = bucket.pendentes.reduce(function (s, x) { return s + x.valor; }, 0);
                    var resumoMes = filtro === 'pendentes'
                        ? ('a receber ' + moeda(totP))
                        : ('saldo ' + moeda(totE - totS));
                    html += '<div class="pasta-cx-mes" onclick="togglePastaCaixa(\'' + idMes + '\')">📂 Mês: ' +
                        esc(mesNome) + ' <small style="font-weight:500;opacity:.85">(' + esc(bucket.mesAno) +
                        ' · ' + resumoMes + ')</small></div>';
                    html += '<div class="pasta-cx-mes-acoes">' +
                        '<button type="button" class="btn btn-pdf" style="padding:6px 10px;font-size:12px" data-rel-mes-fixo="' +
                        esc(bucket.mesAno) + '" data-rel-mes="' + esc(filtro) + '">📄 Relatório geral</button>' +
                        '<button type="button" class="btn btn-secondary" style="padding:6px 10px;font-size:12px" data-arquivar-mes="' +
                        esc(bucket.mesAno) + '" data-arquivar-filtro="' + esc(filtro) + '">📂 Arquivar no PC</button></div>';
                    html += '<div id="' + idMes + '" style="display:none">';

                    if (filtro !== 'pendentes') {
                        idc++;
                        var idE = idPrefix + '_e_' + idc;
                        html += '<div class="pasta-cx-tipo" onclick="togglePastaCaixa(\'' + idE + '\')">✅ Entradas (' +
                            bucket.entradas.length + ' · ' + moeda(totE) + ')</div>';
                        html += '<div id="' + idE + '" class="pasta-cx-conteudo" style="display:none">' +
                            htmlItensPastaCx(bucket.entradas, 'val-ent') + '</div>';

                        idc++;
                        var idS = idPrefix + '_s_' + idc;
                        html += '<div class="pasta-cx-tipo" onclick="togglePastaCaixa(\'' + idS + '\')">🔻 Saídas (' +
                            bucket.saidas.length + ' · ' + moeda(totS) + ')</div>';
                        html += '<div id="' + idS + '" class="pasta-cx-conteudo" style="display:none">' +
                            htmlItensPastaCx(bucket.saidas, 'val-sai') + '</div>';
                    }

                    if (filtro === 'geral' || filtro === 'pendentes') {
                        idc++;
                        var idP = idPrefix + '_p_' + idc;
                        html += '<div class="pasta-cx-tipo" onclick="togglePastaCaixa(\'' + idP + '\')">⏳ Pendentes (' +
                            bucket.pendentes.length + ' · ' + moeda(totP) + ')</div>';
                        html += '<div id="' + idP + '" class="pasta-cx-conteudo" style="display:none">' +
                            htmlItensPastaCx(bucket.pendentes, 'val-pen') + '</div>';
                    }

                    html += '</div>';
                });
                html += '</div>';
            });
            el.innerHTML = html;

            el.querySelectorAll('[data-rel-mes-fixo]').forEach(function (b) {
                b.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    gerarRelatorioMensalPDF(b.getAttribute('data-rel-mes') || 'geral', b.getAttribute('data-rel-mes-fixo'));
                });
            });
            el.querySelectorAll('[data-arquivar-mes]').forEach(function (b) {
                b.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    arquivarMesPastaPC(b.getAttribute('data-arquivar-mes'), b.getAttribute('data-arquivar-filtro') || filtro);
                });
            });
        }

        function atualizarTodasPastasCaixa() {
            gerarArvorePastasCaixa({ elId: 'arvorePastasCaixa', filtro: 'geral', idPrefix: 'pasta_cx' });
            gerarArvorePastasCaixa({ elId: 'arvorePastasBalcao', filtro: 'balcao', idPrefix: 'pasta_bal' });
            gerarArvorePastasCaixa({ elId: 'arvorePastasBanco', filtro: 'banco', idPrefix: 'pasta_ban' });
            gerarArvorePastasCaixa({ elId: 'arvorePastasPendentes', filtro: 'pendentes', idPrefix: 'pasta_pen' });
        }

        function htmlArquivoRelatorioMes(emp, titulo, mesAno, corpoHtml) {
            return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">' +
                '<title>' + esc(titulo) + ' — ' + esc(mesAno) + '</title>' +
                '<style>body{font-family:Segoe UI,Arial,sans-serif;font-size:12px;color:#222;margin:24px}' +
                'h1{font-size:18px;margin:0 0 4px}h2{font-size:14px;color:#555;margin:0 0 16px}' +
                'table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left}' +
                'th{background:#ecf0f1}.section-title{padding:8px 10px;color:#fff;font-weight:bold;margin-top:18px;display:flex;justify-content:space-between}' +
                '.entrada{background:#27ae60}.saida{background:#e74c3c}.pendente{background:#f39c12}' +
                '.resumo{display:flex;gap:12px;flex-wrap:wrap;background:#f4f4f4;padding:12px;border:1px solid #ccc;margin:12px 0}' +
                '.resumo-box{text-align:center;flex:1;min-width:120px}.resumo-box b{display:block;margin-top:4px;font-size:14px}</style></head><body>' +
                '<h1>' + esc(titulo) + '</h1>' +
                '<h2>' + esc(emp.nome || 'HM Centro Automotivo') + ' — Competência: ' + esc(mesAno) + '</h2>' +
                corpoHtml +
                '<p style="margin-top:28px;font-size:10px;color:#888;text-align:center">Gerado em ' +
                esc(new Date().toLocaleString('pt-BR')) + ' · HM Centro Automotivo</p></body></html>';
        }

        async function gravarTextoNaPasta(dirHandle, nomeArquivo, texto) {
            var fh = await dirHandle.getFileHandle(nomeArquivo, { create: true });
            var w = await fh.createWritable();
            await w.write(texto);
            await w.close();
        }

        async function arquivarMesPastaPC(mesAnoFixo, filtroFixo) {
            if (!('showDirectoryPicker' in window)) {
                toast('Arquivar na pasta do PC só funciona no Chrome/Edge no computador.');
                return;
            }
            var filtro = filtroFixo || 'geral';
            var mesAno = mesAnoFixo || prompt('Qual mês arquivar na pasta do PC? (Ex: 07/2026)', mesAnoAtualPadrao());
            if (!mesAno) return;
            mesAno = String(mesAno).trim();
            if (!/^\d{2}\/\d{4}$/.test(mesAno)) {
                alert('Use o formato MM/AAAA (Ex: 07/2026).');
                return;
            }
            var root = await carregarHandlePastaRaiz();
            if (!root) {
                toast('Configure a pasta do PC em Config primeiro.');
                return;
            }
            if (!(await solicitarPermissaoPasta(root))) {
                toast('Sem permissão na pasta do PC.');
                return;
            }

            var db = carregar();
            var emp = getEmpresa(db);
            var itens = coletarItensRelatorioMensal(db, filtro, mesAno);
            if (!itens.length) {
                alert('Nenhum registro para arquivar em ' + mesAno);
                return;
            }
            var entradas = itens.filter(function (x) { return x.natureza === 'ENTRADA'; });
            var saidas = itens.filter(function (x) { return x.natureza === 'SAIDA'; });
            var pendentes = itens.filter(function (x) { return x.natureza === 'PENDENTE'; });
            var filtroHtml = filtro === 'pendentes' ? 'pendentes' : (filtro === 'geral' ? 'geral' : filtro);
            var montGeral = montarHtmlSecoesRelatorioMes(itens, filtroHtml);
            var montEnt = montarHtmlSecoesRelatorioMes(entradas, 'entradas');
            var montSai = montarHtmlSecoesRelatorioMes(saidas, 'saidas');

            var partes = mesAno.split('/');
            var ano = partes[1];
            var mesNum = partes[0];
            var mesNome = MES_NOMES_CX[mesNum] || mesNum;
            var nomePastaMes = mesNum + '-' + slugPasta(mesNome);
            var subTipo = filtro === 'balcao' ? 'Balcao' : (filtro === 'banco' ? 'Banco' : (filtro === 'pendentes' ? 'Pendentes' : 'Geral'));
            var tituloRel = REL_MES_TITULOS[filtro] || REL_MES_TITULOS.geral;

            try {
                var pastaCaixa = await root.getDirectoryHandle('Caixa', { create: true });
                var pastaTipo = await pastaCaixa.getDirectoryHandle(subTipo, { create: true });
                var pastaAno = await pastaTipo.getDirectoryHandle(ano, { create: true });
                var pastaMes = await pastaAno.getDirectoryHandle(nomePastaMes, { create: true });

                if (filtro !== 'pendentes') {
                    var pastaEntradas = await pastaMes.getDirectoryHandle('Entradas', { create: true });
                    var pastaSaidas = await pastaMes.getDirectoryHandle('Saidas', { create: true });
                    await gravarTextoNaPasta(pastaEntradas, 'entradas-' + mesNum + '-' + ano + '.html',
                        htmlArquivoRelatorioMes(emp, 'ENTRADAS DO MÊS', mesAno, montEnt.html));
                    await gravarTextoNaPasta(pastaEntradas, 'entradas-' + mesNum + '-' + ano + '.json',
                        JSON.stringify(entradas, null, 2));
                    await gravarTextoNaPasta(pastaSaidas, 'saidas-' + mesNum + '-' + ano + '.html',
                        htmlArquivoRelatorioMes(emp, 'SAÍDAS DO MÊS', mesAno, montSai.html));
                    await gravarTextoNaPasta(pastaSaidas, 'saidas-' + mesNum + '-' + ano + '.json',
                        JSON.stringify(saidas, null, 2));
                } else {
                    var pastaPend = await pastaMes.getDirectoryHandle('Pendentes', { create: true });
                    await gravarTextoNaPasta(pastaPend, 'pendentes-' + mesNum + '-' + ano + '.html',
                        htmlArquivoRelatorioMes(emp, 'CONTAS A RECEBER', mesAno, montGeral.html));
                    await gravarTextoNaPasta(pastaPend, 'pendentes-' + mesNum + '-' + ano + '.json',
                        JSON.stringify(pendentes, null, 2));
                }

                await gravarTextoNaPasta(pastaMes, 'Relatorio-' + subTipo + '-' + mesNum + '-' + ano + '.html',
                    htmlArquivoRelatorioMes(emp, tituloRel, mesAno, montGeral.html));
                await gravarTextoNaPasta(pastaMes, 'resumo-' + mesNum + '-' + ano + '.json', JSON.stringify({
                    mesAno: mesAno,
                    mes: mesNome,
                    filtro: filtro,
                    geradoEm: new Date().toISOString(),
                    totais: {
                        entradas: montGeral.totEntradas,
                        saidas: montGeral.totSaidas,
                        pendentes: montGeral.totPendentes,
                        saldo: montGeral.saldo
                    },
                    qtd: { entradas: entradas.length, saidas: saidas.length, pendentes: pendentes.length },
                    pendentes: pendentes
                }, null, 2));

                var caminho = 'Caixa/' + subTipo + '/' + ano + '/' + nomePastaMes;
                toast('Mês ' + mesAno + ' arquivado em ' + caminho);
                alert(
                    'Pasta do mês criada com sucesso!\n\n' +
                    root.name + '/' + caminho + '/\n' +
                    (filtro === 'pendentes'
                        ? '  ├─ Pendentes/\n  └─ Relatorio-…html\n\nA receber: ' + moeda(montGeral.totPendentes)
                        : '  ├─ Entradas/\n  ├─ Saidas/\n  └─ Relatorio-…html\n\nEntradas: ' + moeda(montGeral.totEntradas) +
                          '\nSaídas: ' + moeda(montGeral.totSaidas) +
                          '\nSaldo: ' + moeda(montGeral.saldo))
                );
            } catch (err) {
                console.error(err);
                toast('Falha ao gravar a pasta do mês no PC.');
            }
        }

