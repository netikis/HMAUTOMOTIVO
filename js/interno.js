'use strict';
/* HM Automotivo — despesas OS / funcionarios / servico finalizado */

        /* ---------- Despesas por OS (Modo Interno) ---------- */

        var despesaOsSelecionadaId = null;

        function listarDespesasInternasPorOs(atendimentoId) {
            var intDb = carregarInternoRaw();
            var ex = garantirExcluidosInterno(intDb).caixa || {};
            var lista = (intDb.caixa || []).filter(function (x) {
                return x && x.tipo === 'saida' && x.atendimentoId === atendimentoId;
            });
            return aplicarExcluidosNaLista(lista, ex);
        }

        function totalDespesasInternasPorOs(atendimentoId) {
            return listarDespesasInternasPorOs(atendimentoId).reduce(function (s, x) {
                return s + (Number(x.valor) || 0);
            }, 0);
        }

        function despesaOcultaFolha(d) {
            return !!(d && (d.escritorio === true || d.ocultarFolha === true || d.folhaInterna === false));
        }

        function listarDespesasFolhaInterna(atendimentoId) {
            return listarDespesasInternasPorOs(atendimentoId).filter(function (d) {
                return !despesaOcultaFolha(d);
            });
        }

        function totalCustoPecasOs(atendimento) {
            if (!atendimento) return 0;
            if (atendimento.totalCustoPecas != null && atendimento.totalCustoPecas !== '') {
                return Number(atendimento.totalCustoPecas) || 0;
            }
            return (atendimento.itens || []).reduce(function (s, it) {
                if ((it.tipo || 'peca') !== 'peca') return s;
                return s + (Number(it.custo) || 0);
            }, 0);
        }

        function totalMaoObraOs(atendimento) {
            if (!atendimento) return 0;
            var deItens = (atendimento.itens || []).reduce(function (s, it) {
                return s + (it.tipo === 'mao' ? (Number(it.valor) || 0) : 0);
            }, 0);
            if (deItens > 0) return deItens;
            return Number(atendimento.maoObra) || 0;
        }

        function totalPecasCobradoOs(atendimento) {
            if (!atendimento) return 0;
            if (atendimento.totalPecas != null && atendimento.totalPecas !== '') {
                return Number(atendimento.totalPecas) || 0;
            }
            return (atendimento.itens || []).reduce(function (s, it) {
                if ((it.tipo || 'peca') !== 'peca') return s;
                return s + (Number(it.valor) || 0);
            }, 0);
        }

        function resumoLucroOs(atendimento) {
            var bruto = Number(atendimento && atendimento.total) || 0;
            var mao = totalMaoObraOs(atendimento);
            var pecasCobrado = totalPecasCobradoOs(atendimento);
            var custoPecas = totalCustoPecasOs(atendimento);
            var despesasLancadas = totalDespesasInternasPorOs(atendimento && atendimento.id);
            var despesas = despesasLancadas + custoPecas;
            /* Lucro do responsável = só mão de obra (peças / lucro de peça não vão pro funcionário) */
            var lucroFuncionario = mao;
            return {
                bruto: bruto,
                maoObra: mao,
                pecasCobrado: pecasCobrado,
                custoPecas: custoPecas,
                despesasLancadas: despesasLancadas,
                despesas: despesas,
                lucro: bruto - despesas,
                lucroFuncionario: lucroFuncionario,
                lucroPecas: pecasCobrado - custoPecas
            };
        }

        /* Folha só do modo interno: serviço + despesas + lucro (não vai pro cliente) */
        function htmlNotaInternaLucroOs(mainDb, a) {
            var emp = getEmpresa(mainDb);
            var nome = nomeAtendimento(mainDb, a);
            var resumo = resumoLucroOs(a);
            var despesas = listarDespesasFolhaInterna(a.id).slice().sort(function (x, y) {
                return String(x.criadoEm || '').localeCompare(String(y.criadoEm || ''));
            });
            var totFolha = despesas.reduce(function (s, d) { return s + (Number(d.valor) || 0); }, 0);
            var linhasDesp = despesas.length
                ? despesas.map(function (d, i) {
                    return '<tr>' +
                        '<td>' + (i + 1) + '</td>' +
                        '<td>' + esc(fmtData(d.criadoEm)) + '</td>' +
                        '<td>' + esc(d.descricao || '—') + '</td>' +
                        '<td>' + esc(d.forma || '—') + '</td>' +
                        '<td>' + moeda(d.valor) + '</td>' +
                        '</tr>';
                }).join('')
                : '<tr><td colspan="5" style="padding:10px;color:#666">Nenhuma despesa de serviço nesta folha.</td></tr>';

            return '<div class="nota-espelho" id="notaInternaLucroOs">' +
                htmlCabecalhoNotaEmpresa(emp,
                    '<div class="nota-sub nota-titulo-espelho" style="color:#c0392b">FOLHA INTERNA — LUCRO DA OS</div>' +
                    '<div class="nota-sub nota-registro">Uso interno · não enviar ao cliente · ' +
                    esc(fmtData(a.entrada || a.criadoEm)) +
                    (a.id ? ' · ID ' + esc(String(a.id).slice(-6)) : '') + '</div>'
                ) +
                '<div class="nota-bloco compacto"><div class="tit azul">Cliente / Veículo</div><div class="nota-grid nota-grid-compacta">' +
                '<div class="nota-campo full"><span class="nota-label">Cliente</span><span class="nota-valor">' + esc(nome) + '</span></div>' +
                '<div class="nota-campo"><span class="nota-label">Veículo</span><span class="nota-valor">' + esc(a.carro || '—') + '</span></div>' +
                '<div class="nota-campo"><span class="nota-label">Placa</span><span class="nota-valor" style="font-weight:800;letter-spacing:1px">' +
                esc((a.placa || '—').toUpperCase()) + '</span></div>' +
                '<div class="nota-campo"><span class="nota-label">Status</span><span class="nota-valor">' + esc(a.status || '—') + '</span></div>' +
                '<div class="nota-campo"><span class="nota-label">Responsável</span><span class="nota-valor">' + esc(nomeResponsavelOs(a)) + '</span></div>' +
                (a.servicos ? '<div class="nota-campo full"><span class="nota-label">Serviços</span><span class="nota-valor">' + esc(a.servicos) + '</span></div>' : '') +
                '</div></div>' +
                '<div class="nota-bloco compacto"><div class="tit verde">Valores do serviço (bruto)</div>' +
                '<div class="nota-valores-pad compacto">' +
                (ehServicoSeguro(a)
                    ? htmlItensNotaSeguro(a.itens, { interno: true, franquia: a.franquia })
                    : htmlItensNota(a.itens)) +
                '</div></div>' +
                (resumo.custoPecas > 0 || resumo.pecasCobrado > 0
                    ? '<div class="nota-bloco compacto"><div class="tit escuro">Peças (oficina — não vão pro funcionário)</div>' +
                      '<div class="nota-valores-pad compacto">' +
                      '<div>Peças cobradas: <strong>' + moeda(resumo.pecasCobrado) + '</strong></div>' +
                      '<div>Custo das peças: <strong style="color:#c0392b">' + moeda(resumo.custoPecas) + '</strong></div>' +
                      '<div>Lucro nas peças: <strong style="color:#1e8449">' + moeda(resumo.lucroPecas) + '</strong></div>' +
                      '</div></div>'
                    : '') +
                '<div class="nota-bloco compacto"><div class="tit vermelho">Despesas do serviço (folha do funcionário)</div>' +
                '<div class="nota-tabela-wrap"><table class="nota-tabela-desp">' +
                '<thead><tr>' +
                '<th>#</th><th>Data</th><th>Descrição</th><th>Forma</th><th>Valor</th>' +
                '</tr></thead><tbody>' + linhasDesp + '</tbody></table></div>' +
                '<div class="nota-subtotais compacto" style="padding:6pt">Total nesta folha: <strong>' + moeda(totFolha) + '</strong></div>' +
                '</div>' +
                '<div class="nota-bloco compacto" style="border:2px solid #222">' +
                '<div class="tit escuro">Resumo do lucro</div>' +
                '<div class="nota-valores-pad compacto">' +
                '<div class="nota-resumo-lucro">' +
                '<div>Bruto OS (serviço): <strong>' + moeda(resumo.bruto) + '</strong></div>' +
                '<div>Mão de obra (responsável): <strong>' + moeda(resumo.maoObra) + '</strong></div>' +
                (resumo.pecasCobrado > 0 || resumo.custoPecas > 0
                    ? '<div>Peças cobradas: <strong>' + moeda(resumo.pecasCobrado) + '</strong></div>' +
                      '<div>Custo peças: <strong style="color:#c0392b">' + moeda(resumo.custoPecas) + '</strong></div>' +
                      '<div>Lucro nas peças: <strong style="color:#1e8449">' + moeda(resumo.lucroPecas) + '</strong></div>'
                    : '') +
                '<div>Despesas do serviço (folha): <strong style="color:#c0392b">' + moeda(totFolha) + '</strong></div>' +
                '<div>Lucro do funcionário (só mão de obra): <strong style="color:#2980b9">' + moeda(resumo.lucroFuncionario) + '</strong></div>' +
                '</div>' +
                '</div></div>' +
                '<div class="nota-sigs compacto" style="margin-top:18px">' +
                '<div class="nota-sig"><div class="nota-sig-espaco"></div><div class="nota-sig-base">Responsável / Funcionário</div></div>' +
                '<div class="nota-sig"><div class="nota-sig-espaco"></div><div class="nota-sig-base">Visto do responsável</div></div>' +
                '</div></div>';
        }

        function imprimirNotaInternaOs(atendimentoId) {
            var id = atendimentoId || despesaOsSelecionadaId || document.getElementById('dosAtendimentoId').value;
            if (!id) {
                toast('Abra uma OS para imprimir a folha interna.');
                return;
            }
            var main = carregarMain();
            var a = (main.atendimentos || []).find(function (x) { return x.id === id; });
            if (!a) {
                toast('OS não encontrada.');
                return;
            }
            var html = htmlNotaInternaLucroOs(main, a);
            var titulo = 'Folha interna — ' + ((a.placa || '').toUpperCase() || nomeAtendimento(main, a));
            _htmlNotaImpressaoAtual = html;
            _tituloNotaImpressao = titulo;

            if (ehCelular()) {
                /* Celular: viewer com Fechar / Imprimir / Encaminhar — evita aba sem saída */
                abrirViewerPdf(html, titulo);
                toast('Folha interna aberta. Use Fechar para sair.');
                return;
            }
            executarImpressaoHtml(html);
            toast('Folha interna pronta para imprimir (despesas + lucro).');
        }

        function osFinalizadaInterno(a) {
            return !!(a && (a.finalizadoInterno === true || a.finalizadoInterno === 'true'));
        }

        function dataIsoServicoFinalizado(a) {
            if (!a) return hojeISO();
            var raw = a.finalizadoEm || a.saida || a.entrada || a.criadoEm || hojeISO();
            var s = String(raw);
            if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
            return hojeISO();
        }

        function partesDataFinalizado(iso) {
            var s = String(iso || hojeISO()).slice(0, 10);
            var p = s.split('-');
            if (p.length !== 3) p = hojeISO().split('-');
            return { ano: p[0], mes: p[1], dia: p[2], iso: p[0] + '-' + p[1] + '-' + p[2] };
        }

        function listarServicosFinalizados() {
            var main = carregarMain();
            var exAt = garantirExcluidos(main).atendimentos || {};
            return aplicarExcluidosNaLista((main.atendimentos || []).filter(osFinalizadaInterno), exAt)
                .sort(function (a, b) {
                return String(dataIsoServicoFinalizado(b)).localeCompare(String(dataIsoServicoFinalizado(a)));
            });
        }

        function finalizarCarroOsInterno(atendimentoId) {
            if (!atendimentoId) return;
            perguntarSimNao('CARRO FINALIZADO?').then(function (sim) {
                if (!sim) return;
                var db = carregar();
                var i = (db.atendimentos || []).findIndex(function (x) { return x.id === atendimentoId; });
                if (i < 0) {
                    toast('OS não encontrada.');
                    return;
                }
                var agora = new Date().toISOString();
                db.atendimentos[i] = Object.assign({}, db.atendimentos[i], {
                    status: 'Entregue',
                    finalizadoInterno: true,
                    finalizadoEm: agora,
                    atualizadoEm: agora
                });
                salvar(db);
                var a = db.atendimentos[i];
                if (usuarioNuvemLogado()) {
                    enviarAtendimentoNuvem(a).catch(function () { /* offline */ });
                }
                if (despesaOsSelecionadaId === atendimentoId) fecharBoxDespesaOs();
                toast('Carro finalizado — arquivado em Serviço finalizado.');
                renderDespesasOs();
                renderServicosFinalizados();
                renderHistorico();
                atualizarKPIs(db);
                abrirPainel('painelServicoFinalizado');
            });
        }

        function visualizarServicoFinalizado(atendimentoId) {
            var main = carregarMain();
            var a = (main.atendimentos || []).find(function (x) { return x.id === atendimentoId; });
            if (!a) {
                toast('Serviço finalizado não encontrado.');
                return;
            }
            var html = htmlNotaInternaLucroOs(main, a);
            var titulo = 'Finalizado — ' + ((a.placa || '').toUpperCase() || nomeAtendimento(main, a));
            _htmlNotaImpressaoAtual = html;
            _tituloNotaImpressao = titulo;
            abrirViewerPdf(html, titulo);
        }

        function excluirServicoFinalizado(atendimentoId) {
            if (!atendimentoId) return;
            var main = carregarMain();
            var a = (main.atendimentos || []).find(function (x) { return x.id === atendimentoId; });
            if (!a || !osFinalizadaInterno(a)) {
                toast('Serviço finalizado não encontrado.');
                renderServicosFinalizados();
                return;
            }
            var placa = (a.placa || '—').toUpperCase();
            var nome = nomeAtendimento(main, a);
            if (!confirm(
                'Excluir este serviço finalizado?\n\n' +
                placa + ' · ' + nome +
                '\n\nA OS sai do arquivo e do sistema (despesas internas desta OS também).'
            )) return;

            marcarExcluidoMain('atendimentos', atendimentoId);
            main = carregarMain();
            main.atendimentos = (main.atendimentos || []).filter(function (x) { return x.id !== atendimentoId; });
            salvarMain(main);

            var intRaw = carregarInternoRaw();
            listarDespesasInternasPorOs(atendimentoId).forEach(function (d) {
                if (d && d.id) marcarExcluidoInterno(intRaw, 'caixa', d.id);
            });
            intRaw.caixa = (intRaw.caixa || []).filter(function (x) {
                return !(x && x.atendimentoId === atendimentoId);
            });
            salvarInternoRaw(intRaw);

            if (usuarioNuvemLogado()) {
                apagarAtendimentoNuvem(atendimentoId).catch(function () { /* offline */ });
                apagarDespesasExcluidasNuvem(intRaw).catch(function () { /* offline */ });
            }
            agendarSyncAutomatico('excluir-servico-finalizado');

            toast('Serviço finalizado excluído.');
            renderServicosFinalizados();
            renderDespesasOs();
            renderHistorico();
            atualizarKPIs(carregarMain());
        }

        function montarArvoreServicosFinalizados(lista) {
            var arvore = {};
            (lista || []).forEach(function (a) {
                var d = partesDataFinalizado(dataIsoServicoFinalizado(a));
                var mesNome = MES_NOMES_CX[d.mes] || d.mes;
                if (!arvore[d.ano]) arvore[d.ano] = {};
                if (!arvore[d.ano][d.mes]) {
                    arvore[d.ano][d.mes] = { mesNome: mesNome, mesNum: d.mes, dias: {} };
                }
                if (!arvore[d.ano][d.mes].dias[d.dia]) arvore[d.ano][d.mes].dias[d.dia] = [];
                arvore[d.ano][d.mes].dias[d.dia].push(a);
            });
            return arvore;
        }

        function renderServicosFinalizados() {
            var panel = document.getElementById('painelServicoFinalizado');
            if (!panel) return;
            var main = carregarMain();
            var q = (document.getElementById('buscaServicoFinalizado') || {}).value || '';
            q = String(q).toLowerCase().trim();
            var lista = listarServicosFinalizados();
            if (q) {
                lista = lista.filter(function (a) {
                    var nome = nomeAtendimento(main, a);
                    return [nome, a.placa, a.carro, a.responsavel, nomeResponsavelOs(a), a.status]
                        .join(' ').toLowerCase().indexOf(q) > -1;
                });
            }
            var totB = 0, totD = 0;
            lista.forEach(function (a) {
                var r = resumoLucroOs(a);
                totB += r.bruto;
                totD += r.despesas;
            });
            var elQ = document.getElementById('finQtdOs');
            var elB = document.getElementById('finBruto');
            var elD = document.getElementById('finDespesas');
            var elL = document.getElementById('finLucro');
            if (elQ) elQ.textContent = String(lista.length);
            if (elB) elB.textContent = moeda(totB);
            if (elD) elD.textContent = moeda(totD);
            if (elL) elL.textContent = moeda(totB - totD);

            var el = document.getElementById('arvorePastasServicoFinalizado');
            if (!el) return;
            var arvore = montarArvoreServicosFinalizados(lista);
            var anos = Object.keys(arvore).sort().reverse();
            if (!anos.length) {
                el.innerHTML = '<div class="muted" style="padding:12px;text-align:center">Nenhum serviço finalizado' +
                    (q ? ' nesta busca' : '') + '. Use <strong>Finalizado</strong> em Despesas por OS.</div>';
                return;
            }
            var html = '';
            var idc = 0;
            anos.forEach(function (ano) {
                idc++;
                var idAno = 'pasta_fin_ano_' + idc;
                html += '<div class="pasta-cx-ano" onclick="togglePastaCaixa(\'' + idAno + '\')">📁 Ano: ' + esc(ano) + '</div>';
                html += '<div id="' + idAno + '" style="display:none">';
                Object.keys(arvore[ano]).sort().reverse().forEach(function (mesNum) {
                    var bucket = arvore[ano][mesNum];
                    idc++;
                    var idMes = 'pasta_fin_mes_' + idc;
                    var qtdMes = 0;
                    Object.keys(bucket.dias).forEach(function (dia) { qtdMes += bucket.dias[dia].length; });
                    html += '<div class="pasta-cx-mes" onclick="togglePastaCaixa(\'' + idMes + '\')">📂 Mês: ' +
                        esc(bucket.mesNome) + ' <small style="font-weight:500;opacity:.85">(' + qtdMes + ' serviço' +
                        (qtdMes === 1 ? '' : 's') + ')</small></div>';
                    html += '<div id="' + idMes + '" style="display:none">';
                    Object.keys(bucket.dias).sort().reverse().forEach(function (dia) {
                        var itens = bucket.dias[dia];
                        idc++;
                        var idDia = 'pasta_fin_dia_' + idc;
                        html += '<div class="pasta-cx-dia" onclick="togglePastaCaixa(\'' + idDia + '\')">📅 Dia: ' +
                            esc(dia + '/' + mesNum + '/' + ano) + ' <small style="font-weight:500;opacity:.85">(' +
                            itens.length + ')</small></div>';
                        html += '<div id="' + idDia + '" class="pasta-cx-dia-conteudo" style="display:none">';
                        itens.forEach(function (a) {
                            var r = resumoLucroOs(a);
                            var nome = nomeAtendimento(main, a);
                            html += '<div class="pasta-cx-item">' +
                                '<span><strong>' + esc((a.placa || '—').toUpperCase()) + '</strong> · ' +
                                esc(a.carro || '—') + '<br>' +
                                '<small>' + esc(nome) + ' · ' + esc(nomeResponsavelOs(a)) +
                                (ehServicoSeguro(a) ? ' · SEGURO' : '') +
                                ' · lucro ' + moeda(r.lucro) + '</small></span>' +
                                '<span class="acoes-fin">' +
                                '<button type="button" class="btn btn-ver" data-fin-ver="' + esc(a.id) + '">👁️ Ver</button>' +
                                '<button type="button" class="btn btn-pdf" data-fin-print="' + esc(a.id) + '">🖨️ Imprimir</button>' +
                                '<button type="button" class="btn btn-danger" data-fin-ex="' + esc(a.id) + '">Excluir</button>' +
                                '</span></div>';
                        });
                        html += '</div>';
                    });
                    html += '</div>';
                });
                html += '</div>';
            });
            el.innerHTML = html;
            el.querySelectorAll('[data-fin-ver]').forEach(function (b) {
                b.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    visualizarServicoFinalizado(b.getAttribute('data-fin-ver'));
                });
            });
            el.querySelectorAll('[data-fin-print]').forEach(function (b) {
                b.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    imprimirNotaInternaOs(b.getAttribute('data-fin-print'));
                });
            });
            el.querySelectorAll('[data-fin-ex]').forEach(function (b) {
                b.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    excluirServicoFinalizado(b.getAttribute('data-fin-ex'));
                });
            });
        }

        var produtoDespesaOsSelecionado = null;

        function preencherListaProdutosDespesaOs() {
            var lista = document.getElementById('listaProdutosDespesaOs');
            if (!lista) return;
            var main = carregarMain();
            lista.innerHTML = '';
            (main.produtos || []).slice().sort(function (a, b) {
                return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
            }).forEach(function (p) {
                var opt = document.createElement('option');
                opt.value = p.nome + (p.codigo ? ' [' + p.codigo + ']' : '');
                lista.appendChild(opt);
            });
        }

        function limparProdutoDespesaOs() {
            produtoDespesaOsSelecionado = null;
            document.getElementById('dosProdutoId').value = '';
            document.getElementById('dosProdBusca').value = '';
            document.getElementById('dosProdQtd').value = '1';
            document.getElementById('dosBaixaEstoque').checked = true;
            var info = document.getElementById('dosEstoqueInfo');
            if (info) {
                info.style.display = 'none';
                info.innerHTML = '';
            }
        }

        function aplicarProdutoDespesaOs() {
            var texto = document.getElementById('dosProdBusca').value;
            var p = encontrarProdutoPorBusca(texto);
            produtoDespesaOsSelecionado = p;
            var info = document.getElementById('dosEstoqueInfo');
            if (!p) {
                document.getElementById('dosProdutoId').value = '';
                if (info) { info.style.display = 'none'; info.innerHTML = ''; }
                return;
            }
            document.getElementById('dosProdutoId').value = p.id;
            document.getElementById('dosDesc').value = p.nome + (p.codigo ? ' [' + p.codigo + ']' : '');
            var qtd = parseMoeda(document.getElementById('dosProdQtd').value) || 1;
            if (qtd <= 0) qtd = 1;
            document.getElementById('dosProdQtd').value = String(qtd);
            var unit = Number(p.custo) > 0 ? Number(p.custo) : (Number(p.venda) || 0);
            document.getElementById('dosValor').value = (unit * qtd).toFixed(2).replace('.', ',');
            document.getElementById('dosBaixaEstoque').checked = true;
            if (info) {
                info.style.display = '';
                info.innerHTML = 'Produto: <strong>' + esc(p.nome) +
                    '</strong> · Estoque: <strong>' + esc(String(p.qtd) + ' ' + (p.unidade || 'un')) +
                    '</strong> · Custo unit.: <strong>' + moeda(unit) + '</strong>';
            }
            toast('Produto do estoque selecionado: ' + p.nome);
        }

        function atualizarValorDespesaPeloProduto() {
            if (!produtoDespesaOsSelecionado) return;
            var p = produtoDespesaOsSelecionado;
            var qtd = parseMoeda(document.getElementById('dosProdQtd').value) || 0;
            var unit = Number(p.custo) > 0 ? Number(p.custo) : (Number(p.venda) || 0);
            document.getElementById('dosValor').value = (unit * Math.max(0, qtd)).toFixed(2).replace('.', ',');
            var info = document.getElementById('dosEstoqueInfo');
            if (info && info.style.display !== 'none') {
                info.innerHTML = 'Produto: <strong>' + esc(p.nome) +
                    '</strong> · Estoque: <strong>' + esc(String(p.qtd) + ' ' + (p.unidade || 'un')) +
                    '</strong> · Custo unit.: <strong>' + moeda(unit) +
                    '</strong> · Qtd nesta despesa: <strong>' + esc(String(qtd)) + '</strong>';
            }
        }

        function fecharBoxDespesaOs() {
            despesaOsSelecionadaId = null;
            var box = document.getElementById('boxLancarDespesaOs');
            if (box) box.style.display = 'none';
            document.getElementById('dosAtendimentoId').value = '';
            document.getElementById('formDespesaOs').reset();
            limparProdutoDespesaOs();
            document.getElementById('tabelaDespesasOsDetalhe').innerHTML = '';
            document.getElementById('listaDespesasOsDetalheVazia').style.display = 'none';
        }

        function abrirLancarDespesaOs(atendimentoId) {
            var main = carregarMain();
            var a = (main.atendimentos || []).find(function (x) { return x.id === atendimentoId; });
            if (!a) {
                toast('OS não encontrada.');
                return;
            }
            canalVendas = 'interno';
            atualizarBadgeCanal();
            despesaOsSelecionadaId = atendimentoId;
            document.getElementById('dosAtendimentoId').value = atendimentoId;
            limparProdutoDespesaOs();
            preencherListaProdutosDespesaOs();
            var nome = nomeAtendimento(main, a);
            var resumo = resumoLucroOs(a);
            document.getElementById('tituloLancarDespesaOs').textContent =
                'Despesas — ' + nome + ' · ' + ((a.placa || '—').toUpperCase());
            document.getElementById('hintLancarDespesaOs').innerHTML =
                'Responsável: <strong>' + esc(nomeResponsavelOs(a)) +
                '</strong> · Bruto OS: <strong>' + moeda(resumo.bruto) +
                '</strong>' +
                (resumo.custoPecas > 0
                    ? ' · Custo peças: <strong>' + moeda(resumo.custoPecas) + '</strong>'
                    : '') +
                ' · Despesas: <strong>' + moeda(resumo.despesas) +
                '</strong> · Lucro: <strong>' + moeda(resumo.lucro) +
                '</strong><br>Pode digitar a despesa livre <strong>ou</strong> escolher um produto do estoque cadastrado.';
            document.getElementById('boxLancarDespesaOs').style.display = '';
            renderDespesasOsDetalhe(atendimentoId);
            document.getElementById('dosProdBusca').focus();
        }

        function renderDespesasOsDetalhe(atendimentoId) {
            var lista = listarDespesasInternasPorOs(atendimentoId);
            var tb = document.getElementById('tabelaDespesasOsDetalhe');
            var vazio = document.getElementById('listaDespesasOsDetalheVazia');
            tb.innerHTML = '';
            if (!lista.length) {
                vazio.style.display = '';
                return;
            }
            vazio.style.display = 'none';
            lista.slice().reverse().forEach(function (x) {
                var tagEsc = despesaOcultaFolha(x)
                    ? ' <span style="font-size:0.68rem;font-weight:700;color:#f1c40f">ESCRITÓRIO</span>'
                    : '';
                var tr = document.createElement('tr');
                tr.innerHTML =
                    '<td>' + esc(fmtData(x.criadoEm)) + '</td>' +
                    '<td>' + esc(x.descricao || '—') + tagEsc + '</td>' +
                    '<td>' + esc(x.forma || '—') + '</td>' +
                    '<td>' + moeda(x.valor) + '</td>' +
                    '<td class="actions"><button type="button" class="btn btn-danger" data-dos-ex="' + esc(x.id) + '">Excluir</button></td>';
                tb.appendChild(tr);
            });
            tb.querySelectorAll('[data-dos-ex]').forEach(function (b) {
                b.addEventListener('click', function () {
                    if (!confirm('Excluir esta despesa interna?')) return;
                    var idEx = b.getAttribute('data-dos-ex');
                    var canalAntes = canalVendas;
                    canalVendas = 'interno';
                    var db = carregar();
                    var rem = (db.caixa || []).find(function (x) { return x.id === idEx; });
                    marcarExcluido(db, 'caixa', idEx);
                    db.caixa = (db.caixa || []).filter(function (x) { return x.id !== idEx; });
                    /* Devolve estoque se a despesa tinha baixado produto */
                    if (rem && rem.baixaEstoque && rem.produtoId) {
                        var main = carregarMain();
                        var pi = (main.produtos || []).findIndex(function (p) { return p.id === rem.produtoId; });
                        if (pi >= 0) {
                            main.produtos[pi].qtd = Math.round(((Number(main.produtos[pi].qtd) || 0) + (Number(rem.qtdEstoque) || 0)) * 1000) / 1000;
                            main.produtos[pi].atualizadoEm = new Date().toISOString();
                            salvarMain(main);
                        }
                    }
                    salvar(db);
                    canalVendas = canalAntes;
                    toast('Despesa interna excluída.');
                    renderDespesasOsDetalhe(atendimentoId);
                    renderDespesasOs();
                    renderCaixa();
                    renderRelatorioCaixa();
                    renderProdutos();
                });
            });
        }

        function renderDespesasOs() {
            var panel = document.getElementById('painelDespesasOs');
            if (!panel) return;
            preencherFiltroFuncionarioDos();
            var main = carregarMain();
            var q = (document.getElementById('buscaDespesasOs').value || '').toLowerCase().trim();
            var filtroFunc = (document.getElementById('filtroFuncionarioDos') || {}).value || '';
            var lista = (main.atendimentos || []).slice().filter(function (a) {
                return !osFinalizadaInterno(a);
            }).sort(function (a, b) {
                return String(b.entrada || b.criadoEm || '').localeCompare(String(a.entrada || a.criadoEm || ''));
            });
            if (filtroFunc === '__sem__') {
                lista = lista.filter(function (a) {
                    return !a.responsavelId && !String(a.responsavel || '').trim();
                });
            } else if (filtroFunc) {
                lista = lista.filter(function (a) {
                    if (a.responsavelId === filtroFunc) return true;
                    var dbInt = obterDbFuncionarios();
                    var f = (dbInt.funcionarios || []).find(function (x) { return x.id === filtroFunc; });
                    if (f && a.responsavel && String(a.responsavel).trim().toLowerCase() === String(f.nome || '').trim().toLowerCase()) {
                        return true;
                    }
                    return false;
                });
            }
            if (q) {
                lista = lista.filter(function (a) {
                    var nome = nomeAtendimento(main, a);
                    return [nome, a.placa, a.carro, a.status, a.responsavel, nomeResponsavelOs(a)].join(' ').toLowerCase().indexOf(q) > -1;
                });
            }

            var totBruto = 0, totDesp = 0;
            lista.forEach(function (a) {
                var r = resumoLucroOs(a);
                totBruto += r.bruto;
                totDesp += r.despesas;
            });
            document.getElementById('dosQtdOs').textContent = String(lista.length);
            document.getElementById('dosBruto').textContent = moeda(totBruto);
            document.getElementById('dosDespesas').textContent = moeda(totDesp);
            document.getElementById('dosLucro').textContent = moeda(totBruto - totDesp);
            renderResumoLucroPorFuncionario(lista);

            if (typeof gerarArvorePastasDespesasOs === 'function') gerarArvorePastasDespesasOs();

            var tb = document.getElementById('tabelaDespesasOs');
            var vazio = document.getElementById('listaDespesasOsVazia');
            tb.innerHTML = '';
            if (!lista.length) {
                vazio.style.display = '';
                return;
            }
            vazio.style.display = 'none';
            lista.forEach(function (a) {
                var r = resumoLucroOs(a);
                var nome = nomeAtendimento(main, a);
                var tr = document.createElement('tr');
                tr.innerHTML =
                    '<td>' + esc(fmtData(a.entrada || a.criadoEm)) + '</td>' +
                    '<td>' + esc(nome) + (ehServicoSeguro(a) ? ' <span style="font-size:0.68rem;font-weight:700;color:#e67e22">SEGURO</span>' : '') + '</td>' +
                    '<td>' + esc(a.carro || '—') + ' · <strong>' + esc((a.placa || '—').toUpperCase()) + '</strong></td>' +
                    '<td>' + esc(nomeResponsavelOs(a)) + '</td>' +
                    '<td>' + esc(a.status || '—') + '</td>' +
                    '<td>' + moeda(r.bruto) + '</td>' +
                    '<td><strong style="color:#7ec8ff">' + moeda(r.maoObra || r.lucroFuncionario || 0) + '</strong></td>' +
                    '<td>' + moeda(r.despesas) + '</td>' +
                    '<td><strong>' + moeda(r.lucro) + '</strong></td>' +
                    '<td class="actions"><span class="acoes-linha">' +
                    '<button type="button" class="btn btn-primary" data-dos-abrir="' + esc(a.id) + '">Despesas</button>' +
                    '<button type="button" class="btn btn-pdf" data-dos-print="' + esc(a.id) + '">Folha interna</button>' +
                    '<button type="button" class="btn btn-ok" data-dos-fin="' + esc(a.id) + '">CARRO FINALIZADO</button>' +
                    '</span></td>';
                tb.appendChild(tr);
            });
            tb.querySelectorAll('[data-dos-abrir]').forEach(function (b) {
                b.addEventListener('click', function () {
                    abrirLancarDespesaOs(b.getAttribute('data-dos-abrir'));
                });
            });
            tb.querySelectorAll('[data-dos-print]').forEach(function (b) {
                b.addEventListener('click', function () {
                    imprimirNotaInternaOs(b.getAttribute('data-dos-print'));
                });
            });
            tb.querySelectorAll('[data-dos-fin]').forEach(function (b) {
                b.addEventListener('click', function () {
                    finalizarCarroOsInterno(b.getAttribute('data-dos-fin'));
                });
            });

            if (despesaOsSelecionadaId) {
                var aindaExiste = lista.some(function (a) { return a.id === despesaOsSelecionadaId; });
                if (aindaExiste) {
                    var aSel = (main.atendimentos || []).find(function (x) { return x.id === despesaOsSelecionadaId; });
                    if (aSel) {
                        var resumo = resumoLucroOs(aSel);
                        document.getElementById('hintLancarDespesaOs').innerHTML =
                            'Responsável: <strong>' + esc(nomeResponsavelOs(aSel)) +
                            '</strong> · Bruto OS: <strong>' + moeda(resumo.bruto) +
                            '</strong>' +
                            (resumo.custoPecas > 0
                                ? ' · Custo peças: <strong>' + moeda(resumo.custoPecas) + '</strong>'
                                : '') +
                            ' · Despesas: <strong>' + moeda(resumo.despesas) +
                            '</strong> · Lucro: <strong>' + moeda(resumo.lucro) + '</strong>';
                        renderDespesasOsDetalhe(despesaOsSelecionadaId);
                    }
                }
            }
        }

        function lancarDespesaOs(e) {
            e.preventDefault();
            var atendimentoId = document.getElementById('dosAtendimentoId').value || despesaOsSelecionadaId;
            if (!atendimentoId) {
                toast('Selecione uma OS para lançar a despesa.');
                return;
            }
            var main = carregarMain();
            var a = (main.atendimentos || []).find(function (x) { return x.id === atendimentoId; });
            if (!a) {
                toast('OS não encontrada no balcão oficial.');
                return;
            }
            if (!produtoDespesaOsSelecionado && document.getElementById('dosProdBusca').value.trim()) {
                aplicarProdutoDespesaOs();
            }
            var desc = document.getElementById('dosDesc').value.trim();
            var valor = parseMoeda(document.getElementById('dosValor').value);
            var forma = document.getElementById('dosForma').value;
            var prod = produtoDespesaOsSelecionado;
            var qtdEstoque = parseMoeda(document.getElementById('dosProdQtd').value) || 0;
            var querBaixa = !!(document.getElementById('dosBaixaEstoque').checked && prod && prod.id);
            if (!desc) { toast('Informe a descrição da despesa (ou escolha um produto).'); return; }
            if (!(valor > 0)) { toast('Informe um valor válido.'); return; }
            if (prod && querBaixa) {
                if (qtdEstoque <= 0) { toast('Informe a quantidade do produto.'); return; }
                var estoqueAtual = Number(prod.qtd) || 0;
                if (qtdEstoque > estoqueAtual + 0.0001) {
                    toast('Estoque insuficiente de ' + prod.nome + '. Disponível: ' +
                        estoqueAtual + ' ' + (prod.unidade || 'un'));
                    return;
                }
            }

            var canalAntes = canalVendas;
            canalVendas = 'interno';
            var db = carregar();
            if (!db.caixa) db.caixa = [];
            var nome = nomeAtendimento(main, a);
            var placa = (a.placa || '—').toUpperCase();
            var lanc = {
                id: uid(),
                tipo: 'saida',
                descricao: desc,
                valor: valor,
                forma: forma,
                conta: 'balcao',
                atendimentoId: atendimentoId,
                produtoId: prod ? prod.id : null,
                qtdEstoque: querBaixa ? qtdEstoque : 0,
                baixaEstoque: querBaixa,
                escritorio: false,
                ocultarFolha: false,
                osResumo: {
                    cliente: nome,
                    placa: placa,
                    carro: a.carro || '',
                    totalOs: Number(a.total) || 0,
                    entrada: a.entrada || a.criadoEm || ''
                },
                criadoEm: new Date().toISOString(),
                atualizadoEm: new Date().toISOString()
            };
            db.caixa.push(lanc);
            salvar(db);

            if (querBaixa && prod) {
                main = carregarMain();
                var pi = (main.produtos || []).findIndex(function (p) { return p.id === prod.id; });
                if (pi >= 0) {
                    var novo = (Number(main.produtos[pi].qtd) || 0) - qtdEstoque;
                    main.produtos[pi].qtd = Math.round(Math.max(0, novo) * 1000) / 1000;
                    main.produtos[pi].atualizadoEm = new Date().toISOString();
                    salvarMain(main);
                }
            }

            canalVendas = canalAntes;
            atualizarBadgeCanal();

            document.getElementById('formDespesaOs').reset();
            limparProdutoDespesaOs();
            toast(querBaixa
                ? ('Despesa lançada + estoque baixado (' + qtdEstoque + '× ' + prod.nome + '). Enviando à nuvem…')
                : ('Despesa interna lançada na OS ' + placa + '. Enviando à nuvem…'));
            renderDespesasOsDetalhe(atendimentoId);
            renderDespesasOs();
            renderCaixa();
            renderRelatorioCaixa();
            renderProdutos();
            document.getElementById('dosProdBusca').focus();

            /* Sobe na hora para o outro PC ver (não espera o debounce) */
            enviarDespesaOsNuvem(lanc).then(function () {
                return sincronizarModoInternoNuvem();
            }).then(function (r) {
                toast('Despesa na nuvem OK (' + (r && r.nDesp != null ? r.nDesp : '?') + ' no total).');
            }).catch(function (err) {
                toast('Despesa salva aqui, mas falhou na nuvem: ' + (err.message || err.code || 'tente Sincronizar agora'));
            });
        }

        document.getElementById('formDespesaOs').addEventListener('submit', lancarDespesaOs);
        document.getElementById('btnCancelarDespesaOs').addEventListener('click', fecharBoxDespesaOs);
        document.getElementById('btnImprimirNotaInternaOs').addEventListener('click', function () {
            imprimirNotaInternaOs();
        });
        document.getElementById('btnLimparProdDespesaOs').addEventListener('click', function () {
            limparProdutoDespesaOs();
            document.getElementById('dosDesc').value = '';
            document.getElementById('dosValor').value = '';
            document.getElementById('dosProdBusca').focus();
        });
        document.getElementById('dosProdBusca').addEventListener('change', aplicarProdutoDespesaOs);
        document.getElementById('dosProdBusca').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                aplicarProdutoDespesaOs();
            }
        });
        document.getElementById('dosProdQtd').addEventListener('input', atualizarValorDespesaPeloProduto);
        document.getElementById('btnAtualizarDespesasOs').addEventListener('click', function () {
            toast('Baixando despesas da nuvem…');
            sincronizarTodosNuvem({ silencioso: false, mostrarToast: true }).then(function () {
                renderDespesasOs();
                if (despesaOsSelecionadaId) renderDespesasOsDetalhe(despesaOsSelecionadaId);
            }).catch(function (err) {
                renderDespesasOs();
                toast('Falha ao sincronizar: ' + (err.message || err.code || 'verifique login'));
            });
        });
        document.getElementById('buscaDespesasOs').addEventListener('input', renderDespesasOs);
        var filtroFuncDos = document.getElementById('filtroFuncionarioDos');
        if (filtroFuncDos) filtroFuncDos.addEventListener('change', renderDespesasOs);
        document.getElementById('buscaServicoFinalizado').addEventListener('input', renderServicosFinalizados);
        document.getElementById('btnAtualizarServicoFinalizado').addEventListener('click', function () {
            toast('Atualizando serviços finalizados…');
            if (usuarioNuvemLogado()) {
                sincronizarTodosNuvem({ silencioso: false, mostrarToast: true }).then(function () {
                    renderServicosFinalizados();
                }).catch(function () {
                    renderServicosFinalizados();
                });
            } else {
                renderServicosFinalizados();
            }
        });
        document.getElementById('btnAtualizarPastasDos').addEventListener('click', function () {
            if (typeof gerarArvorePastasDespesasOs === 'function') gerarArvorePastasDespesasOs();
            toast('Pastas de despesas atualizadas.');
        });
        document.getElementById('btnRelMesDespesasOs').addEventListener('click', function () {
            if (typeof gerarRelatorioMensalDespesasOsPDF === 'function') gerarRelatorioMensalDespesasOsPDF();
        });
        document.getElementById('btnArquivarMesDosPc').addEventListener('click', function () {
            if (typeof arquivarMesDespesasOsPastaPC === 'function') arquivarMesDespesasOsPastaPC();
        });

        /* ---------- Despesa escritório (tópico próprio · Modo Interno) ---------- */

        function listarDespesasEscritorio() {
            var intDb = carregarInternoRaw();
            var ex = garantirExcluidosInterno(intDb).caixa || {};
            var lista = (intDb.caixa || []).filter(function (x) {
                return x && x.tipo === 'saida' && despesaOcultaFolha(x);
            });
            return aplicarExcluidosNaLista(lista, ex).sort(function (a, b) {
                return String(b.criadoEm || b.data || '').localeCompare(String(a.criadoEm || a.data || ''));
            });
        }

        function preencherSelectOsDespesaEscritorio() {
            var sel = document.getElementById('deAtendimentoId');
            if (!sel) return;
            var atual = sel.value || '';
            var main = carregarMain();
            var lista = (main.atendimentos || []).slice().filter(function (a) {
                return !osFinalizadaInterno(a);
            }).sort(function (a, b) {
                return String(b.entrada || b.criadoEm || '').localeCompare(String(a.entrada || a.criadoEm || ''));
            });
            sel.innerHTML = '<option value="">Sem vínculo com OS</option>' + lista.map(function (a) {
                var nome = nomeAtendimento(main, a);
                var placa = (a.placa || '—').toUpperCase();
                return '<option value="' + esc(a.id) + '">' + esc(placa + ' · ' + nome) + '</option>';
            }).join('');
            if (atual && Array.prototype.some.call(sel.options, function (o) { return o.value === atual; })) {
                sel.value = atual;
            }
        }

        function rotuloOsDespesaEscritorio(d) {
            if (!d) return '—';
            if (d.osResumo && (d.osResumo.placa || d.osResumo.cliente)) {
                return ((d.osResumo.placa || '—') + ' · ' + (d.osResumo.cliente || '—')).trim();
            }
            if (!d.atendimentoId) return 'Sem OS';
            var main = carregarMain();
            var a = (main.atendimentos || []).find(function (x) { return x.id === d.atendimentoId; });
            if (!a) return 'OS #' + String(d.atendimentoId).slice(-6);
            return ((a.placa || '—').toUpperCase() + ' · ' + nomeAtendimento(main, a));
        }

        function renderDespesasEscritorio() {
            var panel = document.getElementById('painelDespesasEscritorio');
            if (!panel) return;
            preencherSelectOsDespesaEscritorio();
            var deData = document.getElementById('deData');
            if (deData && !deData.value) deData.value = hojeISO();

            var q = (document.getElementById('buscaDespesaEscritorio') || {}).value || '';
            q = String(q).toLowerCase().trim();
            var lista = listarDespesasEscritorio();
            if (q) {
                lista = lista.filter(function (d) {
                    return [d.descricao, d.forma, rotuloOsDespesaEscritorio(d)].join(' ').toLowerCase().indexOf(q) > -1;
                });
            }

            var mesAtual = hojeISO().slice(0, 7);
            var totMes = 0;
            var totGeral = 0;
            listarDespesasEscritorio().forEach(function (d) {
                var v = Number(d.valor) || 0;
                totGeral += v;
                var dia = String(d.data || d.criadoEm || '').slice(0, 10);
                if (dia.slice(0, 7) === mesAtual) totMes += v;
            });
            document.getElementById('deQtd').textContent = String(lista.length);
            document.getElementById('deMes').textContent = moeda(totMes);
            document.getElementById('deTotal').textContent = moeda(totGeral);

            var tb = document.getElementById('tabelaDespesasEscritorio');
            var vazio = document.getElementById('listaDespesasEscritorioVazia');
            tb.innerHTML = '';
            if (!lista.length) {
                vazio.style.display = '';
                return;
            }
            vazio.style.display = 'none';
            lista.forEach(function (d) {
                var tr = document.createElement('tr');
                tr.innerHTML =
                    '<td>' + esc(fmtData(d.data || d.criadoEm)) + '</td>' +
                    '<td>' + esc(d.descricao || '—') + '</td>' +
                    '<td>' + esc(rotuloOsDespesaEscritorio(d)) + '</td>' +
                    '<td>' + esc(d.forma || '—') + '</td>' +
                    '<td>' + moeda(d.valor) + '</td>' +
                    '<td class="actions"><button type="button" class="btn btn-danger" data-de-ex="' + esc(d.id) + '">Excluir</button></td>';
                tb.appendChild(tr);
            });
            tb.querySelectorAll('[data-de-ex]').forEach(function (b) {
                b.addEventListener('click', function () {
                    if (!confirm('Excluir esta despesa de escritório?')) return;
                    var idEx = b.getAttribute('data-de-ex');
                    var canalAntes = canalVendas;
                    canalVendas = 'interno';
                    var db = carregar();
                    marcarExcluido(db, 'caixa', idEx);
                    db.caixa = (db.caixa || []).filter(function (x) { return x.id !== idEx; });
                    salvar(db);
                    canalVendas = canalAntes;
                    toast('Despesa de escritório excluída.');
                    renderDespesasEscritorio();
                    renderDespesasOs();
                    renderCaixa();
                    renderRelatorioCaixa();
                });
            });
        }

        function lancarDespesaEscritorio(e) {
            e.preventDefault();
            var desc = (document.getElementById('deDesc').value || '').trim();
            var valor = parseMoeda(document.getElementById('deValor').value);
            var forma = document.getElementById('deForma').value;
            var data = (document.getElementById('deData').value || hojeISO()).slice(0, 10);
            var atendimentoId = (document.getElementById('deAtendimentoId').value || '').trim() || null;
            if (!desc) { toast('Informe a descrição.'); return; }
            if (!(valor > 0)) { toast('Informe um valor válido.'); return; }

            var main = carregarMain();
            var a = null;
            var nome = '';
            var placa = '';
            if (atendimentoId) {
                a = (main.atendimentos || []).find(function (x) { return x.id === atendimentoId; });
                if (!a) {
                    toast('OS não encontrada.');
                    return;
                }
                nome = nomeAtendimento(main, a);
                placa = (a.placa || '—').toUpperCase();
            }

            var canalAntes = canalVendas;
            canalVendas = 'interno';
            var db = carregar();
            if (!db.caixa) db.caixa = [];
            var lanc = {
                id: uid(),
                tipo: 'saida',
                descricao: desc,
                valor: valor,
                forma: forma,
                conta: 'balcao',
                data: data,
                atendimentoId: atendimentoId,
                produtoId: null,
                qtdEstoque: 0,
                baixaEstoque: false,
                escritorio: true,
                ocultarFolha: true,
                osResumo: a ? {
                    cliente: nome,
                    placa: placa,
                    carro: a.carro || '',
                    totalOs: Number(a.total) || 0,
                    entrada: a.entrada || a.criadoEm || ''
                } : null,
                criadoEm: data + 'T12:00:00.000Z',
                atualizadoEm: new Date().toISOString()
            };
            db.caixa.push(lanc);
            salvar(db);
            canalVendas = canalAntes;
            atualizarBadgeCanal();

            document.getElementById('formDespesaEscritorio').reset();
            document.getElementById('deData').value = hojeISO();
            preencherSelectOsDespesaEscritorio();
            toast('Despesa de escritório registrada. Enviando à nuvem…');
            renderDespesasEscritorio();
            if (atendimentoId) {
                renderDespesasOs();
                if (despesaOsSelecionadaId === atendimentoId) renderDespesasOsDetalhe(atendimentoId);
            }
            renderCaixa();
            renderRelatorioCaixa();

            enviarDespesaOsNuvem(lanc).then(function () {
                return sincronizarModoInternoNuvem();
            }).then(function (r) {
                toast('Despesa escritório na nuvem OK (' + (r && r.nDesp != null ? r.nDesp : '?') + ' no total).');
            }).catch(function (err) {
                toast('Salva aqui, mas falhou na nuvem: ' + (err.message || err.code || 'tente Sincronizar agora'));
            });
        }

        var formDe = document.getElementById('formDespesaEscritorio');
        if (formDe) formDe.addEventListener('submit', lancarDespesaEscritorio);
        var btnAtDe = document.getElementById('btnAtualizarDespesaEscritorio');
        if (btnAtDe) {
            btnAtDe.addEventListener('click', function () {
                toast('Baixando despesas da nuvem…');
                sincronizarTodosNuvem({ silencioso: false, mostrarToast: true }).then(function () {
                    renderDespesasEscritorio();
                }).catch(function (err) {
                    renderDespesasEscritorio();
                    toast('Falha ao sincronizar: ' + (err.message || err.code || 'verifique login'));
                });
            });
        }
        var buscaDe = document.getElementById('buscaDespesaEscritorio');
        if (buscaDe) buscaDe.addEventListener('input', renderDespesasEscritorio);

        /* ---------- Pagamento funcionários (Modo Interno) ---------- */
        function inicioFimSemana(isoDate) {
            var d = new Date((isoDate || hojeISO()) + 'T12:00:00');
            if (isNaN(d.getTime())) d = new Date();
            var dia = d.getDay(); /* 0=dom */
            var diffSeg = dia === 0 ? -6 : 1 - dia;
            var seg = new Date(d);
            seg.setDate(d.getDate() + diffSeg);
            var dom = new Date(seg);
            dom.setDate(seg.getDate() + 6);
            function ymd(x) {
                return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
            }
            return { inicio: ymd(seg), fim: ymd(dom) };
        }

        function rotuloSemana(isoDate) {
            var s = inicioFimSemana(isoDate);
            function ddmm(iso) {
                var p = String(iso).split('-');
                return (p[2] || '') + '/' + (p[1] || '');
            }
            return ddmm(s.inicio) + ' a ' + ddmm(s.fim);
        }

        function comCanalInterno(fn) {
            var antes = canalVendas;
            canalVendas = 'interno';
            atualizarBadgeCanal();
            try {
                return fn();
            } finally {
                canalVendas = antes;
                atualizarBadgeCanal();
            }
        }

        function limparFormFuncionario() {
            document.getElementById('formFuncionario').reset();
            document.getElementById('pfFuncEditId').value = '';
            document.getElementById('pfAtivoFunc').checked = true;
            document.getElementById('btnCancelarFunc').style.display = 'none';
            document.getElementById('btnSalvarFunc').textContent = 'Salvar funcionário';
        }

        function renderCadastroFuncionarios() {
            var panel = document.getElementById('painelFuncionarios');
            if (!panel) return;
            comCanalInterno(function () {
                var db = carregar();
                var q = (document.getElementById('buscaFuncionario').value || '').trim().toLowerCase();
                var funcs = listarFuncionariosOrdenados(db, false).filter(function (f) {
                    if (!q) return true;
                    return [f.nome, f.telefone, f.cargo, f.obs].join(' ').toLowerCase().indexOf(q) >= 0;
                });
                var tb = document.getElementById('tabelaFuncionarios');
                var vaz = document.getElementById('listaFuncionariosVazia');
                if (!funcs.length) {
                    tb.innerHTML = '';
                    vaz.style.display = 'block';
                } else {
                    vaz.style.display = 'none';
                    tb.innerHTML = funcs.map(function (f) {
                        var ativo = f.ativo !== false;
                        return '<tr>' +
                            '<td>' + esc(f.nome || '—') + '</td>' +
                            '<td>' + esc(f.telefone || '—') + '</td>' +
                            '<td>' + esc(f.cargo || '—') + '</td>' +
                            '<td>' + (ativo
                                ? '<span style="color:#2ecc71;font-weight:700">Ativo</span>'
                                : '<span style="color:#e74c3c;font-weight:700">Inativo</span>') + '</td>' +
                            '<td class="actions">' +
                            '<button type="button" class="btn btn-secondary" data-ed-func="' + esc(f.id) + '" style="padding:4px 8px;font-size:0.8rem">Editar</button> ' +
                            '<button type="button" class="btn btn-danger" data-excluir-func="' + esc(f.id) + '" style="padding:4px 8px;font-size:0.8rem">Excluir</button>' +
                            '</td></tr>';
                    }).join('');
                }
            });
        }

        function renderPagFuncionarios() {
            var panel = document.getElementById('painelPagFuncionarios');
            if (!panel) return;
            comCanalInterno(function () {
                var db = carregar();
                var funcs = listarFuncionariosOrdenados(db, false);
                var pags = (db.pagamentosFuncionarios || []).slice().sort(function (a, b) {
                    return String(b.data || b.criadoEm || '').localeCompare(String(a.data || a.criadoEm || ''));
                });

                var sem = inicioFimSemana(hojeISO());
                var mesAtual = hojeISO().slice(0, 7);
                var totSemana = 0;
                var totMes = 0;
                var totGeral = 0;
                pags.forEach(function (p) {
                    var v = Number(p.valor) || 0;
                    totGeral += v;
                    var d = (p.data || '').slice(0, 10);
                    if (d >= sem.inicio && d <= sem.fim) totSemana += v;
                    if (d.slice(0, 7) === mesAtual) totMes += v;
                });

                document.getElementById('pfQtdFunc').textContent = String(funcs.length);
                document.getElementById('pfSemana').textContent = moeda(totSemana);
                document.getElementById('pfMes').textContent = moeda(totMes);
                document.getElementById('pfTotal').textContent = moeda(totGeral);

                var sel = document.getElementById('pfFuncId');
                var selVal = sel.value;
                sel.innerHTML = '<option value="">Selecione...</option>' + funcs.map(function (f) {
                    var st = f.ativo === false ? ' (inativo)' : '';
                    return '<option value="' + esc(f.id) + '">' + esc((f.nome || '') + st) + '</option>';
                }).join('');
                if (selVal && funcs.some(function (f) { return f.id === selVal; })) sel.value = selVal;

                var tbF = document.getElementById('tabelaFuncionariosPag');
                var vazF = document.getElementById('listaFuncionariosPagVazia');
                if (tbF && vazF) {
                    if (!funcs.length) {
                        tbF.innerHTML = '';
                        vazF.style.display = 'block';
                    } else {
                        vazF.style.display = 'none';
                        tbF.innerHTML = funcs.map(function (f) {
                            return '<tr><td>' + esc(f.nome || '—') + '</td><td>' + esc(f.cargo || '—') + '</td><td>' +
                                (f.ativo !== false
                                    ? '<span style="color:#2ecc71;font-weight:700">Ativo</span>'
                                    : '<span style="color:#e74c3c;font-weight:700">Inativo</span>') +
                                '</td></tr>';
                        }).join('');
                    }
                }

                var q = (document.getElementById('buscaPagFunc').value || '').trim().toLowerCase();
                var filtrados = pags.filter(function (p) {
                    if (!q) return true;
                    var nome = String(p.funcionarioNome || '').toLowerCase();
                    var obs = String(p.obs || '').toLowerCase();
                    return nome.indexOf(q) >= 0 || obs.indexOf(q) >= 0;
                });
                var tbP = document.getElementById('tabelaPagFuncionarios');
                var vazP = document.getElementById('listaPagFuncVazia');
                if (!filtrados.length) {
                    tbP.innerHTML = '';
                    vazP.style.display = 'block';
                } else {
                    vazP.style.display = 'none';
                    tbP.innerHTML = filtrados.map(function (p) {
                        return '<tr>' +
                            '<td>' + esc(fmtData(p.data || p.criadoEm)) + '</td>' +
                            '<td>' + esc(rotuloSemana(p.data || hojeISO())) + '</td>' +
                            '<td>' + esc(p.funcionarioNome || '—') + '</td>' +
                            '<td>' + esc(p.forma || '—') + '</td>' +
                            '<td>' + esc(p.obs || '—') + '</td>' +
                            '<td>' + moeda(p.valor) + '</td>' +
                            '<td><button type="button" class="btn btn-secondary" data-excluir-pag-func="' + esc(p.id) + '" style="padding:4px 8px;font-size:0.8rem">Excluir</button></td>' +
                            '</tr>';
                    }).join('');
                }

                var pfData = document.getElementById('pfData');
                if (pfData && !pfData.value) pfData.value = hojeISO();
            });
        }

        document.getElementById('formFuncionario').addEventListener('submit', function (e) {
            e.preventDefault();
            var nome = document.getElementById('pfNomeFunc').value.trim();
            var telefone = document.getElementById('pfTelFunc').value.trim();
            var cargo = document.getElementById('pfCargoFunc').value.trim();
            var obs = document.getElementById('pfObsFunc').value.trim();
            var ativo = document.getElementById('pfAtivoFunc').checked;
            var editId = document.getElementById('pfFuncEditId').value;
            if (!nome) { toast('Informe o nome do funcionário.'); return; }
            comCanalInterno(function () {
                var db = carregar();
                if (!db.funcionarios) db.funcionarios = [];
                var existe = db.funcionarios.some(function (f) {
                    return String(f.nome || '').toLowerCase() === nome.toLowerCase() && f.id !== editId;
                });
                if (existe) { toast('Já existe funcionário com esse nome.'); return; }
                var agora = new Date().toISOString();
                if (editId) {
                    var i = db.funcionarios.findIndex(function (f) { return f.id === editId; });
                    if (i < 0) { toast('Funcionário não encontrado.'); return; }
                    db.funcionarios[i] = Object.assign({}, db.funcionarios[i], {
                        nome: nome,
                        telefone: telefone,
                        cargo: cargo,
                        obs: obs,
                        ativo: ativo,
                        atualizadoEm: agora
                    });
                    toast('Funcionário atualizado.');
                } else {
                    db.funcionarios.push({
                        id: uid(),
                        nome: nome,
                        telefone: telefone,
                        cargo: cargo,
                        obs: obs,
                        ativo: ativo,
                        criadoEm: agora,
                        atualizadoEm: agora
                    });
                    toast('Funcionário cadastrado — já pode comprar no modo interno.');
                }
                salvar(db);
                limparFormFuncionario();
            });
            renderCadastroFuncionarios();
            renderPagFuncionarios();
            preencherSelectFuncionariosVenda();
            preencherSelectResponsavelOs(
                (document.getElementById('atResponsavelId') || {}).value || '',
                ''
            );
            preencherFiltroFuncionarioDos();
        });

        document.getElementById('btnCancelarFunc').addEventListener('click', limparFormFuncionario);
        document.getElementById('buscaFuncionario').addEventListener('input', renderCadastroFuncionarios);
        document.getElementById('btnPagIrCadFunc').addEventListener('click', function () {
            abrirPainel('painelFuncionarios');
        });
        document.getElementById('btnVdIrFuncionarios').addEventListener('click', function () {
            abrirPainel('painelFuncionarios');
        });

        document.getElementById('formPagFuncionario').addEventListener('submit', function (e) {
            e.preventDefault();
            var funcId = document.getElementById('pfFuncId').value;
            var data = document.getElementById('pfData').value || hojeISO();
            var valor = parseMoeda(document.getElementById('pfValor').value);
            var forma = document.getElementById('pfForma').value;
            var obs = document.getElementById('pfObs').value.trim();
            if (!funcId) { toast('Selecione o funcionário.'); return; }
            if (!(valor > 0)) { toast('Informe um valor válido.'); return; }

            comCanalInterno(function () {
                var db = carregar();
                var func = (db.funcionarios || []).find(function (f) { return f.id === funcId; });
                if (!func) { toast('Funcionário não encontrado.'); return; }
                if (!db.pagamentosFuncionarios) db.pagamentosFuncionarios = [];
                if (!db.caixa) db.caixa = [];
                if (!db.caixaBanco) db.caixaBanco = [];

                var pagId = uid();
                var caixaId = uid();
                var desc = 'Pag. funcionário: ' + func.nome + ' · semana ' + rotuloSemana(data) + (obs ? ' — ' + obs : '');
                var ehDinheiro = String(forma).toLowerCase() === 'dinheiro';
                var lanc = {
                    id: caixaId,
                    tipo: 'saida',
                    descricao: desc,
                    valor: valor,
                    forma: forma,
                    conta: ehDinheiro ? 'balcao' : 'banco',
                    funcionarioId: func.id,
                    pagamentoFuncionarioId: pagId,
                    criadoEm: new Date(data + 'T12:00:00').toISOString()
                };
                if (ehDinheiro) db.caixa.push(lanc);
                else db.caixaBanco.push(lanc);

                db.pagamentosFuncionarios.push({
                    id: pagId,
                    funcionarioId: func.id,
                    funcionarioNome: func.nome,
                    data: data,
                    valor: valor,
                    forma: forma,
                    obs: obs,
                    caixaId: caixaId,
                    conta: ehDinheiro ? 'balcao' : 'banco',
                    criadoEm: new Date().toISOString()
                });
                salvar(db);
                document.getElementById('formPagFuncionario').reset();
                document.getElementById('pfData').value = hojeISO();
                toast('Pagamento de ' + func.nome + ' registrado.');
            });
            renderPagFuncionarios();
            renderCaixa();
            renderCaixaBanco();
            renderRelatorioCaixa();
        });

        document.getElementById('tabelaFuncionarios').addEventListener('click', function (e) {
            var btnEd = e.target.closest('[data-ed-func]');
            if (btnEd) {
                var idEd = btnEd.getAttribute('data-ed-func');
                comCanalInterno(function () {
                    var db = carregar();
                    var f = (db.funcionarios || []).find(function (x) { return x.id === idEd; });
                    if (!f) return;
                    document.getElementById('pfFuncEditId').value = f.id;
                    document.getElementById('pfNomeFunc').value = f.nome || '';
                    document.getElementById('pfTelFunc').value = f.telefone || '';
                    document.getElementById('pfCargoFunc').value = f.cargo || '';
                    document.getElementById('pfObsFunc').value = f.obs || '';
                    document.getElementById('pfAtivoFunc').checked = f.ativo !== false;
                    document.getElementById('btnCancelarFunc').style.display = '';
                    document.getElementById('btnSalvarFunc').textContent = 'Salvar alterações';
                    document.getElementById('pfNomeFunc').focus();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
                return;
            }
            var btn = e.target.closest('[data-excluir-func]');
            if (!btn) return;
            var id = btn.getAttribute('data-excluir-func');
            if (!confirm('Excluir este funcionário? Histórico de pagamentos e vendas permanece.')) return;
            comCanalInterno(function () {
                var db = carregar();
                marcarExcluido(db, 'funcionarios', id);
                db.funcionarios = (db.funcionarios || []).filter(function (f) { return f.id !== id; });
                salvar(db);
                toast('Funcionário removido.');
                if (document.getElementById('pfFuncEditId').value === id) limparFormFuncionario();
            });
            renderCadastroFuncionarios();
            renderPagFuncionarios();
            preencherSelectFuncionariosVenda();
            preencherSelectResponsavelOs(
                (document.getElementById('atResponsavelId') || {}).value || '',
                ''
            );
            preencherFiltroFuncionarioDos();
        });

        document.getElementById('tabelaPagFuncionarios').addEventListener('click', function (e) {
            var btn = e.target.closest('[data-excluir-pag-func]');
            if (!btn) return;
            var id = btn.getAttribute('data-excluir-pag-func');
            if (!confirm('Excluir este pagamento e a saída no caixa interno?')) return;
            comCanalInterno(function () {
                var db = carregar();
                var pag = (db.pagamentosFuncionarios || []).find(function (p) { return p.id === id; });
                marcarExcluido(db, 'pagamentosFuncionarios', id);
                db.pagamentosFuncionarios = (db.pagamentosFuncionarios || []).filter(function (p) { return p.id !== id; });
                if (pag) {
                    var cid = pag.caixaId;
                    if (pag.conta === 'banco') {
                        if (cid) marcarExcluido(db, 'caixaBanco', cid);
                        db.caixaBanco = (db.caixaBanco || []).filter(function (x) {
                            if (x.id === cid) return false;
                            if (x.pagamentoFuncionarioId === id) {
                                marcarExcluido(db, 'caixaBanco', x.id);
                                return false;
                            }
                            return true;
                        });
                    } else {
                        if (cid) marcarExcluido(db, 'caixa', cid);
                        db.caixa = (db.caixa || []).filter(function (x) {
                            if (x.id === cid) return false;
                            if (x.pagamentoFuncionarioId === id) {
                                marcarExcluido(db, 'caixa', x.id);
                                return false;
                            }
                            return true;
                        });
                    }
                }
                salvar(db);
                toast('Pagamento excluído.');
            });
            renderPagFuncionarios();
            renderCaixa();
            renderCaixaBanco();
            renderRelatorioCaixa();
        });

        document.getElementById('btnAtualizarPagFunc').addEventListener('click', function () {
            renderPagFuncionarios();
            toast('Lista atualizada.');
        });
        document.getElementById('buscaPagFunc').addEventListener('input', renderPagFuncionarios);


        /* ---------- Pastas mensais — Despesas por OS (Modo Interno) ---------- */
        function listarOsDoMes(mesAno) {
            var main = carregarMain();
            return (main.atendimentos || []).filter(function (a) {
                return !osFinalizadaInterno(a) && mesAnoDeIso(a.entrada || a.criadoEm) === mesAno;
            }).map(function (a) {
                var r = resumoLucroOs(a);
                var despesas = listarDespesasInternasPorOs(a.id);
                return {
                    id: a.id,
                    data: fmtData(a.entrada || a.criadoEm),
                    cliente: nomeAtendimento(main, a),
                    placa: (a.placa || '—').toUpperCase(),
                    carro: a.carro || '—',
                    status: a.status || '—',
                    bruto: r.bruto,
                    despesas: r.despesas,
                    lucro: r.lucro,
                    lancamentosDespesa: despesas.map(function (x) {
                        return {
                            data: fmtData(x.criadoEm),
                            descricao: x.descricao || '—',
                            forma: x.forma || '—',
                            valor: Number(x.valor) || 0
                        };
                    })
                };
            }).sort(function (a, b) {
                return String(b.data).split('/').reverse().join('').localeCompare(String(a.data).split('/').reverse().join(''));
            });
        }

        function montarArvoreDespesasOs() {
            var main = carregarMain();
            var arvore = {};
            (main.atendimentos || []).forEach(function (a) {
                if (osFinalizadaInterno(a)) return;
                var ma = mesAnoDeIso(a.entrada || a.criadoEm);
                if (!ma) return;
                var p = ma.split('/');
                var ano = p[1];
                var mesNum = p[0];
                var mesNome = MES_NOMES_CX[mesNum] || mesNum;
                if (!arvore[ano]) arvore[ano] = {};
                if (!arvore[ano][mesNome]) {
                    arvore[ano][mesNome] = { mesNum: mesNum, mesAno: ma, os: [] };
                }
                var r = resumoLucroOs(a);
                arvore[ano][mesNome].os.push({
                    id: a.id,
                    data: fmtData(a.entrada || a.criadoEm),
                    cliente: nomeAtendimento(main, a),
                    placa: (a.placa || '—').toUpperCase(),
                    carro: a.carro || '—',
                    status: a.status || '—',
                    bruto: r.bruto,
                    despesas: r.despesas,
                    lucro: r.lucro,
                    lancamentos: listarDespesasInternasPorOs(a.id)
                });
            });
            return arvore;
        }

        function htmlCorpoRelatorioDespesasOs(listaOs) {
            var totB = 0, totD = 0, totL = 0;
            var linhasOs = '';
            var linhasDesp = '';
            listaOs.forEach(function (o) {
                totB += o.bruto;
                totD += o.despesas;
                totL += o.lucro;
                linhasOs +=
                    '<tr>' +
                    '<td style="padding:6px;border-bottom:1px solid #ddd">' + esc(o.data) + '</td>' +
                    '<td style="padding:6px;border-bottom:1px solid #ddd">' + esc(o.cliente) + '</td>' +
                    '<td style="padding:6px;border-bottom:1px solid #ddd">' + esc(o.carro) + ' · ' + esc(o.placa) + '</td>' +
                    '<td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;color:#27ae60;font-weight:bold">' + moeda(o.bruto) + '</td>' +
                    '<td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;color:#e74c3c;font-weight:bold">' + moeda(o.despesas) + '</td>' +
                    '<td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;color:#2980b9;font-weight:bold">' + moeda(o.lucro) + '</td>' +
                    '</tr>';
                (o.lancamentosDespesa || o.lancamentos || []).forEach(function (d) {
                    linhasDesp +=
                        '<tr>' +
                        '<td style="padding:6px;border-bottom:1px solid #ddd">' + esc(d.data || fmtData(d.criadoEm)) + '</td>' +
                        '<td style="padding:6px;border-bottom:1px solid #ddd">' + esc(o.placa) + '</td>' +
                        '<td style="padding:6px;border-bottom:1px solid #ddd">' + esc(d.descricao) + '</td>' +
                        '<td style="padding:6px;border-bottom:1px solid #ddd">' + esc(d.forma) + '</td>' +
                        '<td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;color:#e74c3c;font-weight:bold">' + moeda(d.valor) + '</td>' +
                        '</tr>';
                });
            });
            if (!linhasOs) linhasOs = '<tr><td colspan="6" style="padding:10px;text-align:center;color:#777">Nenhuma OS neste período.</td></tr>';
            if (!linhasDesp) linhasDesp = '<tr><td colspan="5" style="padding:10px;text-align:center;color:#777">Nenhuma despesa interna neste período.</td></tr>';

            return {
                html:
                    '<div class="resumo">' +
                    '<div class="resumo-box" style="color:#27ae60">BRUTO (OS)<b>' + moeda(totB) + '</b></div>' +
                    '<div class="resumo-box" style="color:#e74c3c">DESPESAS INTERNAS<b>' + moeda(totD) + '</b></div>' +
                    '<div class="resumo-box" style="color:#2980b9">LUCRO ESTIMADO<b>' + moeda(totL) + '</b></div>' +
                    '</div>' +
                    '<div class="section-title entrada"><span>BRUTO / ENTRADAS POR OS</span><span>TOTAL: ' + moeda(totB) + '</span></div>' +
                    '<table><thead><tr><th>Data</th><th>Cliente</th><th>Veículo / Placa</th><th style="text-align:right">Bruto</th><th style="text-align:right">Despesas</th><th style="text-align:right">Lucro</th></tr></thead>' +
                    '<tbody>' + linhasOs + '</tbody></table>' +
                    '<div class="section-title saida"><span>DESPESAS / SAÍDAS INTERNAS</span><span>TOTAL: ' + moeda(totD) + '</span></div>' +
                    '<table><thead><tr><th>Data</th><th>Placa</th><th>Descrição</th><th>Forma</th><th style="text-align:right">Valor</th></tr></thead>' +
                    '<tbody>' + linhasDesp + '</tbody></table>',
                totBruto: totB,
                totDespesas: totD,
                totLucro: totL
            };
        }

        function gerarRelatorioMensalDespesasOsPDF(mesAnoFixo) {
            var mesAno = mesAnoFixo || prompt('Digite o mês e ano do relatório de despesas por OS (Ex: 07/2026):', mesAnoAtualPadrao());
            if (!mesAno) return;
            mesAno = String(mesAno).trim();
            if (!/^\d{2}\/\d{4}$/.test(mesAno)) {
                alert('Use o formato MM/AAAA (Ex: 07/2026).');
                return;
            }
            var lista = listarOsDoMes(mesAno);
            if (!lista.length) {
                alert('Nenhuma OS encontrada para o período: ' + mesAno);
                return;
            }
            var emp = getEmpresa(carregarMain());
            var montado = htmlCorpoRelatorioDespesasOs(lista);
            var html =
                '<div class="nota-espelho relatorio-mensal-print">' +
                htmlCabecalhoNotaEmpresa(emp,
                    '<div class="nota-sub nota-titulo-espelho">RELATÓRIO MENSAL — LUCRO POR OS (INTERNO)</div>' +
                    '<div class="nota-sub">Competência: ' + esc(mesAno) + ' · ' + esc(pastaMesLabel(mesAno)) + '</div>'
                ) +
                '<style>' +
                '.relatorio-mensal-print .resumo{display:flex;justify-content:space-around;flex-wrap:wrap;gap:10px;background:#f4f4f4;padding:12px;border:1px solid #ccc;margin:12px 0}' +
                '.relatorio-mensal-print .resumo-box{text-align:center;font-size:11px}' +
                '.relatorio-mensal-print .resumo-box b{display:block;font-size:14px;margin-top:4px}' +
                '.relatorio-mensal-print .section-title{padding:8px 10px;font-size:11px;font-weight:bold;margin-top:18px;text-transform:uppercase;border-radius:4px 4px 0 0;display:flex;justify-content:space-between;color:#fff}' +
                '.relatorio-mensal-print .section-title.entrada{background:#27ae60}' +
                '.relatorio-mensal-print .section-title.saida{background:#e74c3c}' +
                '.relatorio-mensal-print table{width:100%;border-collapse:collapse;margin-bottom:8px;font-size:11px}' +
                '.relatorio-mensal-print th{background:#ecf0f1;color:#111;padding:8px;text-align:left;font-size:10px;border-bottom:2px solid #bdc3c7}' +
                '</style>' +
                montado.html +
                '<div style="text-align:center;margin-top:24px;font-size:9px;color:#777">' +
                'Documento interno · HM Centro Automotivo · ' + esc(new Date().toLocaleString('pt-BR')) +
                '</div></div>';
            executarImpressaoHtml(html);
        }

        function gerarArvorePastasDespesasOs() {
            var el = document.getElementById('arvorePastasDespesasOs');
            if (!el) return;
            var arvore = montarArvoreDespesasOs();
            var anos = Object.keys(arvore).sort().reverse();
            if (!anos.length) {
                el.innerHTML = '<div class="muted" style="padding:10px;text-align:center">Ainda não há OS oficiais para montar as pastas do mês.</div>';
                return;
            }
            var html = '';
            var idc = 0;
            anos.forEach(function (ano) {
                idc++;
                var idAno = 'pasta_dos_ano_' + idc;
                html += '<div class="pasta-cx-ano" onclick="togglePastaCaixa(\'' + idAno + '\')">📁 Ano: ' + esc(ano) + '</div>';
                html += '<div id="' + idAno + '" style="display:none">';
                Object.keys(arvore[ano]).forEach(function (mesNome) {
                    var bucket = arvore[ano][mesNome];
                    var totB = 0, totD = 0, totL = 0;
                    bucket.os.forEach(function (o) {
                        totB += o.bruto;
                        totD += o.despesas;
                        totL += o.lucro;
                    });
                    idc++;
                    var idMes = 'pasta_dos_mes_' + idc;
                    html += '<div class="pasta-cx-mes" onclick="togglePastaCaixa(\'' + idMes + '\')">📂 Mês: ' +
                        esc(mesNome) + ' <small style="font-weight:500;opacity:.85">(' + esc(bucket.mesAno) +
                        ' · ' + bucket.os.length + ' OS · lucro ' + moeda(totL) + ')</small></div>';
                    html += '<div class="pasta-cx-mes-acoes">' +
                        '<button type="button" class="btn btn-pdf" style="padding:6px 10px;font-size:12px" data-dos-rel="' +
                        esc(bucket.mesAno) + '">📄 Relatório geral</button>' +
                        '<button type="button" class="btn btn-secondary" style="padding:6px 10px;font-size:12px" data-dos-arquivar="' +
                        esc(bucket.mesAno) + '">📂 Arquivar no PC</button></div>';
                    html += '<div id="' + idMes + '" style="display:none">';

                    /* Bruto / Entradas */
                    idc++;
                    var idE = 'pasta_dos_e_' + idc;
                    html += '<div class="pasta-cx-tipo" onclick="togglePastaCaixa(\'' + idE + '\')">✅ Bruto / Entradas (' +
                        bucket.os.length + ' OS · ' + moeda(totB) + ')</div>';
                    html += '<div id="' + idE + '" class="pasta-cx-conteudo" style="display:none">';
                    if (!bucket.os.length) {
                        html += '<div class="muted">Nenhuma OS neste mês.</div>';
                    } else {
                        bucket.os.forEach(function (o) {
                            html += '<div class="pasta-cx-item">' +
                                '<span><strong>' + esc(o.data) + '</strong> · ' + esc(o.cliente) +
                                ' · ' + esc(o.placa) +
                                ' <button type="button" class="btn btn-primary" style="padding:3px 8px;font-size:11px;margin-left:8px" data-dos-abrir-pasta="' +
                                esc(o.id) + '">Despesas</button></span>' +
                                '<span class="val-ent">' + moeda(o.bruto) + '</span></div>';
                        });
                    }
                    html += '</div>';

                    /* Despesas / Saídas */
                    idc++;
                    var idS = 'pasta_dos_s_' + idc;
                    var qtdDesp = 0;
                    bucket.os.forEach(function (o) { qtdDesp += (o.lancamentos || []).length; });
                    html += '<div class="pasta-cx-tipo" onclick="togglePastaCaixa(\'' + idS + '\')">🔻 Despesas / Saídas (' +
                        qtdDesp + ' · ' + moeda(totD) + ')</div>';
                    html += '<div id="' + idS + '" class="pasta-cx-conteudo" style="display:none">';
                    if (!qtdDesp) {
                        html += '<div class="muted">Nenhuma despesa interna lançada neste mês.</div>';
                    } else {
                        bucket.os.forEach(function (o) {
                            (o.lancamentos || []).forEach(function (d) {
                                html += '<div class="pasta-cx-item">' +
                                    '<span><strong>[' + esc(o.placa) + ']</strong> ' + esc(fmtData(d.criadoEm)) +
                                    ' · ' + esc(d.descricao || '—') +
                                    ' <small class="muted">(' + esc(d.forma || '—') + ')</small></span>' +
                                    '<span class="val-sai">' + moeda(d.valor) + '</span></div>';
                            });
                        });
                    }
                    html += '</div>';

                    /* Relatório / Lucro */
                    idc++;
                    var idL = 'pasta_dos_l_' + idc;
                    html += '<div class="pasta-cx-tipo" onclick="togglePastaCaixa(\'' + idL + '\')">📊 Lucro / Relatório (' +
                        moeda(totL) + ')</div>';
                    html += '<div id="' + idL + '" class="pasta-cx-conteudo" style="display:none">' +
                        '<div class="pasta-cx-item"><span>Total bruto</span><span class="val-ent">' + moeda(totB) + '</span></div>' +
                        '<div class="pasta-cx-item"><span>Total despesas</span><span class="val-sai">' + moeda(totD) + '</span></div>' +
                        '<div class="pasta-cx-item"><span><strong>Lucro estimado do mês</strong></span><span class="val-ent"><strong>' +
                        moeda(totL) + '</strong></span></div></div>';

                    html += '</div>';
                });
                html += '</div>';
            });
            el.innerHTML = html;

            el.querySelectorAll('[data-dos-rel]').forEach(function (b) {
                b.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    gerarRelatorioMensalDespesasOsPDF(b.getAttribute('data-dos-rel'));
                });
            });
            el.querySelectorAll('[data-dos-arquivar]').forEach(function (b) {
                b.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    arquivarMesDespesasOsPastaPC(b.getAttribute('data-dos-arquivar'));
                });
            });
            el.querySelectorAll('[data-dos-abrir-pasta]').forEach(function (b) {
                b.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    abrirLancarDespesaOs(b.getAttribute('data-dos-abrir-pasta'));
                });
            });
        }

        async function arquivarMesDespesasOsPastaPC(mesAnoFixo) {
            if (!('showDirectoryPicker' in window)) {
                toast('Arquivar na pasta do PC só funciona no Chrome/Edge no computador.');
                return;
            }
            var mesAno = mesAnoFixo || prompt('Qual mês de despesas por OS arquivar? (Ex: 07/2026)', mesAnoAtualPadrao());
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

            var lista = listarOsDoMes(mesAno);
            if (!lista.length) {
                alert('Nenhuma OS para arquivar em ' + mesAno);
                return;
            }
            var emp = getEmpresa(carregarMain());
            var montado = htmlCorpoRelatorioDespesasOs(lista);
            var entradas = lista.map(function (o) {
                return { data: o.data, cliente: o.cliente, placa: o.placa, carro: o.carro, bruto: o.bruto, status: o.status };
            });
            var saidas = [];
            lista.forEach(function (o) {
                (o.lancamentosDespesa || []).forEach(function (d) {
                    saidas.push({
                        data: d.data,
                        placa: o.placa,
                        cliente: o.cliente,
                        descricao: d.descricao,
                        forma: d.forma,
                        valor: d.valor
                    });
                });
            });

            var partes = mesAno.split('/');
            var ano = partes[1];
            var mesNum = partes[0];
            var mesNome = MES_NOMES_CX[mesNum] || mesNum;
            var nomePastaMes = mesNum + '-' + slugPasta(mesNome);

            var htmlEntradas =
                '<div class="resumo"><div class="resumo-box" style="color:#27ae60">BRUTO TOTAL<b>' + moeda(montado.totBruto) + '</b></div></div>' +
                '<table><thead><tr><th>Data</th><th>Cliente</th><th>Veículo / Placa</th><th style="text-align:right">Bruto</th></tr></thead><tbody>' +
                entradas.map(function (o) {
                    return '<tr><td>' + esc(o.data) + '</td><td>' + esc(o.cliente) + '</td><td>' +
                        esc(o.carro) + ' · ' + esc(o.placa) + '</td><td style="text-align:right;color:#27ae60;font-weight:bold">' +
                        moeda(o.bruto) + '</td></tr>';
                }).join('') + '</tbody></table>';

            var htmlSaidas =
                '<div class="resumo"><div class="resumo-box" style="color:#e74c3c">DESPESAS TOTAL<b>' + moeda(montado.totDespesas) + '</b></div></div>' +
                '<table><thead><tr><th>Data</th><th>Placa</th><th>Descrição</th><th>Forma</th><th style="text-align:right">Valor</th></tr></thead><tbody>' +
                (saidas.length ? saidas.map(function (d) {
                    return '<tr><td>' + esc(d.data) + '</td><td>' + esc(d.placa) + '</td><td>' + esc(d.descricao) +
                        '</td><td>' + esc(d.forma) + '</td><td style="text-align:right;color:#e74c3c;font-weight:bold">' +
                        moeda(d.valor) + '</td></tr>';
                }).join('') : '<tr><td colspan="5" style="text-align:center;color:#777;padding:10px">Sem despesas neste mês.</td></tr>') +
                '</tbody></table>';

            try {
                var pastaRaizDos = await root.getDirectoryHandle('Despesas-OS', { create: true });
                var pastaAno = await pastaRaizDos.getDirectoryHandle(ano, { create: true });
                var pastaMes = await pastaAno.getDirectoryHandle(nomePastaMes, { create: true });
                var pastaEntradas = await pastaMes.getDirectoryHandle('Entradas', { create: true });
                var pastaSaidas = await pastaMes.getDirectoryHandle('Saidas', { create: true });

                await gravarTextoNaPasta(pastaEntradas, 'bruto-os-' + mesNum + '-' + ano + '.html',
                    htmlArquivoRelatorioMes(emp, 'BRUTO / ENTRADAS POR OS', mesAno, htmlEntradas));
                await gravarTextoNaPasta(pastaEntradas, 'bruto-os-' + mesNum + '-' + ano + '.json',
                    JSON.stringify(entradas, null, 2));

                await gravarTextoNaPasta(pastaSaidas, 'despesas-' + mesNum + '-' + ano + '.html',
                    htmlArquivoRelatorioMes(emp, 'DESPESAS / SAÍDAS INTERNAS', mesAno, htmlSaidas));
                await gravarTextoNaPasta(pastaSaidas, 'despesas-' + mesNum + '-' + ano + '.json',
                    JSON.stringify(saidas, null, 2));

                await gravarTextoNaPasta(pastaMes, 'Relatorio-Geral-Lucro-OS-' + mesNum + '-' + ano + '.html',
                    htmlArquivoRelatorioMes(emp, 'RELATÓRIO MENSAL — LUCRO POR OS (INTERNO)', mesAno, montado.html));
                await gravarTextoNaPasta(pastaMes, 'resumo-lucro-os-' + mesNum + '-' + ano + '.json', JSON.stringify({
                    mesAno: mesAno,
                    mes: mesNome,
                    geradoEm: new Date().toISOString(),
                    totais: {
                        bruto: montado.totBruto,
                        despesas: montado.totDespesas,
                        lucro: montado.totLucro
                    },
                    qtdOs: lista.length,
                    os: lista
                }, null, 2));

                toast('Mês ' + mesAno + ' arquivado em Despesas-OS/' + ano + '/' + nomePastaMes);
                alert(
                    'Pasta de despesas por OS criada!\n\n' +
                    root.name + '/Despesas-OS/' + ano + '/' + nomePastaMes + '/\n' +
                    '  ├─ Entradas/  (bruto das OS)\n' +
                    '  ├─ Saidas/    (despesas internas)\n' +
                    '  └─ Relatorio-Geral-Lucro-OS-…html\n\n' +
                    'Bruto: ' + moeda(montado.totBruto) +
                    '\nDespesas: ' + moeda(montado.totDespesas) +
                    '\nLucro: ' + moeda(montado.totLucro)
                );
            } catch (err) {
                console.error(err);
                toast('Falha ao gravar a pasta de despesas por OS no PC.');
            }
        }

        function renderRelatorioCaixa() {
            var db = carregar();
            var cfg = getCaixaConfig(db);
            var balEnt = somarLista(db.caixa, 'entrada');
            var balSai = somarLista(db.caixa, 'saida');
            var banEnt = somarLista(db.caixaBanco, 'entrada');
            var banSai = somarLista(db.caixaBanco, 'saida');
            var pend = (db.pendentes || []).reduce(function (s, p) { return s + (Number(p.valor) || 0); }, 0);
            var salBal = (Number(cfg.inicialBalcao) || 0) + balEnt - balSai;
            var salBan = (Number(cfg.inicialBanco) || 0) + banEnt - banSai;
            document.getElementById('relCxBalcao').textContent = moeda(salBal);
            document.getElementById('relCxBanco').textContent = moeda(salBan);
            document.getElementById('relCxPend').textContent = moeda(pend);
            document.getElementById('relCxGeral').textContent = moeda(salBal + salBan);

            var mapa = {};
            function acum(origem, item) {
                var k = origem + '|' + (item.forma || '—') + '|' + (item.tipo || '—');
                if (!mapa[k]) mapa[k] = { origem: origem, forma: item.forma || '—', tipo: item.tipo || '—', qtd: 0, total: 0 };
                mapa[k].qtd++;
                mapa[k].total += Number(item.valor) || 0;
            }
            (db.caixa || []).forEach(function (x) { acum('Balcão', x); });
            (db.caixaBanco || []).forEach(function (x) { acum('Banco', x); });

            var tb = document.getElementById('tabelaRelCx');
            var rows = Object.keys(mapa).map(function (k) { return mapa[k]; });
            tb.innerHTML = '';
            if (!rows.length) {
                tb.innerHTML = '<tr><td colspan="5" class="muted">Sem movimentações para resumir.</td></tr>';
            } else {
                rows.sort(function (a, b) { return a.origem.localeCompare(b.origem) || a.forma.localeCompare(b.forma); });
                rows.forEach(function (r) {
                    var tr = document.createElement('tr');
                    tr.innerHTML =
                        '<td>' + esc(r.origem) + '</td>' +
                        '<td>' + esc(r.forma) + '</td>' +
                        '<td>' + esc(r.tipo) + '</td>' +
                        '<td>' + r.qtd + '</td>' +
                        '<td>' + moeda(r.total) + '</td>';
                    tb.appendChild(tr);
                });
            }

            /* No modo interno: resumo de lucro por OS (despesas vinculadas) */
            var boxRel = document.getElementById('relCxConteudo');
            var oldLucro = document.getElementById('relLucroOsBox');
            if (oldLucro) oldLucro.remove();
            if (canalVendas === 'interno') {
                var main = carregarMain();
                var linhasLucro = [];
                var totBruto = 0, totDesp = 0;
                (main.atendimentos || []).forEach(function (a) {
                    var r = resumoLucroOs(a);
                    if (r.despesas <= 0 && r.bruto <= 0) return;
                    if (r.despesas <= 0) return; /* só OS com despesa interna */
                    totBruto += r.bruto;
                    totDesp += r.despesas;
                    linhasLucro.push({
                        data: fmtData(a.entrada || a.criadoEm),
                        cliente: nomeAtendimento(main, a),
                        placa: (a.placa || '—').toUpperCase(),
                        bruto: r.bruto,
                        despesas: r.despesas,
                        lucro: r.lucro
                    });
                });
                var wrap = document.createElement('div');
                wrap.id = 'relLucroOsBox';
                wrap.style.marginTop = '18px';
                if (!linhasLucro.length) {
                    wrap.innerHTML = '<h2>Lucro por OS (despesas internas)</h2><p class="muted">Nenhuma despesa vinculada a OS ainda.</p>';
                } else {
                    wrap.innerHTML =
                        '<h2>Lucro por OS (despesas internas)</h2>' +
                        '<p class="hint">Bruto das OS oficiais − saídas do caixa interno vinculadas. Total despesas: <strong>' +
                        moeda(totDesp) + '</strong> · Lucro: <strong>' + moeda(totBruto - totDesp) + '</strong></p>' +
                        '<table><thead><tr><th>Data</th><th>Cliente</th><th>Placa</th><th>Bruto</th><th>Despesas</th><th>Lucro</th></tr></thead>' +
                        '<tbody>' +
                        linhasLucro.map(function (r) {
                            return '<tr><td>' + esc(r.data) + '</td><td>' + esc(r.cliente) + '</td><td>' +
                                esc(r.placa) + '</td><td>' + moeda(r.bruto) + '</td><td>' +
                                moeda(r.despesas) + '</td><td><strong>' + moeda(r.lucro) + '</strong></td></tr>';
                        }).join('') +
                        '</tbody></table>';
                }
                boxRel.appendChild(wrap);
            }

            gerarArvorePastasCaixa({ elId: 'arvorePastasCaixa', filtro: 'geral', idPrefix: 'pasta_cx' });
        }

        document.getElementById('btnAtualizarRelCx').addEventListener('click', function () {
            renderRelatorioCaixa();
            toast('Relatório atualizado.');
        });
        document.getElementById('btnImprimirRelCx').addEventListener('click', function () {
            renderRelatorioCaixa();
            var db = carregar();
            var emp = getEmpresa(db);
            executarImpressaoHtml(
                '<div class="nota-espelho">' +
                htmlCabecalhoNotaEmpresa(emp,
                    '<div class="nota-sub nota-titulo-espelho">Relatório de Caixa · ' + esc(fmtData(hojeISO())) + '</div>'
                ) +
                document.getElementById('relCxConteudo').innerHTML +
                '<div style="margin-top:12px">Balcão: <strong>' + document.getElementById('relCxBalcao').textContent +
                '</strong> · Banco: <strong>' + document.getElementById('relCxBanco').textContent +
                '</strong> · Pendentes: <strong>' + document.getElementById('relCxPend').textContent +
                '</strong> · Geral: <strong>' + document.getElementById('relCxGeral').textContent + '</strong></div></div>'
            );
        });

        /* ---------- Relatório unificado (oficial + interno) ---------- */
        function resumoCanalCaixa(dbCanal) {
            var cfg = getCaixaConfig(dbCanal);
            var balEnt = somarLista(dbCanal.caixa, 'entrada');
            var balSai = somarLista(dbCanal.caixa, 'saida');
            var banEnt = somarLista(dbCanal.caixaBanco, 'entrada');
            var banSai = somarLista(dbCanal.caixaBanco, 'saida');
            var pend = (dbCanal.pendentes || []).reduce(function (s, p) {
                return s + (Number(p.valor) || 0);
            }, 0);
            var salBal = (Number(cfg.inicialBalcao) || 0) + balEnt - balSai;
            var salBan = (Number(cfg.inicialBanco) || 0) + banEnt - banSai;
            return {
                balcaoEntradas: balEnt,
                balcaoSaidas: balSai,
                balcaoSaldo: salBal,
                bancoEntradas: banEnt,
                bancoSaidas: banSai,
                bancoSaldo: salBan,
                pendentes: pend,
                saldoCaixa: salBal + salBan
            };
        }

        function montarResumoUnificado() {
            var main = carregarMain();
            var intDb = carregarInternoRaw();
            var off = resumoCanalCaixa(main);
            var inn = resumoCanalCaixa(intDb);
            var totBruto = 0, totCusto = 0, totLucro = 0, qtdOs = 0;
            var linhasOs = [];
            (main.atendimentos || []).forEach(function (a) {
                if (!a) return;
                var r = resumoLucroOs(a);
                if (r.bruto <= 0 && r.despesas <= 0) return;
                qtdOs++;
                totBruto += r.bruto;
                totCusto += r.despesas;
                totLucro += r.lucro;
                linhasOs.push({
                    data: fmtData(a.entrada || a.criadoEm),
                    cliente: nomeAtendimento(main, a),
                    placa: (a.placa || '—').toUpperCase(),
                    bruto: r.bruto,
                    custoPecas: r.custoPecas || 0,
                    desp: r.despesasLancadas != null ? r.despesasLancadas : (r.despesas - (r.custoPecas || 0)),
                    lucro: r.lucro
                });
            });
            return {
                oficial: off,
                interno: inn,
                pendentesTotal: off.pendentes + inn.pendentes,
                totalUnificado: off.saldoCaixa + inn.saldoCaixa,
                os: {
                    qtd: qtdOs,
                    bruto: totBruto,
                    custos: totCusto,
                    lucro: totLucro,
                    linhas: linhasOs
                }
            };
        }

        function renderRelatorioUnificado() {
            var elDet = document.getElementById('relUnifDetalhe');
            if (!elDet) return;
            var r = montarResumoUnificado();
            document.getElementById('relUnifOficial').textContent = moeda(r.oficial.saldoCaixa);
            document.getElementById('relUnifInterno').textContent = moeda(r.interno.saldoCaixa);
            document.getElementById('relUnifPend').textContent = moeda(r.pendentesTotal);
            document.getElementById('relUnifTotal').textContent = moeda(r.totalUnificado);
            document.getElementById('relUnifBrutoOs').textContent = moeda(r.os.bruto);
            document.getElementById('relUnifCustoOs').textContent = moeda(r.os.custos);
            document.getElementById('relUnifLucroOs').textContent = moeda(r.os.lucro);

            function blocoCanal(titulo, c) {
                return '<div class="nota-bloco compacto" style="margin-bottom:12px">' +
                    '<div class="tit escuro" style="padding:8px 10px;font-weight:800">' + esc(titulo) + '</div>' +
                    '<table style="width:100%;margin-top:8px"><thead><tr>' +
                    '<th>Conta</th><th>Entradas</th><th>Saídas</th><th>Saldo</th></tr></thead><tbody>' +
                    '<tr><td>Balcão</td><td>' + moeda(c.balcaoEntradas) + '</td><td>' + moeda(c.balcaoSaidas) +
                    '</td><td><strong>' + moeda(c.balcaoSaldo) + '</strong></td></tr>' +
                    '<tr><td>Banco (PIX/cartão)</td><td>' + moeda(c.bancoEntradas) + '</td><td>' + moeda(c.bancoSaidas) +
                    '</td><td><strong>' + moeda(c.bancoSaldo) + '</strong></td></tr>' +
                    '<tr><td>Pendentes</td><td colspan="2">A receber</td><td><strong>' + moeda(c.pendentes) + '</strong></td></tr>' +
                    '<tr><td colspan="3"><strong>Saldo do canal</strong></td><td><strong style="color:#27ae60">' +
                    moeda(c.saldoCaixa) + '</strong></td></tr>' +
                    '</tbody></table></div>';
            }

            var htmlOs = '';
            if (r.os.linhas.length) {
                htmlOs =
                    '<div class="nota-bloco compacto" style="margin-top:14px">' +
                    '<div class="tit verde" style="padding:8px 10px;font-weight:800">Lucro das OS (bruto − despesas − custo peças)</div>' +
                    '<p class="hint" style="margin:8px 0">' + r.os.qtd + ' OS · Bruto ' + moeda(r.os.bruto) +
                    ' · Custos ' + moeda(r.os.custos) + ' · Lucro <strong>' + moeda(r.os.lucro) + '</strong></p>' +
                    '<table><thead><tr><th>Data</th><th>Cliente</th><th>Placa</th><th>Bruto</th><th>Desp.</th><th>Custo peças</th><th>Lucro</th></tr></thead><tbody>' +
                    r.os.linhas.map(function (l) {
                        return '<tr><td>' + esc(l.data) + '</td><td>' + esc(l.cliente) + '</td><td>' + esc(l.placa) +
                            '</td><td>' + moeda(l.bruto) + '</td><td>' + moeda(l.desp) + '</td><td>' +
                            moeda(l.custoPecas) + '</td><td><strong>' + moeda(l.lucro) + '</strong></td></tr>';
                    }).join('') +
                    '</tbody></table></div>';
            } else {
                htmlOs = '<p class="muted" style="margin-top:12px">Nenhuma OS com valores para lucro ainda.</p>';
            }

            elDet.innerHTML =
                '<p class="hint">Oficial = balcão/banco do menu Caixa. Interno = vendas p/ funcionário e despesas lançadas no modo interno.</p>' +
                blocoCanal('Caixa oficial', r.oficial) +
                blocoCanal('Caixa interno', r.interno) +
                '<div style="padding:12px;border:2px solid #27ae60;border-radius:10px;margin:12px 0">' +
                '<strong>Total unificado (oficial + interno):</strong> ' +
                '<span style="font-size:1.25rem;font-weight:800;color:#2ecc71">' + moeda(r.totalUnificado) + '</span>' +
                '<div class="muted" style="margin-top:6px">Pendentes somados (não entram no saldo de caixa): ' +
                moeda(r.pendentesTotal) + '</div></div>' +
                htmlOs;
        }

        function imprimirRelatorioUnificado() {
            renderRelatorioUnificado();
            var main = carregarMain();
            var emp = getEmpresa(main);
            var r = montarResumoUnificado();
            var html =
                '<div class="nota-espelho">' +
                htmlCabecalhoNotaEmpresa(emp,
                    '<div class="nota-sub nota-titulo-espelho">RELATÓRIO UNIFICADO</div>' +
                    '<div class="nota-sub nota-registro">Oficial + Interno · ' + esc(fmtData(hojeISO())) + '</div>'
                ) +
                '<div class="nota-bloco compacto"><div class="tit azul">Resumo</div><div class="nota-valores-pad compacto">' +
                '<div>Caixa oficial: <strong>' + moeda(r.oficial.saldoCaixa) + '</strong></div>' +
                '<div>Caixa interno: <strong>' + moeda(r.interno.saldoCaixa) + '</strong></div>' +
                '<div>Pendentes (oficial+interno): <strong>' + moeda(r.pendentesTotal) + '</strong></div>' +
                '<div class="nota-total compacto">Total unificado: ' + moeda(r.totalUnificado) + '</div>' +
                '<div style="margin-top:8px">Bruto OS: <strong>' + moeda(r.os.bruto) +
                '</strong> · Custos OS: <strong>' + moeda(r.os.custos) +
                '</strong> · Lucro OS: <strong>' + moeda(r.os.lucro) + '</strong></div>' +
                '</div></div>' +
                document.getElementById('relUnifDetalhe').innerHTML +
                '</div>';
            _htmlNotaImpressaoAtual = html;
            _tituloNotaImpressao = 'Relatório unificado';
            if (ehCelular()) {
                abrirViewerPdf(html, 'Relatório unificado');
            } else {
                executarImpressaoHtml(html);
            }
            toast('Relatório unificado pronto.');
        }

        var btnAtUnif = document.getElementById('btnAtualizarRelUnif');
        if (btnAtUnif) {
            btnAtUnif.addEventListener('click', function () {
                renderRelatorioUnificado();
                toast('Relatório unificado atualizado.');
            });
        }
        var btnImpUnif = document.getElementById('btnImprimirRelUnif');
        if (btnImpUnif) {
            btnImpUnif.addEventListener('click', imprimirRelatorioUnificado);
        }

        document.querySelectorAll('[data-rel-mes]').forEach(function (b) {
            if (b.hasAttribute('data-rel-mes-fixo')) return;
            b.addEventListener('click', function () {
                gerarRelatorioMensalPDF(b.getAttribute('data-rel-mes') || 'geral');
            });
        });
        document.getElementById('btnAtualizarPastasCx').addEventListener('click', function () {
            gerarArvorePastasCaixa({ elId: 'arvorePastasCaixa', filtro: 'geral', idPrefix: 'pasta_cx' });
            toast('Pastas atualizadas.');
        });
        document.getElementById('btnArquivarMesPc').addEventListener('click', function () {
            arquivarMesPastaPC(null, 'geral');
        });

        document.getElementById('btnAtualizarPastasBalcao').addEventListener('click', function () {
            gerarArvorePastasCaixa({ elId: 'arvorePastasBalcao', filtro: 'balcao', idPrefix: 'pasta_bal' });
            toast('Pastas do balcão atualizadas.');
        });
        document.getElementById('btnRelMesBalcao').addEventListener('click', function () {
            gerarRelatorioMensalPDF('balcao');
        });
        document.getElementById('btnArquivarMesBalcao').addEventListener('click', function () {
            arquivarMesPastaPC(null, 'balcao');
        });

        document.getElementById('btnAtualizarPastasBanco').addEventListener('click', function () {
            gerarArvorePastasCaixa({ elId: 'arvorePastasBanco', filtro: 'banco', idPrefix: 'pasta_ban' });
            toast('Pastas do banco atualizadas.');
        });
        document.getElementById('btnRelMesBanco').addEventListener('click', function () {
            gerarRelatorioMensalPDF('banco');
        });
        document.getElementById('btnArquivarMesBanco').addEventListener('click', function () {
            arquivarMesPastaPC(null, 'banco');
        });

        document.getElementById('btnAtualizarPastasPend').addEventListener('click', function () {
            gerarArvorePastasCaixa({ elId: 'arvorePastasPendentes', filtro: 'pendentes', idPrefix: 'pasta_pen' });
            toast('Pastas a receber atualizadas.');
        });
        document.getElementById('btnRelMesPend').addEventListener('click', function () {
            gerarRelatorioMensalPDF('pendentes');
        });
        document.getElementById('btnArquivarMesPend').addEventListener('click', function () {
            arquivarMesPastaPC(null, 'pendentes');
        });

