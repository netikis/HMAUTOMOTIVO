'use strict';
/* HM — histórico de telas (seta lateral do mouse / Alt+← / ESC), sem sair do sistema */

window._navHistorico = window._navHistorico || [];
window._navIgnorarHistorico = false;
window._navProfundidade = 0;

function _navLogado() {
    return !document.body.classList.contains('aguardando-login');
}

window._navGetEstado = function () {
    var panel = document.querySelector('.panel.active');
    return {
        panelId: panel ? panel.id : 'painelInicio',
        canal: typeof canalVendas === 'string' ? canalVendas : 'normal',
        relTipo: typeof relatorioCaixaTipo === 'string' ? relatorioCaixaTipo : 'geral'
    };
};

window._navEstadosIguais = function (a, b) {
    if (!a || !b) return false;
    return a.panelId === b.panelId &&
        (a.canal || 'normal') === (b.canal || 'normal') &&
        (a.relTipo || '') === (b.relTipo || '');
};

window._navHashEstado = function (est) {
    if (!est || !est.panelId) return '#inicio';
    var h = '#p=' + encodeURIComponent(est.panelId);
    if (est.canal && est.canal !== 'normal') h += '&c=' + encodeURIComponent(est.canal);
    if (est.relTipo) h += '&r=' + encodeURIComponent(est.relTipo);
    return h;
};

window._navFecharOverlayAberto = function () {
    var overlay = document.querySelector('.modal-overlay.aberto');
    if (!overlay) return false;
    overlay.classList.remove('aberto');
    return true;
};

window._navAplicarEstado = function (est) {
    if (!est || !est.panelId) return;
    window._navIgnorarHistorico = true;
    try {
        if (est.relTipo) relatorioCaixaTipo = est.relTipo;
        if (est.canal) canalVendas = est.canal;
        var sel = '.nav-btn[data-panel="' + est.panelId + '"]';
        var btn = document.querySelector(sel + '[data-canal="' + (est.canal || 'normal') + '"][data-rel-tipo="' + (est.relTipo || '') + '"]') ||
            document.querySelector(sel + '[data-canal="' + (est.canal || 'normal') + '"]') ||
            document.querySelector(sel);
        if (typeof window.abrirPainel === 'function') {
            window.abrirPainel(est.panelId, btn, {
                skipNav: true,
                canal: est.canal,
                relTipo: est.relTipo
            });
        }
    } finally {
        window._navIgnorarHistorico = false;
    }
    try { window.scrollTo(0, 0); } catch (e) { /* ok */ }
};

window._navPushHistorico = function (estadoDestino) {
    if (!estadoDestino || !estadoDestino.panelId) return;
    try {
        window._navProfundidade++;
        history.pushState(
            { hmNav: estadoDestino, navDepth: window._navProfundidade },
            '',
            window._navHashEstado(estadoDestino)
        );
    } catch (e) { /* file:// */ }
};

window._navRegistrarDepoisNavegacao = function (estadoAntes) {
    if (window._navIgnorarHistorico) return;
    var depois = window._navGetEstado();
    if (!depois.panelId || window._navEstadosIguais(estadoAntes, depois)) return;
    window._navHistorico.push(estadoAntes);
    if (window._navHistorico.length > 50) window._navHistorico.shift();
    window._navPushHistorico(depois);
};

window._navIrInicio = function () {
    window._navIgnorarHistorico = true;
    window._navAplicarEstado({ panelId: 'painelInicio', canal: 'normal', relTipo: 'geral' });
    try {
        history.replaceState(
            { hmNav: { panelId: 'painelInicio', canal: 'normal', relTipo: 'geral' }, navDepth: 0, seguro: true },
            '',
            window._navHashEstado({ panelId: 'painelInicio', canal: 'normal' })
        );
    } catch (e) { /* ok */ }
    window._navHistorico = [];
    window._navProfundidade = 0;
    window._navIgnorarHistorico = false;
};

window._navPodeVoltarHistorico = function () {
    return window._navHistorico.length > 0 || window._navProfundidade > 0;
};

window.voltarPaginaAnterior = function () {
    if (!_navLogado()) return;
    if (window._navFecharOverlayAberto()) return;
    if (window._navPodeVoltarHistorico()) {
        try {
            history.back();
        } catch (e) {
            window._navVoltarPilhaInterna();
        }
        return;
    }
    window._navIrInicio();
};

window._navVoltarPilhaInterna = function () {
    if (!window._navHistorico.length) {
        window._navIrInicio();
        return;
    }
    var est = window._navHistorico.pop();
    window._navProfundidade = Math.max(0, window._navProfundidade - 1);
    window._navAplicarEstado(est);
};

window._navIniciarSessao = function () {
    window._navHistorico = [];
    window._navProfundidade = 0;
    var est = window._navGetEstado();
    try {
        history.replaceState({ hmNav: est, navDepth: 0, seguro: true }, '', window._navHashEstado(est));
        history.pushState({ hmNav: est, navDepth: 0, seguro: true, anchor: true }, '', window._navHashEstado(est));
    } catch (e) { /* ok */ }
};

window._navLimparHistorico = function () {
    window._navHistorico = [];
    window._navProfundidade = 0;
};

window._navTratarEscape = function () {
    if (!_navLogado()) return false;
    if (document.body.classList.contains('menu-aberto')) return false;
    if (window._navFecharOverlayAberto()) return true;
    if (window._navPodeVoltarHistorico()) {
        window.voltarPaginaAnterior();
        return true;
    }
    window._navIrInicio();
    return true;
};

window.addEventListener('popstate', function (e) {
    if (!_navLogado()) return;
    if (window._navIgnorarHistorico) return;
    if (window._navFecharOverlayAberto()) {
        try {
            var atual = window._navGetEstado();
            history.pushState(
                { hmNav: atual, navDepth: window._navProfundidade || 0 },
                '',
                window._navHashEstado(atual)
            );
        } catch (err) { /* ok */ }
        return;
    }
    if (e.state && e.state.hmNav) {
        window._navProfundidade = e.state.navDepth || 0;
        if (window._navHistorico.length) window._navHistorico.pop();
        window._navAplicarEstado(e.state.hmNav);
        return;
    }
    if (window._navHistorico.length) {
        window._navVoltarPilhaInterna();
        return;
    }
    window._navIrInicio();
});

window.addEventListener('keydown', function (e) {
    if (!_navLogado()) return;
    if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        window.voltarPaginaAnterior();
    }
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
        if (_navLogado()) window._navIniciarSessao();
    });
} else if (_navLogado()) {
    window._navIniciarSessao();
}
