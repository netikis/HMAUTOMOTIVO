'use strict';
/* HM Automotivo — OS / veiculo / fotos / nota / historico / receber / seguro */

        /* ---------- Atendimento / veículo ---------- */
        function atualizarPlaca() {
            var placa = (document.getElementById('atPlaca').value || 'PLACA').toUpperCase();
            var cidade = document.getElementById('atCidadePlaca').value || 'CIDADE / UF';
            document.getElementById('plateNum').textContent = placa || 'PLACA';
            document.getElementById('plateLoc').textContent = (cidade || 'CIDADE / UF').toUpperCase();
        }

        document.getElementById('atPlaca').addEventListener('input', atualizarPlaca);
        document.getElementById('atCidadePlaca').addEventListener('input', atualizarPlaca);

        /* ---------- Fotos do veículo (chegada) ---------- */
        function srcFoto(f) {
            return (f && (f.url || f.data)) || '';
        }

        function renderGaleriaFotos() {
            var box = document.getElementById('fotosGaleria');
            var cont = document.getElementById('fotosContador');
            var btnLimpar = document.getElementById('btnLimparFotos');
            var n = fotosAtuais.length;
            cont.textContent = n ? (n + ' foto' + (n > 1 ? 's' : '') + ' (internas)') : 'Nenhuma foto';
            btnLimpar.style.display = n ? '' : 'none';
            var btnExp = document.getElementById('btnExportarFotosForm');
            if (btnExp) btnExp.style.display = n ? '' : 'none';
            if (!n) {
                box.innerHTML = '';
                return;
            }
            box.innerHTML = fotosAtuais.map(function (f, idx) {
                var src = srcFoto(f);
                return '<div class="foto-thumb">' +
                    '<img src="' + src + '" alt="Foto ' + (idx + 1) + '" data-foto-zoom="' + idx + '">' +
                    '<button type="button" title="Remover" data-foto-rm="' + idx + '">×</button>' +
                    '</div>';
            }).join('');
            box.querySelectorAll('[data-foto-rm]').forEach(function (b) {
                b.addEventListener('click', function (e) {
                    e.stopPropagation();
                    fotosAtuais.splice(Number(b.getAttribute('data-foto-rm')), 1);
                    renderGaleriaFotos();
                });
            });
            box.querySelectorAll('[data-foto-zoom]').forEach(function (img) {
                img.addEventListener('click', function () {
                    document.getElementById('fotoZoomImg').src = img.src;
                    document.getElementById('modalFotoZoom').classList.add('aberto');
                });
            });
        }

        document.getElementById('btnFecharFotoZoom').addEventListener('click', function () {
            document.getElementById('modalFotoZoom').classList.remove('aberto');
        });
        document.getElementById('modalFotoZoom').addEventListener('click', function (e) {
            if (e.target === this) this.classList.remove('aberto');
        });

        function comprimirImagemArquivo(file) {
            return new Promise(function (resolve, reject) {
                var reader = new FileReader();
                reader.onerror = reject;
                reader.onload = function () {
                    var img = new Image();
                    img.onerror = reject;
                    img.onload = function () {
                        var max = 960;
                        var w = img.naturalWidth || img.width;
                        var h = img.naturalHeight || img.height;
                        if (!w || !h) { reject(new Error('imagem inválida')); return; }
                        if (w > max || h > max) {
                            if (w > h) { h = (h * max) / w; w = max; }
                            else { w = (w * max) / h; h = max; }
                        }
                        var canvas = document.createElement('canvas');
                        canvas.width = Math.round(w);
                        canvas.height = Math.round(h);
                        var ctx = canvas.getContext('2d');
                        ctx.fillStyle = '#fff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        resolve(canvas.toDataURL('image/jpeg', 0.85));
                    };
                    img.src = reader.result;
                };
                reader.readAsDataURL(file);
            });
        }

        async function processarArquivosFoto(fileList) {
            var files = Array.prototype.slice.call(fileList || []);
            if (!files.length) return;
            var erros = 0;
            for (var i = 0; i < files.length; i++) {
                if (fotosAtuais.length >= FOTOS_MAX) {
                    toast('Máximo de ' + FOTOS_MAX + ' fotos por atendimento.');
                    break;
                }
                var file = files[i];
                if (!file) continue;
                var tipo = (file.type || '').toLowerCase();
                if (!tipo.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || '')) continue;
                try {
                    var data = await comprimirImagemArquivo(file);
                    if (data) fotosAtuais.push({ id: uid(), data: data, url: null });
                    else erros++;
                } catch (err) {
                    erros++;
                }
            }
            renderGaleriaFotos();
            if (erros) toast('Algumas imagens não puderam ser processadas.');
        }

        document.getElementById('btnTirarFoto').addEventListener('click', function () {
            document.getElementById('inFotoCamera').click();
        });
        document.getElementById('btnGaleriaFoto').addEventListener('click', function () {
            document.getElementById('inFotoGaleria').click();
        });
        document.getElementById('inFotoCamera').addEventListener('change', function () {
            processarArquivosFoto(this.files);
            this.value = '';
        });
        document.getElementById('inFotoGaleria').addEventListener('change', function () {
            processarArquivosFoto(this.files);
            this.value = '';
        });
        document.getElementById('btnLimparFotos').addEventListener('click', function () {
            if (!fotosAtuais.length) return;
            if (!confirm('Remover todas as fotos deste atendimento?')) return;
            fotosAtuais = [];
            renderGaleriaFotos();
        });

        function carregarFotosNoForm(lista) {
            fotosAtuais = (lista || []).map(function (f) {
                return { id: f.id || uid(), data: f.data || null, url: f.url || null };
            }).filter(function (f) { return f.data || f.url; });
            renderGaleriaFotos();
        }

        function slugPasta(nome) {
            return String(nome || 'cliente')
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9]+/g, '_')
                .replace(/^_|_$/g, '')
                .slice(0, 60) || 'cliente';
        }

        function dataUrlParaBlob(dataUrl) {
            var parts = String(dataUrl).split(',');
            var mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
            var bin = atob(parts[1] || '');
            var arr = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            return new Blob([arr], { type: mime });
        }

        function abrirDbPasta() {
            return new Promise(function (resolve, reject) {
                var req = indexedDB.open(PASTA_IDB, 1);
                req.onupgradeneeded = function () { req.result.createObjectStore('handles'); };
                req.onsuccess = function () { resolve(req.result); };
                req.onerror = function () { reject(req.error); };
            });
        }


        /* ---------- Nota / PDF / Assinatura (base do relatório de veículos) ---------- */
        function carregarAssinaturas() {
            try {
                return JSON.parse(localStorage.getItem(ASSIN_KEY) || '{}') || {};
            } catch (e) { return {}; }
        }

        function salvarAssinaturas(mapa) {
            localStorage.setItem(ASSIN_KEY, JSON.stringify(mapa));
        }

        function sincronizarAssinaturasNoDb() {
            var mapa = carregarAssinaturas();
            var db = carregar();
            var mudou = false;
            db.atendimentos.forEach(function (a) {
                if (!a.tokenAssinatura) return;
                var pack = mapa[a.tokenAssinatura];
                if (!pack || !pack.assinaturaCliente) return;
                if (a.assinaturaCliente !== pack.assinaturaCliente) {
                    a.assinaturaCliente = pack.assinaturaCliente;
                    a.assinadoEm = pack.assinadoEm || null;
                    mudou = true;
                }
            });
            if (mudou) salvar(db);
            return mudou;
        }

        function gerarTokenAssinatura() {
            return 'hm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
        }

        function urlBasePasta() {
            return (location.href || '').split('#')[0].split('?')[0].replace(/[^/\\]+$/, '');
        }

        function urlLinkAssinatura(token) {
            return urlBasePasta() + 'assinar-hm.html?t=' + encodeURIComponent(token);
        }

        function badgeAssinatura(a) {
            if (a.assinaturaCliente) return '<span class="badge-assinado">Assinado</span>';
            if (a.tokenAssinatura) return '<span class="badge-pendente">Aguardando assinatura</span>';
            return '';
        }

        function despesasFolhaDaOs(atendimentoId) {
            if (typeof listarDespesasFolhaInterna === 'function') {
                return listarDespesasFolhaInterna(atendimentoId);
            }
            return [];
        }

        function despesasEscritorioDaOs(atendimentoId) {
            if (typeof listarDespesasEscritorioPorOs === 'function') {
                return listarDespesasEscritorioPorOs(atendimentoId);
            }
            return [];
        }

        function normalizarExportItens(exp, a, opts) {
            opts = opts || {};
            if (opts.modoInternoSeguro) {
                return {
                    notaSeguro: true,
                    servicosAparte: true,
                    vendasDespesas: true,
                    despesasOs: true,
                    franquia: true,
                    despesasEscritorio: true,
                    mao: true,
                    pecas: true
                };
            }
            if (!exp) {
                var seguroPrev = ehServicoSeguro(a);
                return {
                    notaSeguro: seguroPrev,
                    servicosAparte: true,
                    vendasDespesas: true,
                    despesasOs: false,
                    franquia: seguroPrev,
                    despesasEscritorio: false,
                    mao: true,
                    pecas: true
                };
            }
            var soNotaSeguro = !!exp.notaSeguro && !exp.servicosAparte && !exp.vendasDespesas;
            return {
                notaSeguro: !!exp.notaSeguro,
                servicosAparte: !!exp.servicosAparte,
                vendasDespesas: !!exp.vendasDespesas,
                despesasOs: !!exp.despesasOs,
                franquia: !!exp.franquia,
                despesasEscritorio: !!exp.despesasEscritorio,
                mao: !!(exp.servicosAparte || exp.mao || soNotaSeguro),
                pecas: !!(exp.vendasDespesas || exp.pecas || soNotaSeguro)
            };
        }

        function htmlTabelaDespesasExport(lista, vazioMsg) {
            var linhas = (lista || []).length
                ? lista.map(function (d, i) {
                    return '<tr>' +
                        '<td>' + (i + 1) + '</td>' +
                        '<td>' + esc(fmtData(d.criadoEm || d.data)) + '</td>' +
                        '<td>' + esc(d.descricao || '—') + '</td>' +
                        '<td>' + esc(d.forma || '—') + '</td>' +
                        '<td>' + moeda(d.valor) + '</td>' +
                        '</tr>';
                }).join('')
                : '<tr><td colspan="5" style="padding:10px;color:#666">' + esc(vazioMsg || 'Nenhuma despesa.') + '</td></tr>';
            var tot = (lista || []).reduce(function (s, d) { return s + (Number(d.valor) || 0); }, 0);
            return '<div class="nota-tabela-wrap"><table class="nota-itens compacta"><thead><tr>' +
                '<th>#</th><th>Data</th><th>Descrição</th><th>Forma</th><th>Valor</th>' +
                '</tr></thead><tbody>' + linhas + '</tbody></table></div>' +
                '<div class="nota-subtotais compacto" style="padding:6pt">Total: <strong>' + moeda(tot) + '</strong></div>';
        }

        function htmlItensNota(itens, opts) {
            opts = opts || {};
            var lista = itens || [];
            var exp = opts.exportItens;
            var showPecas = !exp || !!exp.pecas;
            var showMao = !exp || !!exp.mao;
            var filtrada = lista.filter(function (it) {
                var tipo = it.tipo || 'peca';
                if (tipo === 'mao') return showMao;
                return showPecas;
            });
            if (!filtrada.length) {
                return opts.vazioHtml != null ? opts.vazioHtml : '<p style="color:#000;font-size:0.85rem;">Nenhum item selecionado para este PDF.</p>';
            }
            var rows = filtrada.map(function (it) {
                var tipo = (it.tipo === 'mao') ? 'Mão de obra' : 'Peça';
                return '<tr><td>' + esc(tipo) + '</td><td>' + esc(it.desc || '') + '</td><td>' + moeda(it.valor) + '</td></tr>';
            }).join('');
            var pecas = filtrada.reduce(function (s, it) { return s + ((it.tipo || 'peca') === 'peca' ? (Number(it.valor) || 0) : 0); }, 0);
            var mao = filtrada.reduce(function (s, it) { return s + (it.tipo === 'mao' ? (Number(it.valor) || 0) : 0); }, 0);
            var partesSub = [];
            if (showPecas && pecas > 0) partesSub.push('Peças: <strong>' + moeda(pecas) + '</strong>');
            if (showMao && mao > 0) partesSub.push('Mão de obra: <strong>' + moeda(mao) + '</strong>');
            var rotulo = opts.rotuloTotal || ((showPecas && showMao) ? 'Total' : 'Subtotal');
            return '<table class="nota-itens compacta"><thead><tr><th>Tipo</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>' +
                rows + '</tbody></table>' +
                (partesSub.length ? '<div class="nota-subtotais compacto">' + partesSub.join(' · ') + '</div>' : '') +
                '<div class="nota-total compacto">' + rotulo + ': ' + moeda(pecas + mao) + '</div>';
        }

        function itensNotaDoAtendimento(a) {
            var itens = ((a && a.itens) || []).map(function (it) {
                return {
                    tipo: it.tipo || 'peca',
                    desc: it.desc || '',
                    valor: Number(it.valor) || 0
                };
            });
            var temMao = itens.some(function (it) { return it.tipo === 'mao'; });
            if (!temMao && a && Number(a.maoObra) > 0) {
                itens.push({ tipo: 'mao', desc: 'Mão de obra', valor: Number(a.maoObra) || 0 });
            }
            return itens;
        }

        function somarItensExport(itens, exp) {
            var showPecas = !exp || !!exp.pecas;
            var showMao = !exp || !!exp.mao;
            return (itens || []).reduce(function (s, it) {
                var tipo = it.tipo || 'peca';
                if (tipo === 'mao') return showMao ? s + (Number(it.valor) || 0) : s;
                return showPecas ? s + (Number(it.valor) || 0) : s;
            }, 0);
        }

        function htmlNotaEspelho(db, a, opts) {
            opts = opts || {};
            var incluirFotos = !!opts.incluirFotos;
            var exp = normalizarExportItens(opts.exportItens, a, opts);
            var emp = getEmpresa(db);
            var cad = dadosClienteDoAtendimento(db, a);
            var nome = cad.nome || nomeAtendimento(db, a);
            var sigEspaco = '';
            var sigBase = 'Assinatura do Cliente';
            if (a.assinaturaCliente) {
                sigEspaco = '<img src="' + a.assinaturaCliente + '" alt="Assinatura">';
                sigBase = 'Assinado em ' + esc(fmtData(a.assinadoEm) + (a.assinadoEm && a.assinadoEm.length > 10 ? ' ' + String(a.assinadoEm).slice(11, 16) : ''));
            }
            var endCli = [cad.endereco, cad.numero].filter(Boolean).join(', ');
            var blocoFotos = '';
            if (incluirFotos && a.fotos && a.fotos.length) {
                blocoFotos =
                    '<div class="nota-bloco compacto"><div class="tit azul">Fotos do veículo</div><div class="nota-fotos">' +
                    a.fotos.map(function (f) {
                        var s = f.url || f.data;
                        return s ? '<img src="' + s + '" alt="Foto">' : '';
                    }).join('') +
                    '</div></div>';
            }
            var tituloNota = exp.notaSeguro
                ? (opts.modoInternoSeguro ? 'SERVIÇO DE SEGURO — USO INTERNO' : 'NOTA SEGURO')
                : 'ESPELHO DE ATENDIMENTO';
            var partesSel = [];
            if (exp.notaSeguro) partesSel.push('nota seguro');
            if (exp.servicosAparte) partesSel.push('serviços realizados');
            if (exp.vendasDespesas) partesSel.push('peças/vendas');
            if (exp.despesasOs) partesSel.push('despesas da O.S');
            if (exp.franquia) partesSel.push('franquia');
            if (exp.despesasEscritorio) partesSel.push('despesas escritório');
            var servicosNoBlocoOficina = !exp.servicosAparte;
            var itensNota = itensNotaDoAtendimento(a);
            var blocosExtra = '';
            if (exp.servicosAparte) {
                var maoHtml = htmlItensNota(itensNota, { exportItens: { mao: true, pecas: false }, vazioHtml: '' });
                blocosExtra +=
                    '<div class="nota-bloco compacto"><div class="tit escuro">Serviços realizados</div>' +
                    (a.servicos
                        ? '<div class="nota-valores-pad compacto" style="color:#000;font-weight:800">' + esc(a.servicos) + '</div>'
                        : '') +
                    '<div class="nota-valores-pad compacto">' + maoHtml + '</div></div>';
            }
            if (exp.vendasDespesas) {
                var pecasHtml = htmlItensNota(itensNota, { exportItens: { mao: false, pecas: true }, vazioHtml: '' });
                blocosExtra +=
                    '<div class="nota-bloco compacto"><div class="tit verde">Peças / Vendas</div>' +
                    '<div class="nota-valores-pad compacto">' + pecasHtml + '</div>' +
                    '</div>';
            }
            if (exp.despesasOs) {
                var despOs = despesasFolhaDaOs(a.id);
                blocosExtra +=
                    '<div class="nota-bloco compacto"><div class="tit vermelho">Despesas da O.S</div>' +
                    htmlTabelaDespesasExport(despOs, 'Nenhuma despesa de serviço nesta OS.') +
                    '</div>';
            }
            if (exp.notaSeguro && !exp.vendasDespesas && !exp.servicosAparte) {
                var itensNotaHtml = htmlItensNota(itensNota, { exportItens: { mao: true, pecas: true }, vazioHtml: '' });
                if (itensNotaHtml) {
                    blocosExtra =
                        '<div class="nota-bloco compacto"><div class="tit verde">Peças e serviços</div>' +
                        '<div class="nota-valores-pad compacto">' + itensNotaHtml + '</div></div>' +
                        blocosExtra;
                }
            }
            if (exp.franquia) {
                blocosExtra +=
                    '<div class="nota-bloco compacto"><div class="tit verde">Franquia</div>' +
                    '<div class="nota-valores-pad compacto">' +
                    htmlItensNotaSeguro([], { interno: !!opts.modoInternoSeguro, franquia: a.franquia, exportItens: { franquia: true, mao: false, pecas: false } }) +
                    '</div></div>';
            }
            if (exp.despesasEscritorio) {
                var despEsc = despesasEscritorioDaOs(a.id);
                blocosExtra +=
                    '<div class="nota-bloco compacto"><div class="tit vermelho">Despesas escritório</div>' +
                    htmlTabelaDespesasExport(despEsc, 'Nenhuma despesa de escritório nesta OS.') +
                    '</div>';
            }
            var somaTotal = somarItensExport(itensNota, exp);
            if (!(somaTotal > 0) && exp.pecas && exp.mao && Number(a.total) > 0) {
                somaTotal = Number(a.total) || 0;
            }
            if (somaTotal > 0) {
                blocosExtra +=
                    '<div class="nota-bloco compacto"><div class="tit verde">Total</div>' +
                    '<div class="nota-valores-pad compacto">' +
                    '<div class="nota-total compacto nota-total-geral">TOTAL: ' + moeda(somaTotal) + '</div>' +
                    '</div></div>';
            }
            if (!blocosExtra && !exp.notaSeguro) {
                blocosExtra = '<div class="nota-bloco compacto"><div class="tit verde">Valores</div>' +
                    '<p style="color:#000;font-size:0.85rem;">Nenhum bloco de valores selecionado.</p></div>';
            }
            return '<div class="nota-espelho" id="notaEspelhoHtml">' +
                htmlCabecalhoNotaEmpresa(emp,
                    '<div class="nota-sub nota-titulo-espelho"' + (exp.notaSeguro && opts.modoInternoSeguro ? ' style="color:#c0392b"' : '') + '>' +
                    tituloNota + '</div>' +
                    '<div class="nota-sub nota-registro">' +
                    (partesSel.length ? ('Itens: ' + partesSel.join(' · ') + ' · ') : '') +
                    'Registro ' + esc(fmtData(a.entrada || a.criadoEm)) +
                    (a.id ? ' · ID ' + esc(String(a.id).slice(-6)) : '') + '</div>'
                ) +
                '<div class="nota-bloco compacto"><div class="tit azul">Cliente</div><div class="nota-grid nota-grid-compacta">' +
                '<div class="nota-campo full"><span class="nota-label">Cliente</span><span class="nota-valor">' + esc(nome) + (cad.avulso || a.clienteAvulso ? ' (avulso)' : '') + '</span></div>' +
                (cad.cpf ? '<div class="nota-campo"><span class="nota-label">CPF</span><span class="nota-valor">' + esc(cad.cpf) + '</span></div>' : '') +
                (cad.cnpj ? '<div class="nota-campo"><span class="nota-label">CNPJ</span><span class="nota-valor">' + esc(cad.cnpj) + '</span></div>' : '') +
                (cad.telefone ? '<div class="nota-campo"><span class="nota-label">Telefone</span><span class="nota-valor">' + esc(cad.telefone) + '</span></div>' : '') +
                (cad.email ? '<div class="nota-campo full"><span class="nota-label">E-mail</span><span class="nota-valor">' + esc(cad.email) + '</span></div>' : '') +
                (endCli ? '<div class="nota-campo full"><span class="nota-label">Endereço</span><span class="nota-valor">' + esc(endCli) + (cad.cidade ? ' — ' + esc(cad.cidade) : '') + '</span></div>' : '') +
                '</div></div>' +
                '<div class="nota-bloco compacto"><div class="tit vermelho">Veículo</div><div class="nota-grid nota-grid-compacta">' +
                '<div class="nota-campo"><span class="nota-label">Modelo</span><span class="nota-valor">' + esc(a.carro || '—') + '</span></div>' +
                '<div class="nota-campo"><span class="nota-label">Placa</span><span class="nota-valor" style="letter-spacing:2px;font-weight:700">' + esc((a.placa || '—').toUpperCase()) + '</span></div>' +
                '<div class="nota-campo"><span class="nota-label">Cidade / UF</span><span class="nota-valor">' + esc(a.cidadePlaca || '—') + '</span></div>' +
                '<div class="nota-campo"><span class="nota-label">Km</span><span class="nota-valor">' + esc(a.km ? a.km + ' Km' : '—') + '</span></div>' +
                '<div class="nota-campo"><span class="nota-label">Cor</span><span class="nota-valor">' + esc(a.cor || '—') + '</span></div>' +
                '<div class="nota-campo"><span class="nota-label">Ano fab.</span><span class="nota-valor">' + esc(a.anoFabricacao || '—') + '</span></div>' +
                '<div class="nota-campo"><span class="nota-label">Ano modelo</span><span class="nota-valor">' + esc(a.anoModelo || '—') + '</span></div>' +
                '<div class="nota-campo full"><span class="nota-label">Chassi</span><span class="nota-valor nota-chassi">' + esc((a.chassi || '—').toUpperCase()) + '</span></div>' +
                '</div></div>' +
                '<div class="nota-bloco compacto"><div class="tit escuro">Oficina, Chegada' + (exp.notaSeguro ? ' &amp; Seguro' : '') + '</div><div class="nota-grid nota-grid-compacta">' +
                ((opts.modoInternoSeguro || !exp.notaSeguro)
                    ? '<div class="nota-campo"><span class="nota-label">Responsável</span><span class="nota-valor">' + esc(nomeResponsavelOs(a)) + '</span></div>'
                    : '') +
                '<div class="nota-campo"><span class="nota-label">Status</span><span class="nota-valor">' + esc(a.status || '—') +
                (a.status === 'Agendado' && a.agendadoPara ? ' · ' + esc(fmtData(a.agendadoPara)) : '') + '</span></div>' +
                '<div class="nota-campo"><span class="nota-label">Entrada</span><span class="nota-valor">' + esc(fmtData(a.entrada)) + '</span></div>' +
                '<div class="nota-campo"><span class="nota-label">Saída</span><span class="nota-valor">' + esc(fmtData(a.saida)) + '</span></div>' +
                (a.agendadoPara ? '<div class="nota-campo full"><span class="nota-label">Agendado para</span><span class="nota-valor">' + esc(fmtData(a.agendadoPara)) + '</span></div>' : '') +
                (exp.notaSeguro && a.seguradora ? '<div class="nota-campo"><span class="nota-label">Seguradora</span><span class="nota-valor">' + esc(a.seguradora) + '</span></div>' : '') +
                (exp.notaSeguro && a.sinistro ? '<div class="nota-campo"><span class="nota-label">Sinistro</span><span class="nota-valor">' + esc(a.sinistro) + '</span></div>' : '') +
                '<div class="nota-campo full"><span class="nota-label">Estado de chegada</span><span class="nota-valor">' + esc(a.estado || 'Sem observações.') + '</span></div>' +
                (servicosNoBlocoOficina
                    ? '<div class="nota-campo full"><span class="nota-label">Serviços</span><span class="nota-valor" style="color:#000;font-weight:800">' + esc(a.servicos || '—') + '</span></div>'
                    : '') +
                '</div></div>' +
                blocoFotos +
                blocosExtra +
                '<div class="nota-sigs compacto">' +
                '<div class="nota-sig"><div class="nota-sig-espaco"></div><div class="nota-sig-base">' +
                (opts.modoInternoSeguro ? 'Responsável / Funcionário' : 'Assinatura do Responsável') + '</div></div>' +
                '<div class="nota-sig"><div class="nota-sig-espaco">' + sigEspaco + '</div><div class="nota-sig-base">' + sigBase + '</div></div>' +
                '</div></div>';
        }

        function atendimentoTemFotos(a) {
            return !!(a && a.fotos && a.fotos.some(function (f) {
                return f && (f.data || f.url || f.id || f.arquivo);
            }));
        }

        function contarFotosVisiveis(a) {
            if (!a || !a.fotos) return 0;
            return a.fotos.filter(function (f) {
                return f && (f.data || f.url || f.id || f.arquivo);
            }).length;
        }

        var _fotosClienteResolve = null;
        function perguntarEnviarComFotos(a, opts) {
            opts = opts || {};
            return new Promise(function (resolve) {
                var tem = atendimentoTemFotos(a);
                var n = contarFotosVisiveis(a);
                var btnCom = document.getElementById('btnFotosSim');
                var msg = document.getElementById('modalFotosClienteMsg');
                if (!tem && !opts.forcarPergunta) {
                    resolve(false);
                    return;
                }
                _fotosClienteResolve = resolve;
                /* Sempre mostra as duas opções */
                btnCom.style.display = '';
                btnCom.disabled = false;
                if (tem) {
                    msg.textContent = 'Há ' + n + ' foto(s) na ficha (uso interno). Escolha como enviar a nota ao cliente:';
                } else {
                    msg.textContent = 'Não há fotos neste atendimento ainda. Você pode enviar SEM FOTOS, ou editar a OS e anexar fotos antes.';
                }
                document.getElementById('modalFotosCliente').classList.add('aberto');
            });
        }
        function fecharModalFotosCliente(resposta) {
            document.getElementById('modalFotosCliente').classList.remove('aberto');
            var btnCom = document.getElementById('btnFotosSim');
            if (btnCom) { btnCom.style.display = ''; btnCom.disabled = false; }
            if (_fotosClienteResolve) {
                var r = _fotosClienteResolve;
                _fotosClienteResolve = null;
                r(resposta);
            }
        }

        document.getElementById('btnFotosSim').addEventListener('click', function () { fecharModalFotosCliente(true); });
        document.getElementById('btnFotosNao').addEventListener('click', function () { fecharModalFotosCliente(false); });
        document.getElementById('btnFotosCancelar').addEventListener('click', function () { fecharModalFotosCliente(null); });
        document.getElementById('modalFotosCliente').addEventListener('click', function (e) {
            if (e.target.id === 'modalFotosCliente') fecharModalFotosCliente(null);
        });

        var _exportFotosCtx = null; /* { atendimento } ou { lista: fotosAtuais } */
        function abrirModalExportFotos(ctx) {
            var fotos = (ctx && ctx.atendimento && ctx.atendimento.fotos) || (ctx && ctx.lista) || [];
            if (!fotos.length) { toast('Não há fotos para exportar.'); return; }
            _exportFotosCtx = ctx;
            document.getElementById('modalExportFotos').classList.add('aberto');
        }
        function fecharModalExportFotos() {
            document.getElementById('modalExportFotos').classList.remove('aberto');
            _exportFotosCtx = null;
        }

        function listaFotosExport() {
            if (!_exportFotosCtx) return [];
            if (_exportFotosCtx.atendimento) return _exportFotosCtx.atendimento.fotos || [];
            return _exportFotosCtx.lista || [];
        }

        function baixarDataUrl(dataUrl, nomeArquivo) {
            var a = document.createElement('a');
            a.href = dataUrl;
            a.download = nomeArquivo;
            document.body.appendChild(a);
            a.click();
            a.remove();
        }

        function dataUrlParaFormato(dataUrl, mime) {
            return new Promise(function (resolve, reject) {
                if (!dataUrl) { reject(new Error('sem imagem')); return; }
                if (mime === 'image/jpeg' && String(dataUrl).indexOf('data:image/jpeg') === 0) {
                    resolve(dataUrl);
                    return;
                }
                var img = new Image();
                img.onload = function () {
                    var canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    var ctx = canvas.getContext('2d');
                    if (mime === 'image/jpeg') {
                        ctx.fillStyle = '#fff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL(mime, mime === 'image/jpeg' ? 0.92 : undefined));
                };
                img.onerror = reject;
                img.src = dataUrl;
            });
        }

        async function exportarFotosFormato(formato) {
            var fotos = listaFotosExport().filter(function (f) { return f && (f.data || f.url); });
            if (!fotos.length) { toast('Não há fotos para exportar.'); return; }
            var baseNome = 'hm_fotos';
            if (_exportFotosCtx && _exportFotosCtx.atendimento) {
                var at = _exportFotosCtx.atendimento;
                baseNome = slugPasta((at.clienteNome || 'cliente') + '_' + (at.placa || 'placa') + '_' + String(at.id || '').slice(-6));
            } else if (_exportFotosCtx && _exportFotosCtx.lista) {
                var placaForm = (document.getElementById('atPlaca') && document.getElementById('atPlaca').value) || 'placa';
                var cliForm = (document.getElementById('atClienteBusca') && document.getElementById('atClienteBusca').value) || 'cliente';
                baseNome = slugPasta(cliForm + '_' + placaForm);
            }
            if (formato === 'pdf') {
                var html = '<div class="nota-espelho"><div class="nota-topo"><h1>Fotos do veículo (interno)</h1>' +
                    '<div class="nota-sub">' + esc(baseNome) + ' · ' + fotos.length + ' foto(s)</div></div>' +
                    '<div class="nota-fotos">' +
                    fotos.map(function (f, i) {
                        var s = f.data || f.url;
                        return s ? '<div style="margin-bottom:12px;page-break-inside:avoid"><div class="nota-sub">Foto ' + (i + 1) + '</div><img src="' + s + '" style="max-width:100%;height:auto"></div>' : '';
                    }).join('') +
                    '</div></div>';
                fecharModalExportFotos();
                executarImpressaoHtml(html);
                return;
            }
            var mime = formato === 'png' ? 'image/png' : 'image/jpeg';
            var ext = formato === 'png' ? 'png' : 'jpg';
            for (var i = 0; i < fotos.length; i++) {
                try {
                    var src = fotos[i].data || fotos[i].url;
                    var out = await dataUrlParaFormato(src, mime);
                    baixarDataUrl(out, baseNome + '_foto_' + (i + 1) + '.' + ext);
                    await new Promise(function (r) { setTimeout(r, 350); });
                } catch (e) { /* segue */ }
            }
            fecharModalExportFotos();
            toast(fotos.length + ' arquivo(s) ' + ext.toUpperCase() + ' exportado(s).');
        }

        document.getElementById('btnExpJpeg').addEventListener('click', function () { exportarFotosFormato('jpeg'); });
        document.getElementById('btnExpPng').addEventListener('click', function () { exportarFotosFormato('png'); });
        document.getElementById('btnExpPdf').addEventListener('click', function () { exportarFotosFormato('pdf'); });
        document.getElementById('btnExpFechar').addEventListener('click', fecharModalExportFotos);
        document.getElementById('modalExportFotos').addEventListener('click', function (e) {
            if (e.target.id === 'modalExportFotos') fecharModalExportFotos();
        });
        document.getElementById('btnExportarFotosForm').addEventListener('click', function () {
            abrirModalExportFotos({ lista: fotosAtuais.slice() });
        });

        function abrirNota(id) {
            sincronizarAssinaturasNoDb();
            var db = carregar();
            var a = db.atendimentos.find(function (x) { return x.id === id; });
            if (!a) { toast('Atendimento não encontrado.'); return; }
            atendimentoNotaAtual = a;
            var seguro = ehServicoSeguro(a);
            var titulo = (seguro ? 'Seguro — ' : 'Nota — ') + (a.placa || '').toUpperCase() + ' · ' + nomeAtendimento(db, a);
            /* Preview: interno se seguro. Salvar/Encaminhar pedem escolha do PDF cliente. */
            var html = htmlNotaEspelho(db, a, { incluirFotos: true, modoInternoSeguro: seguro }) +
                (atendimentoTemFotos(a)
                    ? '<p class="hint" style="margin-top:10px;color:#0d3d6e">Fotos acima são internas. Em <strong>imprimir</strong> ou <strong>enviar nota ao cliente</strong> você marca o que sai: Nota seguro, Serviços realizados, Peças/Vendas, Despesas da O.S, Franquia e Despesas escritório.</p>'
                    : '') +
                '<p class="hint" style="margin-top:8px">Ao imprimir, salvar, encaminhar ou enviar, escolha com as caixas o que entra no documento.</p>';
            _htmlNotaImpressaoAtual = htmlNotaEspelho(db, a, { incluirFotos: true, modoInternoSeguro: seguro });
            _tituloNotaImpressao = titulo;
            _notaPdfPrecisaEscolherItens = true;
            _notaPdfEhSeguro = seguro;

            if (ehCelular()) {
                abrirViewerPdf(_htmlNotaImpressaoAtual, titulo);
                return;
            }

            document.getElementById('modalNotaTitulo').textContent = titulo;
            document.getElementById('modalNotaCorpo').innerHTML = html;
            document.getElementById('btnNotaExportFotos').style.display = atendimentoTemFotos(a) ? '' : 'none';
            document.getElementById('btnNotaPdf').style.display = seguro ? 'none' : '';
            document.getElementById('btnNotaPdfInterno').style.display = seguro ? '' : 'none';
            document.getElementById('btnNotaPdfCliente').style.display = seguro ? '' : 'none';
            document.getElementById('modalNota').classList.add('aberto');
        }

        function fecharNota() {
            document.getElementById('modalNota').classList.remove('aberto');
            fecharViewerPdf();
        }

        var _itensPdfClienteResolve = null;
        var _notaPdfPrecisaEscolherItens = false;
        var _notaPdfEhSeguro = false;
        function perguntarItensPdfCliente(opts) {
            opts = opts || {};
            var modoSeguro = opts.seguro !== false;
            return new Promise(function (resolve) {
                _itensPdfClienteResolve = resolve;
                var chkN = document.getElementById('chkPdfNotaSeguro');
                var chkS = document.getElementById('chkPdfServicosAparte');
                var chkV = document.getElementById('chkPdfVendasDespesas');
                var chkF = document.getElementById('chkPdfFranquia');
                var chkE = document.getElementById('chkPdfDespesasEscritorio');
                var tit = document.getElementById('titItensPdfCliente');
                var hint = document.getElementById('hintItensPdfCliente');
                var sug = document.getElementById('sugItensPdfCliente');
                if (tit) tit.textContent = 'Imprimir / enviar — o que incluir?';
                if (hint) {
                    hint.innerHTML = 'Marque as caixas do que deseja <strong>imprimir</strong> ou <strong>enviar ao cliente</strong>. Pode marcar um ou vários.';
                }
                if (sug) {
                    sug.textContent = modoSeguro
                        ? 'Sugestão no seguro: Nota seguro + Peças + Serviços + Franquia, para sair o valor total. Desmarque só o que não quiser no papel.'
                        : 'Sugestão: Serviços realizados e Peças/Vendas. Despesas da O.S, Franquia e Nota seguro só se for o caso.';
                }
                var chkD = document.getElementById('chkPdfDespesasOs');
                if (chkN) chkN.checked = modoSeguro;
                if (chkS) chkS.checked = true;
                if (chkV) chkV.checked = true;
                if (chkD) chkD.checked = false;
                if (chkF) chkF.checked = modoSeguro;
                if (chkE) chkE.checked = false;
                document.getElementById('modalItensPdfCliente').classList.add('aberto');
            });
        }
        function fecharModalItensPdfCliente(ok) {
            document.getElementById('modalItensPdfCliente').classList.remove('aberto');
            if (!_itensPdfClienteResolve) return;
            var r = _itensPdfClienteResolve;
            _itensPdfClienteResolve = null;
            if (!ok) {
                r(null);
                return;
            }
            var exportItens = {
                notaSeguro: !!(document.getElementById('chkPdfNotaSeguro') || {}).checked,
                servicosAparte: !!(document.getElementById('chkPdfServicosAparte') || {}).checked,
                vendasDespesas: !!(document.getElementById('chkPdfVendasDespesas') || {}).checked,
                despesasOs: !!(document.getElementById('chkPdfDespesasOs') || {}).checked,
                franquia: !!(document.getElementById('chkPdfFranquia') || {}).checked,
                despesasEscritorio: !!(document.getElementById('chkPdfDespesasEscritorio') || {}).checked
            };
            exportItens.mao = exportItens.servicosAparte;
            exportItens.pecas = exportItens.vendasDespesas;
            if (!exportItens.notaSeguro && !exportItens.servicosAparte && !exportItens.vendasDespesas &&
                !exportItens.despesasOs && !exportItens.franquia && !exportItens.despesasEscritorio) {
                toast('Marque pelo menos uma opção para imprimir ou enviar.');
                _itensPdfClienteResolve = r;
                document.getElementById('modalItensPdfCliente').classList.add('aberto');
                return;
            }
            r(exportItens);
        }
        document.getElementById('btnItensPdfOk').addEventListener('click', function () {
            fecharModalItensPdfCliente(true);
        });
        document.getElementById('btnItensPdfCancelar').addEventListener('click', function () {
            fecharModalItensPdfCliente(false);
        });
        document.getElementById('modalItensPdfCliente').addEventListener('click', function (e) {
            if (e.target.id === 'modalItensPdfCliente') fecharModalItensPdfCliente(false);
        });

        async function imprimirNotaPdf(id, opts) {
            opts = opts || {};
            sincronizarAssinaturasNoDb();
            var db = carregar();
            var a = id ? db.atendimentos.find(function (x) { return x.id === id; }) : atendimentoNotaAtual;
            if (!a) { toast('Selecione um atendimento.'); return; }
            atendimentoNotaAtual = a;
            var seguro = ehServicoSeguro(a);
            var modoInterno = !!opts.modoInternoSeguro;
            var exportItens = opts.exportItens || null;

            if (seguro && modoInterno && !exportItens) {
                exportItens = {
                    notaSeguro: true,
                    servicosAparte: true,
                    vendasDespesas: true,
                    despesasOs: true,
                    franquia: true,
                    despesasEscritorio: true,
                    mao: true,
                    pecas: true
                };
            }
            if (!exportItens) {
                exportItens = await perguntarItensPdfCliente({ seguro: seguro });
                if (!exportItens) return;
            }

            var comFotos = false;
            if (!modoInterno) {
                comFotos = await perguntarEnviarComFotos(a, { forcarPergunta: true });
                if (comFotos === null) return;
                if (comFotos) {
                    a = await garantirFotosCarregadas(a);
                    var okFoto = (a.fotos || []).some(function (f) { return f && (f.data || f.url); });
                    if (!okFoto) {
                        toast('Não há fotos disponíveis — imprimindo só o documento.');
                        comFotos = false;
                    }
                }
            }
            var html = htmlNotaEspelho(db, a, {
                incluirFotos: !!comFotos,
                modoInternoSeguro: seguro && modoInterno,
                exportItens: exportItens
            });
            var titulo = (seguro
                ? (modoInterno ? 'Seguro interno — ' : 'Seguro cliente — ')
                : 'Espelho — ') +
                (a.placa || '').toUpperCase() + ' · ' + nomeAtendimento(db, a);
            _htmlNotaImpressaoAtual = html;
            _tituloNotaImpressao = titulo;
            _notaPdfPrecisaEscolherItens = !!(seguro && modoInterno);
            _notaPdfEhSeguro = seguro;

            if (ehCelular()) {
                fecharNota();
                abrirViewerPdf(html, titulo);
                return;
            }
            executarImpressaoHtml(html);
        }

        /** Gera HTML do PDF cliente (com escolha) sem imprimir — usado em Salvar/Encaminhar. */
        async function garantirHtmlNotaParaCliente(opts) {
            opts = opts || {};
            sincronizarAssinaturasNoDb();
            var db = carregar();
            var a = atendimentoNotaAtual;
            if (!a) return obterHtmlNotaAtual();
            var seguro = ehServicoSeguro(a);
            if (!_notaPdfPrecisaEscolherItens && !opts.forcar) {
                return obterHtmlNotaAtual();
            }
            var exportItens = await perguntarItensPdfCliente({ seguro: seguro });
            if (!exportItens) return null;
            var comFotos = false;
            if (opts.perguntarFotos !== false) {
                comFotos = await perguntarEnviarComFotos(a, { forcarPergunta: true });
                if (comFotos === null) return null;
                if (comFotos) {
                    a = await garantirFotosCarregadas(a);
                    if (!(a.fotos || []).some(function (f) { return f && (f.data || f.url); })) {
                        comFotos = false;
                    }
                }
            }
            var html = htmlNotaEspelho(db, a, {
                incluirFotos: !!comFotos,
                modoInternoSeguro: false,
                exportItens: exportItens
            });
            _htmlNotaImpressaoAtual = html;
            _tituloNotaImpressao = (seguro ? 'Seguro cliente — ' : 'Espelho — ') +
                (a.placa || '').toUpperCase() + ' · ' + nomeAtendimento(db, a);
            _notaPdfPrecisaEscolherItens = false;
            _notaPdfEhSeguro = seguro;
            return html;
        }

        function filtrarItensExportCliente(itens, exportItens) {
            var lista = itens || [];
            var exp = exportItens || null;
            if (!exp) return lista.slice();
            return lista.filter(function (it) {
                var tipo = it.tipo || 'peca';
                if (tipo === 'mao') return !!(exp.servicosAparte || exp.mao);
                return !!(exp.vendasDespesas || exp.pecas);
            });
        }

        function documentoAssinatura(db, a, incluirFotos, exportItens) {
            var emp = getEmpresa(db);
            var cad = dadosClienteDoAtendimento(db, a);
            var exp = normalizarExportItens(exportItens, a, {});
            var itensFiltrados = filtrarItensExportCliente(itensNotaDoAtendimento(a), exp);
            var totalItens = itensFiltrados.reduce(function (s, it) {
                return s + (Number(it.valor) || 0);
            }, 0);
            if (!(totalItens > 0) && exp.pecas && exp.mao && Number(a.total) > 0) {
                totalItens = Number(a.total) || 0;
            }
            var franquiaShow = exp.franquia ? (Number(a.franquia) || 0) : 0;
            var despOs = exp.despesasOs ? despesasFolhaDaOs(a.id) : [];
            var despEsc = exp.despesasEscritorio ? despesasEscritorioDaOs(a.id) : [];
            var doc = {
                atendimentoId: a.id,
                nomeCliente: cad.nome || nomeAtendimento(db, a),
                clienteAvulso: !!(cad.avulso || a.clienteAvulso),
                clienteCadastro: cad,
                cpf: cad.cpf || '',
                cnpj: cad.cnpj || '',
                telefone: cad.telefone || '',
                email: cad.email || '',
                responsavel: a.responsavel || '',
                responsavelId: a.responsavelId || '',
                carro: a.carro || '',
                placa: a.placa || '',
                cidadePlaca: a.cidadePlaca || '',
                cor: a.cor || '',
                anoFabricacao: a.anoFabricacao || '',
                anoModelo: a.anoModelo || '',
                chassi: a.chassi || '',
                km: a.km || '',
                entrada: a.entrada || '',
                saida: a.saida || '',
                status: a.status || '',
                agendadoPara: a.agendadoPara || '',
                estado: a.estado || '',
                servicos: exp.servicosAparte || exp.notaSeguro ? (a.servicos || '') : '',
                tipoServico: a.tipoServico || 'normal',
                seguradora: exp.notaSeguro ? (a.seguradora || '') : '',
                sinistro: exp.notaSeguro ? (a.sinistro || '') : '',
                itens: itensFiltrados,
                total: totalItens,
                franquia: franquiaShow,
                despesasOs: despOs.map(function (d) {
                    return {
                        criadoEm: d.criadoEm || d.data || '',
                        descricao: d.descricao || '',
                        forma: d.forma || '',
                        valor: Number(d.valor) || 0
                    };
                }),
                despesasEscritorio: despEsc.map(function (d) {
                    return {
                        criadoEm: d.criadoEm || d.data || '',
                        descricao: d.descricao || '',
                        forma: d.forma || '',
                        valor: Number(d.valor) || 0
                    };
                }),
                exportItens: {
                    notaSeguro: !!exp.notaSeguro,
                    servicosAparte: !!exp.servicosAparte,
                    vendasDespesas: !!exp.vendasDespesas,
                    despesasOs: !!exp.despesasOs,
                    franquia: !!exp.franquia,
                    despesasEscritorio: !!exp.despesasEscritorio,
                    mao: !!exp.mao,
                    pecas: !!exp.pecas
                },
                empresa: emp.nome || 'HM Centro Automotivo',
                empresaEndereco: enderecoCompleto(emp),
                empresaTelefone: emp.telefone || '',
                empresaCnpj: emp.cnpj || '',
                empresaIe: emp.ie || '',
                empresaLogo: logoSrc(emp)
            };
            if (incluirFotos && a.fotos && a.fotos.length) {
                doc.fotos = a.fotos.map(function (f) {
                    return { id: f.id, url: f.url || null, data: f.data || null };
                }).filter(function (f) { return f.data || f.url; });
            }
            return doc;
        }

        async function garantirFotosCarregadas(a) {
            if (!a || !a.fotos || !a.fotos.length) return a;
            var precisa = a.fotos.some(function (f) { return f && f.id && !f.data && !f.url; });
            if (!precisa) return a;
            var cfgN = carregarConfigNuvem();
            if (!cfgN || !cfgN.apiKey || !cfgN.projectId) return a;
            try {
                await hidratarFotosDaNuvem(a);
                var db = carregar();
                var ix = db.atendimentos.findIndex(function (x) { return x.id === a.id; });
                if (ix >= 0) {
                    db.atendimentos[ix].fotos = a.fotos;
                    salvar(db);
                }
            } catch (e) { /* segue */ }
            return a;
        }

        async function abrirLinkAssinatura(id) {
            var db = carregar();
            var a = db.atendimentos.find(function (x) { return x.id === id; });
            if (!a) { toast('Atendimento não encontrado.'); return; }

            var seguro = ehServicoSeguro(a);
            var exportItens = await perguntarItensPdfCliente({ seguro: seguro });
            if (!exportItens) return;

            var comFotos = await perguntarEnviarComFotos(a, { forcarPergunta: true });
            if (comFotos === null) return;
            if (comFotos) {
                a = await garantirFotosCarregadas(a);
                var okFoto = (a.fotos || []).some(function (f) { return f && (f.data || f.url); });
                if (!okFoto) {
                    toast('Não há fotos disponíveis neste atendimento. Enviando só o documento.');
                    comFotos = false;
                }
            }
            if (!a.tokenAssinatura) a.tokenAssinatura = gerarTokenAssinatura();

            var mapa = carregarAssinaturas();
            var prev = mapa[a.tokenAssinatura] || {};
            var pack = {
                token: a.tokenAssinatura,
                atendimentoId: a.id,
                documento: documentoAssinatura(db, a, !!comFotos, exportItens),
                criadoEm: prev.criadoEm || new Date().toISOString(),
                atualizadoEm: new Date().toISOString(),
                assinaturaCliente: prev.assinaturaCliente || a.assinaturaCliente || null,
                assinadoEm: prev.assinadoEm || a.assinadoEm || null
            };
            mapa[a.tokenAssinatura] = pack;
            salvarAssinaturas(mapa);

            var i = db.atendimentos.findIndex(function (x) { return x.id === a.id; });
            if (i >= 0) {
                db.atendimentos[i].tokenAssinatura = a.tokenAssinatura;
                if (pack.assinaturaCliente) {
                    db.atendimentos[i].assinaturaCliente = pack.assinaturaCliente;
                    db.atendimentos[i].assinadoEm = pack.assinadoEm;
                }
                salvar(db);
            }

            var partes = [];
            if (exportItens.notaSeguro) partes.push('nota seguro');
            if (exportItens.servicosAparte) partes.push('serviços realizados');
            if (exportItens.vendasDespesas) partes.push('peças/vendas');
            if (exportItens.despesasOs) partes.push('despesas da O.S');
            if (exportItens.franquia) partes.push('franquia');
            if (exportItens.despesasEscritorio) partes.push('despesas escritório');
            var link = urlLinkAssinatura(a.tokenAssinatura);
            document.getElementById('inputLinkAssinatura').value = link;
            document.getElementById('modalLinkAssinatura').classList.add('aberto');
            atendimentoNotaAtual = db.atendimentos[i] || a;
            toast(
                (pack.assinaturaCliente ? 'Cliente já assinou — link reenviado.' : 'Link pronto — envie ao cliente.') +
                ' · ' + partes.join(', ') +
                (comFotos ? ' · com fotos' : ' · sem fotos')
            );
            renderHistorico();
        }

        function fecharModalLink() {
            document.getElementById('modalLinkAssinatura').classList.remove('aberto');
        }

        function aplicarAssinaturaImportada(data) {
            if (!data || !data.token || !data.assinaturaCliente) {
                toast('Arquivo de assinatura inválido.');
                return;
            }
            var mapa = carregarAssinaturas();
            var pack = mapa[data.token] || { token: data.token, documento: data.documento || null };
            pack.assinaturaCliente = data.assinaturaCliente;
            pack.assinadoEm = data.assinadoEm || new Date().toISOString();
            pack.atualizadoEm = new Date().toISOString();
            if (data.atendimentoId) pack.atendimentoId = data.atendimentoId;
            mapa[data.token] = pack;
            salvarAssinaturas(mapa);

            var db = carregar();
            var alvo = db.atendimentos.find(function (a) {
                return a.tokenAssinatura === data.token || a.id === data.atendimentoId || a.id === pack.atendimentoId;
            });
            if (alvo) {
                alvo.assinaturaCliente = pack.assinaturaCliente;
                alvo.assinadoEm = pack.assinadoEm;
                alvo.tokenAssinatura = data.token;
                salvar(db);
            }
            toast('Assinatura importada com sucesso.');
            renderHistorico();
            if (atendimentoNotaAtual && (atendimentoNotaAtual.id === (alvo && alvo.id))) {
                abrirNota(atendimentoNotaAtual.id);
            }
        }

        function renderHistorico() {
            sincronizarAssinaturasNoDb();
            var db = carregar();
            var q = (document.getElementById('buscaAtend').value || '').toLowerCase().trim();
            var exAt = garantirExcluidos(db).atendimentos || {};
            var lista = aplicarExcluidosNaLista(db.atendimentos.slice(), exAt).filter(function (a) {
                if (osFinalizadaInterno(a)) return false;
                if (!q) return true;
                var nome = nomeAtendimento(db, a);
                return [nome, a.carro, a.placa, a.status, a.servicos, a.agendadoPara, fmtData(a.agendadoPara), a.tipoServico, a.seguradora]
                    .join(' ').toLowerCase().indexOf(q) > -1;
            }).sort(function (a, b) {
                var aAg = (a.status || '') === 'Agendado' ? 0 : 1;
                var bAg = (b.status || '') === 'Agendado' ? 0 : 1;
                if (aAg !== bAg) return aAg - bAg;
                if (aAg === 0) {
                    return String(a.agendadoPara || '9999').localeCompare(String(b.agendadoPara || '9999'));
                }
                return String(b.entrada || b.criadoEm || '').localeCompare(String(a.entrada || a.criadoEm || ''));
            });

            /* Destaque no topo: chips dos agendados */
            var boxAg = document.getElementById('boxAgendadosDestaque');
            var chips = document.getElementById('listaAgendadosChips');
            var agendados = lista.filter(function (a) { return (a.status || '') === 'Agendado'; });
            if (boxAg && chips) {
                if (!agendados.length) {
                    boxAg.style.display = 'none';
                    chips.innerHTML = '';
                } else {
                    boxAg.style.display = '';
                    chips.innerHTML = agendados.map(function (a) {
                        var nome = nomeAtendimento(db, a);
                        return '<button type="button" class="chip-agendado" data-ed-ag="' + esc(a.id) + '">' +
                            '<span class="chip-data">📅 ' + esc(fmtData(a.agendadoPara) || 'Sem data') + '</span>' +
                            '<span class="chip-info">' + esc((a.placa || '—').toUpperCase()) + ' · ' + esc(a.carro || '—') + '</span>' +
                            '<span class="chip-cli">' + esc(nome) + '</span>' +
                            '</button>';
                    }).join('');
                    chips.querySelectorAll('[data-ed-ag]').forEach(function (b) {
                        b.addEventListener('click', function () {
                            editarAtendimento(b.getAttribute('data-ed-ag'));
                        });
                    });
                }
            }

            var tb = document.getElementById('tabelaAtend');
            var vazio = document.getElementById('listaAtendVazia');
            tb.innerHTML = '';
            if (!lista.length) { vazio.style.display = ''; return; }
            vazio.style.display = 'none';
            lista.forEach(function (a) {
                var nome = nomeAtendimento(db, a);
                var tagAvulso = a.clienteAvulso
                    ? ' <span style="font-size:0.68rem;font-weight:700;color:#8fe0b8">AVULSO</span>'
                    : '';
                var tagSeguro = ehServicoSeguro(a)
                    ? ' <span style="font-size:0.68rem;font-weight:700;color:#e67e22">SEGURO</span>'
                    : '';
                var statusAtual = a.status || 'Em andamento';
                var ehAgendado = statusAtual === 'Agendado';
                var badgeAg = ehAgendado
                    ? '<div class="badge-agendado">📅 Agendado' +
                        (a.agendadoPara ? ' · ' + esc(fmtData(a.agendadoPara)) : '') + '</div>'
                    : '';
                var jaPago = String(a.statusPagamento || '').toUpperCase() === 'PAGO';
                var badgePago = jaPago
                    ? '<div class="badge-pago-os">PAGO · ' + esc(a.formaPagamento || '—') +
                        (a.canalRecebimento === 'interno' ? ' · Interno' : ' · Oficial') + '</div>'
                    : '';
                var btnReceber = jaPago
                    ? ''
                    : '<button type="button" class="btn btn-receber" data-rec="' + a.id + '">💰 Receber</button>';
                var tr = document.createElement('tr');
                if (ehAgendado) tr.className = 'linha-agendada';
                tr.innerHTML =
                    '<td>' + esc(fmtData(ehAgendado && a.agendadoPara ? a.agendadoPara : (a.entrada || a.criadoEm))) +
                    (ehAgendado ? '<div style="font-size:0.68rem;color:#f1c40f;font-weight:700">agendado</div>' : '') +
                    '</td>' +
                    '<td>' + badgeAg + esc(nome) + tagAvulso + tagSeguro + badgeAssinatura(a) + badgePago + '</td>' +
                    '<td>' + esc(a.carro || '—') + '</td>' +
                    '<td>' + esc(a.placa || '—') + '</td>' +
                    '<td>' + moeda(a.total) + '</td>' +
                    '<td class="actions">' +
                    '<select class="status-at-select' + (ehAgendado ? ' status-agendado' : '') +
                    '" data-st="' + a.id + '" title="Alterar status" style="min-width:150px;padding:6px 8px;font-size:0.75rem;font-weight:700">' +
                    opcoesStatusAt(statusAtual) +
                    '</select>' +
                    '<select data-tipo-orc="' + a.id + '" title="Tipo de orçamento" style="min-width:130px;padding:6px 8px;font-size:0.75rem;font-weight:700;' +
                    (ehServicoSeguro(a) ? 'border-color:#e67e22;color:#e67e22' : '') + '">' +
                    '<option value="normal"' + (!ehServicoSeguro(a) ? ' selected' : '') + '>📄 Normal</option>' +
                    '<option value="seguro"' + (ehServicoSeguro(a) ? ' selected' : '') + '>🛡️ Seguro</option>' +
                    '</select>' +
                    btnReceber +
                    '<button type="button" class="btn btn-ver" data-ver="' + a.id + '">Ver nota</button>' +
                    '<button type="button" class="btn btn-pdf" data-pdf="' + a.id + '">PDF</button>' +
                    '<button type="button" class="btn btn-assinar" data-link="' + a.id + '">Enviar nota</button>' +
                    (atendimentoTemFotos(a)
                        ? '<button type="button" class="btn btn-secondary" data-expf="' + a.id + '">Exportar fotos</button>'
                        : '') +
                    '<button type="button" class="btn btn-secondary" data-ed="' + a.id + '">Editar</button>' +
                    '<button type="button" class="btn btn-danger" data-ex="' + a.id + '">Excluir</button>' +
                    '</td>';
                tb.appendChild(tr);
            });
            tb.querySelectorAll('[data-st]').forEach(function (sel) {
                sel.addEventListener('change', function () {
                    alterarStatusAtendimento(sel.getAttribute('data-st'), sel.value);
                });
            });
            tb.querySelectorAll('[data-tipo-orc]').forEach(function (sel) {
                sel.addEventListener('change', function () {
                    alterarTipoOrcamentoAtendimento(sel.getAttribute('data-tipo-orc'), sel.value);
                });
            });
            tb.querySelectorAll('[data-rec]').forEach(function (b) {
                b.addEventListener('click', function () { abrirModalReceberOs(b.getAttribute('data-rec')); });
            });
            tb.querySelectorAll('[data-ver]').forEach(function (b) {
                b.addEventListener('click', function () { abrirNota(b.getAttribute('data-ver')); });
            });
            tb.querySelectorAll('[data-pdf]').forEach(function (b) {
                b.addEventListener('click', function () { imprimirNotaPdf(b.getAttribute('data-pdf')); });
            });
            tb.querySelectorAll('[data-link]').forEach(function (b) {
                b.addEventListener('click', function () { abrirLinkAssinatura(b.getAttribute('data-link')); });
            });
            tb.querySelectorAll('[data-expf]').forEach(function (b) {
                b.addEventListener('click', function () {
                    var dbx = carregar();
                    var ax = dbx.atendimentos.find(function (x) { return x.id === b.getAttribute('data-expf'); });
                    if (ax) abrirModalExportFotos({ atendimento: ax });
                });
            });
            tb.querySelectorAll('[data-ed]').forEach(function (b) {
                b.addEventListener('click', function () { editarAtendimento(b.getAttribute('data-ed')); });
            });
            tb.querySelectorAll('[data-ex]').forEach(function (b) {
                b.addEventListener('click', function () { excluirAtendimento(b.getAttribute('data-ex')); });
            });
        }

        function alterarTipoOrcamentoAtendimento(id, novoTipo) {
            var db = carregar();
            var i = db.atendimentos.findIndex(function (a) { return a.id === id; });
            if (i < 0) {
                toast('Atendimento não encontrado.');
                renderHistorico();
                return;
            }
            var a = db.atendimentos[i];
            var paraSeguro = String(novoTipo || '') === 'seguro';
            var atualSeguro = ehServicoSeguro(a);
            if (paraSeguro === atualSeguro) {
                renderHistorico();
                return;
            }
            if (paraSeguro) {
                var franquiaAtual = Number(a.franquia) || 0;
                var sugestao = franquiaAtual > 0
                    ? String(franquiaAtual).replace('.', ',')
                    : '0';
                var dig = prompt(
                    'Trocar para ORÇAMENTO DE SEGURO.\n\nInforme a franquia (R$). Deixe 0 se ainda não souber:',
                    sugestao
                );
                if (dig === null) {
                    renderHistorico();
                    return;
                }
                var franquia = parseMoeda(dig);
                if (isNaN(franquia) || franquia < 0) franquia = 0;
                a.tipoServico = 'seguro';
                a.franquia = franquia;
                if (!a.seguradora) {
                    var seg = prompt('Seguradora (opcional):', a.seguradora || '');
                    if (seg !== null) a.seguradora = String(seg || '').trim();
                }
                toast('Orçamento marcado como SEGURO' + (franquia > 0 ? ' · franquia ' + moeda(franquia) : '') + '.');
            } else {
                if (!confirm('Trocar para ORÇAMENTO NORMAL?\nA franquia deixa de aparecer na impressão do cliente (fica só no histórico interno se já existir).')) {
                    renderHistorico();
                    return;
                }
                a.tipoServico = 'normal';
                toast('Orçamento marcado como NORMAL.');
            }
            a.atualizadoEm = new Date().toISOString();
            db.atendimentos[i] = a;
            salvar(db);
            if (usuarioNuvemLogado()) {
                enviarAtendimentoNuvem(a).catch(function () { /* offline */ });
            }
            /* Se estiver aberto no formulário, sincroniza o seletor */
            if (document.getElementById('atId').value === id) {
                document.getElementById('atTipoOrcamento').value = paraSeguro ? 'seguro' : 'normal';
                if (paraSeguro) {
                    document.getElementById('atFranquia').value = a.franquia
                        ? String(a.franquia).replace('.', ',')
                        : '';
                    document.getElementById('atSeguradora').value = a.seguradora || '';
                }
                atualizarUITipoOrcamento();
            }
            renderHistorico();
        }

        /* ---------- Receber OS (Histórico → Caixa oficial ou Interno) ---------- */
        var receberOsIdAtual = null;
        var receberOsCanalDestino = null;

        function fecharModalReceberOs() {
            receberOsIdAtual = null;
            receberOsCanalDestino = null;
            document.getElementById('modalReceberOs').classList.remove('aberto');
            document.getElementById('receberOsPasso1').style.display = '';
            document.getElementById('receberOsPasso2').style.display = 'none';
        }

        function abrirModalReceberOs(atendimentoId) {
            var main = carregarMain();
            var a = (main.atendimentos || []).find(function (x) { return x.id === atendimentoId; });
            if (!a) {
                toast('OS não encontrada.');
                return;
            }
            if (String(a.statusPagamento || '').toUpperCase() === 'PAGO') {
                alert('Esta OS já está marcada como PAGA (' + (a.formaPagamento || '—') +
                    (a.canalRecebimento === 'interno' ? ' · Modo Interno' : ' · Caixa oficial') + ').');
                return;
            }
            var valor = Number(a.total) || 0;
            if (!(valor > 0)) {
                toast('Esta OS está sem valor para receber.');
                return;
            }
            receberOsIdAtual = atendimentoId;
            receberOsCanalDestino = null;
            var nome = nomeAtendimento(main, a);
            document.getElementById('receberOsResumo').innerHTML =
                '<strong>' + esc(nome) + '</strong> — ' + esc(a.carro || '—') +
                ' · Placa <strong>' + esc((a.placa || '—').toUpperCase()) + '</strong>';
            document.getElementById('receberOsValor').textContent = 'Valor a receber: ' + moeda(valor);
            document.getElementById('receberOsPasso1').style.display = '';
            document.getElementById('receberOsPasso2').style.display = 'none';
            document.getElementById('modalReceberOs').classList.add('aberto');
        }

        function atendimentoEmAberto(a) {
            if (!a) return false;
            if (String(a.statusPagamento || '').toUpperCase() === 'PAGO') return false;
            if (typeof osFinalizadaInterno === 'function' && osFinalizadaInterno(a)) return false;
            var st = a.status || 'Em andamento';
            if (st === 'Entregue' || st === 'Agendado') return false;
            return true;
        }

        function listarCarrosEmAberto(db) {
            db = db || carregarMain();
            var exAt = garantirExcluidos(db).atendimentos || {};
            return aplicarExcluidosNaLista(db.atendimentos || [], exAt)
                .filter(atendimentoEmAberto)
                .sort(function (a, b) {
                    return String(b.entrada || b.criadoEm || '').localeCompare(String(a.entrada || a.criadoEm || ''));
                });
        }

        var ANDAMENTO_EXPAND_KEY = 'hm_andamento_expandido';

        function atualizarQtdCarrosAndamento(n) {
            var qtd = document.getElementById('qtdCarrosAndamento');
            if (qtd) qtd.textContent = String(n || 0);
        }

        function andamentoEstaExpandido() {
            try {
                return localStorage.getItem(ANDAMENTO_EXPAND_KEY) === '1';
            } catch (e) {
                return false;
            }
        }

        function aplicarEstadoAndamento() {
            var box = document.getElementById('boxCarrosAndamentoInicio');
            var btn = document.getElementById('btnToggleAndamento');
            if (!box || !btn) return;
            var aberto = andamentoEstaExpandido();
            box.classList.toggle('recolhido', !aberto);
            btn.setAttribute('aria-expanded', aberto ? 'true' : 'false');
            btn.title = aberto ? 'Recolher carros em andamento' : 'Expandir carros em andamento';
        }

        function alternarAndamento() {
            var aberto = !andamentoEstaExpandido();
            try {
                localStorage.setItem(ANDAMENTO_EXPAND_KEY, aberto ? '1' : '0');
            } catch (e) { /* ok */ }
            aplicarEstadoAndamento();
        }

        function ligarToggleAndamento() {
            var btn = document.getElementById('btnToggleAndamento');
            if (!btn || btn.getAttribute('data-ligado') === '1') return;
            btn.setAttribute('data-ligado', '1');
            btn.addEventListener('click', alternarAndamento);
            aplicarEstadoAndamento();
        }

        function renderCarrosEmAberto(db) {
            db = db || carregarMain();
            ligarToggleAndamento();
            var host = document.getElementById('listaCarrosAndamentoInicio');
            if (!host) return;
            var lista = listarCarrosEmAberto(db);
            atualizarQtdCarrosAndamento(lista.length);
            if (!lista.length) {
                host.innerHTML = '<div class="muted" style="padding:6px 0">Nenhum carro em andamento agora.</div>';
                return;
            }
            host.innerHTML = lista.map(function (a) {
                var nome = nomeAtendimento(db, a);
                return '<div class="chip-agendado chip-andamento">' +
                    '<button type="button" class="chip-andamento-main" data-ed-and="' + esc(a.id) + '">' +
                    '<span class="chip-data">🔧 ' + esc(a.status || 'Em andamento') + '</span>' +
                    '<span class="chip-info">' + esc((a.placa || '—').toUpperCase()) + ' · ' + esc(a.carro || '—') + '</span>' +
                    '<span class="chip-cli">' + esc(nome) + ' · ' + moeda(a.total) + '</span>' +
                    '</button>' +
                    '<button type="button" class="btn btn-ok btn-sm btn-mandar-caixa" data-fin-cx="' + esc(a.id) + '">Mandar ao caixa</button>' +
                    '</div>';
            }).join('');
            host.querySelectorAll('[data-ed-and]').forEach(function (b) {
                b.addEventListener('click', function () {
                    editarAtendimento(b.getAttribute('data-ed-and'), { irParaAcoes: true });
                });
            });
            host.querySelectorAll('[data-fin-cx]').forEach(function (b) {
                b.addEventListener('click', function (e) {
                    e.stopPropagation();
                    finalizarEMandarAoCaixa(b.getAttribute('data-fin-cx'));
                });
            });
        }

        function finalizarEMandarAoCaixa(id) {
            var db = carregarMain();
            var i = (db.atendimentos || []).findIndex(function (a) { return a && String(a.id) === String(id); });
            if (i < 0) { toast('OS não encontrada.'); return; }
            var a = db.atendimentos[i];
            if (String(a.statusPagamento || '').toUpperCase() === 'PAGO') {
                toast('Esta OS já foi ao caixa.');
                editarAtendimento(id);
                return;
            }
            if ((a.status || '') === 'Em andamento' || (a.status || '') === 'Aguardando peça' || !a.status) {
                a.status = 'Pronto';
                a.saida = a.saida || hojeISO();
                a.atualizadoEm = new Date().toISOString();
                db.atendimentos[i] = a;
                salvarMain(db);
            }
            renderCarrosEmAberto(db);
            if (typeof renderHistorico === 'function') renderHistorico();
            abrirModalReceberOs(id);
        }

        function receberOsIrPassoForma(canalDestino) {
            receberOsCanalDestino = canalDestino;
            document.getElementById('receberOsDestinoTxt').innerHTML = canalDestino === 'interno'
                ? 'Destino: <strong style="color:#f1c40f">Modo Interno</strong> — o valor entra no caixa interno.'
                : 'Destino: <strong style="color:#7ec8ff">Caixa / Relatórios (oficial)</strong> — o valor entra no caixa oficial.';
            document.getElementById('receberOsPasso1').style.display = 'none';
            document.getElementById('receberOsPasso2').style.display = '';
        }

        function confirmarRecebimentoOs(forma) {
            if (!receberOsIdAtual || !receberOsCanalDestino) return;
            var main = carregarMain();
            var idx = (main.atendimentos || []).findIndex(function (x) { return x.id === receberOsIdAtual; });
            if (idx < 0) {
                toast('OS não encontrada.');
                fecharModalReceberOs();
                return;
            }
            var a = main.atendimentos[idx];
            if (String(a.statusPagamento || '').toUpperCase() === 'PAGO') {
                alert('Esta OS já foi recebida.');
                fecharModalReceberOs();
                renderHistorico();
                return;
            }
            var valor = Number(a.total) || 0;
            if (!(valor > 0)) {
                toast('OS sem valor.');
                return;
            }
            var nome = nomeAtendimento(main, a);
            var placa = (a.placa || '—').toUpperCase();
            var digital = formaPagamentoEhDigital(forma);
            var lancId = uid();
            var agora = new Date().toISOString();
            var lanc = {
                id: lancId,
                tipo: 'entrada',
                descricao: 'Recebimento OS ' + placa + ' — ' + nome,
                valor: valor,
                forma: forma,
                conta: digital ? 'banco' : 'balcao',
                atendimentoId: a.id,
                osResumo: {
                    cliente: nome,
                    placa: placa,
                    carro: a.carro || '',
                    totalOs: valor,
                    entrada: a.entrada || a.criadoEm || ''
                },
                criadoEm: agora
            };

            var canalAntes = canalVendas;
            canalVendas = receberOsCanalDestino === 'interno' ? 'interno' : 'normal';
            var dbCx = carregar();
            if (digital) {
                if (!dbCx.caixaBanco) dbCx.caixaBanco = [];
                dbCx.caixaBanco.push(lanc);
            } else {
                if (!dbCx.caixa) dbCx.caixa = [];
                dbCx.caixa.push(lanc);
            }
            salvar(dbCx);
            canalVendas = canalAntes;
            atualizarBadgeCanal();

            a.statusPagamento = 'PAGO';
            a.formaPagamento = forma;
            a.canalRecebimento = receberOsCanalDestino === 'interno' ? 'interno' : 'oficial';
            a.recebidoEm = agora;
            a.lancamentoRecebimentoId = lancId;
            a.atualizadoEm = agora;
            main.atendimentos[idx] = a;
            salvarMain(main);

            var destinoTxt = receberOsCanalDestino === 'interno' ? 'Modo Interno' : 'Caixa / Relatórios (oficial)';
            var contaTxt = digital ? 'Caixa do Banco (PIX/cartão)' : 'Caixa / Balcão (dinheiro)';
            fecharModalReceberOs();
            renderHistorico();
            renderCaixa();
            renderCaixaBanco();
            renderRelatorioCaixa();
            atualizarKPIs(carregar());
            if (typeof renderCarrosEmAberto === 'function') renderCarrosEmAberto(carregarMain());
            if (typeof atualizarAcoesOsForm === 'function') atualizarAcoesOsForm();
            toast('Recebido: ' + moeda(valor) + ' · ' + forma);
            alert(
                '✅ Pagamento registrado!\n\n' +
                'OS: ' + placa + ' — ' + nome + '\n' +
                'Valor: ' + moeda(valor) + '\n' +
                'Forma: ' + forma + '\n' +
                'Destino: ' + destinoTxt + '\n' +
                'Conta: ' + contaTxt
            );
        }

        document.getElementById('btnRecDestNormal').addEventListener('click', function () {
            receberOsIrPassoForma('normal');
        });
        document.getElementById('btnRecDestInterno').addEventListener('click', function () {
            receberOsIrPassoForma('interno');
        });
        document.getElementById('btnReceberOsVoltar').addEventListener('click', function () {
            receberOsCanalDestino = null;
            document.getElementById('receberOsPasso1').style.display = '';
            document.getElementById('receberOsPasso2').style.display = 'none';
        });
        document.getElementById('btnReceberOsFechar').addEventListener('click', fecharModalReceberOs);
        document.getElementById('modalReceberOs').addEventListener('click', function (e) {
            if (e.target.id === 'modalReceberOs') fecharModalReceberOs();
        });
        document.querySelectorAll('[data-rec-forma]').forEach(function (b) {
            b.addEventListener('click', function () {
                confirmarRecebimentoOs(b.getAttribute('data-rec-forma'));
            });
        });

        document.getElementById('buscaAtend').addEventListener('input', renderHistorico);

        function idOsFormAtual() {
            return (document.getElementById('atId') || {}).value || '';
        }

        function atualizarAcoesOsForm() {
            var box = document.getElementById('acoesOsForm');
            if (!box) return;
            var id = idOsFormAtual();
            if (!id) {
                box.style.display = 'none';
                return;
            }
            box.style.display = '';
            var db = carregarMain();
            var a = (db.atendimentos || []).find(function (x) { return x && x.id === id; });
            var jaPago = !!(a && String(a.statusPagamento || '').toUpperCase() === 'PAGO');
            var btnRec = document.getElementById('btnOsFormReceber');
            if (btnRec) btnRec.style.display = jaPago ? 'none' : '';
        }

        function ligarAcoesOsForm() {
            var btnRec = document.getElementById('btnOsFormReceber');
            var btnVer = document.getElementById('btnOsFormVer');
            var btnPdf = document.getElementById('btnOsFormPdf');
            var btnImp = document.getElementById('btnOsFormImprimir');
            var btnEnv = document.getElementById('btnOsFormEnviar');
            var btnEd = document.getElementById('btnOsFormEditar');
            var btnEx = document.getElementById('btnOsFormExcluir');
            if (btnRec) btnRec.addEventListener('click', function () {
                var id = idOsFormAtual();
                if (id) abrirModalReceberOs(id);
            });
            if (btnVer) btnVer.addEventListener('click', function () {
                var id = idOsFormAtual();
                if (id) abrirNota(id);
            });
            if (btnPdf) btnPdf.addEventListener('click', function () {
                var id = idOsFormAtual();
                if (id) imprimirNotaPdf(id);
            });
            if (btnImp) btnImp.addEventListener('click', function () {
                var id = idOsFormAtual();
                if (id) imprimirNotaPdf(id);
            });
            if (btnEnv) btnEnv.addEventListener('click', function () {
                var id = idOsFormAtual();
                if (id) abrirLinkAssinatura(id);
            });
            if (btnEd) btnEd.addEventListener('click', function () {
                var id = idOsFormAtual();
                if (!id) return;
                var topo = document.getElementById('formAtendimento') || document.getElementById('painelVeiculo');
                if (topo) topo.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            if (btnEx) btnEx.addEventListener('click', function () {
                var id = idOsFormAtual();
                if (id) excluirAtendimento(id);
            });
            atualizarAcoesOsForm();
        }
        ligarAcoesOsForm();

        document.getElementById('btnNotaFechar').addEventListener('click', fecharNota);
        document.getElementById('modalNota').addEventListener('click', function (e) {
            if (e.target.id === 'modalNota') fecharNota();
        });
        document.getElementById('btnNotaPdf').addEventListener('click', function () {
            if (atendimentoNotaAtual) imprimirNotaPdf(atendimentoNotaAtual.id);
        });
        document.getElementById('btnNotaPdfInterno').addEventListener('click', function () {
            if (atendimentoNotaAtual) imprimirNotaPdf(atendimentoNotaAtual.id, { modoInternoSeguro: true });
        });
        document.getElementById('btnNotaPdfCliente').addEventListener('click', function () {
            if (atendimentoNotaAtual) imprimirNotaPdf(atendimentoNotaAtual.id, { modoInternoSeguro: false });
        });
        document.getElementById('btnNotaEncaminhar').addEventListener('click', async function () {
            if (_notaPdfPrecisaEscolherItens) {
                var html = await garantirHtmlNotaParaCliente();
                if (!html) return;
            }
            encaminharNotaAtual();
        });
        document.getElementById('btnNotaSalvarPdf').addEventListener('click', async function () {
            if (_notaPdfPrecisaEscolherItens) {
                var html = await garantirHtmlNotaParaCliente();
                if (!html) return;
            }
            salvarNotaPdfArquivo();
        });
        document.getElementById('btnViewerFechar').addEventListener('click', fecharViewerPdf);
        document.getElementById('btnViewerEncaminhar').addEventListener('click', async function () {
            if (_notaPdfPrecisaEscolherItens) {
                var html = await garantirHtmlNotaParaCliente();
                if (!html) return;
                abrirViewerPdf(html, _tituloNotaImpressao);
            }
            encaminharNotaAtual();
        });
        document.getElementById('btnViewerSalvarPdf').addEventListener('click', async function () {
            if (_notaPdfPrecisaEscolherItens) {
                var html = await garantirHtmlNotaParaCliente();
                if (!html) return;
                abrirViewerPdf(html, _tituloNotaImpressao);
            }
            salvarNotaPdfArquivo();
        });
        document.getElementById('btnViewerImprimir').addEventListener('click', async function () {
            if (_notaPdfPrecisaEscolherItens) {
                var html = await garantirHtmlNotaParaCliente({ perguntarFotos: false });
                if (!html) return;
                abrirViewerPdf(html, _tituloNotaImpressao);
                executarImpressaoHtml(html);
                return;
            }
            if (_htmlNotaImpressaoAtual) executarImpressaoHtml(_htmlNotaImpressaoAtual);
            else toast('Documento não encontrado.');
        });
        document.getElementById('btnNomePdfOk').addEventListener('click', function () {
            var v = document.getElementById('inputNomePdf').value;
            fecharModalNomePdf(limparNomeArquivoPdf(v));
        });
        document.getElementById('btnNomePdfCancelar').addEventListener('click', function () {
            fecharModalNomePdf(null);
        });
        document.getElementById('modalNomePdf').addEventListener('click', function (e) {
            if (e.target.id === 'modalNomePdf') fecharModalNomePdf(null);
        });
        document.getElementById('inputNomePdf').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('btnNomePdfOk').click();
            }
        });
        document.getElementById('btnNotaLink').addEventListener('click', function () {
            if (atendimentoNotaAtual) abrirLinkAssinatura(atendimentoNotaAtual.id);
        });
        document.getElementById('btnNotaExportFotos').addEventListener('click', function () {
            if (atendimentoNotaAtual) abrirModalExportFotos({ atendimento: atendimentoNotaAtual });
        });
        document.getElementById('btnFecharLink').addEventListener('click', fecharModalLink);
        document.getElementById('modalLinkAssinatura').addEventListener('click', function (e) {
            if (e.target.id === 'modalLinkAssinatura') fecharModalLink();
        });
        document.getElementById('btnCopiarLink').addEventListener('click', function () {
            var v = document.getElementById('inputLinkAssinatura');
            v.select();
            try {
                navigator.clipboard.writeText(v.value);
                toast('Link copiado.');
            } catch (err) {
                document.execCommand('copy');
                toast('Link copiado.');
            }
        });
        document.getElementById('btnWhatsappLink').addEventListener('click', function () {
            var link = document.getElementById('inputLinkAssinatura').value;
            var nome = atendimentoNotaAtual ? nomeAtendimento(carregar(), atendimentoNotaAtual) : 'cliente';
            var texto = 'Olá ' + nome + '! A ' + (getEmpresa().nome || 'HM Centro Automotivo') +
                ' enviou o espelho do seu veículo para leitura e assinatura:\n' + link;
            window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
        });
        document.getElementById('btnImportarSig').addEventListener('click', function () {
            document.getElementById('fileImportSig').click();
        });
        document.getElementById('fileImportSig').addEventListener('change', function () {
            var file = this.files && this.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function () {
                try {
                    aplicarAssinaturaImportada(JSON.parse(reader.result));
                } catch (e) {
                    toast('JSON de assinatura inválido.');
                }
            };
            reader.readAsText(file);
            this.value = '';
        });

        window.addEventListener('storage', function (e) {
            if (e.key === ASSIN_KEY || e.key === STORAGE_KEY) {
                if (sincronizarAssinaturasNoDb()) renderHistorico();
            }
        });
        setInterval(function () {
            if (document.getElementById('painelHistorico').classList.contains('active')) {
                if (sincronizarAssinaturasNoDb()) renderHistorico();
            }
        }, 4000);


                /* ---------- Serviço de Seguro (integrado na OS) ---------- */
        function ehServicoSeguro(a) {
            return !!(a && a.tipoServico === 'seguro');
        }

        function htmlItensNotaSeguro(itens, opts) {
            opts = opts || {};
            var lista = itens || [];
            var franquia = Number(opts.franquia) || 0;
            var interno = !!opts.interno;
            var exp = opts.exportItens;
            /* Interno: sempre tudo. Cliente: só o que foi marcado no aviso. */
            var showPecas = interno || !exp || !!exp.pecas;
            var showMao = interno || !exp || !!exp.mao;
            var showFranquia = interno || !exp || !!exp.franquia;

            var pecasLista = showPecas
                ? lista.filter(function (it) { return (it.tipo || 'peca') === 'peca'; })
                : [];
            var maoLista = showMao
                ? lista.filter(function (it) { return it.tipo === 'mao'; })
                : [];
            var pecas = pecasLista.reduce(function (s, it) { return s + (Number(it.valor) || 0); }, 0);
            var mao = maoLista.reduce(function (s, it) { return s + (Number(it.valor) || 0); }, 0);
            var franquiaShow = showFranquia ? franquia : 0;
            var soFranquiaCliente = !interno && showFranquia && !showPecas && !showMao;

            if (!pecasLista.length && !maoLista.length && !showFranquia) {
                return '<p style="color:#000;font-size:0.85rem;">Nenhum item selecionado para este PDF.</p>';
            }

            var rows = '';
            pecasLista.forEach(function (it) {
                rows += '<tr><td>Peça</td><td>' + esc(it.desc || '') + '</td><td>' + moeda(it.valor) + '</td></tr>';
            });
            maoLista.forEach(function (it) {
                rows += '<tr><td>Mão de obra</td><td>' + esc(it.desc || '') + '</td><td>' + moeda(it.valor) + '</td></tr>';
            });
            /* Franquia NÃO entra na tabela de itens somáveis — fica à parte (não soma no total do serviço) */

            var html = '<table class="nota-itens compacta"><thead><tr><th>Tipo</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>' +
                (rows || '<tr><td colspan="3" style="padding:8px;color:#666">Sem peças / mão de obra neste PDF.</td></tr>') +
                '</tbody></table>';

            var partesSub = [];
            if (showPecas) partesSub.push('Peças: <strong>' + moeda(pecas) + '</strong>');
            if (showMao) partesSub.push('Mão de obra: <strong>' + moeda(mao) + '</strong>');
            if (partesSub.length) {
                html += '<div class="nota-subtotais compacto">' + partesSub.join(' · ') + '</div>';
            }

            /* Total do serviço = peças + mão. Franquia NUNCA soma. */
            var totalServico = pecas + mao;
            if (soFranquiaCliente) {
                html += '<div class="nota-total compacto">FRANQUIA (cliente): ' + moeda(franquiaShow) + '</div>';
            } else if (showPecas || showMao) {
                html += '<div class="nota-total compacto">Total serviço: ' + moeda(totalServico) + '</div>';
            }

            if (franquiaShow > 0 && !soFranquiaCliente) {
                html += '<div class="nota-subtotais compacto" style="margin-top:6px;padding:6pt;border:1.5pt solid #e67e22;border-radius:4px">' +
                    'FRANQUIA (a cargo do cliente): <strong style="color:#c0392b">' + moeda(franquiaShow) + '</strong>';
                if (showPecas && pecas > 0 && !showMao) {
                    html += '<br><span style="font-size:9pt">Adicional (peças): <strong>' + moeda(pecas) + '</strong>' +
                        ' · Total cliente (franquia + peças): <strong>' + moeda(franquiaShow + pecas) + '</strong></span>';
                } else if (totalServico > 0 && interno) {
                    var dif = totalServico - franquiaShow;
                    html += '<br><span style="font-size:9pt">Diferença serviço − franquia: <strong>' + moeda(dif) + '</strong></span>';
                } else if (totalServico > 0 && showMao) {
                    var dif2 = totalServico - franquiaShow;
                    html += '<br><span style="font-size:9pt">Diferença serviço − franquia: <strong>' + moeda(dif2) + '</strong></span>';
                }
                html += '</div>';
            } else if (franquiaShow > 0 && soFranquiaCliente) {
                /* já mostrado como total */
            }

            if (interno && franquiaShow > 0) {
                html += '<div class="nota-subtotais compacto" style="margin-top:4px;color:#555">Uso interno: franquia informativa — o total do serviço permanece peças + mão de obra.</div>';
            }
            return html;
        }

