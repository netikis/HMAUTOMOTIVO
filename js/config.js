'use strict';
/* HM Automotivo — config + estado compartilhado */


        /** Banco exclusivo deste index — não usa chaves dos outros sistemas */
        var STORAGE_KEY = 'hm_automotivo_v1';
        var STORAGE_INTERNO = 'hm_automotivo_interno_v1';
        var ASSIN_KEY = 'hm_automotivo_assinaturas';
        var atendimentoNotaAtual = null;
        var canalVendas = 'normal'; /* normal | interno */

        var TITULOS = {
            painelInicio: ['Painel', 'Visão geral da oficina HM'],
            painelClientes: ['Cadastrar Cliente', 'Base de clientes do index HM'],
            painelListaClientes: ['Clientes Cadastrados', 'Lista e edição rápida'],
            painelVeiculo: ['Ordem de Serviço / Veículo', 'Atendimento com veículo, serviços e valores'],
            painelHistorico: ['Histórico de Atendimentos', 'Veículos e serviços registrados'],
            painelProdutos: ['Cadastro de Produtos', 'Estoque local simplificado'],
            painelOrcamento: ['Venda / Orçamento', 'Documentos do balcão local'],
            painelVendasRealizadas: ['Vendas realizadas', 'Somente vendas finalizadas do balcão'],
            painelOrcamentosRealizados: ['Orçamentos realizados', 'Somente orçamentos / propostas salvos'],
            painelCaixa: ['Caixa / Balcão', 'Pastas mensais · entradas · saídas'],
            painelCaixaBanco: ['Caixa do Banco', 'Pastas mensais · PIX · cartões'],
            painelPendentes: ['Contas a Receber', 'Pastas mensais · a receber'],
            painelRelatorioCaixa: ['Relatório Caixa', 'Pastas mensais · entradas · saídas · relatório geral'],
            painelRelatorioUnificado: ['Relatório unificado', 'Oficial + interno · um caixa no final'],
            painelDespesasOs: ['Despesas por OS', 'Pastas mensais · bruto · despesas · lucro'],
            painelServicoFinalizado: ['Serviço finalizado', 'Pastas Ano → Mês → Dia · visualizar e imprimir'],
            painelFuncionarios: ['Cadastro de Funcionários', 'Quem pode comprar no modo interno'],
            painelPagFuncionarios: ['Pagamento funcionários', 'Controle semanal interno · sem impressão'],
            painelConfig: ['Config / Empresa', 'Empresa, logo, endereço e backup']
        };

        var itensTemp = [];
        var carrinhoVenda = [];
        var produtoVendaSelecionado = null;
        var fotosAtuais = [];
        var LOGO_PADRAO = 'logo-hm.png';
        var PASTA_IDB = 'hm_automotivo_pasta_v1';
        var NUVEM_KEY = 'hm_automotivo_nuvem';
        var LOGIN_EMAIL_KEY = 'hm_automotivo_login_email';
        var SYNC_ULTIMA_KEY = 'hm_automotivo_sync_ultima';
        var FOTOS_MAX = 12;

