'use strict';
/* HM Automotivo — pasta PC + Firebase sync */

        async function salvarHandlePastaRaiz(handle) {
            var dbp = await abrirDbPasta();
            return new Promise(function (resolve, reject) {
                var tx = dbp.transaction('handles', 'readwrite');
                tx.objectStore('handles').put(handle, 'root');
                tx.oncomplete = function () { resolve(); };
                tx.onerror = function () { reject(tx.error); };
            });
        }

        async function carregarHandlePastaRaiz() {
            try {
                var dbp = await abrirDbPasta();
                return await new Promise(function (resolve, reject) {
                    var tx = dbp.transaction('handles', 'readonly');
                    var req = tx.objectStore('handles').get('root');
                    req.onsuccess = function () { resolve(req.result || null); };
                    req.onerror = function () { reject(req.error); };
                });
            } catch (e) {
                return null;
            }
        }

        async function solicitarPermissaoPasta(handle) {
            if (!handle) return false;
            var perm = await handle.queryPermission({ mode: 'readwrite' });
            if (perm !== 'granted') perm = await handle.requestPermission({ mode: 'readwrite' });
            return perm === 'granted';
        }

        async function atualizarStatusPastaUI() {
            var el = document.getElementById('pastaStatusTexto');
            if (!el) return;
            if (!('showDirectoryPicker' in window)) {
                el.className = 'config-status aviso';
                el.innerHTML = '<strong>Pasta PC:</strong> disponível só no Chrome/Edge no computador. No celular use a sincronização da nuvem.';
                return;
            }
            var handle = await carregarHandlePastaRaiz();
            if (handle) {
                el.className = 'config-status';
                el.innerHTML = '<strong>Pasta PC:</strong> ' + esc(handle.name) + ' — ao salvar a OS, cria a subpasta do cliente e grava as fotos.';
            } else {
                el.className = 'config-status aviso';
                el.innerHTML = '<strong>Pasta PC:</strong> clique em "Escolher pasta no PC" (só na 1ª vez).';
            }
        }

        async function configurarPastaRaiz() {
            if (!('showDirectoryPicker' in window)) {
                toast('Para salvar na pasta do PC, use Chrome ou Edge no computador.');
                return;
            }
            try {
                var handle = await window.showDirectoryPicker({ mode: 'readwrite' });
                await salvarHandlePastaRaiz(handle);
                await atualizarStatusPastaUI();
                toast('Pasta configurada: ' + handle.name);
            } catch (err) {
                if (err && err.name !== 'AbortError') toast('Não foi possível configurar a pasta.');
            }
        }

        async function salvarAtendimentoNaPastaPC(atendimento, clienteNome) {
            var root = await carregarHandlePastaRaiz();
            if (!root) return { ok: false, motivo: 'pasta não configurada' };
            if (!(await solicitarPermissaoPasta(root))) return { ok: false, motivo: 'sem permissão na pasta' };
            var pastaCliente = await root.getDirectoryHandle(slugPasta(clienteNome), { create: true });
            var base = slugPasta((atendimento.placa || 'placa') + '_' + String(atendimento.id || '').slice(-6));
            var copia = JSON.parse(JSON.stringify(atendimento));
            var fotos = copia.fotos || [];
            for (var i = 0; i < fotos.length; i++) {
                var f = fotos[i];
                var src = f.data || f.url;
                if (!src) continue;
                var nomeFoto = base + '_foto_' + (i + 1) + '.jpg';
                try {
                    var blob = src.indexOf('data:') === 0 ? dataUrlParaBlob(src) : await (await fetch(src)).blob();
                    var fh = await pastaCliente.getFileHandle(nomeFoto, { create: true });
                    var w = await fh.createWritable();
                    await w.write(blob);
                    await w.close();
                    f.arquivo = nomeFoto;
                    delete f.data;
                } catch (e) { /* segue */ }
            }
            var fhJson = await pastaCliente.getFileHandle(base + '.json', { create: true });
            var wj = await fhJson.createWritable();
            await wj.write(JSON.stringify(copia, null, 2));
            await wj.close();
            return { ok: true, pasta: root.name + '/' + slugPasta(clienteNome) };
        }

        function configNuvemInjetada() {
            var c = window.HM_FIREBASE_CONFIG;
            if (!c || typeof c !== 'object') return null;
            if (!c.apiKey || !c.projectId) return null;
            return {
                apiKey: String(c.apiKey || '').trim(),
                authDomain: String(c.authDomain || '').trim(),
                projectId: String(c.projectId || '').trim(),
                storageBucket: String(c.storageBucket || '').trim(),
                messagingSenderId: String(c.messagingSenderId || '').trim(),
                appId: String(c.appId || '').trim(),
                email: String(c.email || '').trim(),
                senha: String(c.senha || '')
            };
        }

        function carregarConfigNuvem() {
            var local = null;
            try {
                local = JSON.parse(localStorage.getItem(NUVEM_KEY) || 'null');
            } catch (e) {
                local = null;
            }
            var inj = configNuvemInjetada();
            if (!local && !inj) return null;
            if (!local) return inj;
            if (!inj) return local;
            return {
                apiKey: local.apiKey || inj.apiKey,
                authDomain: local.authDomain || inj.authDomain,
                projectId: local.projectId || inj.projectId,
                storageBucket: local.storageBucket || inj.storageBucket,
                messagingSenderId: local.messagingSenderId || inj.messagingSenderId,
                appId: local.appId || inj.appId,
                email: local.email || inj.email,
                senha: local.senha || inj.senha
            };
        }

        function salvarConfigNuvem(cfg) {
            if (!cfg) localStorage.removeItem(NUVEM_KEY);
            else localStorage.setItem(NUVEM_KEY, JSON.stringify(cfg));
        }

        function atualizarStatusNuvemUI() {
            var el = document.getElementById('nuvemStatusTexto');
            if (!el) return;
            var cfg = carregarConfigNuvem();
            var user = _fbSessao && _fbSessao.auth && _fbSessao.auth.currentUser;
            if (!cfg || !cfg.apiKey || !cfg.projectId) {
                el.className = 'config-status aviso';
                el.innerHTML = '<strong>Nuvem:</strong> faltam chaves no firebase-env.js (rode o build com .env).';
                return;
            }
            if (user) {
                el.className = 'config-status';
                var syncTxt = _syncUltimaOkEm
                    ? ' · última sync ' + esc(fmtHoraSync(_syncUltimaOkEm))
                    : '';
                el.innerHTML = '<strong>Nuvem:</strong> conectado como ' + esc(user.email || 'usuário') +
                    ' · sync automática ligada' + syncTxt +
                    (_syncEmAndamento ? ' · sincronizando…' : '') + '.';
            } else {
                el.className = 'config-status aviso';
                el.innerHTML = '<strong>Nuvem:</strong> entre com o e-mail/senha do Firebase para sincronizar.';
            }
        }

        var _fbSessao = null;
        var _fbMods = null;
        var _syncEmAndamento = false;
        var _syncDebounceTimer = null;
        var _syncIntervalId = null;
        var _syncUltimaOkEm = 0;
        try {
            var _ultSyncRaw = localStorage.getItem('hm_automotivo_sync_ultima');
            if (_ultSyncRaw) _syncUltimaOkEm = Number(_ultSyncRaw) || 0;
        } catch (eUlt0) { /* ok */ }
        var _syncListenersLigados = false;

        function fmtHoraSync(ts) {
            try {
                var d = new Date(ts);
                return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
            } catch (e) {
                return '';
            }
        }

        function usuarioNuvemLogado() {
            return !!(!_fbSessao || !_fbSessao.auth ? false : _fbSessao.auth.currentUser);
        }

        function agendarSyncAutomatico(motivo) {
            if (_syncEmAndamento) return;
            if (!usuarioNuvemLogado()) return;
            var cfg = carregarConfigNuvem();
            if (!cfg || !cfg.apiKey || !cfg.projectId) return;
            /* Ao salvar, agenda mesmo com aba em segundo plano (envia o que acabou de mudar) */
            if (motivo !== 'salvar' && document.hidden) return;
            clearTimeout(_syncDebounceTimer);
            _syncDebounceTimer = setTimeout(function () {
                if (_syncEmAndamento || !usuarioNuvemLogado()) return;
                if (motivo !== 'salvar' && document.hidden) return;
                sincronizarTodosNuvem({ silencioso: true, motivo: motivo || 'auto' }).catch(function () { /* offline */ });
            }, motivo === 'salvar' ? 2800 : 800);
        }

        function iniciarSyncAutomatico() {
            if (_syncIntervalId) return;
            /* A cada 60s, se a aba estiver aberta */
            _syncIntervalId = setInterval(function () {
                if (document.hidden) return;
                if (!usuarioNuvemLogado()) return;
                sincronizarTodosNuvem({ silencioso: true, motivo: 'intervalo' }).catch(function () { /* offline */ });
            }, 60000);

            if (_syncListenersLigados) return;
            _syncListenersLigados = true;
            document.addEventListener('visibilitychange', function () {
                if (!document.hidden) agendarSyncAutomatico('visivel');
            });
            window.addEventListener('focus', function () {
                agendarSyncAutomatico('foco');
            });
            window.addEventListener('online', function () {
                agendarSyncAutomatico('online');
            });
        }

        function pararSyncAutomatico() {
            if (_syncIntervalId) {
                clearInterval(_syncIntervalId);
                _syncIntervalId = null;
            }
            clearTimeout(_syncDebounceTimer);
            _syncDebounceTimer = null;
        }

        async function initFirebaseApp() {
            var cfg = carregarConfigNuvem();
            if (!cfg || !cfg.apiKey || !cfg.projectId) {
                throw new Error('Nuvem sem chaves. Envie o arquivo firebase-config.js para o GitHub e atualize o site.');
            }
            if (_fbSessao && _fbSessao.projectId === cfg.projectId && _fbSessao.auth) {
                return _fbSessao;
            }
            var firebaseConfig = {
                apiKey: cfg.apiKey,
                authDomain: cfg.authDomain || (cfg.projectId + '.firebaseapp.com'),
                projectId: cfg.projectId,
                storageBucket: cfg.storageBucket || undefined,
                messagingSenderId: cfg.messagingSenderId || '',
                appId: cfg.appId || ''
            };
            var appMod = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js');
            var authMod = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js');
            var fsMod = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
            _fbMods = { appMod: appMod, authMod: authMod, fsMod: fsMod };
            var appName = 'hm-auto-' + cfg.projectId;
            var app;
            try {
                app = appMod.getApp(appName);
            } catch (e) {
                app = appMod.initializeApp(firebaseConfig, appName);
            }
            var auth = authMod.getAuth(app);
            try {
                await authMod.setPersistence(auth, authMod.browserLocalPersistence);
            } catch (e) { /* ok */ }
            var dbFs = fsMod.getFirestore(app);
            _fbSessao = { projectId: cfg.projectId, app: app, auth: auth, dbFs: dbFs, fsMod: fsMod, authMod: authMod };
            return _fbSessao;
        }

        async function obterSessaoFirebase() {
            var sessao = await initFirebaseApp();
            if (!sessao.auth.currentUser) {
                throw new Error('Faça login com o e-mail e senha do Firebase para usar a nuvem.');
            }
            return sessao;
        }

        async function loginComFirebase(email, senha) {
            var sessao = await initFirebaseApp();
            await sessao.authMod.signInWithEmailAndPassword(sessao.auth, email, senha);
            return sessao.auth.currentUser;
        }

        async function logoutFirebase() {
            try {
                var sessao = await initFirebaseApp();
                if (sessao.auth.currentUser) {
                    await sessao.authMod.signOut(sessao.auth);
                }
            } catch (e) { /* ok */ }
        }

        async function enviarAtendimentoNuvem(atendimento) {
            var sessao = await obterSessaoFirebase();
            var fsMod = sessao.fsMod;
            var dbFs = sessao.dbFs;
            var docOut = JSON.parse(JSON.stringify(atendimento));
            var fotos = docOut.fotos || [];
            for (var i = 0; i < fotos.length; i++) {
                var f = fotos[i];
                if (!f.data || !String(f.data).startsWith('data:')) continue;
                var fotoId = f.id || ('f' + i);
                f.id = fotoId;
                try {
                    await fsMod.setDoc(fsMod.doc(dbFs, 'hm_automotivo_midia', atendimento.id + '_' + fotoId), {
                        atendimentoId: atendimento.id,
                        fotoId: fotoId,
                        data: f.data,
                        atualizadoEm: new Date().toISOString()
                    });
                    delete f.data;
                } catch (midErr) {
                    return { ok: false, motivo: 'falha ao enviar foto: ' + (midErr.message || midErr.code || '') };
                }
            }
            docOut.atualizadoEm = new Date().toISOString();
            await fsMod.setDoc(fsMod.doc(dbFs, 'hm_automotivo_atendimentos', atendimento.id), docOut);
            return { ok: true, atendimento: docOut };
        }

        async function hidratarFotosDaNuvem(atendimento) {
            var sessao = await obterSessaoFirebase();
            var fsMod = sessao.fsMod;
            var dbFs = sessao.dbFs;
            var fotos = atendimento.fotos || [];
            for (var i = 0; i < fotos.length; i++) {
                var f = fotos[i];
                if (f.data || f.url) continue;
                if (!f.id) continue;
                try {
                    var snap = await fsMod.getDoc(fsMod.doc(dbFs, 'hm_automotivo_midia', atendimento.id + '_' + f.id));
                    if (snap.exists()) {
                        var d = snap.data() || {};
                        if (d.data) f.data = d.data;
                        if (d.url) f.url = d.url;
                    }
                } catch (e) { /* segue */ }
            }
            return atendimento;
        }

        async function baixarAtendimentosNuvem() {
            var sessao = await obterSessaoFirebase();
            var fsMod = sessao.fsMod;
            var dbFs = sessao.dbFs;
            var snap = await fsMod.getDocs(fsMod.collection(dbFs, 'hm_automotivo_atendimentos'));
            var lista = [];
            snap.forEach(function (docSnap) {
                var a = docSnap.data() || {};
                if (!a.id) a.id = docSnap.id;
                lista.push(a);
            });
            for (var i = 0; i < lista.length; i++) {
                await hidratarFotosDaNuvem(lista[i]);
            }
            return lista;
        }

        function mesclarAtendimentosLocalNuvem(localLista, nuvemLista) {
            var map = {};
            (localLista || []).forEach(function (a) {
                if (a && a.id) map[a.id] = a;
            });
            (nuvemLista || []).forEach(function (n) {
                if (!n || !n.id) return;
                var L = map[n.id];
                if (!L) {
                    map[n.id] = n;
                    return;
                }
                var tL = new Date(L.atualizadoEm || L.criadoEm || 0).getTime();
                var tN = new Date(n.atualizadoEm || n.criadoEm || 0).getTime();
                if (tN >= tL) {
                    var fotosLoc = L.fotos || [];
                    var fotosNuv = n.fotos || [];
                    map[n.id] = Object.assign({}, L, n);
                    if (fotosNuv.length) {
                        map[n.id].fotos = fotosNuv.map(function (fn, idx) {
                            if (fn.data || fn.url) return fn;
                            var fl = fotosLoc.find(function (x) { return x.id === fn.id; }) || fotosLoc[idx];
                            if (fl && (fl.data || fl.url)) return Object.assign({}, fn, { data: fl.data || null, url: fl.url || null });
                            return fn;
                        });
                    } else if (fotosLoc.length) {
                        map[n.id].fotos = fotosLoc;
                    }
                } else {
                    (n.fotos || []).forEach(function (fn) {
                        if (!fn.id) return;
                        var fl = (L.fotos || []).find(function (x) { return x.id === fn.id; });
                        if (fl && !fl.data && !fl.url && (fn.data || fn.url)) {
                            fl.data = fn.data || null;
                            fl.url = fn.url || null;
                        }
                    });
                }
            });
            return Object.keys(map).map(function (k) { return map[k]; });
        }

        function mesclarAtendimentosComExcluidos(localLista, nuvemLista, mapaEx) {
            return aplicarExcluidosNaLista(mesclarAtendimentosLocalNuvem(localLista, nuvemLista), mapaEx);
        }

        function tempoRegistro(item, seSemData) {
            var t = new Date((item && (item.atualizadoEm || item.criadoEm)) || 0).getTime();
            if (t) return t;
            return seSemData != null ? seSemData : 0;
        }

        function mesclarListaPorId(localLista, nuvemLista, mapaEx) {
            var map = {};
            (localLista || []).forEach(function (x) {
                if (x && x.id) map[x.id] = x;
            });
            (nuvemLista || []).forEach(function (n) {
                if (!n || !n.id) return;
                var L = map[n.id];
                if (!L) {
                    map[n.id] = n;
                    return;
                }
                /* Local sem data = edição recente (evita nuvem antiga zerar preço/estoque).
                   Empate: local vence. Só nuvem mais nova sobrescreve. */
                var tL = tempoRegistro(L, Date.now());
                var tN = tempoRegistro(n, 0);
                map[n.id] = tN > tL ? Object.assign({}, L, n) : Object.assign({}, n, L);
            });
            return aplicarExcluidosNaLista(Object.keys(map).map(function (k) { return map[k]; }), mapaEx);
        }

        async function enviarLogoEmpresaNuvem(logoDataUrl) {
            var sessao = await obterSessaoFirebase();
            var fsMod = sessao.fsMod;
            var dbFs = sessao.dbFs;
            if (logoDataUrl && String(logoDataUrl).startsWith('data:')) {
                await fsMod.setDoc(fsMod.doc(dbFs, 'hm_automotivo_midia', 'logo_empresa'), {
                    data: logoDataUrl,
                    atualizadoEm: new Date().toISOString()
                });
                return true;
            }
            try {
                await fsMod.deleteDoc(fsMod.doc(dbFs, 'hm_automotivo_midia', 'logo_empresa'));
            } catch (e) { /* ok se não existir */ }
            return false;
        }

        async function hidratarLogoEmpresa(emp) {
            var e = Object.assign(empresaPadrao(), emp || {});
            if (e.logo && String(e.logo).startsWith('data:')) return e;
            if (e.logo && /^https?:\/\//i.test(e.logo)) return e;
            if (!e.logoNaMidia && e.logo) return e;
            try {
                var sessao = await obterSessaoFirebase();
                var snap = await sessao.fsMod.getDoc(
                    sessao.fsMod.doc(sessao.dbFs, 'hm_automotivo_midia', 'logo_empresa')
                );
                if (snap.exists()) {
                    var d = snap.data() || {};
                    if (d.data) {
                        e.logo = d.data;
                        e.logoNaMidia = true;
                    }
                }
            } catch (err) { /* segue sem logo */ }
            return e;
        }

        function empresaParaBaseNuvem(emp) {
            var out = Object.assign(empresaPadrao(), emp || {});
            if (out.logo && String(out.logo).startsWith('data:')) {
                out.logoNaMidia = true;
                out.logo = '';
            }
            return out;
        }

        var _envioEmpTimer = null;
        function agendarEnvioEmpresaNuvem(emp) {
            clearTimeout(_envioEmpTimer);
            _envioEmpTimer = setTimeout(function () {
                enviarEmpresaNuvem(emp).then(function (ok) {
                    if (ok) {
                        atualizarStatusNuvemUI();
                        toast('Configuração da empresa na nuvem OK.');
                    }
                }).catch(function () { /* sem login / offline: fica só local */ });
            }, 350);
        }

        async function enviarEmpresaNuvem(emp) {
            if (!_fbSessao || !_fbSessao.auth || !_fbSessao.auth.currentUser) return false;
            var sessao = await obterSessaoFirebase();
            var fsMod = sessao.fsMod;
            var dbFs = sessao.dbFs;
            var empLocal = Object.assign(empresaPadrao(), emp || getEmpresa());
            await enviarLogoEmpresaNuvem(empLocal.logo);
            var empNuv = empresaParaBaseNuvem(empLocal);
            /* merge:true — só atualiza empresa; NÃO regrava produtos/clientes antigos */
            await fsMod.setDoc(fsMod.doc(dbFs, 'hm_automotivo_base', 'principal'), {
                empresa: empNuv,
                atualizadoEm: new Date().toISOString()
            }, { merge: true });
            return true;
        }

        async function puxarConfigEmpresaNuvemSilencioso() {
            try {
                if (!_fbSessao || !_fbSessao.auth || !_fbSessao.auth.currentUser) return false;
                var baseNuv = await baixarBaseNuvemSilencioso();
                if (!baseNuv || !baseNuv.empresa) {
                    /* Nada na nuvem ainda: sobe o que estiver no PC */
                    var local = carregarMain().empresa;
                    if (local && !empresaEstaPadrao(local)) {
                        await enviarEmpresaNuvem(local);
                        return true;
                    }
                    return false;
                }
                var db = carregarMain();
                var empAntes = db.empresa;
                var tL = new Date((empAntes && empAntes.atualizadoEm) || 0).getTime();
                var tN = new Date((baseNuv.empresa && baseNuv.empresa.atualizadoEm) || baseNuv.atualizadoEm || 0).getTime();
                var mesclada = mesclarEmpresa(db.empresa, baseNuv.empresa, baseNuv.atualizadoEm);
                mesclada = await hidratarLogoEmpresa(mesclada);
                db.empresa = mesclada;
                salvarMain(db);
                aplicarIdentidadeVisual();
                preencherFormEmpresa();
                if (tL > tN && !empresaEstaPadrao(empAntes)) {
                    await enviarEmpresaNuvem(mesclada);
                }
                return true;
            } catch (e) {
                return false;
            }
        }

        async function enviarBaseNuvem(db) {
            var sessao = await obterSessaoFirebase();
            var fsMod = sessao.fsMod;
            var dbFs = sessao.dbFs;
            var empLocal = Object.assign(empresaPadrao(), db.empresa || empresaPadrao());
            await enviarLogoEmpresaNuvem(empLocal.logo);
            var base = {
                empresa: empresaParaBaseNuvem(empLocal),
                clientes: db.clientes || [],
                produtos: db.produtos || [],
                orcamentos: db.orcamentos || [],
                caixa: db.caixa || [],
                caixaBanco: db.caixaBanco || [],
                pendentes: db.pendentes || [],
                caixaConfig: db.caixaConfig || { inicialBalcao: 0, inicialBanco: 0 },
                excluidos: garantirExcluidos(db),
                atualizadoEm: new Date().toISOString()
            };
            await fsMod.setDoc(fsMod.doc(dbFs, 'hm_automotivo_base', 'principal'), base);
            return base;
        }

        async function baixarBaseNuvemSilencioso(sessao) {
            try {
                var s = sessao || await obterSessaoFirebase();
                var snap = await s.fsMod.getDoc(s.fsMod.doc(s.dbFs, 'hm_automotivo_base', 'principal'));
                if (!snap.exists()) return null;
                return snap.data() || null;
            } catch (e) {
                return null;
            }
        }

        async function baixarBaseNuvem() {
            var sessao = await obterSessaoFirebase();
            var fsMod = sessao.fsMod;
            var dbFs = sessao.dbFs;
            var snap = await fsMod.getDoc(fsMod.doc(dbFs, 'hm_automotivo_base', 'principal'));
            if (!snap.exists()) return null;
            return snap.data() || null;
        }

        /* Modo interno na nuvem (despesas OS, funcionários, caixa interno…) */
        async function baixarBaseInternoNuvem() {
            var sessao = await obterSessaoFirebase();
            var snap = await sessao.fsMod.getDoc(
                sessao.fsMod.doc(sessao.dbFs, 'hm_automotivo_base', 'interno')
            );
            if (!snap.exists()) return null;
            return snap.data() || null;
        }

        async function enviarBaseInternoNuvem(intDb) {
            var sessao = await obterSessaoFirebase();
            var base = {
                orcamentos: (intDb && intDb.orcamentos) || [],
                caixa: (intDb && intDb.caixa) || [],
                caixaBanco: (intDb && intDb.caixaBanco) || [],
                pendentes: (intDb && intDb.pendentes) || [],
                caixaConfig: (intDb && intDb.caixaConfig) || { inicialBalcao: 0, inicialBanco: 0 },
                funcionarios: (intDb && intDb.funcionarios) || [],
                pagamentosFuncionarios: (intDb && intDb.pagamentosFuncionarios) || [],
                excluidos: garantirExcluidosInterno(intDb || {}),
                atualizadoEm: new Date().toISOString()
            };
            await sessao.fsMod.setDoc(
                sessao.fsMod.doc(sessao.dbFs, 'hm_automotivo_base', 'interno'),
                base
            );
            return base;
        }

        async function apagarDespesasExcluidasNuvem(intDb) {
            var ex = garantirExcluidosInterno(intDb || {}).caixa || {};
            var ids = Object.keys(ex);
            if (!ids.length) return 0;
            var sessao = await obterSessaoFirebase();
            var apagados = 0;
            for (var i = 0; i < ids.length; i++) {
                try {
                    await sessao.fsMod.deleteDoc(
                        sessao.fsMod.doc(sessao.dbFs, 'hm_automotivo_despesas_os', ids[i])
                    );
                    apagados++;
                } catch (eDel) { /* ok */ }
            }
            return apagados;
        }

        async function apagarAtendimentoNuvem(atendimentoId) {
            if (!atendimentoId) return false;
            var sessao = await obterSessaoFirebase();
            await sessao.fsMod.deleteDoc(
                sessao.fsMod.doc(sessao.dbFs, 'hm_automotivo_atendimentos', atendimentoId)
            );
            return true;
        }

        /* Cada despesa de OS também vai em documento próprio (mais confiável entre PCs) */
        async function baixarDespesasOsNuvem() {
            var sessao = await obterSessaoFirebase();
            var snap = await sessao.fsMod.getDocs(
                sessao.fsMod.collection(sessao.dbFs, 'hm_automotivo_despesas_os')
            );
            var lista = [];
            snap.forEach(function (docSnap) {
                var d = docSnap.data() || {};
                if (!d.id) d.id = docSnap.id;
                lista.push(d);
            });
            return lista;
        }

        async function enviarDespesaOsNuvem(despesa) {
            if (!despesa || !despesa.id) return false;
            var sessao = await obterSessaoFirebase();
            var out = JSON.parse(JSON.stringify(despesa));
            out.atualizadoEm = out.atualizadoEm || out.criadoEm || new Date().toISOString();
            await sessao.fsMod.setDoc(
                sessao.fsMod.doc(sessao.dbFs, 'hm_automotivo_despesas_os', despesa.id),
                out
            );
            return true;
        }

        async function enviarDespesasOsNuvemLista(intDb) {
            var lista = ((intDb && intDb.caixa) || []).filter(function (x) {
                return x && x.id && x.tipo === 'saida' && x.atendimentoId;
            });
            var ok = 0, falha = 0;
            for (var i = 0; i < lista.length; i++) {
                try {
                    await enviarDespesaOsNuvem(lista[i]);
                    ok++;
                } catch (e) { falha++; }
            }
            return { ok: ok, falha: falha, total: lista.length };
        }

        function mesclarCaixaComDespesasNuvem(caixaLocal, despNuvem, mapaEx) {
            var map = {};
            (caixaLocal || []).forEach(function (x) {
                if (x && x.id) map[x.id] = x;
            });
            (despNuvem || []).forEach(function (n) {
                if (!n || !n.id) return;
                var L = map[n.id];
                if (!L) {
                    map[n.id] = n;
                    return;
                }
                var tL = tempoRegistro(L, Date.now());
                var tN = tempoRegistro(n, 0);
                map[n.id] = tN > tL ? Object.assign({}, L, n) : Object.assign({}, n, L);
            });
            return aplicarExcluidosNaLista(Object.keys(map).map(function (k) { return map[k]; }), mapaEx);
        }

        function mesclarBaseInternoLocalNuvem(local, nuvem) {
            var L = Object.assign(estadoInternoVazio(), local || {});
            L.produtos = []; /* estoque unificado fica no oficial */
            L.excluidos = mesclarExcluidosInterno(L.excluidos, nuvem && nuvem.excluidos);
            var ex = garantirExcluidosInterno(L);
            if (!nuvem) return L;
            L.orcamentos = mesclarListaPorId(L.orcamentos, nuvem.orcamentos, ex.orcamentos);
            L.caixa = mesclarListaPorId(L.caixa, nuvem.caixa, ex.caixa);
            L.caixaBanco = mesclarListaPorId(L.caixaBanco, nuvem.caixaBanco, ex.caixaBanco);
            L.pendentes = mesclarListaPorId(L.pendentes, nuvem.pendentes, ex.pendentes);
            L.funcionarios = mesclarListaPorId(L.funcionarios, nuvem.funcionarios, ex.funcionarios);
            L.pagamentosFuncionarios = mesclarListaPorId(
                L.pagamentosFuncionarios,
                nuvem.pagamentosFuncionarios,
                ex.pagamentosFuncionarios
            );
            var tL = new Date(L.atualizadoEm || 0).getTime();
            var tN = new Date(nuvem.atualizadoEm || 0).getTime();
            if (nuvem.caixaConfig && (tN >= tL || !L.caixaConfig)) {
                L.caixaConfig = nuvem.caixaConfig;
            }
            L.atualizadoEm = new Date().toISOString();
            return L;
        }

        async function sincronizarModoInternoNuvem(opts) {
            opts = opts || {};
            var intLocal = carregarInternoRaw();
            var intNuv = null;
            var despNuv = [];
            var erro = null;
            try {
                intNuv = await baixarBaseInternoNuvem();
            } catch (e1) {
                erro = e1;
            }
            try {
                despNuv = await baixarDespesasOsNuvem();
            } catch (e2) {
                if (!erro) erro = e2;
            }
            /* Junta despesas individuais da nuvem no caixa local antes do merge geral */
            var exLocal = garantirExcluidosInterno(intLocal);
            intLocal.caixa = mesclarCaixaComDespesasNuvem(intLocal.caixa, despNuv, exLocal.caixa);
            var intMesclado = mesclarBaseInternoLocalNuvem(intLocal, intNuv);
            /* Garante de novo as despesas individuais (não perder se o doc interno estiver vazio) */
            var exMesclado = garantirExcluidosInterno(intMesclado);
            intMesclado.caixa = mesclarCaixaComDespesasNuvem(intMesclado.caixa, despNuv, exMesclado.caixa);
            salvarInternoRaw(intMesclado);
            var envio = { ok: 0, falha: 0, total: 0 };
            var apagadosNuvem = 0;
            try {
                apagadosNuvem = await apagarDespesasExcluidasNuvem(intMesclado);
                await enviarBaseInternoNuvem(intMesclado);
                envio = await enviarDespesasOsNuvemLista(intMesclado);
            } catch (eUp) {
                erro = eUp;
            }
            var nDesp = (intMesclado.caixa || []).filter(function (x) {
                return x && x.tipo === 'saida' && x.atendimentoId;
            }).length;
            return {
                ok: !erro || envio.ok > 0,
                erro: erro,
                nDesp: nDesp,
                baixadasNuvem: (despNuv || []).length,
                envio: envio,
                intDb: intMesclado
            };
        }

        async function sincronizarTodosNuvem(opts) {
            opts = opts || {};
            var silencioso = !!opts.silencioso;
            var mostrarToast = opts.mostrarToast != null ? !!opts.mostrarToast : !silencioso;
            if (_syncEmAndamento) {
                if (!silencioso) toast('Sincronização já em andamento…');
                return;
            }
            var cfg = carregarConfigNuvem();
            if (!cfg || !cfg.apiKey || !cfg.projectId) {
                if (!silencioso) toast('Nuvem sem chaves no firebase-env.js.');
                return;
            }
            if (!usuarioNuvemLogado()) {
                if (!silencioso) toast('Faça login para sincronizar.');
                return;
            }

            _syncEmAndamento = true;
            atualizarStatusNuvemUI();
            if (!silencioso) toast('Entrando na nuvem e sincronizando…');

            try {
                await obterSessaoFirebase();

                var canalAntes = canalVendas;
                canalVendas = 'normal';
                var db = carregar();
                var ok = 0, falha = 0;

                /* 1) Baixa e mescla base (empresa, clientes, estoque, caixa…) */
                var baseNuv = await baixarBaseNuvem();
                if (baseNuv) {
                    db.excluidos = mesclarExcluidos(db.excluidos, baseNuv.excluidos);
                    var ex = garantirExcluidos(db);
                    db.empresa = mesclarEmpresa(db.empresa, baseNuv.empresa, baseNuv.atualizadoEm);
                    db.empresa = await hidratarLogoEmpresa(db.empresa);
                    db.clientes = mesclarListaPorId(db.clientes, baseNuv.clientes, ex.clientes);
                    db.produtos = mesclarListaPorId(db.produtos, baseNuv.produtos, ex.produtos);
                    db.orcamentos = mesclarListaPorId(db.orcamentos, baseNuv.orcamentos, ex.orcamentos);
                    db.caixa = mesclarListaPorId(db.caixa, baseNuv.caixa, ex.caixa);
                    db.caixaBanco = mesclarListaPorId(db.caixaBanco, baseNuv.caixaBanco, ex.caixaBanco);
                    db.pendentes = mesclarListaPorId(db.pendentes, baseNuv.pendentes, ex.pendentes);
                    if (baseNuv.caixaConfig) db.caixaConfig = baseNuv.caixaConfig;
                } else {
                    db.excluidos = garantirExcluidos(db);
                    db.empresa = await hidratarLogoEmpresa(db.empresa);
                }

                /* 2) Baixa e mescla OS + fotos (respeitando exclusões) */
                var nuvemLista = await baixarAtendimentosNuvem();
                var exAt = garantirExcluidos(db).atendimentos;
                db.atendimentos = mesclarAtendimentosComExcluidos(db.atendimentos, nuvemLista, exAt);

                /* 2b) Apaga na nuvem OS que foram excluídas */
                try {
                    var sessaoDel = await obterSessaoFirebase();
                    var idsEx = Object.keys(exAt || {});
                    for (var di = 0; di < idsEx.length; di++) {
                        try {
                            await sessaoDel.fsMod.deleteDoc(
                                sessaoDel.fsMod.doc(sessaoDel.dbFs, 'hm_automotivo_atendimentos', idsEx[di])
                            );
                        } catch (delErr) { /* ok */ }
                    }
                } catch (eDel) { /* ok */ }

                /* 3) Envia o resultado mesclado de volta (oficial) */
                await enviarBaseNuvem(db);
                for (var i = 0; i < (db.atendimentos || []).length; i++) {
                    var r = await enviarAtendimentoNuvem(db.atendimentos[i]);
                    if (r.ok) {
                        ok++;
                        if (r.atendimento) {
                            var locais = db.atendimentos[i].fotos || [];
                            var nuvFotos = r.atendimento.fotos || [];
                            db.atendimentos[i].syncNuvemEm = new Date().toISOString();
                            db.atendimentos[i].fotos = nuvFotos.map(function (fn, idx) {
                                var fl = locais.find(function (x) { return x && fn && x.id === fn.id; }) || locais[idx] || {};
                                return {
                                    id: (fn && fn.id) || fl.id || uid(),
                                    data: fl.data || null,
                                    url: fl.url || (fn && fn.url) || null
                                };
                            });
                            if (!db.atendimentos[i].fotos.length && locais.length) {
                                db.atendimentos[i].fotos = locais;
                            }
                        }
                    } else falha++;
                }

                salvar(db);

                /* 4) Modo interno + despesas OS (doc geral + coleção por despesa) */
                var syncInt = await sincronizarModoInternoNuvem();
                if (syncInt.erro && !silencioso) {
                    toast('Oficial OK, mas falhou sync interno: ' +
                        (syncInt.erro.message || syncInt.erro.code || 'verifique regras do Firestore'));
                }

                canalVendas = canalAntes;
                _syncUltimaOkEm = Date.now();
                try { localStorage.setItem(SYNC_ULTIMA_KEY, String(_syncUltimaOkEm)); } catch (eUlt) { /* ok */ }

                if (mostrarToast) {
                    if (silencioso) {
                        toast('Sincronizado: ' + syncInt.nDesp + ' despesa(s) internas na nuvem.');
                    } else {
                        toast('Nuvem OK: ' + ok + ' OS · ' + (db.clientes || []).length + ' cliente(s)' +
                            ' · ' + syncInt.nDesp + ' despesa(s) internas' +
                            (syncInt.baixadasNuvem ? ' (baixou ' + syncInt.baixadasNuvem + ' da nuvem)' : '') +
                            (falha ? ' · ' + falha + ' falha(s)' : '') + '.');
                    }
                }
                preencherFormEmpresa();
                renderTudo();
            } finally {
                _syncEmAndamento = false;
                atualizarStatusNuvemUI();
            }
        }

        document.getElementById('btnConfigPasta').addEventListener('click', configurarPastaRaiz);
        document.getElementById('btnAtualizarPasta').addEventListener('click', atualizarStatusPastaUI);
        document.getElementById('btnSyncNuvem').addEventListener('click', function () {
            sincronizarTodosNuvem({ silencioso: false, mostrarToast: true }).catch(function (err) {
                toast('Erro na nuvem: ' + (err.message || err.code || 'verifique login e regras'));
            });
        });

