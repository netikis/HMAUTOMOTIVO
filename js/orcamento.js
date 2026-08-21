'use strict';
/* HM Automotivo — venda / orcamento */

        /* ---------- Venda / Orçamento (modelo FH Control) ---------- */
        function formaPagamentoEhDigital(formaPag) {
            var f = String(formaPag || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return f.indexOf('pix') > -1 || f.indexOf('cartao') > -1 || f.indexOf('debito') > -1 ||
                f.indexOf('credito') > -1 || f.indexOf('boleto') > -1 || f.indexOf('transfer') > -1;
        }

        function proximoNumeroVenda(db) {
            var max = 1000;
            (db.orcamentos || []).forEach(function (o) {
                var n = Number(o.numero) || 0;
                if (n > max) max = n;
            });
            return max + 1;
        }

        function prepararVendaForm() {
            var db = carregar();
            document.getElementById('vdNumero').value = proximoNumeroVenda(db);
            document.getElementById('vdEmissao').value = hojeISO();
            document.getElementById('vdVenc').value = hojeISO();
            preencherListaProdutosVenda(db);
            atualizarUIVendaPorCanal();
        }

        function atualizarUIVendaPorCanal() {
            var interno = canalVendas === 'interno';
            var wrapN = document.getElementById('wrapVdClienteNormal');
            var wrapI = document.getElementById('wrapVdClienteInterno');
            var titulo = document.querySelector('#painelOrcamento .venda-form .box h2');
            var hint = document.querySelector('#painelOrcamento .venda-form .box > .hint');
            if (wrapN) wrapN.style.display = interno ? 'none' : '';
            if (wrapI) wrapI.style.display = interno ? '' : 'none';
            if (titulo) {
                titulo.textContent = interno
                    ? '🛒 Venda interna — somente para funcionário'
                    : '🛒 Lançar venda — balcão / serviço imediato';
            }
            if (hint) {
                hint.innerHTML = interno
                    ? 'No modo interno a venda é <strong>só para funcionário cadastrado</strong>. Baixa o estoque unificado; dinheiro → caixa interno; PIX/cartão → banco interno.'
                    : 'Venda baixa estoque; <strong>Dinheiro</strong> → Caixa Balcão; <strong>PIX/Cartão/Boleto</strong> → Caixa do Banco; <strong>Pendente</strong> → Contas a Receber.';
            }
            if (interno) preencherSelectFuncionariosVenda();
        }

        function listarFuncionariosOrdenados(db, soAtivos) {
            var int = carregarInternoRaw();
            var exFunc = garantirExcluidosInterno(int).funcionarios || {};
            return aplicarExcluidosNaLista(db.funcionarios || [], exFunc).filter(function (f) {
                if (!f) return false;
                if (soAtivos && f.ativo === false) return false;
                return true;
            }).sort(function (a, b) {
                return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
            });
        }

        /* Funcionários sempre no banco interno — disponível também na OS do balcão */
        function obterDbFuncionarios() {
            if (canalVendas === 'interno') return carregar();
            var int = carregarInternoRaw();
            return { funcionarios: (int && int.funcionarios) || [] };
        }

        function preencherSelectFuncionariosVenda() {
            var sel = document.getElementById('vdFuncionarioId');
            if (!sel) return;
            var db = carregar();
            var funcs = listarFuncionariosOrdenados(db, true);
            var atual = sel.value;
            sel.innerHTML = '<option value="">Selecione o funcionário...</option>' + funcs.map(function (f) {
                var extra = f.cargo ? ' · ' + f.cargo : '';
                return '<option value="' + esc(f.id) + '">' + esc(f.nome + extra) + '</option>';
            }).join('');
            if (atual && funcs.some(function (f) { return f.id === atual; })) sel.value = atual;
        }

        /* Responsável da OS = funcionário do cadastro interno (para fechar lucro depois) */
        function preencherSelectResponsavelOs(selecionadoId, nomeLegado, selectId) {
            var sel = document.getElementById(selectId || 'atResponsavelId');
            if (!sel) return;
            var db = obterDbFuncionarios();
            var funcs = listarFuncionariosOrdenados(db, false);
            var ativos = funcs.filter(function (f) { return f.ativo !== false; });
            var atual = selecionadoId != null ? String(selecionadoId || '') : (sel.value || '');
            var html = '<option value="">Selecione o funcionário...</option>';
            ativos.forEach(function (f) {
                var extra = f.cargo ? ' · ' + f.cargo : '';
                html += '<option value="' + esc(f.id) + '">' + esc(f.nome + extra) + '</option>';
            });
            /* Mantém inativo se já estava na OS */
            if (atual) {
                var inativo = funcs.find(function (f) { return f.id === atual && f.ativo === false; });
                if (inativo) {
                    html += '<option value="' + esc(inativo.id) + '">' + esc((inativo.nome || 'Funcionário') + ' (inativo)') + '</option>';
                }
            }
            sel.innerHTML = html;
            if (atual && Array.prototype.some.call(sel.options, function (o) { return o.value === atual; })) {
                sel.value = atual;
            } else if (!atual && nomeLegado) {
                var porNome = funcs.find(function (f) {
                    return String(f.nome || '').trim().toLowerCase() === String(nomeLegado).trim().toLowerCase();
                });
                if (porNome) sel.value = porNome.id;
            }
        }

        function obterResponsavelOsDoForm(selectId) {
            var sel = document.getElementById(selectId || 'atResponsavelId');
            var id = sel ? String(sel.value || '').trim() : '';
            if (!id) return { responsavelId: '', responsavel: '' };
            var db = obterDbFuncionarios();
            var func = (db.funcionarios || []).find(function (f) { return f.id === id; });
            var nome = func ? String(func.nome || '').trim() : '';
            if (!nome && sel && sel.selectedIndex >= 0) {
                nome = String(sel.options[sel.selectedIndex].text || '').replace(/\s*·.*$/, '').replace(/\s*\(inativo\)\s*$/i, '').trim();
            }
            return { responsavelId: id, responsavel: nome };
        }

        function nomeResponsavelOs(a) {
            if (!a) return '—';
            if (a.responsavel) return a.responsavel;
            if (a.responsavelId) {
                var db = obterDbFuncionarios();
                var f = (db.funcionarios || []).find(function (x) { return x.id === a.responsavelId; });
                if (f && f.nome) return f.nome;
            }
            return '—';
        }

        function preencherFiltroFuncionarioDos() {
            var sel = document.getElementById('filtroFuncionarioDos');
            if (!sel) return;
            var db = obterDbFuncionarios();
            var funcs = listarFuncionariosOrdenados(db, false);
            var atual = sel.value;
            sel.innerHTML = '<option value="">Todos os funcionários</option>' +
                '<option value="__sem__">Sem responsável</option>' +
                funcs.map(function (f) {
                    var extra = f.cargo ? ' · ' + f.cargo : '';
                    var tag = f.ativo === false ? ' (inativo)' : '';
                    return '<option value="' + esc(f.id) + '">' + esc(f.nome + extra + tag) + '</option>';
                }).join('');
            if (atual && Array.prototype.some.call(sel.options, function (o) { return o.value === atual; })) {
                sel.value = atual;
            }
        }

        function renderResumoLucroPorFuncionario(listaOs) {
            var el = document.getElementById('resumoLucroPorFuncionario');
            if (!el) return;
            var por = {};
            (listaOs || []).forEach(function (a) {
                var key = a.responsavelId || ('nome:' + String(a.responsavel || '').trim().toLowerCase());
                var nome = nomeResponsavelOs(a);
                if (!a.responsavelId && (!a.responsavel || !String(a.responsavel).trim())) {
                    key = '__sem__';
                    nome = 'Sem responsável';
                }
                if (!por[key]) por[key] = { nome: nome, qtd: 0, mao: 0, lucroFunc: 0, lucroOficina: 0 };
                var r = resumoLucroOs(a);
                por[key].qtd += 1;
                por[key].mao += r.maoObra || 0;
                por[key].lucroFunc += r.lucroFuncionario != null ? r.lucroFuncionario : (r.maoObra || 0);
                por[key].lucroOficina += r.lucro;
            });
            var rows = Object.keys(por).map(function (k) { return por[k]; }).sort(function (a, b) {
                if (a.nome === 'Sem responsável') return 1;
                if (b.nome === 'Sem responsável') return -1;
                return String(a.nome).localeCompare(String(b.nome), 'pt-BR');
            });
            if (!rows.length) {
                el.innerHTML = '<span class="muted">Nenhuma OS com responsável vinculado.</span>';
                return;
            }
            el.innerHTML = '<p class="hint" style="margin:0 0 8px">Lucro do funcionário = <strong>só mão de obra</strong> (peças ficam da oficina).</p>' +
                '<table style="margin:0;width:100%"><thead><tr>' +
                '<th>Funcionário</th><th>OS</th><th>Mão de obra</th><th>Lucro funcionário</th><th>Lucro oficina (ref.)</th>' +
                '</tr></thead><tbody>' + rows.map(function (r) {
                    return '<tr><td><strong>' + esc(r.nome) + '</strong></td><td>' + r.qtd +
                        '</td><td>' + moeda(r.mao) + '</td><td><strong style="color:#2980b9">' + moeda(r.lucroFunc) +
                        '</strong></td><td>' + moeda(r.lucroOficina) + '</td></tr>';
                }).join('') + '</tbody></table>';
        }

        function encontrarProdutoPorBusca(texto) {
            var db = carregar();
            var t = String(texto || '').trim().toLowerCase();
            if (!t) return null;
            var cod = t.replace(/^.*\[/, '').replace(/\].*$/, '').trim();
            var porCod = db.produtos.find(function (p) {
                return p.codigo && String(p.codigo).toLowerCase() === cod;
            });
            if (porCod) return porCod;
            var nome = t.replace(/\s*\[.*$/, '').trim();
            return db.produtos.find(function (p) {
                return String(p.nome || '').toLowerCase() === nome ||
                    String(p.nome || '').toLowerCase().indexOf(nome) === 0 ||
                    (p.codigo && String(p.codigo).toLowerCase() === t);
            }) || null;
        }

        function atualizarTotalLinhaEstoque() {
            var qtd = parseMoeda(document.getElementById('vdProdQtd').value) || 0;
            var venda = Number(document.getElementById('vdProdVenda').value) || 0;
            document.getElementById('vdProdTotal').value = (qtd * venda).toFixed(2);
        }

        function atualizarTotalLinhaAvulso() {
            var qtd = parseMoeda(document.getElementById('vdAvQtd').value) || 0;
            var venda = Number(document.getElementById('vdAvVenda').value) || 0;
            document.getElementById('vdAvTotal').value = (qtd * venda).toFixed(2);
        }

        function recalcVendaDeCusto(custoId, margemId, vendaId, totalFn) {
            var custo = Number(document.getElementById(custoId).value) || 0;
            var margem = Number(document.getElementById(margemId).value) || 0;
            document.getElementById(vendaId).value = (custo * (1 + margem / 100)).toFixed(2);
            totalFn();
        }

        function recalcMargemDeVenda(custoId, margemId, vendaId, totalFn) {
            var custo = Number(document.getElementById(custoId).value) || 0;
            var venda = Number(document.getElementById(vendaId).value) || 0;
            if (custo > 0) document.getElementById(margemId).value = (((venda / custo) - 1) * 100).toFixed(1);
            totalFn();
        }

        function fmtQtdEstoque(n, un) {
            var v = Math.round((Number(n) || 0) * 1000) / 1000;
            var txt = (Math.abs(v - Math.round(v)) < 1e-9) ? String(Math.round(v)) : String(v);
            return txt + ' ' + (un || 'un');
        }

        function calcularDisponivelEstoqueVenda(p) {
            var cadastro = Number(p && p.qtd) || 0;
            var reservado = qtdReservadaCarrinho(p && p.id);
            var livre = Math.round((cadastro - reservado) * 1000) / 1000;
            return { cadastro: cadastro, reservado: reservado, livre: livre };
        }

        function qtdReservadaCarrinho(produtoId) {
            return carrinhoVenda.reduce(function (s, it) {
                return s + (it.produtoId === produtoId ? (Number(it.qtd) || 0) : 0);
            }, 0);
        }

        function atualizarResumoEstoqueVenda() {
            var info = document.getElementById('vdEstoqueInfo');
            if (!info) return;
            var p = produtoVendaSelecionado;
            if (!p) {
                info.style.display = 'none';
                info.className = 'estoque-resumo';
                info.innerHTML = '';
                return;
            }
            var tipoDoc = document.getElementById('vdTipo').value;
            var un = document.getElementById('vdProdUn').value || p.unidade || 'un';
            var disp = calcularDisponivelEstoqueVenda(p);
            var qCampo = parseMoeda(document.getElementById('vdProdQtd').value) || 0;
            var livre = Math.max(0, disp.livre);
            var html = '<strong>Estoque disponível do produto</strong> ' + esc(p.nome) +
                ': <strong style="color:#f1c40f;font-size:1.05em">' + esc(fmtQtdEstoque(livre, un)) + '</strong>';
            html += '<br><span style="opacity:0.9">No cadastro: <strong>' + esc(fmtQtdEstoque(disp.cadastro, un)) +
                '</strong> · No carrinho: <strong>' + esc(fmtQtdEstoque(disp.reservado, un)) + '</strong>';
            if (p.codigo) html += ' · Cód: <strong>' + esc(p.codigo) + '</strong>';
            html += '</span>';

            if (tipoDoc === 'ORCAMENTO') {
                info.className = 'estoque-resumo estoque-orcamento';
                html += '<br><span style="color:#d2b4de">📄 Orçamento: pode lançar qualquer quantidade (não baixa estoque).</span>';
            } else if (livre <= 0) {
                info.className = 'estoque-resumo estoque-zero';
                html += '<br><span style="color:#ff6b6b;font-weight:800">⚠ Estoque 0 — venda direta bloqueada para este produto. Use Orçamento ou reponha o estoque.</span>';
            } else {
                info.className = 'estoque-resumo';
                if (qCampo > 0) {
                    var depois = livre - qCampo;
                    if (depois < -1e-9) {
                        html += '<br><span style="color:#e74c3c;font-weight:700">⚠ Quantidade no campo (' +
                            esc(fmtQtdEstoque(qCampo, un)) + ') passa do disponível (' +
                            esc(fmtQtdEstoque(livre, un)) + ').</span>';
                    } else {
                        html += '<br><span style="color:#95a5a6">Se incluir esta qtd, saldo ficaria: <strong>' +
                            esc(fmtQtdEstoque(Math.max(0, depois), un)) + '</strong>.</span>';
                    }
                }
            }
            info.innerHTML = html;
            info.style.display = 'block';
        }

        function preencherCamposProdutoEstoque() {
            var p = encontrarProdutoPorBusca(document.getElementById('vdProdBusca').value);
            produtoVendaSelecionado = p;
            if (!p) {
                atualizarResumoEstoqueVenda();
                return;
            }
            document.getElementById('vdProdCusto').value = p.custo || 0;
            document.getElementById('vdProdVenda').value = p.venda || 0;
            var margem = (p.custo > 0) ? (((p.venda / p.custo) - 1) * 100) : 0;
            document.getElementById('vdProdMargem').value = margem.toFixed(1);
            document.getElementById('vdProdUn').value = p.unidade || '';
            document.getElementById('vdProdQtd').value = '1';
            atualizarTotalLinhaEstoque();
            atualizarResumoEstoqueVenda();
            var disp = calcularDisponivelEstoqueVenda(p);
            var un = p.unidade || 'un';
            var tipoDoc = document.getElementById('vdTipo').value;
            if (tipoDoc === 'VENDA' && disp.livre <= 0) {
                toast('Estoque disponível do produto ' + p.nome + ': 0 ' + un + ' — venda bloqueada.');
            } else {
                toast('Estoque disponível do produto ' + p.nome + ': ' + fmtQtdEstoque(Math.max(0, disp.livre), un));
            }
        }

        function calcTotaisVenda() {
            var sub = carrinhoVenda.reduce(function (s, it) { return s + (Number(it.total) || 0); }, 0);
            var descR = Number(document.getElementById('vdDescReais').value) || 0;
            var descP = Number(document.getElementById('vdDescPerc').value) || 0;
            var total = Math.max(0, sub - descR - (sub * descP / 100));
            var recebido = Number(document.getElementById('vdRecebido').value) || 0;
            var troco = Math.max(0, recebido - total);
            document.getElementById('vdSubtotalTxt').textContent = moeda(sub);
            document.getElementById('vdTotalTxt').textContent = 'TOTAL: ' + moeda(total);
            document.getElementById('vdTrocoTxt').textContent = 'Troco: ' + moeda(troco);
            return { subtotal: sub, total: total, troco: troco, descontoReais: descR, descontoPerc: descP, valorRecebido: recebido };
        }

        function renderCarrinhoVenda() {
            var box = document.getElementById('vdCarrinhoLista');
            if (!carrinhoVenda.length) {
                box.innerHTML = '<p class="muted">Nenhum item.</p>';
            } else {
                box.innerHTML = carrinhoVenda.map(function (it, idx) {
                    var tag = it.origem === 'estoque' ? 'ESTOQUE' : (it.origem === 'mao' ? 'MÃO DE OBRA' : 'AVULSO');
                    var cor = it.origem === 'mao' ? '#8fe0b8' : (it.origem === 'estoque' ? '#9fd3ff' : '#ffb4a8');
                    return '<div class="row" style="margin-bottom:8px;align-items:center;border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:6px">' +
                        '<div class="col" style="flex:2"><span style="color:' + cor + ';font-size:0.7rem;font-weight:700;margin-right:6px">' + tag + '</span>' +
                        esc(it.desc) + ' <span class="muted">(' + esc(String(it.qtd)) + ' ' + esc(it.unidade || 'un') + ' × ' + moeda(it.venda) + ')</span></div>' +
                        '<div class="col">' + moeda(it.total) + '</div>' +
                        '<div class="col" style="flex:0.4"><button type="button" class="btn btn-danger" data-vd-rm="' + idx + '">×</button></div></div>';
                }).join('');
                box.querySelectorAll('[data-vd-rm]').forEach(function (b) {
                    b.addEventListener('click', function () {
                        carrinhoVenda.splice(Number(b.getAttribute('data-vd-rm')), 1);
                        renderCarrinhoVenda();
                        atualizarResumoEstoqueVenda();
                    });
                });
            }
            calcTotaisVenda();
            atualizarResumoEstoqueVenda();
        }

        function addItemCarrinho(item) {
            carrinhoVenda.push(item);
            renderCarrinhoVenda();
        }

        document.getElementById('vdProdBusca').addEventListener('change', preencherCamposProdutoEstoque);
        document.getElementById('vdProdBusca').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                preencherCamposProdutoEstoque();
            }
        });
        ['vdProdQtd', 'vdProdVenda'].forEach(function (id) {
            document.getElementById(id).addEventListener('input', function () {
                atualizarTotalLinhaEstoque();
                if (id === 'vdProdQtd') atualizarResumoEstoqueVenda();
            });
        });
        document.getElementById('vdProdUn').addEventListener('change', atualizarResumoEstoqueVenda);
        document.getElementById('vdProdCusto').addEventListener('input', function () {
            recalcVendaDeCusto('vdProdCusto', 'vdProdMargem', 'vdProdVenda', atualizarTotalLinhaEstoque);
        });
        document.getElementById('vdProdMargem').addEventListener('input', function () {
            recalcVendaDeCusto('vdProdCusto', 'vdProdMargem', 'vdProdVenda', atualizarTotalLinhaEstoque);
        });
        document.getElementById('vdProdVenda').addEventListener('input', function () {
            recalcMargemDeVenda('vdProdCusto', 'vdProdMargem', 'vdProdVenda', atualizarTotalLinhaEstoque);
        });

        document.getElementById('btnVdAddEstoque').addEventListener('click', function () {
            if (!produtoVendaSelecionado) preencherCamposProdutoEstoque();
            var p = produtoVendaSelecionado;
            if (!p) { toast('Selecione um produto do estoque (nome ou código).'); return; }
            var qtd = parseMoeda(document.getElementById('vdProdQtd').value);
            var venda = Number(document.getElementById('vdProdVenda').value) || 0;
            if (qtd <= 0) { toast('Informe a quantidade.'); return; }
            var tipoDoc = document.getElementById('vdTipo').value;
            var un = document.getElementById('vdProdUn').value || p.unidade || 'un';
            var disp = calcularDisponivelEstoqueVenda(p);
            var livre = disp.livre;

            /* Venda direta: só o que tem no estoque. Orçamento: liberado. */
            if (tipoDoc === 'VENDA') {
                if (livre <= 0) {
                    toast('Estoque disponível do produto ' + p.nome + ': 0 ' + un + ' — venda bloqueada.');
                    atualizarResumoEstoqueVenda();
                    return;
                }
                if (qtd > livre + 0.0001) {
                    toast('Quantidade acima do disponível. Produto: ' + p.nome +
                        ' · Disponível: ' + fmtQtdEstoque(livre, un) +
                        ' · Você tentou: ' + fmtQtdEstoque(qtd, un));
                    atualizarResumoEstoqueVenda();
                    return;
                }
            }

            addItemCarrinho({
                origem: 'estoque',
                produtoId: p.id,
                codigo: p.codigo || '',
                desc: p.nome,
                qtd: qtd,
                unidade: un,
                custo: Number(document.getElementById('vdProdCusto').value) || 0,
                margem: Number(document.getElementById('vdProdMargem').value) || 0,
                venda: venda,
                total: qtd * venda,
                baixaEstoque: tipoDoc === 'VENDA'
            });
            document.getElementById('vdProdBusca').value = '';
            produtoVendaSelecionado = null;
            atualizarResumoEstoqueVenda();
            document.getElementById('vdProdQtd').value = '1';
            document.getElementById('vdProdBusca').focus();
            if (tipoDoc === 'VENDA') {
                toast('Item adicionado. Estoque será baixado ao finalizar a venda.');
            } else {
                toast('Item no orçamento (sem baixa de estoque).');
            }
        });

        document.getElementById('vdTipo').addEventListener('change', function () {
            atualizarResumoEstoqueVenda();
            var tipo = this.value;
            if (tipo === 'ORCAMENTO') {
                toast('Modo Orçamento: quantidade livre — não baixa estoque.');
            } else {
                toast('Modo Venda Direta: só vende o que tem no estoque — baixa ao finalizar.');
            }
        });

        ['vdAvQtd', 'vdAvVenda'].forEach(function (id) {
            document.getElementById(id).addEventListener('input', atualizarTotalLinhaAvulso);
        });
        document.getElementById('vdAvCusto').addEventListener('input', function () {
            recalcVendaDeCusto('vdAvCusto', 'vdAvMargem', 'vdAvVenda', atualizarTotalLinhaAvulso);
        });
        document.getElementById('vdAvMargem').addEventListener('input', function () {
            recalcVendaDeCusto('vdAvCusto', 'vdAvMargem', 'vdAvVenda', atualizarTotalLinhaAvulso);
        });

        document.getElementById('btnVdAddAvulso').addEventListener('click', function () {
            var desc = document.getElementById('vdAvNome').value.trim();
            var qtd = parseMoeda(document.getElementById('vdAvQtd').value) || 0;
            var venda = Number(document.getElementById('vdAvVenda').value) || 0;
            if (!desc) { toast('Informe a descrição do item avulso.'); return; }
            if (qtd <= 0 || venda < 0) { toast('Qtd e valor de venda inválidos.'); return; }
            addItemCarrinho({
                origem: 'avulso',
                produtoId: null,
                desc: desc,
                qtd: qtd,
                unidade: document.getElementById('vdAvUn').value || 'un',
                custo: Number(document.getElementById('vdAvCusto').value) || 0,
                margem: Number(document.getElementById('vdAvMargem').value) || 0,
                venda: venda,
                total: qtd * venda
            });
            document.getElementById('vdAvNome').value = '';
            document.getElementById('vdAvQtd').value = '1';
            document.getElementById('vdAvVenda').value = '';
            document.getElementById('vdAvTotal').value = '';
            document.getElementById('vdAvNome').focus();
        });

        document.getElementById('btnVdAddMao').addEventListener('click', function () {
            var desc = document.getElementById('vdMaoDesc').value.trim();
            var valor = parseMoeda(document.getElementById('vdMaoValor').value);
            if (!desc) { toast('Informe a descrição da mão de obra.'); return; }
            addItemCarrinho({
                origem: 'mao',
                produtoId: null,
                desc: desc,
                qtd: 1,
                unidade: 'serv',
                custo: 0,
                margem: 0,
                venda: valor,
                total: valor
            });
            document.getElementById('vdMaoDesc').value = '';
            document.getElementById('vdMaoValor').value = '';
            document.getElementById('vdMaoDesc').focus();
        });

        ['vdDescReais', 'vdDescPerc', 'vdRecebido'].forEach(function (id) {
            document.getElementById(id).addEventListener('input', calcTotaisVenda);
        });

        function limparVendaForm() {
            carrinhoVenda = [];
            produtoVendaSelecionado = null;
            var editId = document.getElementById('vdEditId');
            if (editId) editId.value = '';
            document.getElementById('vdCliente').value = '';
            document.getElementById('vdPlaca').value = '';
            var placaInt = document.getElementById('vdPlacaInterno');
            if (placaInt) placaInt.value = '';
            var selFunc = document.getElementById('vdFuncionarioId');
            if (selFunc) selFunc.value = '';
            document.getElementById('vdProdBusca').value = '';
            document.getElementById('vdObs').value = '';
            document.getElementById('vdDescReais').value = '0';
            document.getElementById('vdDescPerc').value = '0';
            document.getElementById('vdRecebido').value = '';
            document.getElementById('vdTipo').value = 'VENDA';
            document.getElementById('vdStatus').value = 'PAGO';
            document.getElementById('vdForma').value = 'Dinheiro';
            prepararVendaForm();
            renderCarrinhoVenda();
            atualizarResumoEstoqueVenda();
        }

        document.getElementById('btnVdLimpar').addEventListener('click', function () {
            limparVendaForm();
            toast('Venda limpa.');
        });

        document.getElementById('btnVdFinalizar').addEventListener('click', function () {
            var db = carregar();
            var interno = canalVendas === 'interno';
            var clienteNome = '';
            var resolvido = { ok: false, clienteAvulso: true, clienteId: null };
            var funcionarioId = null;
            var funcionarioNome = '';
            var placa = '';

            if (interno) {
                funcionarioId = document.getElementById('vdFuncionarioId').value;
                var func = (db.funcionarios || []).find(function (f) { return f.id === funcionarioId; });
                if (!func || func.ativo === false) {
                    toast('Selecione um funcionário ativo. Cadastre em Modo interno → Cadastro de Funcionários.');
                    return;
                }
                funcionarioNome = func.nome;
                clienteNome = func.nome;
                placa = (document.getElementById('vdPlacaInterno').value || '').toUpperCase().trim();
            } else {
                clienteNome = document.getElementById('vdCliente').value.trim();
                if (!clienteNome) { toast('Informe o cliente (cadastrado ou avulso).'); return; }
                resolvido = resolverClienteAtendimento(db, clienteNome);
                placa = (document.getElementById('vdPlaca').value || '').toUpperCase().trim();
            }
            if (!carrinhoVenda.length) { toast('Adicione itens ao carrinho.'); return; }

            var totais = calcTotaisVenda();
            var tipo = document.getElementById('vdTipo').value;
            var status = document.getElementById('vdStatus').value;
            var forma = document.getElementById('vdForma').value;
            var editId = (document.getElementById('vdEditId') || {}).value || '';
            var numero = Number(document.getElementById('vdNumero').value) || proximoNumeroVenda(db);

            /* Edição: atualiza o documento sem rebaixar estoque / relançar caixa */
            if (editId) {
                var ixEdit = (db.orcamentos || []).findIndex(function (x) { return x.id === editId; });
                if (ixEdit < 0) {
                    toast('Documento para editar não encontrado.');
                    return;
                }
                var ant = db.orcamentos[ixEdit];
                if (ant.estornado) {
                    toast('Documento já estornado — não pode editar.');
                    return;
                }
                db.orcamentos[ixEdit] = Object.assign({}, ant, {
                    numero: numero,
                    tipo: tipo,
                    clienteId: !interno && resolvido.ok && !resolvido.clienteAvulso ? resolvido.clienteId : null,
                    clienteNome: clienteNome,
                    clienteAvulso: interno ? false : !(resolvido.ok && !resolvido.clienteAvulso),
                    vendaFuncionario: interno,
                    funcionarioId: funcionarioId,
                    funcionarioNome: funcionarioNome,
                    placa: placa,
                    statusPagamento: status,
                    formaPagamento: forma,
                    dataEmissao: document.getElementById('vdEmissao').value,
                    dataVencimento: document.getElementById('vdVenc').value,
                    itens: carrinhoVenda.slice(),
                    subtotal: totais.subtotal,
                    descontoReais: totais.descontoReais,
                    descontoPerc: totais.descontoPerc,
                    valor: totais.total,
                    valorRecebido: totais.valorRecebido,
                    troco: totais.troco,
                    observacao: document.getElementById('vdObs').value.trim(),
                    descricao: carrinhoVenda.map(function (x) { return x.desc; }).join(', '),
                    atualizadoEm: new Date().toISOString()
                });
                salvar(db);
                toast('Documento Nº ' + numero + ' atualizado.');
                limparVendaForm();
                renderOrcamentos();
                atualizarKPIs(db);
                return;
            }

            /* Baixa de estoque — só em VENDA (orçamento não mexe). Igual FH Control. */
            if (tipo === 'VENDA') {
                var necessidade = {};
                for (var i = 0; i < carrinhoVenda.length; i++) {
                    var it = carrinhoVenda[i];
                    if (!it.produtoId) continue;
                    necessidade[it.produtoId] = (necessidade[it.produtoId] || 0) + (Number(it.qtd) || 0);
                }
                var ids = Object.keys(necessidade);
                for (var j = 0; j < ids.length; j++) {
                    var pid = ids[j];
                    var pi = db.produtos.findIndex(function (p) { return p.id === pid; });
                    if (pi < 0) {
                        toast('Produto do carrinho não encontrado no estoque.');
                        return;
                    }
                    var prod = db.produtos[pi];
                    var tem = Number(prod.qtd) || 0;
                    var precisa = necessidade[pid];
                    if (precisa > tem + 0.0001) {
                        toast('Estoque disponível do produto ' + (prod.nome || '') + ': ' +
                            fmtQtdEstoque(tem, prod.unidade || 'un') +
                            ' — insuficiente para finalizar (precisa ' + fmtQtdEstoque(precisa, prod.unidade || 'un') + ').');
                        return;
                    }
                }
                for (var k = 0; k < ids.length; k++) {
                    var pid2 = ids[k];
                    var pi2 = db.produtos.findIndex(function (p) { return p.id === pid2; });
                    var novo = (Number(db.produtos[pi2].qtd) || 0) - necessidade[pid2];
                    db.produtos[pi2].qtd = Math.round(Math.max(0, novo) * 1000) / 1000;
                    db.produtos[pi2].atualizadoEm = new Date().toISOString();
                }
            }

            var doc = {
                id: uid(),
                numero: numero,
                tipo: tipo,
                clienteId: !interno && resolvido.ok && !resolvido.clienteAvulso ? resolvido.clienteId : null,
                clienteNome: clienteNome,
                clienteAvulso: interno ? false : !(resolvido.ok && !resolvido.clienteAvulso),
                vendaFuncionario: interno,
                funcionarioId: funcionarioId,
                funcionarioNome: funcionarioNome,
                placa: placa,
                statusPagamento: status,
                formaPagamento: forma,
                dataEmissao: document.getElementById('vdEmissao').value,
                dataVencimento: document.getElementById('vdVenc').value,
                itens: carrinhoVenda.slice(),
                subtotal: totais.subtotal,
                descontoReais: totais.descontoReais,
                descontoPerc: totais.descontoPerc,
                valor: totais.total,
                valorRecebido: totais.valorRecebido,
                troco: totais.troco,
                observacao: document.getElementById('vdObs').value.trim(),
                descricao: carrinhoVenda.map(function (x) { return x.desc; }).join(', '),
                criadoEm: new Date().toISOString()
            };
            if (!db.orcamentos) db.orcamentos = [];
            db.orcamentos.push(doc);

            /* Destino financeiro — igual FH */
            if (tipo === 'VENDA' || tipo === 'ORCAMENTO') {
                if (status === 'PAGO' && tipo === 'VENDA') {
                    var lanc = {
                        id: uid(),
                        tipo: 'entrada',
                        descricao: 'Venda Nº ' + numero + ' — ' + clienteNome,
                        valor: totais.total,
                        forma: forma,
                        vendaId: doc.id,
                        criadoEm: new Date().toISOString()
                    };
                    if (formaPagamentoEhDigital(forma)) {
                        if (!db.caixaBanco) db.caixaBanco = [];
                        lanc.conta = 'banco';
                        db.caixaBanco.push(lanc);
                    } else {
                        if (!db.caixa) db.caixa = [];
                        lanc.conta = 'balcao';
                        db.caixa.push(lanc);
                    }
                } else if (status === 'PENDENTE' && tipo === 'VENDA') {
                    if (!db.pendentes) db.pendentes = [];
                    db.pendentes.push({
                        id: uid(),
                        cliente: clienteNome,
                        descricao: 'Venda Nº ' + numero + ' — ' + (doc.descricao || 'Venda'),
                        valor: totais.total,
                        vencimento: doc.dataVencimento || hojeISO(),
                        status: 'aberto',
                        vendaId: doc.id,
                        formaPrevista: forma,
                        criadoEm: new Date().toISOString()
                    });
                }
            }

            salvar(db);
            var msg = tipo === 'ORCAMENTO'
                ? 'Orçamento Nº ' + numero + ' salvo (sem baixa de estoque).'
                : (status === 'PAGO'
                    ? ('Venda Nº ' + numero + ' salva. Estoque baixado. ' +
                        (formaPagamentoEhDigital(forma) ? 'Valor no Caixa do Banco (PIX/cartão).' : 'Valor no Caixa Balcão (dinheiro).'))
                    : ('Venda Nº ' + numero + ' salva. Estoque baixado. Valor em Contas a Receber.'));
            toast(interno
                ? (msg + ' Funcionário: ' + funcionarioNome + '.')
                : msg);
            limparVendaForm();
            renderOrcamentos();
            renderProdutos();
            renderCaixa();
            renderCaixaBanco();
            renderPendentes();
            atualizarKPIs(db);
        });

        function nomeDocVenda(db, o) {
            return o.funcionarioNome || o.clienteNome || nomeCliente(db, o.clienteId) || '—';
        }

        function saldoDocVenda(o) {
            var total = Number(o.valor) || 0;
            var recebido = Number(o.valorRecebido);
            if (isNaN(recebido) || recebido <= 0) {
                if ((o.statusPagamento || '') === 'PAGO') recebido = total;
                else recebido = 0;
            }
            var saldo = Math.max(0, total - recebido);
            if ((o.statusPagamento || '') === 'PENDENTE' && recebido <= 0) saldo = total;
            return { total: total, recebido: recebido, saldo: saldo };
        }

        function htmlNotaVenda(db, o, opts) {
            opts = opts || {};
            var emp = getEmpresa(db);
            var nome = nomeDocVenda(db, o);
            var s = saldoDocVenda(o);
            var cupom = !!opts.cupom;
            var tipoDoc = o.tipo === 'ORCAMENTO' ? 'ORÇAMENTO' : 'VENDA';
            var tituloDoc = cupom
                ? 'CUPOM NÃO FISCAL'
                : (tipoDoc === 'ORÇAMENTO' ? 'ORÇAMENTO / PROPOSTA' : 'VENDA / BALCÃO');
            var itens = o.itens || [];

            function tipoItem(it) {
                if (it.origem === 'mao' || it.tipo === 'mao' || it.unidade === 'serv') return 'Serviço';
                if (it.origem === 'avulso') return 'Avulso';
                if (it.origem === 'estoque' || it.produtoId) return 'Produto';
                return 'Item';
            }

            var rows = itens.length
                ? itens.map(function (it) {
                    var qtd = Number(it.qtd) || 0;
                    var venda = Number(it.venda) || 0;
                    var totalLinha = it.total != null ? Number(it.total) : (qtd * venda);
                    var descHtml = esc(it.desc || '—');
                    if (qtd) descHtml += ' · ' + esc(fmtQtdEstoque(qtd, it.unidade || 'un'));
                    if (it.codigo && !cupom) {
                        descHtml += '<div style="font-size:0.75rem;color:#555;font-weight:500">' + esc(it.codigo) + '</div>';
                    }
                    return '<tr>' +
                        '<td>' + esc(tipoItem(it)) + '</td>' +
                        '<td>' + descHtml + '</td>' +
                        '<td>' + moeda(totalLinha) + '</td>' +
                        '</tr>';
                }).join('')
                : '<tr><td colspan="3" style="padding:8px;color:#666">Sem itens lançados.</td></tr>';

            var htmlItens =
                '<table class="nota-itens compacta"><thead><tr>' +
                '<th>Tipo</th><th>Descrição</th><th>Valor</th>' +
                '</tr></thead><tbody>' + rows + '</tbody></table>' +
                '<div class="nota-subtotais compacto">' +
                'Subtotal: <strong>' + moeda(o.subtotal != null ? o.subtotal : s.total) + '</strong>' +
                ((Number(o.descontoReais) > 0 || Number(o.descontoPerc) > 0)
                    ? ' · Desconto: <strong>' + moeda(o.descontoReais || 0) +
                      (Number(o.descontoPerc) > 0 ? ' (' + o.descontoPerc + '%)' : '') + '</strong>'
                    : '') +
                (Number(o.valorRecebido) > 0
                    ? ' · Recebido: <strong>' + moeda(s.recebido) + '</strong> · Troco: <strong>' + moeda(o.troco || 0) + '</strong>'
                    : '') +
                '</div>' +
                '<div class="nota-total compacto">Total: ' + moeda(s.total) + '</div>' +
                ((o.statusPagamento || '') === 'PENDENTE'
                    ? '<div class="nota-subtotais compacto">Saldo em aberto: <strong>' + moeda(s.saldo) + '</strong></div>'
                    : '');

            var wrapExtra = cupom ? ' style="max-width:360px;margin:0 auto"' : '';

            return '<div class="nota-espelho" id="notaVendaHtml"' + wrapExtra + '>' +
                htmlCabecalhoNotaEmpresa(emp,
                    '<div class="nota-sub nota-titulo-espelho">' + esc(tituloDoc) + '</div>' +
                    '<div class="nota-sub nota-registro">' +
                    'Nº ' + esc(String(o.numero || '—')) +
                    ' · Registro ' + esc(fmtData(o.dataEmissao || o.criadoEm)) +
                    (o.estornado ? ' · ESTORNADO' : '') +
                    (o.id ? ' · ID ' + esc(String(o.id).slice(-6)) : '') +
                    '</div>'
                ) +
                '<div class="nota-bloco compacto"><div class="tit azul">Cliente</div><div class="nota-grid nota-grid-compacta">' +
                '<div class="nota-campo full"><span class="nota-label">' +
                (o.vendaFuncionario || o.funcionarioId ? 'Funcionário' : 'Cliente') +
                '</span><span class="nota-valor">' + esc(nome) +
                (o.clienteAvulso ? ' (avulso)' : '') + '</span></div>' +
                (o.placa
                    ? '<div class="nota-campo"><span class="nota-label">Placa</span><span class="nota-valor" style="letter-spacing:2px;font-weight:700">' +
                      esc(String(o.placa).toUpperCase()) + '</span></div>'
                    : '') +
                '<div class="nota-campo"><span class="nota-label">Pagamento</span><span class="nota-valor">' +
                esc((o.statusPagamento || '—') + (o.formaPagamento ? ' / ' + o.formaPagamento : '')) +
                '</span></div>' +
                (o.dataVencimento
                    ? '<div class="nota-campo"><span class="nota-label">Vencimento</span><span class="nota-valor">' +
                      esc(fmtData(o.dataVencimento)) + '</span></div>'
                    : '') +
                '</div></div>' +
                '<div class="nota-bloco compacto"><div class="tit verde">Valores</div>' +
                '<div class="nota-valores-pad compacto">' + htmlItens +
                (o.observacao
                    ? '<div style="margin-top:8px"><span class="nota-label">Observações</span><div class="nota-valor">' +
                      esc(o.observacao) + '</div></div>'
                    : '') +
                '</div></div>' +
                (cupom
                    ? '<p style="text-align:center;margin-top:14px;font-size:10pt;color:#333">Obrigado pela preferência!</p>'
                    : '<div class="nota-sigs compacto">' +
                      '<div class="nota-sig"><div class="nota-sig-espaco"></div><div class="nota-sig-base">Assinatura do Responsável</div></div>' +
                      '<div class="nota-sig"><div class="nota-sig-espaco"></div><div class="nota-sig-base">Assinatura do Cliente</div></div>' +
                      '</div>') +
                '</div>';
        }

        function abrirNotaVenda(id, modo) {
            var db = carregar();
            var o = (db.orcamentos || []).find(function (x) { return x.id === id; });
            if (!o) {
                toast('Documento não encontrado.');
                return;
            }
            modo = modo || 'ver';
            var opts = {};
            if (modo === 'cliente') opts.cliente = true;
            if (modo === 'cupom') opts.cupom = true;
            var html = htmlNotaVenda(db, o, opts);
            var titulo = (modo === 'cupom' ? 'Cupom' : (o.tipo === 'ORCAMENTO' ? 'Orçamento' : 'Venda')) +
                ' Nº ' + (o.numero || '');
            _htmlNotaImpressaoAtual = html;
            _tituloNotaImpressao = titulo;
            if (modo === 'ver' && !ehCelular()) {
                abrirViewerPdf(html, titulo);
                toast('Documento aberto.');
                return;
            }
            abrirViewerPdf(html, titulo);
            toast(modo === 'cupom' ? 'Cupom aberto.' : 'PDF aberto — use Imprimir ou Encaminhar.');
        }

        var vendaAcoesAtualId = null;

        function fecharAcoesVenda() {
            var m = document.getElementById('modalAcoesVenda');
            if (m) m.classList.remove('aberto');
            vendaAcoesAtualId = null;
        }

        function abrirAcoesVenda(id) {
            var db = carregar();
            var o = (db.orcamentos || []).find(function (x) { return x.id === id; });
            if (!o) {
                toast('Documento não encontrado.');
                return;
            }
            vendaAcoesAtualId = id;
            var s = saldoDocVenda(o);
            var nome = nomeDocVenda(db, o);
            document.getElementById('acoesVendaMeta').innerHTML =
                '<div><strong>Nº Doc:</strong> ' + esc(String(o.numero || '—')) +
                ' · <strong>Tipo:</strong> ' + esc(o.tipo || '—') +
                (o.estornado ? ' <span class="tag-estornado">ESTORNADO</span>' : '') + '</div>' +
                '<div><strong>Cliente:</strong> ' + esc(nome) + '</div>' +
                '<div><strong>Total:</strong> <span class="val-ok">' + moeda(s.total) + '</span></div>' +
                '<div><strong>Recebido:</strong> <span class="val-ok">' + moeda(s.recebido) +
                '</span> · <strong>Saldo:</strong> <span class="val-saldo">' + moeda(s.saldo) + '</span></div>';
            document.getElementById('modalAcoesVenda').classList.add('aberto');
        }

        function textoResumoVenda(db, o) {
            var emp = getEmpresa(db);
            var s = saldoDocVenda(o);
            var linhas = [
                (emp.nome || 'HM Centro Automotivo'),
                (o.tipo === 'ORCAMENTO' ? 'Orçamento' : 'Venda') + ' Nº ' + (o.numero || '—'),
                'Cliente: ' + nomeDocVenda(db, o),
                'Data: ' + fmtData(o.dataEmissao || o.criadoEm),
                'Total: ' + moeda(s.total),
                'Pagamento: ' + ((o.statusPagamento || '—') + (o.formaPagamento ? ' / ' + o.formaPagamento : ''))
            ];
            if (o.placa) linhas.push('Placa: ' + String(o.placa).toUpperCase());
            if ((o.itens || []).length) {
                linhas.push('Itens:');
                (o.itens || []).forEach(function (it) {
                    linhas.push('- ' + (it.desc || '') + ' · ' + fmtQtdEstoque(it.qtd, it.unidade || 'un') + ' · ' + moeda(it.total != null ? it.total : (Number(it.qtd) || 0) * (Number(it.venda) || 0)));
                });
            }
            return linhas.join('\n');
        }

        function telefoneClienteVenda(db, o) {
            if (o.clienteId) {
                var c = (db.clientes || []).find(function (x) { return x.id === o.clienteId; });
                if (c && c.telefone) return String(c.telefone).replace(/\D/g, '');
            }
            return '';
        }

        function editarDocumentoVenda(id) {
            var db = carregar();
            var o = (db.orcamentos || []).find(function (x) { return x.id === id; });
            if (!o) return;
            if (o.estornado) {
                toast('Documento estornado — não pode editar.');
                return;
            }
            fecharAcoesVenda();
            abrirPainel('painelOrcamento');
            limparVendaForm();
            document.getElementById('vdEditId').value = o.id;
            document.getElementById('vdNumero').value = o.numero || '';
            document.getElementById('vdTipo').value = o.tipo === 'ORCAMENTO' ? 'ORCAMENTO' : 'VENDA';
            document.getElementById('vdStatus').value = o.statusPagamento || 'PAGO';
            document.getElementById('vdForma').value = o.formaPagamento || 'Dinheiro';
            document.getElementById('vdEmissao').value = (o.dataEmissao || hojeISO()).slice(0, 10);
            document.getElementById('vdVenc').value = (o.dataVencimento || hojeISO()).slice(0, 10);
            document.getElementById('vdObs').value = o.observacao || '';
            document.getElementById('vdDescReais').value = o.descontoReais || 0;
            document.getElementById('vdDescPerc').value = o.descontoPerc || 0;
            document.getElementById('vdRecebido').value = o.valorRecebido || '';
            if (canalVendas === 'interno' || o.vendaFuncionario || o.funcionarioId) {
                canalVendas = 'interno';
                atualizarBadgeCanal();
                atualizarUIVendaPorCanal();
                preencherSelectFuncionariosVenda();
                document.getElementById('vdFuncionarioId').value = o.funcionarioId || '';
                document.getElementById('vdPlacaInterno').value = o.placa || '';
            } else {
                document.getElementById('vdCliente').value = o.clienteNome || '';
                document.getElementById('vdPlaca').value = o.placa || '';
            }
            carrinhoVenda = (o.itens || []).map(function (it) {
                return Object.assign({}, it);
            });
            renderCarrinhoVenda();
            toast('Editando Nº ' + (o.numero || '') + ' — ao salvar, atualiza o documento (sem rebaixar estoque).');
        }

        function abrirWhatsVenda(id) {
            var db = carregar();
            var o = (db.orcamentos || []).find(function (x) { return x.id === id; });
            if (!o) return;
            fecharAcoesVenda();
            var texto = 'Olá! Segue o resumo da ' +
                (o.tipo === 'ORCAMENTO' ? 'proposta' : 'venda') +
                ' da ' + (getEmpresa(db).nome || 'HM Centro Automotivo') + ':\n\n' +
                textoResumoVenda(db, o);
            var tel = telefoneClienteVenda(db, o);
            var url = tel
                ? ('https://wa.me/55' + tel + '?text=' + encodeURIComponent(texto))
                : ('https://wa.me/?text=' + encodeURIComponent(texto));
            window.open(url, '_blank');
        }

        function abrirLinkVenda(id) {
            var db = carregar();
            var o = (db.orcamentos || []).find(function (x) { return x.id === id; });
            if (!o) return;
            fecharAcoesVenda();
            document.getElementById('inputLinkVenda').value = textoResumoVenda(db, o);
            document.getElementById('modalLinkVenda').classList.add('aberto');
        }

        function excluirDocumentoVenda(id, perguntar) {
            if (perguntar !== false && !confirm('Excluir documento? (não estorna estoque — use Estornar para devolver estoque/caixa)')) return;
            var db2 = carregar();
            marcarExcluido(db2, 'orcamentos', id);
            db2.orcamentos = (db2.orcamentos || []).filter(function (x) { return x.id !== id; });
            salvar(db2);
            fecharAcoesVenda();
            renderOrcamentos();
            atualizarKPIs(db2);
            toast('Documento excluído.');
        }

        function estornarDocumentoVenda(id) {
            var db = carregar();
            var ix = (db.orcamentos || []).findIndex(function (x) { return x.id === id; });
            if (ix < 0) return;
            var o = db.orcamentos[ix];
            if (o.estornado) {
                toast('Documento já está estornado.');
                return;
            }
            if (!confirm('Estornar Nº ' + (o.numero || '') + '?\n\n• Devolve itens ao estoque (se houver produto)\n• Remove lançamento no caixa / pendente vinculado\n• Marca o documento como ESTORNADO')) return;

            if (o.tipo === 'VENDA') {
                (o.itens || []).forEach(function (it) {
                    if (!it.produtoId) return;
                    var pi = (db.produtos || []).findIndex(function (p) { return p.id === it.produtoId; });
                    if (pi < 0) return;
                    var q = Number(db.produtos[pi].qtd) || 0;
                    db.produtos[pi].qtd = Math.round((q + (Number(it.qtd) || 0)) * 1000) / 1000;
                    db.produtos[pi].atualizadoEm = new Date().toISOString();
                });
            }

            (db.caixa || []).forEach(function (x) {
                if (x && x.vendaId === id) marcarExcluido(db, 'caixa', x.id);
            });
            db.caixa = (db.caixa || []).filter(function (x) { return !(x && x.vendaId === id); });
            (db.caixaBanco || []).forEach(function (x) {
                if (x && x.vendaId === id) marcarExcluido(db, 'caixaBanco', x.id);
            });
            db.caixaBanco = (db.caixaBanco || []).filter(function (x) { return !(x && x.vendaId === id); });
            (db.pendentes || []).forEach(function (x) {
                if (x && x.vendaId === id) marcarExcluido(db, 'pendentes', x.id);
            });
            db.pendentes = (db.pendentes || []).filter(function (x) { return !(x && x.vendaId === id); });

            db.orcamentos[ix] = Object.assign({}, o, {
                estornado: true,
                statusPagamento: 'ESTORNADO',
                estornadoEm: new Date().toISOString()
            });
            salvar(db);
            fecharAcoesVenda();
            renderOrcamentos();
            renderProdutos();
            renderCaixa();
            renderCaixaBanco();
            renderPendentes();
            atualizarKPIs(db);
            toast('Documento Nº ' + (o.numero || '') + ' estornado.');
        }

        function executarAcaoVenda(acao) {
            var id = vendaAcoesAtualId;
            if (!id) return;
            if (acao === 'ed') editarDocumentoVenda(id);
            else if (acao === 'whats') abrirWhatsVenda(id);
            else if (acao === 'link') abrirLinkVenda(id);
            else if (acao === 'ver') { fecharAcoesVenda(); abrirNotaVenda(id, 'ver'); }
            else if (acao === 'pdf') { fecharAcoesVenda(); abrirNotaVenda(id, 'pdf'); }
            else if (acao === 'pdf-cliente') { fecharAcoesVenda(); abrirNotaVenda(id, 'cliente'); }
            else if (acao === 'cupom') { fecharAcoesVenda(); abrirNotaVenda(id, 'cupom'); }
            else if (acao === 'estornar') estornarDocumentoVenda(id);
            else if (acao === 'excluir') excluirDocumentoVenda(id, true);
        }

        function filtrarOrcamentosLista(lista, termo) {
            var t = String(termo || '').trim().toLowerCase();
            if (!t) return lista;
            return lista.filter(function (o) {
                var nome = (o.funcionarioNome || o.clienteNome || '').toLowerCase();
                var blob = [
                    o.numero, o.tipo, nome, o.statusPagamento, o.formaPagamento,
                    o.placa, o.descricao, o.observacao, o.estornado ? 'estornado' : ''
                ].join(' ').toLowerCase();
                return blob.indexOf(t) >= 0;
            });
        }

        function renderOrcamentos(filtroTipo) {
            if (!filtroTipo) {
                renderOrcamentos('VENDA');
                renderOrcamentos('ORCAMENTO');
                return;
            }
            var db = carregar();
            var isOrc = filtroTipo === 'ORCAMENTO';
            var tb = document.getElementById(isOrc ? 'tabelaOrcamentosRealizados' : 'tabelaVendasRealizadas');
            var vazio = document.getElementById(isOrc ? 'listaOrcamentosRealizadosVazia' : 'listaVendasRealizadasVazia');
            var buscaEl = document.getElementById(isOrc ? 'buscaOrcamentosRealizados' : 'buscaVendasRealizadas');
            if (!tb) return;
            var termo = (buscaEl || {}).value || '';
            var base = (db.orcamentos || []).filter(function (o) {
                var t = String(o.tipo || 'VENDA').toUpperCase();
                if (isOrc) return t === 'ORCAMENTO' || t === 'ORÇAMENTO';
                return t === 'VENDA';
            }).slice().reverse();
            var lista = filtrarOrcamentosLista(base, termo);
            tb.innerHTML = '';
            if (!lista.length) {
                if (vazio) vazio.style.display = '';
                return;
            }
            if (vazio) vazio.style.display = 'none';
            lista.forEach(function (o) {
                var nome = nomeDocVenda(db, o);
                var tagAvulso = o.clienteAvulso ? ' <span style="font-size:0.68rem;font-weight:700;color:#8fe0b8">AVULSO</span>' : '';
                var tagFunc = o.vendaFuncionario || o.funcionarioId
                    ? ' <span style="font-size:0.68rem;font-weight:700;color:#f1c40f">FUNCIONÁRIO</span>'
                    : '';
                var tagEst = o.estornado ? ' <span class="tag-estornado">ESTORNADO</span>' : '';
                var pgto = (o.statusPagamento || '—') + (o.formaPagamento ? ' / ' + o.formaPagamento : '');
                var tr = document.createElement('tr');
                tr.innerHTML =
                    '<td>' + esc(o.numero || '—') + tagEst + '</td>' +
                    '<td>' + esc(fmtData(o.dataEmissao || o.criadoEm)) + '</td>' +
                    '<td>' + esc(nome) + tagFunc + tagAvulso + '</td>' +
                    '<td>' + esc(pgto) + '</td>' +
                    '<td>' + moeda(o.valor) + '</td>' +
                    '<td class="actions">' +
                    '<button type="button" class="btn-acoes-doc" data-acoes-venda="' + o.id + '" title="Ações do documento">⚙</button>' +
                    '</td>';
                tb.appendChild(tr);
            });
            tb.querySelectorAll('[data-acoes-venda]').forEach(function (b) {
                b.addEventListener('click', function () {
                    abrirAcoesVenda(b.getAttribute('data-acoes-venda'));
                });
            });
        }

        var buscaVr = document.getElementById('buscaVendasRealizadas');
        if (buscaVr) {
            buscaVr.addEventListener('input', function () { renderOrcamentos('VENDA'); });
        }
        var buscaOr = document.getElementById('buscaOrcamentosRealizados');
        if (buscaOr) {
            buscaOr.addEventListener('input', function () { renderOrcamentos('ORCAMENTO'); });
        }

        (function ligarModalAcoesVenda() {
            var btnFechar = document.getElementById('btnFecharAcoesVenda');
            var modal = document.getElementById('modalAcoesVenda');
            if (btnFechar) btnFechar.addEventListener('click', fecharAcoesVenda);
            if (modal) {
                modal.addEventListener('click', function (e) {
                    if (e.target.id === 'modalAcoesVenda') fecharAcoesVenda();
                });
            }
            document.querySelectorAll('[data-acao-venda]').forEach(function (b) {
                b.addEventListener('click', function () {
                    executarAcaoVenda(b.getAttribute('data-acao-venda'));
                });
            });
            var btnCopiar = document.getElementById('btnCopiarLinkVenda');
            var btnWhatsL = document.getElementById('btnWhatsLinkVenda');
            var btnFecharL = document.getElementById('btnFecharLinkVenda');
            var modalL = document.getElementById('modalLinkVenda');
            if (btnCopiar) {
                btnCopiar.addEventListener('click', function () {
                    var v = document.getElementById('inputLinkVenda');
                    v.select();
                    try {
                        navigator.clipboard.writeText(v.value);
                        toast('Texto copiado.');
                    } catch (err) {
                        document.execCommand('copy');
                        toast('Texto copiado.');
                    }
                });
            }
            if (btnWhatsL) {
                btnWhatsL.addEventListener('click', function () {
                    var texto = document.getElementById('inputLinkVenda').value;
                    window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
                });
            }
            if (btnFecharL) {
                btnFecharL.addEventListener('click', function () {
                    document.getElementById('modalLinkVenda').classList.remove('aberto');
                });
            }
            if (modalL) {
                modalL.addEventListener('click', function (e) {
                    if (e.target.id === 'modalLinkVenda') modalL.classList.remove('aberto');
                });
            }
        })();

