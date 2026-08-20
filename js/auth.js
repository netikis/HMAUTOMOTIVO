'use strict';
/* HM Automotivo — login Firebase */

        /* ---------- Login = Firebase Authentication ---------- */
        function liberarApp() {
            document.body.classList.remove('aguardando-login');
            document.getElementById('telaLogin').classList.add('oculto');
            document.getElementById('loginErro').style.display = 'none';
            atualizarStatusNuvemUI();
            iniciarSyncAutomatico();
            /* Sync completa ao entrar: traz o que foi feito no celular / outro PC */
            sincronizarTodosNuvem({ silencioso: true, mostrarToast: true }).catch(function () {
                puxarConfigEmpresaNuvemSilencioso().then(function (ok) {
                    if (ok) renderTudo();
                });
            });
        }

        function bloquearApp() {
            document.body.classList.add('aguardando-login');
            document.getElementById('telaLogin').classList.remove('oculto');
            prepararTelaLogin();
            pararSyncAutomatico();
            atualizarStatusNuvemUI();
        }

        function mostrarErroLogin(msg) {
            var el = document.getElementById('loginErro');
            el.textContent = msg || '';
            el.style.display = msg ? 'block' : 'none';
        }

        function mensagemErroFirebase(err) {
            var c = (err && (err.code || err.message)) || '';
            if (String(c).indexOf('auth/invalid-credential') >= 0 || String(c).indexOf('auth/wrong-password') >= 0) {
                return 'E-mail ou senha incorretos.';
            }
            if (String(c).indexOf('auth/user-not-found') >= 0) return 'Usuário não encontrado no Firebase.';
            if (String(c).indexOf('auth/too-many-requests') >= 0) return 'Muitas tentativas. Aguarde e tente de novo.';
            if (String(c).indexOf('auth/invalid-email') >= 0) return 'E-mail inválido.';
            if (String(c).indexOf('firebase-env') >= 0 || String(c).indexOf('chaves') >= 0) {
                return String(err.message || c);
            }
            return err.message || err.code || 'Falha no login.';
        }

        function prepararTelaLogin() {
            document.getElementById('loginTitulo').textContent = 'Entrar no sistema';
            document.getElementById('loginHint').textContent = 'Use o e-mail e a senha do Firebase Authentication.';
            mostrarErroLogin('');
            document.getElementById('loginEmail').value = localStorage.getItem(LOGIN_EMAIL_KEY) || '';
            document.getElementById('loginSenha').value = '';
            setTimeout(function () {
                var email = document.getElementById('loginEmail');
                var senha = document.getElementById('loginSenha');
                if (email && email.value) senha.focus();
                else if (email) email.focus();
            }, 80);
        }

        async function iniciarLoginApp() {
            document.getElementById('loginHint').textContent = 'Conectando…';
            try {
                var sessao = await initFirebaseApp();
                await new Promise(function (resolve) {
                    var done = false;
                    var unsub = sessao.authMod.onAuthStateChanged(sessao.auth, function (user) {
                        if (done) return;
                        done = true;
                        try { unsub(); } catch (e) { /* ok */ }
                        if (user) {
                            if (user.email) localStorage.setItem(LOGIN_EMAIL_KEY, user.email);
                            liberarApp();
                        } else {
                            prepararTelaLogin();
                        }
                        resolve();
                    });
                    setTimeout(function () {
                        if (!done) {
                            done = true;
                            try { unsub(); } catch (e) { /* ok */ }
                            if (sessao.auth.currentUser) liberarApp();
                            else prepararTelaLogin();
                            resolve();
                        }
                    }, 4000);
                });
            } catch (err) {
                prepararTelaLogin();
                mostrarErroLogin(mensagemErroFirebase(err));
            }
        }

        document.getElementById('btnLoginEntrar').addEventListener('click', async function () {
            var email = document.getElementById('loginEmail').value.trim();
            var senha = document.getElementById('loginSenha').value;
            if (!email || !senha) { mostrarErroLogin('Informe e-mail e senha.'); return; }
            mostrarErroLogin('');
            document.getElementById('loginHint').textContent = 'Entrando…';
            try {
                var user = await loginComFirebase(email, senha);
                if (user && user.email) localStorage.setItem(LOGIN_EMAIL_KEY, user.email);
                liberarApp();
                toast('Login OK — ' + (user.email || 'conectado') + '.');
            } catch (err) {
                document.getElementById('loginHint').textContent = 'Use o e-mail e a senha do Firebase Authentication.';
                mostrarErroLogin(mensagemErroFirebase(err));
            }
        });

        document.getElementById('loginSenha').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') document.getElementById('btnLoginEntrar').click();
        });
        document.getElementById('loginEmail').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') document.getElementById('loginSenha').focus();
        });

        document.getElementById('btnAppSair').addEventListener('click', async function () {
            await logoutFirebase();
            bloquearApp();
            toast('Saiu da conta.');
        });

        function somaPorTipo(tipo) {
            return itensTemp.reduce(function (s, it) {
                return s + ((it.tipo || 'peca') === tipo ? (Number(it.valor) || 0) : 0);
            }, 0);
        }

        function renderItens() {
            var box = document.getElementById('listaItens');
            if (!itensTemp.length) {
                box.innerHTML = '<p class="muted">Nenhuma peça ou mão de obra adicionada.</p>';
            } else {
                box.innerHTML = itensTemp.map(function (it, idx) {
                    var tipo = it.tipo || 'peca';
                    var tag = tipo === 'mao'
                        ? '<span style="display:inline-block;margin-right:8px;padding:2px 8px;border-radius:999px;font-size:0.7rem;font-weight:700;background:rgba(47,158,107,0.2);color:#8fe0b8;border:1px solid rgba(47,158,107,0.45)">MÃO DE OBRA</span>'
                        : '<span style="display:inline-block;margin-right:8px;padding:2px 8px;border-radius:999px;font-size:0.7rem;font-weight:700;background:rgba(61,160,232,0.15);color:#9fd3ff;border:1px solid rgba(61,160,232,0.4)">PEÇA</span>';
                    return '<div class="row" style="margin-bottom:6px;align-items:center">' +
                        '<div class="col" style="flex:2">' + tag + esc(it.desc) + '</div>' +
                        '<div class="col">' + moeda(it.valor) + '</div>' +
                        '<div class="col" style="flex:0.5"><button type="button" class="btn btn-danger" data-rm="' + idx + '">×</button></div>' +
                        '</div>';
                }).join('');
                box.querySelectorAll('[data-rm]').forEach(function (b) {
                    b.addEventListener('click', function () {
                        itensTemp.splice(Number(b.getAttribute('data-rm')), 1);
                        renderItens();
                    });
                });
            }
            calcTotal();
        }

        function calcTotal() {
            var pecas = somaPorTipo('peca');
            var mao = somaPorTipo('mao');
            var seguro = (document.getElementById('atTipoOrcamento') || {}).value === 'seguro';
            var franquia = seguro ? (parseMoeda((document.getElementById('atFranquia') || {}).value) || 0) : 0;
            document.getElementById('atSubPecas').textContent = moeda(pecas);
            document.getElementById('atSubMao').textContent = moeda(mao);
            var linhaF = document.getElementById('linhaFranquiaOs');
            var subF = document.getElementById('atSubFranquia');
            var labelT = document.getElementById('labelTotalOs');
            if (linhaF) linhaF.style.display = seguro ? '' : 'none';
            if (subF) subF.textContent = moeda(franquia);
            if (labelT) labelT.textContent = seguro ? 'Total serviço (cliente)' : 'Valor total';
            document.getElementById('atTotal').textContent = moeda(pecas + mao);
        }

        function atualizarUITipoOrcamento() {
            var tipo = (document.getElementById('atTipoOrcamento') || {}).value || 'normal';
            var box = document.getElementById('boxSeguroOs');
            var hint = document.getElementById('hintTipoOrcamento');
            if (box) box.style.display = tipo === 'seguro' ? '' : 'none';
            if (hint) {
                hint.textContent = tipo === 'seguro'
                    ? 'Orçamento de seguro: no PDF cliente você escolhe Franquia, Mão de obra e/ou Peças. Peças só saem se marcar.'
                    : 'Orçamento normal: impressão padrão da OS.';
            }
            var st = document.getElementById('atStatus');
            if (st && tipo === 'seguro') {
                var tem = Array.prototype.some.call(st.options, function (o) { return o.value === 'Aguardando seguradora'; });
                if (!tem) {
                    var opt = document.createElement('option');
                    opt.value = 'Aguardando seguradora';
                    opt.textContent = 'Aguardando seguradora';
                    st.appendChild(opt);
                }
            }
            calcTotal();
        }

        function addLinhaValor(tipo, descId, valorId, msgVazio) {
            var desc = document.getElementById(descId).value.trim();
            var valor = parseMoeda(document.getElementById(valorId).value);
            if (!desc) { toast(msgVazio); return; }
            itensTemp.push({ tipo: tipo, desc: desc, valor: valor });
            document.getElementById(descId).value = '';
            document.getElementById(valorId).value = '';
            renderItens();
        }

        document.getElementById('btnAddItem').addEventListener('click', function () {
            addLinhaValor('peca', 'itemDesc', 'itemValor', 'Informe a descrição da peça/item.');
        });

        document.getElementById('btnAddMao').addEventListener('click', function () {
            addLinhaValor('mao', 'maoDesc', 'maoValor', 'Informe a descrição da mão de obra.');
        });

        function limparAtendimento() {
            document.getElementById('formAtendimento').reset();
            document.getElementById('atId').value = '';
            document.getElementById('atClienteId').value = '';
            document.getElementById('atClienteBusca').value = '';
            document.getElementById('atEntrada').value = hojeISO();
            document.getElementById('atStatus').value = 'Em andamento';
            document.getElementById('atAgendadoPara').value = '';
            document.getElementById('atTipoOrcamento').value = 'normal';
            document.getElementById('atFranquia').value = '';
            document.getElementById('atSeguradora').value = '';
            document.getElementById('atSinistro').value = '';
            preencherSelectResponsavelOs('', '');
            itensTemp = [];
            fotosAtuais = [];
            renderItens();
            renderGaleriaFotos();
            atualizarPlaca();
            atualizarStatusClienteAt();
            atualizarCampoAgendamentoUI();
            atualizarUITipoOrcamento();
        }

        document.getElementById('btnLimparAt').addEventListener('click', limparAtendimento);
        document.getElementById('atStatus').addEventListener('focus', function () {
            this.setAttribute('data-status-antes', this.value);
        });
        document.getElementById('atStatus').addEventListener('change', function () {
            var sel = this;
            var antes = sel.getAttribute('data-status-antes') || '';
            atualizarCampoAgendamentoUI();
            if (sel.value !== 'Entregue' || antes === 'Entregue') return;
            perguntarSimNao('CARRO FINALIZADO?').then(function (sim) {
                if (!sim) {
                    sel.value = antes;
                    atualizarCampoAgendamentoUI();
                    return;
                }
                return avisarMensagem('Baixa do serviço', MSG_BAIXA_OS);
            });
        });
        document.getElementById('atTipoOrcamento').addEventListener('change', atualizarUITipoOrcamento);
        document.getElementById('atFranquia').addEventListener('input', calcTotal);

        document.getElementById('atClienteBusca').addEventListener('input', atualizarStatusClienteAt);
        document.getElementById('atClienteBusca').addEventListener('change', atualizarStatusClienteAt);

        document.getElementById('formAtendimento').addEventListener('submit', async function (e) {
            e.preventDefault();
            var db = carregar();
            var resolvido = resolverClienteAtendimento(db, document.getElementById('atClienteBusca').value);
            if (!resolvido.ok) {
                toast('Informe pelo menos o nome do cliente (o restante é opcional).');
                return;
            }
            var st = document.getElementById('atStatus').value;
            var agData = document.getElementById('atAgendadoPara').value;
            if (st === 'Agendado' && !agData) {
                toast('Informe a data agendada (ex.: segunda-feira).');
                document.getElementById('atAgendadoPara').focus();
                return;
            }
            var id = document.getElementById('atId').value;
            var pecas = somaPorTipo('peca');
            var mao = somaPorTipo('mao');
            var resp = obterResponsavelOsDoForm();
            var tipoOrc = (document.getElementById('atTipoOrcamento') || {}).value === 'seguro' ? 'seguro' : 'normal';
            var franquia = tipoOrc === 'seguro'
                ? (parseMoeda((document.getElementById('atFranquia') || {}).value) || 0)
                : 0;
            var payload = {
                id: id || uid(),
                tipoServico: tipoOrc === 'seguro' ? 'seguro' : 'normal',
                clienteId: resolvido.clienteId,
                clienteNome: resolvido.clienteNome,
                clienteAvulso: resolvido.clienteAvulso,
                clienteCadastro: snapshotClienteCadastro(db, resolvido),
                responsavelId: resp.responsavelId,
                responsavel: resp.responsavel,
                carro: document.getElementById('atCarro').value.trim(),
                placa: (document.getElementById('atPlaca').value || '').toUpperCase().trim(),
                cidadePlaca: document.getElementById('atCidadePlaca').value.trim(),
                cor: document.getElementById('atCor').value.trim(),
                anoFabricacao: document.getElementById('atAnoFabricacao').value.trim(),
                anoModelo: document.getElementById('atAnoModelo').value.trim(),
                chassi: document.getElementById('atChassi').value.trim(),
                km: document.getElementById('atKm').value,
                entrada: document.getElementById('atEntrada').value,
                saida: document.getElementById('atSaida').value,
                status: document.getElementById('atStatus').value,
                agendadoPara: document.getElementById('atAgendadoPara').value || '',
                estado: document.getElementById('atEstado').value.trim(),
                servicos: document.getElementById('atServicos').value.trim(),
                seguradora: tipoOrc === 'seguro' ? document.getElementById('atSeguradora').value.trim() : '',
                sinistro: tipoOrc === 'seguro' ? document.getElementById('atSinistro').value.trim() : '',
                franquia: franquia,
                itens: itensTemp.slice(),
                fotos: fotosAtuais.map(function (f) {
                    return { id: f.id || uid(), data: f.data || null, url: f.url || null };
                }).filter(function (f) { return f.data || f.url; }),
                maoObra: mao,
                totalPecas: pecas,
                total: pecas + mao,
                atualizadoEm: new Date().toISOString()
            };
            if (id) {
                var i = db.atendimentos.findIndex(function (a) { return a.id === id; });
                if (i >= 0) db.atendimentos[i] = Object.assign({}, db.atendimentos[i], payload);
            } else {
                payload.criadoEm = new Date().toISOString();
                db.atendimentos.push(payload);
            }
            limparExcluido(db, 'atendimentos', payload.id);
            salvar(db);

            var extras = [];
            try {
                var pasta = await salvarAtendimentoNaPastaPC(payload, resolvido.clienteNome);
                if (pasta.ok) extras.push('PC: ' + pasta.pasta);
            } catch (errPasta) { /* opcional */ }

            var cfgN = carregarConfigNuvem();
            if (cfgN && cfgN.apiKey && cfgN.projectId && _fbSessao && _fbSessao.auth && _fbSessao.auth.currentUser) {
                try {
                    await enviarBaseNuvem(carregar());
                    var nuv = await enviarAtendimentoNuvem(payload);
                    if (nuv.ok) {
                        extras.push('nuvem OK');
                        if (nuv.atendimento && nuv.atendimento.fotos) {
                            var db2 = carregar();
                            var ix = db2.atendimentos.findIndex(function (a) { return a.id === payload.id; });
                            if (ix >= 0) {
                                var locais = db2.atendimentos[ix].fotos || payload.fotos || [];
                                var nuvFotos = nuv.atendimento.fotos || [];
                                db2.atendimentos[ix].fotos = nuvFotos.map(function (fn, idx) {
                                    var fl = locais.find(function (x) { return x && fn && x.id === fn.id; }) || locais[idx] || {};
                                    return {
                                        id: (fn && fn.id) || fl.id || uid(),
                                        data: fl.data || null,
                                        url: fl.url || (fn && fn.url) || null
                                    };
                                });
                                if (!db2.atendimentos[ix].fotos.length && locais.length) {
                                    db2.atendimentos[ix].fotos = locais;
                                }
                                db2.atendimentos[ix].syncNuvemEm = new Date().toISOString();
                                salvar(db2);
                            }
                        }
                    } else extras.push('nuvem: ' + (nuv.motivo || 'falhou'));
                } catch (errN) {
                    extras.push('nuvem: erro');
                }
            }

            toast(
                (id ? 'Atendimento atualizado' : 'Atendimento salvo') +
                (resolvido.clienteAvulso ? ' (cliente avulso)' : '') +
                (extras.length ? ' · ' + extras.join(' · ') : '.')
            );
            limparAtendimento();
            renderHistorico();
            atualizarKPIs(carregar());
        });

        function editarAtendimento(id) {
            var db = carregar();
            var a = db.atendimentos.find(function (x) { return x.id === id; });
            if (!a) return;
            abrirPainel('painelVeiculo');
            document.getElementById('atId').value = a.id;
            document.getElementById('atClienteId').value = a.clienteId || '';
            document.getElementById('atClienteBusca').value = a.clienteAvulso
                ? (a.clienteNome || '')
                : (a.clienteNome || nomeCliente(db, a.clienteId));
            atualizarStatusClienteAt();
            preencherSelectResponsavelOs(a.responsavelId || '', a.responsavel || '');
            document.getElementById('atTipoOrcamento').value = ehServicoSeguro(a) ? 'seguro' : 'normal';
            document.getElementById('atSeguradora').value = a.seguradora || '';
            document.getElementById('atSinistro').value = a.sinistro || '';
            document.getElementById('atFranquia').value = a.franquia != null && a.franquia !== ''
                ? String(a.franquia).replace('.', ',')
                : '';
            document.getElementById('atCarro').value = a.carro || '';
            document.getElementById('atPlaca').value = a.placa || '';
            document.getElementById('atCidadePlaca').value = a.cidadePlaca || '';
            document.getElementById('atCor').value = a.cor || '';
            document.getElementById('atAnoFabricacao').value = a.anoFabricacao || '';
            document.getElementById('atAnoModelo').value = a.anoModelo || '';
            document.getElementById('atChassi').value = a.chassi || '';
            document.getElementById('atKm').value = a.km || '';
            document.getElementById('atEntrada').value = a.entrada || '';
            document.getElementById('atSaida').value = a.saida || '';
            document.getElementById('atStatus').value = a.status || 'Em andamento';
            document.getElementById('atAgendadoPara').value = a.agendadoPara || '';
            atualizarCampoAgendamentoUI();
            document.getElementById('atEstado').value = a.estado || '';
            document.getElementById('atServicos').value = a.servicos || '';
            itensTemp = (a.itens || []).map(function (it) {
                return {
                    tipo: it.tipo || 'peca',
                    desc: it.desc || '',
                    valor: Number(it.valor) || 0
                };
            });
            /* Compatibilidade: valor único antigo de mão de obra vira um item */
            var temMaoNaLista = itensTemp.some(function (it) { return it.tipo === 'mao'; });
            if (!temMaoNaLista && Number(a.maoObra) > 0) {
                itensTemp.push({ tipo: 'mao', desc: 'Mão de obra', valor: Number(a.maoObra) || 0 });
            }
            renderItens();
            carregarFotosNoForm(a.fotos);
            atualizarPlaca();
            atualizarUITipoOrcamento();
        }

        function excluirAtendimento(id) {
            if (!confirm('Excluir este atendimento?')) return;
            var main = carregarMain();
            marcarExcluidoMain('atendimentos', id);
            main = carregarMain();
            main.atendimentos = (main.atendimentos || []).filter(function (a) { return a.id !== id; });
            salvarMain(main);
            if (usuarioNuvemLogado()) {
                apagarAtendimentoNuvem(id).catch(function () { /* offline */ });
            }
            agendarSyncAutomatico('excluir-atendimento');
            toast('Atendimento excluído.');
            renderHistorico();
            renderServicosFinalizados();
            atualizarKPIs(main);
        }

        function opcoesStatusAt(atual) {
            var opts = ['Agendado', 'Em andamento', 'Aguardando peça', 'Aguardando seguradora', 'Pronto', 'Entregue'];
            return opts.map(function (s) {
                var label = s === 'Agendado' ? '📅 Agendado' : s;
                return '<option value="' + s + '"' + (s === atual ? ' selected' : '') + '>' + label + '</option>';
            }).join('');
        }

        function atualizarCampoAgendamentoUI() {
            var st = document.getElementById('atStatus');
            var wrap = document.getElementById('wrapAgendadoPara');
            var hint = document.getElementById('hintAgendado');
            var ag = document.getElementById('atAgendadoPara');
            if (!st || !wrap) return;
            var ehAg = st.value === 'Agendado';
            wrap.style.display = '';
            if (hint) hint.style.display = ehAg ? '' : 'none';
            if (ehAg && ag && !ag.value) ag.value = hojeISO();
        }

        function alterarStatusAtendimento(id, novoStatus) {
            var db = carregar();
            var i = db.atendimentos.findIndex(function (a) { return a.id === id; });
            if (i < 0) return;
            var a = db.atendimentos[i];
            var statusAntes = a.status || '';

            function aplicarStatus() {
                db = carregar();
                i = db.atendimentos.findIndex(function (x) { return x.id === id; });
                if (i < 0) return;
                a = db.atendimentos[i];
                if (novoStatus === 'Agendado') {
                    var sugestao = a.agendadoPara || hojeISO();
                    var d = prompt('Data do agendamento (ex.: segunda-feira).\nDigite no formato AAAA-MM-DD:', sugestao);
                    if (d === null) {
                        renderHistorico();
                        return;
                    }
                    d = String(d || '').trim();
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
                        toast('Data inválida. Use AAAA-MM-DD (ex.: 2026-08-03).');
                        renderHistorico();
                        return;
                    }
                    a.agendadoPara = d;
                }
                a.status = novoStatus;
                a.atualizadoEm = new Date().toISOString();
                salvar(db);
                if (usuarioNuvemLogado()) {
                    enviarAtendimentoNuvem(a).catch(function () { /* offline */ });
                }
                toast(novoStatus === 'Agendado'
                    ? 'Agendado para ' + fmtData(a.agendadoPara)
                    : 'Status: ' + novoStatus);
                renderHistorico();
            }

            if (novoStatus === 'Entregue' && statusAntes !== 'Entregue') {
                perguntarSimNao('CARRO FINALIZADO?').then(function (sim) {
                    if (!sim) {
                        renderHistorico();
                        return;
                    }
                    aplicarStatus();
                    return avisarMensagem('Baixa do serviço', MSG_BAIXA_OS);
                });
                return;
            }
            aplicarStatus();
        }

