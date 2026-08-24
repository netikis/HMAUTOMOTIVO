'use strict';
/* HM Automotivo — config empresa / backup / boot */

        /* ---------- Config / empresa / backup ---------- */
        document.getElementById('formEmpresa').addEventListener('submit', function (e) {
            e.preventDefault();
            var emp = lerEmpresaDoForm();
            salvarEmpresaObj(emp);
            var logado = _fbSessao && _fbSessao.auth && _fbSessao.auth.currentUser;
            toast(logado
                ? 'Dados salvos — enviando à nuvem…'
                : 'Dados da empresa salvos neste aparelho.');
        });

        document.getElementById('btnEmpPadrao').addEventListener('click', function () {
            document.getElementById('empNome').value = 'HM Centro Automotivo';
            toast('Nome padrão aplicado — clique em Salvar para gravar.');
        });

        document.getElementById('empCep').addEventListener('input', function () {
            var v = this.value.replace(/\D/g, '').slice(0, 8);
            if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
            this.value = v;
        });

        document.getElementById('empCnpj').addEventListener('input', function () {
            var v = this.value.replace(/\D/g, '').slice(0, 14);
            v = v.replace(/^(\d{2})(\d)/, '$1.$2')
                .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
                .replace(/\.(\d{3})(\d)/, '.$1/$2')
                .replace(/(\d{4})(\d)/, '$1-$2');
            this.value = v;
        });

        document.getElementById('empLogoUpload').addEventListener('change', async function () {
            var file = this.files && this.files[0];
            if (!file) return;
            if (file.size > 2.5 * 1024 * 1024) {
                toast('Imagem muito grande. Use até ~2,5 MB.');
                this.value = '';
                return;
            }
            try {
                toast('Comprimindo logo…');
                var data = await comprimirImagemArquivo(file);
                var emp = lerEmpresaDoForm(data);
                salvarEmpresaObj(emp);
                document.getElementById('empLogoUrl').value = '';
                var logado = _fbSessao && _fbSessao.auth && _fbSessao.auth.currentUser;
                toast(logado ? 'Logo salva — enviando à nuvem…' : 'Logo atualizada pelo arquivo.');
            } catch (err) {
                toast('Não foi possível ler a imagem.');
            }
            this.value = '';
        });

        document.getElementById('btnSalvarLogoUrl').addEventListener('click', function () {
            var url = document.getElementById('empLogoUrl').value.trim();
            if (!url) { toast('Informe o link da imagem.'); return; }
            var emp = lerEmpresaDoForm(url);
            salvarEmpresaObj(emp);
            toast('Logo salva pelo link.');
        });

        document.getElementById('btnLogoPadrao').addEventListener('click', function () {
            var emp = lerEmpresaDoForm('');
            emp.logo = '';
            salvarEmpresaObj(emp);
            document.getElementById('empLogoUrl').value = '';
            toast('Logo padrão (logo-hm.png) restaurada.');
        });

        document.getElementById('btnExportar').addEventListener('click', function () {
            var pack = {
                oficial: carregarMain(),
                interno: carregarInternoRaw(),
                exportadoEm: new Date().toISOString()
            };
            var blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'hm-automotivo-backup-' + hojeISO() + '.json';
            a.click();
            URL.revokeObjectURL(a.href);
            toast('Backup exportado (oficial + interno).');
        });

        document.getElementById('btnImportar').addEventListener('click', function () {
            document.getElementById('fileImport').click();
        });

        document.getElementById('fileImport').addEventListener('change', function () {
            var file = this.files && this.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function () {
                try {
                    var data = JSON.parse(reader.result);
                    if (!confirm('Substituir os dados atuais deste index pelo arquivo importado?')) return;
                    if (data.oficial || data.interno) {
                        salvarMain(Object.assign(estadoVazio(), data.oficial || {}));
                        if (data.interno) salvarInternoRaw(Object.assign(estadoInternoVazio(), data.interno));
                    } else {
                        salvarMain(Object.assign(estadoVazio(), data));
                    }
                    toast('Backup importado.');
                    renderTudo();
                } catch (err) {
                    alert('Arquivo JSON inválido.');
                }
            };
            reader.readAsText(file);
            this.value = '';
        });

        document.getElementById('btnZerar').addEventListener('click', function () {
            if (!confirm('Apagar TODOS os dados deste index (oficial + interno)?\nOs outros sistemas NÃO serão afetados.')) return;
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(STORAGE_INTERNO);
            localStorage.removeItem(ASSIN_KEY);
            limparFormCliente();
            limparProd();
            limparAtendimento();
            toast('Dados do index apagados.');
            renderTudo();
        });

        function renderTudo() {
            var db = carregar();
            if (!db.empresa) {
                db.empresa = empresaPadrao();
                salvar(db);
            }
            atualizarKPIs(db);
            preencherSelectsCliente(db);
            renderClientes();
            renderHistorico();
            renderProdutos();
            renderOrcamentos();
            renderCaixa();
            renderCaixaBanco();
            renderPendentes();
            renderRelatorioCaixa();
            if (typeof renderRelatorioUnificado === 'function' &&
                document.getElementById('painelRelatorioUnificado') &&
                document.getElementById('painelRelatorioUnificado').classList.contains('active')) {
                renderRelatorioUnificado();
            }
            if (document.getElementById('painelDespesasOs') &&
                document.getElementById('painelDespesasOs').classList.contains('active')) {
                renderDespesasOs();
            }
            if (document.getElementById('painelServicoFinalizado') &&
                document.getElementById('painelServicoFinalizado').classList.contains('active')) {
                renderServicosFinalizados();
            }
            if (document.getElementById('painelFuncionarios') &&
                document.getElementById('painelFuncionarios').classList.contains('active')) {
                renderCadastroFuncionarios();
            }
            if (document.getElementById('painelPagFuncionarios') &&
                document.getElementById('painelPagFuncionarios').classList.contains('active')) {
                renderPagFuncionarios();
            }
            if (document.getElementById('painelOrcamento') &&
                document.getElementById('painelOrcamento').classList.contains('active')) {
                atualizarUIVendaPorCanal();
            }
            if (document.getElementById('atResponsavelId')) {
                preencherSelectResponsavelOs(
                    (document.getElementById('atResponsavelId') || {}).value || '',
                    ''
                );
            }
            aplicarIdentidadeVisual();
        }

        /* boot */
        migrarProdutosInternoParaEstoqueUnificado();
        document.getElementById('atEntrada').value = hojeISO();
        atualizarCampoAgendamentoUI();
        atualizarUITipoOrcamento();
        renderItens();
        atualizarPlaca();
        prepararVendaForm();
        renderCarrinhoVenda();
        renderGaleriaFotos();
        atualizarBadgeCanal();
        renderTudo();
        preencherFormEmpresa();
        atualizarStatusNuvemUI();
        atualizarStatusPastaUI();
        iniciarLoginApp();

        /* PWA — instalar como aplicativo (logo na tela inicial) */
        var deferredInstallPrompt = null;
        var installBanner = document.getElementById('installBanner');
        window.addEventListener('beforeinstallprompt', function (e) {
            e.preventDefault();
            deferredInstallPrompt = e;
            if (!localStorage.getItem('hm_auto_hide_install')) {
                installBanner.classList.add('show');
            }
        });
        document.getElementById('btnInstalarApp').addEventListener('click', function () {
            if (!deferredInstallPrompt) return;
            deferredInstallPrompt.prompt();
            deferredInstallPrompt.userChoice.then(function () {
                deferredInstallPrompt = null;
                installBanner.classList.remove('show');
            });
        });
        document.getElementById('btnFecharInstall').addEventListener('click', function () {
            installBanner.classList.remove('show');
            localStorage.setItem('hm_auto_hide_install', '1');
        });
        window.addEventListener('appinstalled', function () {
            installBanner.classList.remove('show');
            toast('HM Auto instalado na tela inicial.');
        });

        if ('serviceWorker' in navigator) {
            var swRefreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', function () {
                if (swRefreshing) return;
                swRefreshing = true;
                window.location.reload();
            });

            navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(function (reg) {
                function checarAtualizacao() {
                    try { reg.update(); } catch (e) { /* ok */ }
                }
                /* Ao abrir / voltar ao app (PC ou celular), busca versão nova */
                checarAtualizacao();
                document.addEventListener('visibilitychange', function () {
                    if (!document.hidden) checarAtualizacao();
                });
                window.addEventListener('focus', checarAtualizacao);
                window.addEventListener('online', checarAtualizacao);
                setInterval(checarAtualizacao, 60 * 1000);

                reg.addEventListener('updatefound', function () {
                    var novo = reg.installing;
                    if (!novo) return;
                    novo.addEventListener('statechange', function () {
                        if (novo.state === 'installed' && navigator.serviceWorker.controller) {
                            toast('Nova versão no ar (PC + celular) — atualizando…');
                            try {
                                novo.postMessage({ type: 'SKIP_WAITING' });
                            } catch (e2) { /* ok */ }
                        }
                    });
                });
            }).catch(function () {});
        }

