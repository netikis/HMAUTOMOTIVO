'use strict';
/* HM Automotivo — produtos / estoque / etiquetas */

        /* ---------- Produtos (+ leitor de código de barras) ---------- */
        function normalizarCodigo(cod) {
            return String(cod || '').trim();
        }

        function focarLeitor() {
            var el = document.getElementById('prodCod');
            el.focus();
            el.select();
        }

        function preencherFormProd(p, manterFocoNome) {
            document.getElementById('prodId').value = p.id;
            document.getElementById('prodNome').value = p.nome || '';
            document.getElementById('prodCat').value = p.categoria || '';
            document.getElementById('prodCod').value = p.codigo || '';
            document.getElementById('prodCusto').value = p.custo || 0;
            document.getElementById('prodVenda').value = p.venda || 0;
            document.getElementById('prodQtd').value = p.qtd || 0;
            document.getElementById('prodUn').value = p.unidade || 'un';
            document.getElementById('tituloFormProd').textContent = 'Editar Produto';
            document.getElementById('btnCancelarProd').style.display = '';
            if (manterFocoNome) document.getElementById('prodNome').focus();
        }

        function processarCodigoBipado(codigo) {
            var cod = normalizarCodigo(codigo);
            if (!cod) return;
            document.getElementById('prodCod').value = cod;
            var db = carregar();
            var achado = db.produtos.find(function (p) {
                return normalizarCodigo(p.codigo).toLowerCase() === cod.toLowerCase();
            });
            if (achado) {
                preencherFormProd(achado, true);
                toast('Produto encontrado pelo código — pode editar e salvar.');
            } else {
                /* Novo cadastro: mantém o código bipado e vai para o nome */
                if (!document.getElementById('prodId').value) {
                    document.getElementById('tituloFormProd').textContent = 'Novo produto (código bipado)';
                }
                document.getElementById('prodNome').focus();
                toast('Código lido. Complete o cadastro e salve.');
            }
        }

        document.getElementById('prodCod').addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;
            e.preventDefault(); /* evita enviar o formulário ao bipar */
            processarCodigoBipado(this.value);
        });

        document.getElementById('btnFocoLeitor').addEventListener('click', focarLeitor);

        /* Busca da lista também aceita bipar + Enter */
        document.getElementById('buscaProd').addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;
            var cod = normalizarCodigo(this.value);
            if (!cod) return;
            var db = carregar();
            var achado = db.produtos.find(function (p) {
                return normalizarCodigo(p.codigo).toLowerCase() === cod.toLowerCase();
            });
            if (achado) {
                e.preventDefault();
                preencherFormProd(achado, true);
                toast('Produto encontrado na busca pelo código.');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });

        document.getElementById('formProduto').addEventListener('submit', function (e) {
            e.preventDefault();
            var db = carregar();
            var id = document.getElementById('prodId').value;
            var codigo = normalizarCodigo(document.getElementById('prodCod').value);
            if (codigo) {
                var duplicado = db.produtos.find(function (p) {
                    return normalizarCodigo(p.codigo).toLowerCase() === codigo.toLowerCase() && p.id !== id;
                });
                if (duplicado) {
                    toast('Já existe produto com este código de barras: ' + (duplicado.nome || ''));
                    focarLeitor();
                    return;
                }
            }
            var agora = new Date().toISOString();
            var payload = {
                id: id || uid(),
                nome: document.getElementById('prodNome').value.trim(),
                categoria: document.getElementById('prodCat').value.trim(),
                codigo: codigo,
                custo: Number(document.getElementById('prodCusto').value) || 0,
                venda: Number(document.getElementById('prodVenda').value) || 0,
                qtd: Number(document.getElementById('prodQtd').value) || 0,
                unidade: document.getElementById('prodUn').value,
                atualizadoEm: agora
            };
            if (id) {
                var i = db.produtos.findIndex(function (p) { return p.id === id; });
                if (i >= 0) {
                    payload.criadoEm = db.produtos[i].criadoEm || agora;
                    db.produtos[i] = Object.assign({}, db.produtos[i], payload);
                } else {
                    payload.criadoEm = agora;
                    db.produtos.push(payload);
                }
            } else {
                payload.criadoEm = agora;
                db.produtos.push(payload);
            }
            limparExcluido(db, 'produtos', payload.id);
            salvar(db);
            limparProd();
            toast('Produto salvo (estoque unificado — vale nos dois modos).');
            renderProdutos();
            atualizarKPIs(db);
            focarLeitor(); /* pronto para o próximo bip */
        });

        function limparProd() {
            document.getElementById('formProduto').reset();
            document.getElementById('prodId').value = '';
            document.getElementById('tituloFormProd').textContent = 'Cadastro de Produto / Serviço';
            document.getElementById('btnCancelarProd').style.display = 'none';
        }

        document.getElementById('btnCancelarProd').addEventListener('click', function () {
            limparProd();
            focarLeitor();
        });

        function editarProd(id) {
            var db = carregar();
            var p = db.produtos.find(function (x) { return x.id === id; });
            if (!p) return;
            abrirPainel('painelProdutos');
            preencherFormProd(p, false);
        }

        function excluirProd(id) {
            if (!confirm('Excluir produto? (some nos dois modos — estoque unificado)')) return;
            marcarExcluidoMain('produtos', id);
            var main = carregarMain();
            main.produtos = (main.produtos || []).filter(function (p) { return p.id !== id; });
            salvarMain(main);
            if (usuarioNuvemLogado()) {
                agendarSyncAutomatico('excluir-produto');
            }
            toast('Produto excluído dos dois modos.');
            renderProdutos();
            atualizarKPIs(main);
        }

        var ordemProdutos = { campo: 'nome', dir: 'asc' }; /* nome | qtd */

        function atualizarCabecalhosOrdemProd() {
            document.querySelectorAll('th[data-ordena-prod]').forEach(function (th) {
                var campo = th.getAttribute('data-ordena-prod');
                var ativa = ordemProdutos.campo === campo;
                th.classList.toggle('ativa', ativa);
                var seta = th.querySelector('.seta-ord');
                if (seta) seta.textContent = ativa ? (ordemProdutos.dir === 'asc' ? '▲' : '▼') : '';
            });
        }

        function renderProdutos() {
            var db = carregar();
            var q = (document.getElementById('buscaProd').value || '').toLowerCase().trim();
            var exProd = garantirExcluidos(carregarMain()).produtos || {};
            var lista = aplicarExcluidosNaLista(db.produtos || [], exProd).filter(function (p) {
                if (!q) return true;
                return [p.nome, p.codigo, p.categoria].join(' ').toLowerCase().indexOf(q) > -1;
            });
            var dir = ordemProdutos.dir === 'desc' ? -1 : 1;
            lista.sort(function (a, b) {
                if (ordemProdutos.campo === 'qtd') {
                    var qa = Number(a.qtd) || 0;
                    var qb = Number(b.qtd) || 0;
                    if (qa !== qb) return (qa - qb) * dir;
                    return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
                }
                var cmp = String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
                return cmp * dir;
            });
            atualizarCabecalhosOrdemProd();
            var tb = document.getElementById('tabelaProd');
            var chkAll = document.getElementById('chkTodasEtiquetas');
            if (chkAll) chkAll.checked = false;
            tb.innerHTML = '';
            var qtdBaixo = lista.filter(function (p) { return (Number(p.qtd) || 0) < 2; }).length;
            var alertaEl = document.getElementById('alertaEstoqueBaixo');
            if (alertaEl) {
                if (qtdBaixo > 0) {
                    alertaEl.style.display = '';
                    alertaEl.textContent = '⚠ ' + qtdBaixo + ' produto(s) com estoque abaixo de 2 — repor o quanto antes.';
                } else {
                    alertaEl.style.display = 'none';
                    alertaEl.textContent = '';
                }
            }
            if (!lista.length) {
                tb.innerHTML = '<tr><td colspan="7" class="muted">Nenhum produto.</td></tr>';
                return;
            }
            lista.forEach(function (p) {
                var tr = document.createElement('tr');
                var cod = normalizarCodigo(p.codigo) || '';
                var vendaNum = Number(p.venda) || 0;
                var qtdNum = Number(p.qtd) || 0;
                var estoqueBaixo = qtdNum < 2;
                if (estoqueBaixo) tr.className = 'linha-estoque-baixo';
                tr.innerHTML =
                    '<td style="text-align:center">' +
                    '<input type="checkbox" class="check-etiqueta"' +
                    ' data-nome="' + esc(p.nome || '') + '"' +
                    ' data-codigo="' + esc(cod) + '"' +
                    ' data-venda="' + esc(String(vendaNum)) + '">' +
                    '</td>' +
                    '<td>' + esc(p.codigo || '—') + '</td>' +
                    '<td>' + esc(p.nome) +
                    (estoqueBaixo ? ' <span class="badge-estoque-baixo">ESTOQUE BAIXO</span>' : '') +
                    '</td>' +
                    '<td>' + esc(p.categoria || '—') + '</td>' +
                    '<td class="' + (estoqueBaixo ? 'qtd-estoque-baixo' : '') + '">' +
                    esc(String(p.qtd) + ' ' + (p.unidade || '')) + '</td>' +
                    '<td>' + moeda(p.venda) + '</td>' +
                    '<td class="actions">' +
                    '<button type="button" class="btn btn-secondary" data-ed="' + p.id + '">Editar</button>' +
                    '<button type="button" class="btn btn-danger" data-ex="' + p.id + '">Excluir</button>' +
                    '</td>';
                tb.appendChild(tr);
            });
            tb.querySelectorAll('[data-ed]').forEach(function (b) {
                b.addEventListener('click', function () { editarProd(b.getAttribute('data-ed')); });
            });
            tb.querySelectorAll('[data-ex]').forEach(function (b) {
                b.addEventListener('click', function () { excluirProd(b.getAttribute('data-ex')); });
            });
        }

        function toggleTodasEtiquetas(source) {
            var checkboxes = document.querySelectorAll('#tabelaProd .check-etiqueta');
            checkboxes.forEach(function (chk) { chk.checked = !!source.checked; });
        }

        function imprimirEtiquetasEstoque() {
            var checkboxes = document.querySelectorAll('#tabelaProd .check-etiqueta:checked');
            if (!checkboxes.length) {
                alert('Selecione pelo menos um produto marcando a caixinha na tabela para imprimir.');
                return;
            }

            var modoRaw = prompt(
                'Modo de impressão das etiquetas:\n\n' +
                '1 = Folha A4 / livre (várias etiquetas por página — escolha a impressora no diálogo)\n' +
                '2 = Térmica Elgin L42 (50×30 mm, 2 por linha)\n\n' +
                'Digite 1 ou 2:',
                '1'
            );
            if (modoRaw == null) return;
            var modo = String(modoRaw).trim();
            var modoTermica = (modo === '2' || /^t/i.test(modo) || /elgin/i.test(modo));

            var qtdCopias = prompt('Quantas cópias de CADA ETIQUETA você deseja imprimir?', '1');
            if (qtdCopias == null) return;
            qtdCopias = parseInt(qtdCopias, 10);
            if (!qtdCopias || qtdCopias <= 0 || isNaN(qtdCopias)) return;

            var cssA4 =
                '* { margin: 0; padding: 0; box-sizing: border-box; }' +
                '@page { size: auto; margin: 8mm; }' +
                'html, body { font-family: Arial, sans-serif; background: #fff; color: #000; margin: 0; padding: 0; }' +
                'body { padding: 8mm; padding-top: 12mm; }' +
                '.folha-etiquetas { display: flex; flex-wrap: wrap; align-content: flex-start; gap: 2mm 3mm; width: 100%; max-width: 100%; }' +
                '.etiqueta { width: 50mm; height: 30mm; padding: 1.5mm; display: flex; flex-direction: column; justify-content: center; align-items: center; overflow: hidden; border: 0.3pt dashed #bbb; page-break-inside: avoid; break-inside: avoid; }' +
                '.etq-nome { font-size: 7pt; font-weight: bold; line-height: 1.1; margin-bottom: 2px; text-align: center; width: 100%; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; }' +
                '.etq-preco { font-size: 12pt; font-weight: 900; margin-bottom: 2px; text-align: center; }' +
                '.etq-barcode-container { width: 100%; text-align: center; }' +
                '.etq-barcode-container svg { max-width: 48mm; height: 42px !important; }' +
                '.barra-print { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 12px; background: #162233; }' +
                '.barra-print button { flex: 1 1 140px; min-height: 42px; border: 0; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; }' +
                '.barra-print .btn-ok { background: #27ae60; color: #fff; }' +
                '.barra-print .btn-fechar { background: #e74c3c; color: #fff; }' +
                '.hint-print { margin: 0 0 10px; font-size: 12px; color: #444; }' +
                '@media print { .barra-print, .hint-print { display: none !important; } body { padding: 0; } .etiqueta { border-color: transparent; } }';

            var cssTermica =
                '* { margin: 0; padding: 0; box-sizing: border-box; }' +
                '@page { size: 104mm 30mm; margin: 0mm !important; }' +
                'body { font-family: Arial, sans-serif; background: #fff; width: 104mm; margin: 0; padding: 0; color: #000; }' +
                '.folha-etiquetas { display: block; width: 104mm; }' +
                '.linha-etiquetas { display: flex; flex-direction: row; width: 104mm; height: 30mm; page-break-inside: avoid; page-break-after: always; justify-content: space-between; align-items: center; }' +
                '.etiqueta { width: 50mm; height: 30mm; padding: 1.5mm; display: flex; flex-direction: column; justify-content: center; align-items: center; overflow: hidden; }' +
                '.etq-nome { font-size: 7pt; font-weight: bold; line-height: 1.1; margin-bottom: 2px; text-align: center; width: 100%; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; }' +
                '.etq-preco { font-size: 12pt; font-weight: 900; margin-bottom: 2px; text-align: center; }' +
                '.etq-barcode-container { width: 100%; text-align: center; }' +
                '.etq-barcode-container svg { max-width: 48mm; height: 42px !important; }' +
                '.barra-print { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 12px; background: #162233; }' +
                '.barra-print button { flex: 1 1 140px; min-height: 42px; border: 0; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; }' +
                '.barra-print .btn-ok { background: #27ae60; color: #fff; }' +
                '.barra-print .btn-fechar { background: #e74c3c; color: #fff; }' +
                '.hint-print { margin: 40px 0 8px; font-size: 12px; color: #444; padding: 0 4px; }' +
                '@media print { .barra-print, .hint-print { display: none !important; } }';

            var titulo = modoTermica
                ? 'Etiquetas térmicas Elgin — HM Automotivo'
                : 'Etiquetas A4 — HM Automotivo';
            var htmlEtiquetas =
                '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">' +
                '<meta name="viewport" content="width=device-width, initial-scale=1">' +
                '<title>' + titulo + '</title>' +
                '<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>' +
                '<style>' + (modoTermica ? cssTermica : cssA4) + '</style></head><body>' +
                '<div class="barra-print">' +
                '<button type="button" class="btn-ok" onclick="window.print()">🖨️ Imprimir</button>' +
                '<button type="button" class="btn-fechar" onclick="try{window.close();}catch(e){}">✕ Fechar</button>' +
                '</div>' +
                '<p class="hint-print">' +
                (modoTermica
                    ? 'Modo térmico Elgin (2 por linha). No diálogo de impressão, selecione a impressora de etiquetas.'
                    : 'Modo A4 / livre — as etiquetas preenchem a folha. No diálogo, escolha a impressora e o tamanho do papel (A4, etc.).') +
                '</p>' +
                '<div class="folha-etiquetas">';

            var arrayEtiquetas = [];
            checkboxes.forEach(function (chk) {
                var nome = chk.getAttribute('data-nome') || '';
                if (nome.length > 45) nome = nome.substring(0, 45) + '...';
                var cod = chk.getAttribute('data-codigo') || '00000000';
                if (!cod) cod = '00000000';
                var precoNum = Number(chk.getAttribute('data-venda')) || 0;
                var precoFmt = precoNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                var i;
                for (i = 0; i < qtdCopias; i++) {
                    arrayEtiquetas.push(
                        '<div class="etiqueta">' +
                        '<div class="etq-nome">' + esc(nome) + '</div>' +
                        '<div class="etq-preco">R$ ' + esc(precoFmt) + '</div>' +
                        '<div class="etq-barcode-container">' +
                        '<svg class="barcode"' +
                        ' jsbarcode-value="' + esc(cod) + '"' +
                        ' jsbarcode-displayvalue="true"' +
                        ' jsbarcode-width="2"' +
                        ' jsbarcode-height="42"' +
                        ' jsbarcode-fontSize="11"' +
                        ' jsbarcode-textmargin="0"' +
                        ' jsbarcode-margin="0"></svg>' +
                        '</div></div>'
                    );
                }
            });

            if (modoTermica) {
                var j;
                for (j = 0; j < arrayEtiquetas.length; j += 2) {
                    var etq1 = arrayEtiquetas[j];
                    var etq2 = arrayEtiquetas[j + 1]
                        ? arrayEtiquetas[j + 1]
                        : '<div class="etiqueta" style="border:none;visibility:hidden"></div>';
                    htmlEtiquetas +=
                        '<div class="linha-etiquetas">' + etq1 + etq2 + '</div>';
                }
            } else {
                htmlEtiquetas += arrayEtiquetas.join('');
            }

            htmlEtiquetas +=
                '</div><script>' +
                'window.onload = function () {' +
                '  function initBc() { if (typeof JsBarcode !== "undefined") JsBarcode(".barcode").init(); }' +
                '  initBc();' +
                '  setTimeout(initBc, 400);' +
                '};' +
                '<\/script></body></html>';

            var janela = window.open('', '', 'width=900,height=700');
            if (!janela) {
                alert('Permita pop-ups neste site para abrir a impressão de etiquetas.');
                return;
            }
            janela.document.write(htmlEtiquetas);
            janela.document.close();
        }

        document.getElementById('buscaProd').addEventListener('input', renderProdutos);
        document.getElementById('chkTodasEtiquetas').addEventListener('change', function () {
            toggleTodasEtiquetas(this);
        });
        document.getElementById('btnImprimirEtiquetas').addEventListener('click', imprimirEtiquetasEstoque);
        document.querySelectorAll('th[data-ordena-prod]').forEach(function (th) {
            th.addEventListener('click', function () {
                var campo = th.getAttribute('data-ordena-prod');
                if (ordemProdutos.campo === campo) {
                    ordemProdutos.dir = ordemProdutos.dir === 'asc' ? 'desc' : 'asc';
                } else {
                    ordemProdutos.campo = campo;
                    ordemProdutos.dir = 'asc';
                }
                renderProdutos();
            });
        });

