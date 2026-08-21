'use strict';
/* HM Automotivo — toast, impressao, navegacao, KPIs */

        function uid() {
            return 'hm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        }

        function esc(s) {
            return String(s == null ? '' : s)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        function toast(msg) {
            var el = document.getElementById('toast');
            el.textContent = msg;
            el.classList.add('show');
            clearTimeout(toast._t);
            toast._t = setTimeout(function () { el.classList.remove('show'); }, 2600);
        }

        var MSG_BAIXA_OS = 'VÁ ATÉ DESPESAS DE O.S NO MODO INTERNO E CLIQUE EM "CARRO FINALIZADO" PARA A BAIXA DO SERVIÇO REALIZADO.';

        function abrirModalPergunta(titulo, texto, botoesHtml) {
            var overlay = document.getElementById('modalPergunta');
            document.getElementById('modalPerguntaTitulo').textContent = titulo || '';
            var p = document.getElementById('modalPerguntaTexto');
            p.textContent = texto || '';
            p.style.display = texto ? '' : 'none';
            document.getElementById('modalPerguntaAcoes').innerHTML = botoesHtml;
            overlay.classList.add('aberto');
            return overlay;
        }

        function fecharModalPergunta() {
            var overlay = document.getElementById('modalPergunta');
            if (overlay) overlay.classList.remove('aberto');
        }

        function perguntarSimNao(titulo, texto) {
            return new Promise(function (resolve) {
                var overlay = abrirModalPergunta(
                    titulo,
                    texto || '',
                    '<button type="button" class="btn btn-ok" id="btnPerguntaSim">SIM</button>' +
                    '<button type="button" class="btn btn-secondary" id="btnPerguntaNao">NÃO</button>'
                );
                function fechar(v) {
                    fecharModalPergunta();
                    resolve(v);
                }
                document.getElementById('btnPerguntaSim').onclick = function () { fechar(true); };
                document.getElementById('btnPerguntaNao').onclick = function () { fechar(false); };
                overlay.onclick = function (ev) {
                    ev.stopPropagation();
                };
            });
        }

        function avisarMensagem(titulo, texto) {
            return new Promise(function (resolve) {
                var overlay = abrirModalPergunta(
                    titulo,
                    texto || '',
                    '<button type="button" class="btn btn-primary" id="btnPerguntaOk">OK</button>'
                );
                function fechar() {
                    fecharModalPergunta();
                    resolve();
                }
                document.getElementById('btnPerguntaOk').onclick = fechar;
                overlay.onclick = function (ev) {
                    if (ev.target === overlay) fechar();
                };
            });
        }

        /* Impressão limpa via iframe (evita tela branca no Android / iOS) */
        var _printCleanupTimer = null;
        var _htmlNotaImpressaoAtual = '';
        var _tituloNotaImpressao = 'Espelho de Atendimento';

        function ehCelular() {
            try {
                if (window.matchMedia && window.matchMedia('(max-width: 900px)').matches) return true;
            } catch (e) { /* ignore */ }
            return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
        }

        function cssDocumentoImpressao() {
            return '*,*:before,*:after{box-sizing:border-box;}' +
                'html,body{margin:0;padding:0;background:#fff;color:#000;max-width:100%;overflow-x:hidden;}' +
                'body{padding:10mm;font-family:Arial,Helvetica,sans-serif;font-size:10pt;line-height:1.25;}' +
                '.barra-sair-print{display:none;position:sticky;top:0;z-index:9999;gap:8px;padding:10px 12px;padding-top:calc(10px + env(safe-area-inset-top,0px));background:#162233;border-bottom:1px solid rgba(255,255,255,.15);}' +
                '.barra-sair-print button{flex:1 1 40%;min-height:44px;border:0;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;}' +
                '.barra-sair-print .btn-fechar{background:#e74c3c;color:#fff;}' +
                '.barra-sair-print .btn-print{background:#1e8449;color:#fff;}' +
                '.nota-espelho{background:#fff;color:#111;max-width:100%;overflow-x:hidden;}' +
                '.nota-topo{text-align:center;border-bottom:2px solid #0d3d6e;padding-bottom:8pt;margin-bottom:10pt;}' +
                '.nota-topo-linha{width:100%;border-collapse:collapse;table-layout:fixed;}' +
                '.nota-topo-logo{width:42%;vertical-align:middle;padding:0 8pt 0 0;}' +
                '.nota-topo-logo img{display:block;width:100%;max-width:100%;max-height:32mm;height:auto;object-fit:contain;object-position:left center;}' +
                '.nota-topo-dados{width:58%;vertical-align:middle;text-align:left;font-size:9.5pt;line-height:1.3;color:#000;}' +
                '.nota-topo-dados .linha{display:block;white-space:normal;overflow-wrap:anywhere;word-break:break-word;color:#000;}' +
                '.nota-topo-dados .linha-end{font-size:9pt;}' +
                '.nota-topo-dados .linha-tel{font-weight:600;}' +
                '.nota-titulo-espelho{margin-top:8pt;margin-bottom:0;font-size:12pt;font-weight:800;color:#0d3d6e;letter-spacing:.04em;text-align:center;}' +
                '.nota-registro{margin-top:4pt;text-align:center;font-size:9pt;}' +
                '.nota-bloco{margin-bottom:8pt;border:1px solid #ccc;border-radius:4px;overflow:hidden;page-break-inside:avoid;max-width:100%;}' +
                '.nota-bloco .tit{padding:4pt 6pt;font-size:9pt;font-weight:800;text-transform:uppercase;color:#000;background:#fff;border-bottom:1.5pt solid #000;}' +
                '.nota-grid{display:grid;grid-template-columns:1fr 1fr;gap:4pt 8pt;padding:6pt;}' +
                '.nota-campo.full{grid-column:1/-1;}' +
                '.nota-grid-compacta{gap:2pt 8pt;padding:4pt 6pt;}' +
                '.nota-grid-compacta .nota-campo{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 4pt;min-width:0;}' +
                '.nota-grid-compacta .nota-label{display:inline;font-size:7.5pt;font-weight:800;text-transform:uppercase;margin:0;}' +
                '.nota-grid-compacta .nota-label::after{content:":";}' +
                '.nota-grid-compacta .nota-valor{display:inline;font-size:9pt;margin:0;overflow-wrap:anywhere;word-break:break-word;min-width:0;flex:1 1 auto;}' +
                '.nota-chassi{font-family:Consolas,Courier New,monospace;word-break:break-all;}' +
                '.nota-itens,.nota-tabela-desp{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9pt;}' +
                '.nota-itens th,.nota-itens td,.nota-tabela-desp th,.nota-tabela-desp td{border-bottom:1px solid #ddd;padding:3pt 2pt;text-align:left;vertical-align:top;overflow-wrap:anywhere;word-break:break-word;min-width:0;}' +
                '.nota-itens th,.nota-tabela-desp th{font-weight:800;}' +
                '.nota-itens th:nth-child(1),.nota-itens td:nth-child(1){width:22%;}' +
                '.nota-itens th:nth-child(2),.nota-itens td:nth-child(2){width:56%;}' +
                '.nota-itens th:nth-child(3),.nota-itens td:nth-child(3){width:22%;text-align:right;white-space:nowrap;}' +
                '.nota-tabela-desp{margin-top:4pt;}' +
                '.nota-tabela-desp thead tr{background:#f2f2f2;}' +
                '.nota-tabela-desp th:nth-child(1),.nota-tabela-desp td:nth-child(1){width:8%;}' +
                '.nota-tabela-desp th:nth-child(2),.nota-tabela-desp td:nth-child(2){width:18%;}' +
                '.nota-tabela-desp th:nth-child(3),.nota-tabela-desp td:nth-child(3){width:38%;}' +
                '.nota-tabela-desp th:nth-child(4),.nota-tabela-desp td:nth-child(4){width:18%;}' +
                '.nota-tabela-desp th:nth-child(5),.nota-tabela-desp td:nth-child(5){width:18%;text-align:right;font-weight:700;white-space:nowrap;}' +
                '.nota-tabela-wrap{width:100%;max-width:100%;overflow:hidden;}' +
                '.nota-resumo-lucro{display:flex;flex-wrap:wrap;gap:8pt 12pt;margin-top:6pt;font-size:10pt;}' +
                '.nota-resumo-lucro>div{flex:1 1 120px;min-width:0;}' +
                '.nota-valores-pad{padding:6pt;}' +
                '.nota-subtotais{margin-top:4pt;font-size:9pt;}' +
                '.nota-total{text-align:right;font-size:11pt;font-weight:800;margin-top:4pt;}' +
                '.nota-sigs{display:grid;grid-template-columns:1fr 1fr;gap:16pt;margin-top:14pt;}' +
                '.nota-sig{text-align:center;font-size:9pt;}' +
                '.nota-sig-espaco{min-height:18mm;border-bottom:1px solid #000;}' +
                '.nota-sig-base{padding-top:4pt;font-weight:700;}' +
                '.nota-sig img{max-height:18mm;max-width:100%;}' +
                '.nota-fotos{display:flex;flex-wrap:wrap;gap:6pt;padding:6pt;}' +
                '.nota-fotos img{width:45mm;height:34mm;object-fit:cover;}' +
                '@page{size:A4;margin:10mm;}' +
                '@media screen and (max-width:700px){' +
                '.barra-sair-print{display:flex;}' +
                'body{padding:8px;padding-top:0;font-size:12px;}' +
                '.nota-grid{grid-template-columns:1fr;}' +
                '.nota-titulo-espelho{font-size:13px;}' +
                '.nota-itens,.nota-tabela-desp{font-size:11px;}' +
                '.nota-tabela-desp th:nth-child(4),.nota-tabela-desp td:nth-child(4){display:none;}' +
                '.nota-sigs{grid-template-columns:1fr;gap:12px;}' +
                '}' +
                '@media print{.barra-sair-print{display:none!important;}body{padding:0;}}';
        }

        function montarHtmlDocumentoImpressao(htmlCorpo) {
            var barra =
                '<div class="barra-sair-print" id="barraSairPrint">' +
                '<button type="button" class="btn-fechar" onclick="try{if(window.opener){window.close();}else if(history.length>1){history.back();}else{window.close();}}catch(e){try{history.back();}catch(e2){}}">✕ Fechar / Voltar</button>' +
                '<button type="button" class="btn-print" onclick="window.print()">🖨️ Imprimir</button>' +
                '</div>';
            return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">' +
                '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">' +
                '<title>' + esc(_tituloNotaImpressao || 'Espelho de Atendimento') + '</title>' +
                '<style>' + cssDocumentoImpressao() + '</style></head><body>' +
                barra +
                (htmlCorpo || '') +
                '</body></html>';
        }

        function limparAposImpressao() {
            document.body.classList.remove('imprimindo');
            var el = document.getElementById('printNota');
            if (el) el.innerHTML = '';
            if (_printCleanupTimer) {
                clearTimeout(_printCleanupTimer);
                _printCleanupTimer = null;
            }
        }

        function aguardarImagensDoc(doc, cb) {
            var imgs = doc.images ? Array.prototype.slice.call(doc.images) : [];
            if (!imgs.length) {
                setTimeout(cb, 120);
                return;
            }
            var faltam = imgs.length;
            var feito = false;
            function tick() {
                faltam--;
                if (faltam <= 0 && !feito) {
                    feito = true;
                    setTimeout(cb, 180);
                }
            }
            imgs.forEach(function (img) {
                if (img.complete) tick();
                else {
                    img.onload = tick;
                    img.onerror = tick;
                }
            });
            setTimeout(function () {
                if (!feito) {
                    feito = true;
                    cb();
                }
            }, 4000);
        }

        function executarImpressaoHtml(html) {
            _htmlNotaImpressaoAtual = html || '';
            var docHtml = montarHtmlDocumentoImpressao(html);

            /* Celular: nova aba/janela evita tela branca no Android/iOS */
            if (ehCelular()) {
                var w = window.open('', '_blank');
                if (!w) {
                    toast('Permita pop-ups para gerar o PDF.');
                    return;
                }
                w.document.open();
                w.document.write(docHtml);
                w.document.close();
                aguardarImagensDoc(w.document, function () {
                    try {
                        w.focus();
                        w.print();
                    } catch (e) {
                        toast('Toque em Compartilhar / Imprimir na barra do navegador.');
                    }
                });
                return;
            }

            var iframe = document.getElementById('printFrame');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'printFrame';
                iframe.title = 'Impressão';
                document.body.appendChild(iframe);
            }
            /* Precisa ter tamanho real — iframe 0×0 gera PDF em branco no Chrome */
            iframe.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;border:0;z-index:-1;opacity:0;pointer-events:none;';

            var idoc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
            if (!idoc) {
                var w2 = window.open('', '_blank');
                if (!w2) {
                    toast('Permita pop-ups para gerar o PDF.');
                    return;
                }
                w2.document.open();
                w2.document.write(docHtml);
                w2.document.close();
                aguardarImagensDoc(w2.document, function () {
                    try { w2.focus(); w2.print(); } catch (e) { /* ignore */ }
                });
                return;
            }

            idoc.open();
            idoc.write(docHtml);
            idoc.close();

            aguardarImagensDoc(idoc, function () {
                try {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                } catch (e) {
                    toast('Não foi possível abrir a impressão. Tente novamente.');
                }
            });
        }

        function abrirViewerPdf(html, titulo) {
            _htmlNotaImpressaoAtual = html || '';
            _tituloNotaImpressao = titulo || 'Espelho de Atendimento';
            var corpo = document.getElementById('viewerPdfCorpo');
            if (corpo) corpo.innerHTML = html || '';
            var viewer = document.getElementById('viewerPdfNota');
            if (viewer) {
                viewer.classList.add('aberto');
                viewer.setAttribute('aria-hidden', 'false');
            }
            document.body.style.overflow = 'hidden';
        }

        function fecharViewerPdf() {
            var viewer = document.getElementById('viewerPdfNota');
            if (viewer) {
                viewer.classList.remove('aberto');
                viewer.setAttribute('aria-hidden', 'true');
            }
            var corpo = document.getElementById('viewerPdfCorpo');
            if (corpo) corpo.innerHTML = '';
            document.body.style.overflow = '';
        }

        async function encaminharNotaAtual() {
            var html = obterHtmlNotaAtual();
            if (!html) {
                toast('Abra a nota antes de encaminhar.');
                return;
            }
            _htmlNotaImpressaoAtual = html;
            var nomeArq = await perguntarNomeArquivoPdfAsync();
            if (!nomeArq) return;
            var titulo = nomeArq.replace(/\.pdf$/i, '');
            toast('Gerando PDF…');

            try {
                var blob = await gerarPdfBlobDaNota(html, nomeArq);
                if (!blob || blob.size < 800) throw new Error('PDF vazio');
                var arquivo = new File([blob], nomeArq, { type: 'application/pdf' });

                if (navigator.share && navigator.canShare) {
                    try {
                        if (navigator.canShare({ files: [arquivo] })) {
                            await navigator.share({ title: titulo, text: titulo, files: [arquivo] });
                            toast('PDF encaminhado: ' + nomeArq);
                            return;
                        }
                    } catch (errShare) {
                        if (errShare && errShare.name === 'AbortError') return;
                    }
                }

                /* iOS: não abrir blob em aba (fica branca). Tenta share sem canShare. */
                if (ehCelular() && navigator.share) {
                    try {
                        await navigator.share({ title: titulo, text: titulo, files: [arquivo] });
                        toast('PDF encaminhado: ' + nomeArq);
                        return;
                    } catch (e2) {
                        if (e2 && e2.name === 'AbortError') return;
                    }
                }

                if (!ehCelular()) {
                    baixarBlobComoArquivo(blob, nomeArq);
                    toast('PDF salvo como ' + nomeArq);
                    return;
                }
                toast('Use Salvar PDF e depois anexe no WhatsApp.');
            } catch (err) {
                console.error(err);
                toast('Falha ao gerar PDF. Tente de novo.');
            }
        }

        async function salvarNotaPdfArquivo() {
            var html = obterHtmlNotaAtual();
            if (!html) {
                toast('Abra a nota antes de salvar.');
                return;
            }
            _htmlNotaImpressaoAtual = html;
            var nomeArq = await perguntarNomeArquivoPdfAsync();
            if (!nomeArq) return;
            toast('Gerando PDF…');
            try {
                var blob = await gerarPdfBlobDaNota(html, nomeArq);
                if (!blob || blob.size < 800) throw new Error('PDF vazio');
                var arquivo = new File([blob], nomeArq, { type: 'application/pdf' });

                /* No celular, share = Salvar em Arquivos / Apps (evita tela branca) */
                if (ehCelular() && navigator.share) {
                    try {
                        await navigator.share({ title: nomeArq, files: [arquivo] });
                        toast('PDF pronto: ' + nomeArq);
                        return;
                    } catch (errShare) {
                        if (errShare && errShare.name === 'AbortError') return;
                    }
                }

                baixarBlobComoArquivo(blob, nomeArq);
                toast('PDF salvo: ' + nomeArq);
            } catch (err) {
                console.error(err);
                toast('Não foi possível salvar o PDF.');
            }
        }

        function obterHtmlNotaAtual() {
            var noViewer = document.querySelector('#viewerPdfCorpo .nota-espelho');
            if (noViewer) return noViewer.outerHTML;
            var noModal = document.querySelector('#modalNotaCorpo .nota-espelho');
            if (noModal) return noModal.outerHTML;
            return _htmlNotaImpressaoAtual || '';
        }

        function nomeCurtoVeiculo(carro) {
            var p = String(carro || '').trim().split(/\s+/).filter(Boolean);
            if (!p.length) return '';
            if (p.length === 1) return p[0].toUpperCase();
            return (p[0] + ' ' + p[1]).toUpperCase();
        }

        function nomeCurtoCliente(nome) {
            var p = String(nome || '').trim().split(/\s+/).filter(Boolean);
            if (!p.length) return 'CLIENTE';
            return p[0].toUpperCase();
        }

        function nomeArquivoOrcamentoPdfPadrao(atendimento) {
            var db = carregar();
            var a = atendimento || atendimentoNotaAtual;
            var veiculo = a ? nomeCurtoVeiculo(a.carro) : '';
            var cliente = a ? nomeCurtoCliente(nomeAtendimento(db, a)) : 'CLIENTE';
            var partes = ['ORÇAMENTO'];
            if (veiculo) partes.push(veiculo);
            if (cliente) partes.push(cliente);
            return partes.join(' ');
        }

        function limparNomeArquivoPdf(nome) {
            var n = String(nome || '').trim();
            if (!n) n = 'ORÇAMENTO';
            n = n.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
            if (!/\.pdf$/i.test(n)) n += '.pdf';
            return n;
        }

        var _nomePdfResolver = null;
        function perguntarNomeArquivoPdfAsync() {
            return new Promise(function (resolve) {
                var input = document.getElementById('inputNomePdf');
                var modal = document.getElementById('modalNomePdf');
                if (!input || !modal) {
                    resolve(limparNomeArquivoPdf(nomeArquivoOrcamentoPdfPadrao()));
                    return;
                }
                _nomePdfResolver = resolve;
                input.value = nomeArquivoOrcamentoPdfPadrao();
                modal.classList.add('aberto');
                setTimeout(function () {
                    try {
                        input.focus();
                        input.select();
                    } catch (e) { /* ignore */ }
                }, 80);
            });
        }

        function fecharModalNomePdf(valor) {
            var modal = document.getElementById('modalNomePdf');
            if (modal) modal.classList.remove('aberto');
            var resolver = _nomePdfResolver;
            _nomePdfResolver = null;
            if (resolver) resolver(valor);
        }

        function nomeArquivoOrcamentoPdf(atendimento) {
            return limparNomeArquivoPdf(nomeArquivoOrcamentoPdfPadrao(atendimento));
        }

        function carregarHtml2Pdf() {
            return new Promise(function (resolve, reject) {
                if (typeof html2pdf !== 'undefined') {
                    resolve();
                    return;
                }
                var s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                s.onload = function () { resolve(); };
                s.onerror = function () { reject(new Error('html2pdf')); };
                document.head.appendChild(s);
            });
        }

        function baixarBlobComoArquivo(blob, nomeArq) {
            /* Evita abrir aba em branco no iPhone */
            if (ehCelular()) {
                toast('No celular use Encaminhar PDF / compartilhar.');
                return;
            }
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = nomeArq || 'ORCAMENTO.pdf';
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            setTimeout(function () {
                URL.revokeObjectURL(url);
                a.remove();
            }, 1500);
        }

        function aguardarImagensElemento(el) {
            return new Promise(function (resolve) {
                if (!el) {
                    resolve();
                    return;
                }
                var imgs = el.querySelectorAll ? el.querySelectorAll('img') : [];
                imgs = Array.prototype.slice.call(imgs);
                if (!imgs.length) {
                    setTimeout(resolve, 60);
                    return;
                }
                var faltam = imgs.length;
                var done = false;
                function tick() {
                    faltam--;
                    if (faltam <= 0 && !done) {
                        done = true;
                        setTimeout(resolve, 100);
                    }
                }
                imgs.forEach(function (img) {
                    if (img.complete) tick();
                    else {
                        img.onload = tick;
                        img.onerror = tick;
                    }
                });
                setTimeout(function () {
                    if (!done) {
                        done = true;
                        resolve();
                    }
                }, 3500);
            });
        }

        async function gerarPdfBlobDaNota(html, nomeArq) {
            await carregarHtml2Pdf();

            /* Sempre renderiza cópia com cabeçalho lado a lado (não usa layout empilhado do celular) */
            var htmlFonte = html || obterHtmlNotaAtual();
            var wrap = document.createElement('div');
            wrap.id = 'hmPdfRenderTemp';
            wrap.innerHTML = htmlFonte;
            document.body.appendChild(wrap);
            var alvo = wrap.querySelector('.nota-espelho') || wrap;

            /* Reforça tabela do topo */
            var tabela = wrap.querySelector('.nota-topo-linha');
            if (tabela) {
                tabela.style.cssText = 'width:100%;border-collapse:collapse;table-layout:fixed;display:table;';
                var logoTd = wrap.querySelector('.nota-topo-logo');
                var dadosTd = wrap.querySelector('.nota-topo-dados');
                if (logoTd) logoTd.style.cssText = 'width:42%;vertical-align:middle;padding:0 10px 0 0;display:table-cell;';
                if (dadosTd) dadosTd.style.cssText = 'width:58%;vertical-align:middle;padding:0;display:table-cell;text-align:left;font-size:9.5pt;line-height:1.3;color:#222;';
                var img = wrap.querySelector('.nota-topo-logo img');
                if (img) img.style.cssText = 'display:block;width:100%;max-height:110px;height:auto;object-fit:contain;object-position:left center;';
                wrap.querySelectorAll('.nota-topo-dados .linha').forEach(function (ln) {
                    ln.style.whiteSpace = 'nowrap';
                    ln.style.display = 'block';
                    ln.style.fontSize = '9pt';
                    ln.style.lineHeight = '1.3';
                });
            }

            await aguardarImagensElemento(alvo);

            var opt = {
                margin: [8, 8, 8, 8],
                filename: nomeArq || 'ORCAMENTO.pdf',
                image: { type: 'jpeg', quality: 0.95 },
                html2canvas: {
                    scale: Math.min(2, window.devicePixelRatio || 1.5),
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                    scrollX: 0,
                    scrollY: 0,
                    windowWidth: 794
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['css', 'legacy'] },
                enableLinks: false
            };

            try {
                var blob = await html2pdf().set(opt).from(alvo).outputPdf('blob');
                return blob;
            } finally {
                if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
            }
        }

        function moeda(n) {
            var v = Number(n) || 0;
            return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }

        function parseMoeda(str) {
            if (typeof str === 'number') return str;
            var s = String(str || '').trim().replace(/[^\d,.-]/g, '');
            if (!s) return 0;
            if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
            var n = parseFloat(s);
            return isNaN(n) ? 0 : n;
        }

        function hojeISO() {
            var d = new Date();
            var m = String(d.getMonth() + 1).padStart(2, '0');
            var day = String(d.getDate()).padStart(2, '0');
            return d.getFullYear() + '-' + m + '-' + day;
        }

        function fmtData(iso) {
            if (!iso) return '—';
            var p = String(iso).slice(0, 10).split('-');
            if (p.length !== 3) return iso;
            return p[2] + '/' + p[1] + '/' + p[0];
        }

        function docCliente(c) {
            return c.cpf || c.cnpj || '—';
        }

        function nomeCliente(db, id) {
            var c = db.clientes.find(function (x) { return x.id === id; });
            return c ? c.nome : '—';
        }

        function nomeAtendimento(db, a) {
            if (a.clienteAvulso || (!a.clienteId && a.clienteNome)) {
                return a.clienteNome || 'Avulso';
            }
            return nomeCliente(db, a.clienteId);
        }

        function resolverClienteAtendimento(db, texto) {
            var nome = String(texto || '').trim();
            if (!nome) return { ok: false };
            var lower = nome.toLowerCase();
            var exato = db.clientes.find(function (c) {
                return String(c.nome || '').trim().toLowerCase() === lower;
            });
            if (exato) {
                return { ok: true, clienteId: exato.id, clienteNome: exato.nome, clienteAvulso: false };
            }
            return { ok: true, clienteId: null, clienteNome: nome, clienteAvulso: true };
        }

        function snapshotClienteCadastro(db, resolvido) {
            if (!resolvido || !resolvido.ok) return null;
            if (resolvido.clienteAvulso) {
                return {
                    nome: resolvido.clienteNome || '',
                    avulso: true,
                    cpf: '',
                    cnpj: '',
                    telefone: '',
                    email: '',
                    cidade: '',
                    cep: '',
                    endereco: '',
                    numero: ''
                };
            }
            var c = db.clientes.find(function (x) { return x.id === resolvido.clienteId; });
            if (!c) {
                return { nome: resolvido.clienteNome || '', avulso: false };
            }
            return {
                nome: c.nome || '',
                avulso: false,
                cpf: c.cpf || '',
                cnpj: c.cnpj || '',
                telefone: c.telefone || c.tel || '',
                email: c.email || '',
                cidade: c.cidade || '',
                cep: c.cep || '',
                endereco: c.endereco || '',
                numero: c.numero || ''
            };
        }

        function dadosClienteDoAtendimento(db, a) {
            if (a && a.clienteCadastro) return a.clienteCadastro;
            if (a && a.clienteId) {
                return snapshotClienteCadastro(db, {
                    ok: true,
                    clienteId: a.clienteId,
                    clienteNome: a.clienteNome,
                    clienteAvulso: false
                });
            }
            return {
                nome: (a && a.clienteNome) || nomeAtendimento(db, a),
                avulso: !!(a && a.clienteAvulso),
                cpf: '', cnpj: '', telefone: '', email: '', cidade: '', cep: '', endereco: '', numero: ''
            };
        }

        function htmlCardClienteOs(cad) {
            if (!cad) return '';
            var linhas = [];
            if (cad.cpf) linhas.push('<div class="linha"><strong>CPF:</strong> ' + esc(cad.cpf) + '</div>');
            if (cad.cnpj) linhas.push('<div class="linha"><strong>CNPJ:</strong> ' + esc(cad.cnpj) + '</div>');
            if (cad.telefone) linhas.push('<div class="linha"><strong>Telefone:</strong> ' + esc(cad.telefone) + '</div>');
            if (cad.email) linhas.push('<div class="linha"><strong>E-mail:</strong> ' + esc(cad.email) + '</div>');
            var end = [cad.endereco, cad.numero].filter(Boolean).join(', ');
            if (end) linhas.push('<div class="linha"><strong>Endereço:</strong> ' + esc(end) + '</div>');
            if (cad.cep) linhas.push('<div class="linha"><strong>CEP:</strong> ' + esc(cad.cep) + '</div>');
            if (cad.cidade) linhas.push('<div class="linha"><strong>Cidade:</strong> ' + esc(cad.cidade) + '</div>');
            return '<div style="font-weight:700;margin-bottom:6px;color:#8fe0b8">Cadastro: ' + esc(cad.nome || '—') + '</div>' +
                (linhas.length ? linhas.join('') : '<div class="linha muted">Sem CPF/telefone no cadastro — complete em Clientes.</div>');
        }

        function atualizarStatusClienteAt() {
            var db = carregar();
            var texto = document.getElementById('atClienteBusca').value.trim();
            var status = document.getElementById('atClienteStatus');
            var hid = document.getElementById('atClienteId');
            var card = document.getElementById('atClienteCard');
            if (!texto) {
                hid.value = '';
                status.innerHTML = 'Digite o nome: se existir no cadastro, aparece na busca; se não, fica como cliente avulso.';
                card.style.display = 'none';
                card.innerHTML = '';
                return;
            }
            var r = resolverClienteAtendimento(db, texto);
            if (!r.clienteAvulso) {
                hid.value = r.clienteId;
                status.innerHTML = '<span style="color:#8fe0b8;font-weight:700">Cliente cadastrado</span> — dados do cadastro carregados abaixo.';
                var snap = snapshotClienteCadastro(db, r);
                card.innerHTML = htmlCardClienteOs(snap);
                card.style.display = '';
            } else {
                hid.value = '';
                status.innerHTML = '<span style="color:#9fd3ff;font-weight:700">Cliente avulso</span> — será salvo só com este nome.';
                card.style.display = 'none';
                card.innerHTML = '';
            }
        }

        function preencherListaClientesAt(db) {
            var lista = document.getElementById('listaClientesAt');
            var busca = document.getElementById('atClienteBusca');
            var atual = busca ? busca.value : '';
            lista.innerHTML = '';
            var exCli = garantirExcluidos(carregarMain()).clientes || {};
            aplicarExcluidosNaLista(db.clientes || [], exCli).slice().sort(function (a, b) {
                return a.nome.localeCompare(b.nome, 'pt-BR');
            }).forEach(function (c) {
                var opt = document.createElement('option');
                opt.value = c.nome;
                lista.appendChild(opt);
            });
            if (atual) busca.value = atual;
        }

        /* ---------- Navegação ---------- */
        function abrirGrupoMenu(nomeGrupo, exclusivo) {
            document.querySelectorAll('.menu-grupo').forEach(function (g) {
                if (g.classList.contains('inicio-compacto')) return;
                var nome = g.getAttribute('data-grupo');
                if (nome === nomeGrupo) g.classList.add('aberto');
                else if (exclusivo !== false) g.classList.remove('aberto');
            });
        }

        function grupoDoPainel(panelId) {
            var btn = document.querySelector('.nav-btn[data-panel="' + panelId + '"]');
            if (!btn) return null;
            var grupo = btn.closest('.menu-grupo');
            return grupo ? grupo.getAttribute('data-grupo') : null;
        }

        function atualizarMarcacaoGrupos() {
            document.querySelectorAll('.menu-grupo').forEach(function (g) {
                var temAtivo = !!g.querySelector('.nav-btn.active');
                g.classList.toggle('tem-ativo', temAtivo);
            });
        }

        function abrirPainel(id, btn) {
            var canalAntes = canalVendas;
            if (btn && btn.getAttribute('data-canal')) {
                canalVendas = btn.getAttribute('data-canal');
            } else if (!btn) {
                /* atalhos do painel / data-goto → canal normal */
                canalVendas = 'normal';
            } else {
                var gBtn = btn.closest('.menu-grupo');
                var gNome = gBtn ? gBtn.getAttribute('data-grupo') : '';
                if (gNome === 'interno' || gNome === 'finalizados') canalVendas = 'interno';
                else if (gNome === 'vendas' || gNome === 'caixa') canalVendas = 'normal';
                else canalVendas = 'normal';
            }
            if (canalAntes !== canalVendas) {
                carrinhoVenda = [];
                produtoVendaSelecionado = null;
            }
            atualizarBadgeCanal();

            document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
            document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.remove('active'); });
            var panel = document.getElementById(id);
            if (!panel) return;
            panel.classList.add('active');
            if (btn && btn.classList.contains('nav-btn')) {
                btn.classList.add('active');
                var gClick = btn.closest('.menu-grupo');
                if (gClick) abrirGrupoMenu(gClick.getAttribute('data-grupo'), true);
            } else {
                var match = document.querySelector('.nav-btn[data-panel="' + id + '"][data-canal="' + canalVendas + '"]') ||
                    document.querySelector('.nav-btn[data-panel="' + id + '"]');
                if (match) {
                    match.classList.add('active');
                    var gMatch = match.closest('.menu-grupo');
                    if (gMatch) abrirGrupoMenu(gMatch.getAttribute('data-grupo'), true);
                }
            }
            document.querySelectorAll('.nav-btn[data-panel="' + id + '"]').forEach(function (b) {
                var c = b.getAttribute('data-canal');
                if (!c || c === canalVendas) b.classList.add('active');
                else b.classList.remove('active');
            });
            atualizarMarcacaoGrupos();
            var t = TITULOS[id] || ['HM', ''];
            var sufixo = canalVendas === 'interno' ? ' · INTERNO' : '';
            document.getElementById('tituloPainel').textContent = t[0] + (PAINEIS_CANAL[id] ? sufixo : '');
            document.getElementById('subtituloPainel').textContent = canalVendas === 'interno' && PAINEIS_CANAL[id]
                ? 'Uso interno — vendas/caixa separados · estoque de produtos unificado'
                : t[1];
            renderTudo();
            if (id === 'painelProdutos') {
                setTimeout(focarLeitor, 80);
            }
            if (id === 'painelOrcamento') {
                prepararVendaForm();
                renderCarrinhoVenda();
            }
            if (id === 'painelVendasRealizadas') {
                renderOrcamentos('VENDA');
            }
            if (id === 'painelOrcamentosRealizados') {
                renderOrcamentos('ORCAMENTO');
            }
            if (id === 'painelVeiculo') {
                preencherSelectResponsavelOs(
                    (document.getElementById('atResponsavelId') || {}).value || '',
                    ''
                );
            }
            if (id === 'painelRelatorioCaixa') renderRelatorioCaixa();
            if (id === 'painelRelatorioUnificado') renderRelatorioUnificado();
            if (id === 'painelDespesasOs') {
                canalVendas = 'interno';
                atualizarBadgeCanal();
                fecharBoxDespesaOs();
                renderDespesasOs();
                /* Puxa despesas do outro PC/celular ao abrir a tela */
                if (usuarioNuvemLogado()) {
                    sincronizarTodosNuvem({ silencioso: true, mostrarToast: true }).then(function () {
                        renderDespesasOs();
                    }).catch(function () { /* offline */ });
                }
            }
            if (id === 'painelServicoFinalizado') {
                canalVendas = 'interno';
                atualizarBadgeCanal();
                renderServicosFinalizados();
                if (usuarioNuvemLogado()) {
                    sincronizarTodosNuvem({ silencioso: true, mostrarToast: true }).then(function () {
                        renderServicosFinalizados();
                    }).catch(function () { /* offline */ });
                }
            }
            if (id === 'painelFuncionarios') {
                canalVendas = 'interno';
                atualizarBadgeCanal();
                renderCadastroFuncionarios();
            }
            if (id === 'painelPagFuncionarios') {
                canalVendas = 'interno';
                atualizarBadgeCanal();
                var pfData = document.getElementById('pfData');
                if (pfData && !pfData.value) pfData.value = hojeISO();
                renderPagFuncionarios();
            }
            if (id === 'painelConfig') {
                preencherFormEmpresa();
                atualizarStatusNuvemUI();
                atualizarStatusPastaUI();
            }
            fecharMenuMobile();
        }

        var PAINEIS_CANAL = {
            painelDespesasOs: true,
            painelServicoFinalizado: true,
            painelFuncionarios: true,
            painelPagFuncionarios: true,
            painelProdutos: true,
            painelOrcamento: true,
            painelVendasRealizadas: true,
            painelOrcamentosRealizados: true,
            painelCaixa: true,
            painelCaixaBanco: true,
            painelPendentes: true,
            painelRelatorioCaixa: true
        };

        function abrirMenuMobile() {
            document.body.classList.add('menu-aberto');
        }

        function fecharMenuMobile() {
            document.body.classList.remove('menu-aberto');
        }

        document.getElementById('btnAbrirMenu').addEventListener('click', abrirMenuMobile);
        document.getElementById('btnFecharMenu').addEventListener('click', fecharMenuMobile);
        document.getElementById('sidebarOverlay').addEventListener('click', fecharMenuMobile);
        window.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') fecharMenuMobile();
        });

        document.querySelectorAll('[data-toggle-grupo]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var nome = btn.getAttribute('data-toggle-grupo');
                var grupo = document.querySelector('.menu-grupo[data-grupo="' + nome + '"]');
                if (!grupo || grupo.classList.contains('inicio-compacto')) return;
                var jaAberto = grupo.classList.contains('aberto');
                document.querySelectorAll('.menu-grupo:not(.inicio-compacto)').forEach(function (g) { g.classList.remove('aberto'); });
                if (!jaAberto) grupo.classList.add('aberto');
            });
        });

        document.querySelectorAll('.menu-grupo-btn[data-panel]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                abrirPainel(btn.getAttribute('data-panel'), document.querySelector('.nav-btn[data-panel="' + btn.getAttribute('data-panel') + '"]') || btn);
            });
        });

        document.querySelectorAll('.nav-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var panel = btn.getAttribute('data-panel');
                if (!panel) return;
                abrirPainel(panel, btn);
            });
        });

        document.querySelectorAll('[data-goto]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                abrirPainel(btn.getAttribute('data-goto'));
            });
        });

        atualizarMarcacaoGrupos();

        /* ---------- KPIs / selects ---------- */
        function atualizarKPIs(db) {
            /* KPIs do painel sempre do balcão oficial (não misturar com interno) */
            db = carregarMain();
            var ex = garantirExcluidos(db);
            document.getElementById('kpiClientes').textContent = String(
                aplicarExcluidosNaLista(db.clientes || [], ex.clientes).length
            );
            document.getElementById('kpiAtend').textContent = String(
                aplicarExcluidosNaLista(db.atendimentos || [], ex.atendimentos).filter(function (a) {
                    return !osFinalizadaInterno(a);
                }).length
            );
            document.getElementById('kpiProd').textContent = String(
                aplicarExcluidosNaLista(db.produtos || [], ex.produtos).length
            );
            var cfg = db.caixaConfig || { inicialBalcao: 0, inicialBanco: 0 };
            var entradas = (db.caixa || []).filter(function (x) { return x.tipo === 'entrada'; })
                .reduce(function (s, x) { return s + (Number(x.valor) || 0); }, 0);
            var entBanco = (db.caixaBanco || []).filter(function (x) { return x.tipo === 'entrada'; })
                .reduce(function (s, x) { return s + (Number(x.valor) || 0); }, 0);
            document.getElementById('kpiCaixa').textContent = moeda((Number(cfg.inicialBalcao) || 0) + entradas + (Number(cfg.inicialBanco) || 0) + entBanco);
        }

        function preencherSelectsCliente(db) {
            preencherListaClientesAt(db);
            var listaCli = document.getElementById('listaClientesVenda');
            if (listaCli) {
                listaCli.innerHTML = '';
                var exCli = garantirExcluidos(carregarMain()).clientes || {};
                aplicarExcluidosNaLista(db.clientes || [], exCli).slice().sort(function (a, b) {
                    return a.nome.localeCompare(b.nome, 'pt-BR');
                }).forEach(function (c) {
                    var opt = document.createElement('option');
                    opt.value = c.nome;
                    listaCli.appendChild(opt);
                });
            }
            preencherListaProdutosVenda(db);
        }

        function preencherListaProdutosVenda(db) {
            var lista = document.getElementById('listaProdutosVenda');
            if (!lista) return;
            lista.innerHTML = '';
            var exProd = garantirExcluidos(carregarMain()).produtos || {};
            aplicarExcluidosNaLista(db.produtos || [], exProd).forEach(function (p) {
                var opt = document.createElement('option');
                opt.value = p.nome + (p.codigo ? ' [' + p.codigo + ']' : '');
                lista.appendChild(opt);
            });
        }

