/**
 * Hero em carrossel de vídeos.
 *
 * Cada slide (.hero__slide) traz uma capa em imagem e o endereço do vídeo em data-video, com uma
 * versão opcional para tela em pé em data-video-portrait. data-forma diz se o arquivo é "vertical"
 * ou "horizontal": vídeo em pé numa tela deitada aparece inteiro no centro, sobre um fundo borrado.
 *
 * O vídeo de cada slide só é criado quando o slide entra (o seguinte é preparado alguns segundos
 * antes). Quando o vídeo termina, o carrossel passa sozinho para o próximo, entrando pela lateral.
 * Setas, pontos e deslizar o dedo trocam de vídeo; o botão de pausa para tudo.
 *
 * Para quem pede menos movimento no sistema ou usa economia de dados, nada começa sozinho: aparece a
 * capa e o vídeo toca ao apertar o play. Para pré-visualizar o modo completo, abra com ?animacao=on.
 */
(() => {
  'use strict';
  const raiz = document.querySelector('[data-hero-slides]');
  if (!raiz) return;
  const hero = raiz.closest('.hero');
  const slides = Array.from(raiz.querySelectorAll('.hero__slide'));
  const btnAnterior = hero.querySelector('[data-hero-prev]');
  const btnProximo = hero.querySelector('[data-hero-next]');
  const btnPausa = hero.querySelector('[data-hero-pause]');
  const caixaPontos = hero.querySelector('[data-hero-dots]');
  const controles = hero.querySelector('.hero__controls');

  const forcar = new URLSearchParams(location.search).get('animacao') === 'on';
  const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches && !forcar;
  const economia = Boolean(navigator.connection && navigator.connection.saveData);
  const telaEmPe = matchMedia('(orientation: portrait)');

  const ESPERA_FIM = 900;       // ms parado no último quadro antes de passar
  const RESERVA = 8000;         // ms até passar se um vídeo não conseguir tocar
  const PREPARO = 2500;         // ms depois de começar a tocar para preparar o próximo

  let atual = 0;
  let pausado = reduzir || economia;
  let naTela = true;
  let temporizador = 0;

  if (slides.length < 2) { if (controles) controles.hidden = true; }

  /* ---------- fontes e formato ---------- */
  const fonte = (slide) => {
    const emPe = telaEmPe.matches && slide.dataset.videoPortrait;
    return {
      src: emPe ? slide.dataset.videoPortrait : slide.dataset.video,
      forma: emPe ? (slide.dataset.formaPortrait || 'vertical') : (slide.dataset.forma || 'horizontal'),
    };
  };
  const ajustarForma = (slide) => {
    slide.classList.toggle('is-contain', fonte(slide).forma === 'vertical' && !telaEmPe.matches);
  };

  const pararVideo = (slide, voltarAoInicio) => {
    const v = slide._video;
    if (!v) return;
    v.pause();
    if (voltarAoInicio) { try { v.currentTime = 0; } catch { /* ainda sem dados */ } }
  };

  const videoDo = (slide) => {
    const { src } = fonte(slide);
    if (slide._video && slide._video.dataset.src === src) return slide._video;
    if (slide._video) slide._video.remove();
    const v = document.createElement('video');
    v.className = 'hero__video';
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.disablePictureInPicture = true;
    v.tabIndex = -1;
    v.setAttribute('aria-hidden', 'true');
    v.dataset.src = src;
    v.src = src;
    v.addEventListener('playing', () => {
      v.classList.add('is-on');
      if (slides[atual] === slide) agendarPreparo();
    });
    v.addEventListener('ended', () => {
      if (slides[atual] !== slide || pausado) return;
      clearTimeout(temporizador);
      temporizador = setTimeout(() => ir(atual + 1, 1), ESPERA_FIM);
    });
    v.addEventListener('error', () => {
      if (slides[atual] !== slide || pausado) return;
      clearTimeout(temporizador);
      temporizador = setTimeout(() => ir(atual + 1, 1), RESERVA);
    });
    slide.appendChild(v);
    slide._video = v;
    return v;
  };

  /* deixa o vídeo seguinte carregando enquanto o atual toca */
  let temporizadorPreparo = 0;
  const agendarPreparo = () => {
    clearTimeout(temporizadorPreparo);
    if (economia || slides.length < 2) return;
    temporizadorPreparo = setTimeout(() => videoDo(slides[(atual + 1) % slides.length]), PREPARO);
  };

  /* ---------- tocar e trocar ---------- */
  const tocar = () => {
    clearTimeout(temporizador);
    const slide = slides[atual];
    if (pausado || !naTela || document.hidden) { pararVideo(slide, false); return; }
    const v = videoDo(slide);
    if (v.ended) { try { v.currentTime = 0; } catch { /* sem dados */ } }
    v.play().catch(() => {
      /* o navegador bloqueou: fica a capa e o carrossel segue mesmo assim */
      temporizador = setTimeout(() => ir(atual + 1, 1), RESERVA);
    });
  };

  const ir = (indice, direcao) => {
    const novo = (indice + slides.length) % slides.length;
    if (novo === atual) return;
    clearTimeout(temporizador);
    clearTimeout(temporizadorPreparo);
    const de = slides[atual];
    const para = slides[novo];
    pararVideo(de, false);
    ajustarForma(para);

    if (reduzir) {
      de.classList.remove('is-active');
      para.classList.add('is-active');
      pararVideo(de, true);
    } else {
      /* o novo entra pelo lado da direção e o atual sai pelo outro */
      para.style.transition = 'none';
      para.style.transform = `translateX(${direcao * 100}%)`;
      para.classList.add('is-active');
      void para.offsetWidth;
      para.style.transition = '';
      para.style.transform = 'translateX(0)';
      de.classList.add('is-leaving');
      de.classList.remove('is-active');
      de.style.transform = `translateX(${-direcao * 100}%)`;
      const terminar = (e) => {
        if (e && e.target !== de) return;
        de.removeEventListener('transitionend', terminar);
        if (de.classList.contains('is-active')) return;
        de.classList.remove('is-leaving');
        de.style.transform = '';
        pararVideo(de, true);
      };
      de.addEventListener('transitionend', terminar);
      setTimeout(terminar, 1200);
    }

    atual = novo;
    marcarPontos();
    tocar();
  };

  /* ---------- controles ---------- */
  const pontos = slides.map((slide, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hero__dot';
    b.setAttribute('aria-label', `Vídeo ${i + 1} de ${slides.length}: ${slide.getAttribute('aria-label') || ''}`.trim());
    b.addEventListener('click', () => ir(i, i > atual ? 1 : -1));
    if (caixaPontos) caixaPontos.appendChild(b);
    return b;
  });
  const marcarPontos = () => pontos.forEach((b, i) => b.setAttribute('aria-current', i === atual ? 'true' : 'false'));

  const marcarPausa = () => {
    if (!btnPausa) return;
    btnPausa.setAttribute('aria-pressed', String(pausado));
    btnPausa.setAttribute('aria-label', pausado ? 'Reproduzir vídeos' : 'Pausar vídeos');
  };

  if (btnAnterior) btnAnterior.addEventListener('click', () => ir(atual - 1, -1));
  if (btnProximo) btnProximo.addEventListener('click', () => ir(atual + 1, 1));
  if (btnPausa) btnPausa.addEventListener('click', () => {
    pausado = !pausado;
    marcarPausa();
    tocar();
  });

  /* deslizar o dedo (ou arrastar o mouse) para o lado troca de vídeo */
  let inicio = null;
  hero.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button')) return;
    inicio = { x: e.clientX, y: e.clientY };
  });
  hero.addEventListener('pointerup', (e) => {
    if (!inicio) return;
    const dx = e.clientX - inicio.x;
    const dy = e.clientY - inicio.y;
    inicio = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) ir(atual + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });
  hero.addEventListener('pointercancel', () => { inicio = null; });

  /* ---------- ciclo de vida ---------- */
  new IntersectionObserver((entradas) => {
    naTela = entradas[entradas.length - 1].isIntersecting;
    tocar();
  }, { threshold: 0.1 }).observe(hero);
  document.addEventListener('visibilitychange', tocar);
  /* girar o aparelho troca o arquivo de quem tem versão em pé */
  telaEmPe.addEventListener('change', () => {
    slides.forEach(ajustarForma);
    tocar();
  });

  slides.forEach(ajustarForma);
  marcarPontos();
  marcarPausa();
  if (document.readyState === 'complete') tocar();
  else window.addEventListener('load', tocar, { once: true });
})();
