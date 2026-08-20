'use strict';
/* HM Automotivo — clientes */

        /* ---------- Clientes ---------- */
        document.getElementById('formCliente').addEventListener('submit', function (e) {
            e.preventDefault();
            var db = carregar();
            var id = document.getElementById('cliId').value;
            var payload = {
                id: id || uid(),
                nome: document.getElementById('cliNome').value.trim(),
                cpf: document.getElementById('cliCpf').value.trim(),
                cnpj: document.getElementById('cliCnpj').value.trim(),
                telefone: document.getElementById('cliTel').value.trim(),
                email: document.getElementById('cliEmail').value.trim(),
                cidade: document.getElementById('cliCidade').value.trim(),
                cep: document.getElementById('cliCep').value.trim(),
                endereco: document.getElementById('cliEndereco').value.trim(),
                numero: document.getElementById('cliNumero').value.trim(),
                atualizadoEm: new Date().toISOString()
            };
            if (id) {
                var i = db.clientes.findIndex(function (c) { return c.id === id; });
                if (i >= 0) db.clientes[i] = Object.assign({}, db.clientes[i], payload);
            } else {
                payload.criadoEm = new Date().toISOString();
                db.clientes.push(payload);
            }
            limparExcluido(db, 'clientes', payload.id);
            salvar(db);
            limparFormCliente();
            toast(id ? 'Cliente atualizado.' : 'Cliente cadastrado.');
            renderClientes();
            preencherSelectsCliente(db);
            atualizarKPIs(db);
        });

        function limparFormCliente() {
            document.getElementById('formCliente').reset();
            document.getElementById('cliId').value = '';
            document.getElementById('tituloFormCliente').textContent = 'Cadastro de Cliente';
            document.getElementById('btnCancelarCli').style.display = 'none';
        }

        document.getElementById('btnCancelarCli').addEventListener('click', limparFormCliente);

        function editarCliente(id) {
            var db = carregar();
            var c = db.clientes.find(function (x) { return x.id === id; });
            if (!c) return;
            document.getElementById('cliId').value = c.id;
            document.getElementById('cliNome').value = c.nome || '';
            document.getElementById('cliCpf').value = c.cpf || '';
            document.getElementById('cliCnpj').value = c.cnpj || '';
            document.getElementById('cliTel').value = c.telefone || '';
            document.getElementById('cliEmail').value = c.email || '';
            document.getElementById('cliCidade').value = c.cidade || '';
            document.getElementById('cliCep').value = c.cep || '';
            document.getElementById('cliEndereco').value = c.endereco || '';
            document.getElementById('cliNumero').value = c.numero || '';
            document.getElementById('tituloFormCliente').textContent = 'Editar Cliente';
            document.getElementById('btnCancelarCli').style.display = '';
            abrirPainel('painelClientes');
        }

        function excluirCliente(id) {
            if (!confirm('Excluir este cliente do banco HM?')) return;
            var db = carregar();
            marcarExcluido(db, 'clientes', id);
            db.clientes = db.clientes.filter(function (c) { return c.id !== id; });
            salvar(db);
            toast('Cliente excluído.');
            renderTudo();
        }

        function renderClientes() {
            var db = carregar();
            var q = (document.getElementById('buscaCliente').value || '').toLowerCase().trim();
            var lista = db.clientes.filter(function (c) {
                if (!q) return true;
                return [c.nome, c.cpf, c.cnpj, c.telefone, c.cidade].join(' ').toLowerCase().indexOf(q) > -1;
            }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });

            var tb = document.getElementById('tabelaClientes');
            var vazio = document.getElementById('listaClientesVazia');
            tb.innerHTML = '';
            if (!lista.length) {
                vazio.style.display = '';
                return;
            }
            vazio.style.display = 'none';
            lista.forEach(function (c) {
                var tr = document.createElement('tr');
                tr.innerHTML =
                    '<td>' + esc(c.nome) + '</td>' +
                    '<td>' + esc(docCliente(c)) + '</td>' +
                    '<td>' + esc(c.telefone || '—') + '</td>' +
                    '<td>' + esc(c.cidade || '—') + '</td>' +
                    '<td class="actions">' +
                    '<button type="button" class="btn btn-secondary" data-ed="' + c.id + '">Editar</button>' +
                    '<button type="button" class="btn btn-primary" data-at="' + c.id + '">Atendimento</button>' +
                    '<button type="button" class="btn btn-danger" data-ex="' + c.id + '">Excluir</button>' +
                    '</td>';
                tb.appendChild(tr);
            });
            tb.querySelectorAll('[data-ed]').forEach(function (b) {
                b.addEventListener('click', function () { editarCliente(b.getAttribute('data-ed')); });
            });
            tb.querySelectorAll('[data-ex]').forEach(function (b) {
                b.addEventListener('click', function () { excluirCliente(b.getAttribute('data-ex')); });
            });
            tb.querySelectorAll('[data-at]').forEach(function (b) {
                b.addEventListener('click', function () {
                    var db2 = carregar();
                    var cid = b.getAttribute('data-at');
                    var c = db2.clientes.find(function (x) { return x.id === cid; });
                    abrirPainel('painelVeiculo');
                    document.getElementById('atClienteId').value = cid;
                    document.getElementById('atClienteBusca').value = c ? c.nome : '';
                    atualizarStatusClienteAt();
                });
            });
        }

        document.getElementById('buscaCliente').addEventListener('input', renderClientes);

