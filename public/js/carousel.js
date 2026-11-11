/**
 * Carrossel de projetos em perspectiva — adaptação do componente "infinite-perspective-slider"
 * (GSAP) para HTML puro.
 *
 * As fotos formam uma faixa infinita. Arrastar, usar as setas, o trackpad na horizontal ou rolar a
 * página move a faixa, e os cartões giram no eixo Y conforme a velocidade, voltando a ficar de
 * frente quando a faixa para.
 *
 * Sem GSAP, ou para quem pede menos movimento no sistema (prefers-reduced-motion), o carrossel fica
 * no modo simples: rolagem horizontal nativa com encaixe, mais as setas. Para pré-visualizar o modo
 * completo mesmo assim, abra a página com ?animacao=on.
 */
(() => {
  'use strict';
  const raiz = document.querySelector('[data-carousel]');
  if (!raiz) return;
  const janela = raiz.querySelector('.carousel__viewport');
  const faixa = raiz.querySelector('.carousel__strip');
  const cartoes = Array.from(faixa.children);
  const btnAnterior = raiz.querySelector('[data-prev]');
  const btnProximo = raiz.querySelector('[data-next]');
  if (cartoes.length < 3) return;

  const forcar = new URLSearchParams(location.search).get('animacao') === 'on';
  const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches && !forcar;

  /* ---------- modo simples: rolagem nativa ---------- */
  if (!window.gsap || reduzir) {
    const passoNativo = () => cartoes[1].offsetLeft - cartoes[0].offsetLeft;
    const rolar = (direcao) => janela.scrollBy({ left: direcao * passoNativo(), behavior: reduzir ? 'auto' : 'smooth' });
    btnAnterior.addEventListener('click', () => rolar(-1));
    btnProximo.addEventListener('click', () => rolar(1));
    return;
  }

  /* ---------- modo completo ---------- */
  const CFG = {
    suavidade: 0.1,        // quanto a faixa se aproxima do alvo por quadro (a 60 qps)
    amortecimento: 0.1,    // suaviza a velocidade usada no giro
    sensibilidade: 0.07,   // graus de giro por pixel de velocidade
    suavidadeGiro: 0.12,
    giroMaximo: 55,
    fatorRolagem: 0.5,     // quanto a rolagem da página empurra a faixa
    rolagemMaxima: 120,    // teto por evento, para saltos de âncora não fazerem a faixa disparar
    esperaParada: 180,     // ms sem movimento até as legendas poderem voltar
    projecao: 180,         // ms de impulso projetado ao soltar o arrasto
  };

  raiz.classList.add('is-live');
  const total = cartoes.length;
  const mover = cartoes.map((el) => ({ x: gsap.quickSetter(el, 'x', 'px'), giro: gsap.quickSetter(el, 'rotateY', 'deg') }));
  const limitar = (v, min, max) => Math.max(min, Math.min(max, v));

  let passo = 0;
  let volta = 0;
  let centro = 0;
  const estado = { atual: 0, alvo: 0, velocidadeGiro: 0, giro: 0 };

  const medir = () => {
    const largura = cartoes[0].offsetWidth;
    const vao = parseFloat(getComputedStyle(faixa).columnGap) || 24;
    passo = largura + vao;
    volta = passo * total;
    centro = janela.clientWidth / 2 - largura / 2;
    faixa.style.height = `${Math.max(...cartoes.map((c) => c.offsetHeight))}px`;
  };

  const posicionar = () => {
    const giro = limitar(estado.giro, -CFG.giroMaximo, CFG.giroMaximo);
    for (let i = 0; i < total; i += 1) {
      let x = i * passo - estado.atual + centro;
      x = ((x % volta) + volta) % volta;
      if (x > volta - passo) x -= volta;
      mover[i].x(x);
      mover[i].giro(giro);
    }
  };

  /* laço de animação: roda só com o carrossel na tela e para sozinho quando tudo assenta */
  let visivel = false;
  let rodando = false;
  let ultimoQuadro = 0;

  const quadro = (agora) => {
    const dt = Math.min(64, agora - ultimoQuadro || 16.7);
    ultimoQuadro = agora;
    /* mesma sensação em telas de 60, 120 ou 144 Hz */
    const k = (fator) => 1 - Math.pow(1 - fator, dt / 16.7);

    estado.atual += (estado.alvo - estado.atual) * k(CFG.suavidade);
    const velocidade = estado.alvo - estado.atual;
    estado.velocidadeGiro += (velocidade - estado.velocidadeGiro) * k(CFG.amortecimento);
    estado.giro += (estado.velocidadeGiro * CFG.sensibilidade - estado.giro) * k(CFG.suavidadeGiro);

    if (Math.abs(velocidade) < 0.05) {
      const voltas = Math.round(estado.atual / volta) * volta;
      estado.atual -= voltas;
      estado.alvo -= voltas;
    }
    posicionar();

    const assentou = Math.abs(velocidade) < 0.05 && Math.abs(estado.giro) < 0.02;
    if (assentou) {
      /* termina exatamente de frente: um resto de giro deixaria metade do cartão atrás do plano da faixa */
      estado.giro = 0;
      estado.velocidadeGiro = 0;
      posicionar();
    }
    if (assentou || !visivel || document.hidden) { rodando = false; return; }
    requestAnimationFrame(quadro);
  };
  const acordar = () => {
    if (rodando || !visivel || document.hidden) return;
    rodando = true;
    ultimoQuadro = performance.now();
    requestAnimationFrame(quadro);
  };

  /* enquanto a faixa se move, as legendas ficam recolhidas */
  let temporizadorParada = 0;
  const marcarMovimento = () => {
    raiz.classList.add('is-moving');
    clearTimeout(temporizadorParada);
    temporizadorParada = setTimeout(() => raiz.classList.remove('is-moving'), CFG.esperaParada);
  };
  const empurrar = (delta) => {
    estado.alvo += delta;
    if (Math.abs(delta) >= 2) marcarMovimento();
    acordar();
  };
  const encaixar = (extra = 0) => {
    estado.alvo = Math.round((estado.alvo + extra) / passo) * passo;
    acordar();
  };
  const ir = (direcao) => {
    estado.alvo = Math.round(estado.alvo / passo) * passo + direcao * passo;
    marcarMovimento();
    acordar();
  };

  /* ---------- entradas ---------- */
  btnAnterior.addEventListener('click', () => ir(-1));
  btnProximo.addEventListener('click', () => ir(1));
  raiz.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); ir(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); ir(1); }
  });

  /* arrasto com mouse, dedo ou caneta */
  let arrastando = false;
  let moveu = false;
  let ponteiro = null;
  let xAnterior = 0;
  let xInicial = 0;
  let amostras = [];

  janela.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    arrastando = true;
    moveu = false;
    ponteiro = e.pointerId;
    xAnterior = xInicial = e.clientX;
    amostras = [{ x: e.clientX, t: e.timeStamp }];
  });
  window.addEventListener('pointermove', (e) => {
    if (!arrastando || e.pointerId !== ponteiro) return;
    const delta = e.clientX - xAnterior;
    xAnterior = e.clientX;
    if (!moveu && Math.abs(e.clientX - xInicial) > 6) {
      moveu = true;
      raiz.classList.add('is-dragging');
    }
    if (!moveu) return;
    amostras.push({ x: e.clientX, t: e.timeStamp });
    if (amostras.length > 5) amostras.shift();
    empurrar(-delta);
  });
  const soltar = (e) => {
    if (!arrastando || e.pointerId !== ponteiro) return;
    arrastando = false;
    raiz.classList.remove('is-dragging');
    if (!moveu) return;
    /* o gesto continua na velocidade do dedo e a faixa pousa no cartão mais próximo desse ponto */
    const primeira = amostras[0];
    const ultima = amostras[amostras.length - 1];
    const tempo = ultima.t - primeira.t;
    const velocidade = tempo > 0 && e.timeStamp - ultima.t < 80 ? (ultima.x - primeira.x) / tempo : 0;
    encaixar(-velocidade * CFG.projecao);
  };
  window.addEventListener('pointerup', soltar);
  window.addEventListener('pointercancel', soltar);
  /* depois de arrastar, o clique que sobra não deve ampliar a foto */
  janela.addEventListener('click', (e) => {
    if (!moveu) return;
    e.preventDefault();
    e.stopPropagation();
    moveu = false;
  }, true);

  /* trackpad ou roda na horizontal: a faixa anda e a página não rola de lado */
  let temporizadorRoda = 0;
  janela.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    empurrar(e.deltaX);
    clearTimeout(temporizadorRoda);
    temporizadorRoda = setTimeout(() => encaixar(), CFG.esperaParada);
  }, { passive: false });

  /* a rolagem da página também empurra a faixa enquanto o carrossel passa pela tela */
  let ultimoY = window.scrollY;
  let temporizadorRolagem = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const delta = limitar(y - ultimoY, -CFG.rolagemMaxima, CFG.rolagemMaxima);
    ultimoY = y;
    if (!visivel || arrastando) return;
    empurrar(delta * CFG.fatorRolagem);
    clearTimeout(temporizadorRolagem);
    temporizadorRolagem = setTimeout(() => encaixar(), CFG.esperaParada);
  }, { passive: true });

  /* navegação por teclado: o cartão focado vem para o centro pelo caminho mais curto */
  faixa.addEventListener('focusin', (e) => {
    if (!e.target.matches(':focus-visible')) return;
    const i = cartoes.indexOf(e.target.closest('.slide'));
    if (i < 0) return;
    let delta = (((i * passo - estado.alvo) % volta) + volta) % volta;
    if (delta > volta / 2) delta -= volta;
    estado.alvo += delta;
    marcarMovimento();
    acordar();
  });

  /* ---------- ciclo de vida ---------- */
  new IntersectionObserver((entradas) => {
    visivel = entradas[entradas.length - 1].isIntersecting;
    if (visivel) { ultimoY = window.scrollY; acordar(); }
  }, { rootMargin: '256px' }).observe(raiz);
  document.addEventListener('visibilitychange', acordar);

  const aoRedimensionar = () => {
    const indice = passo ? Math.round(estado.alvo / passo) : 0;
    medir();
    estado.alvo = estado.atual = indice * passo;
    posicionar();
  };
  new ResizeObserver(aoRedimensionar).observe(janela);
  /* as legendas mudam de altura quando as fontes terminam de carregar */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(aoRedimensionar);

  medir();
  posicionar();
})();
