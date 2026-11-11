/**
 * Vídeo de fundo da hero.
 *
 * A foto continua sendo o que carrega primeiro. Depois que a página termina de carregar, o vídeo
 * entra por cima dela com um esmaecimento: tela em pé (celular) recebe o vídeo vertical, que toca
 * uma vez e para na cozinha iluminada; tela deitada recebe o horizontal, em loop contínuo.
 *
 * Não carrega para quem pede menos movimento no sistema nem para quem ativou economia de dados.
 * Para pré-visualizar mesmo assim, abra a página com ?animacao=on.
 */
(() => {
  'use strict';
  const midia = document.querySelector('.hero__media[data-video]');
  if (!midia) return;

  const forcar = new URLSearchParams(location.search).get('animacao') === 'on';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches && !forcar) return;
  if (navigator.connection && navigator.connection.saveData) return;

  const iniciar = () => {
    const emPe = matchMedia('(orientation: portrait)').matches;
    const video = document.createElement('video');
    video.className = 'hero__video';
    video.muted = true;
    video.playsInline = true;
    video.loop = !emPe;
    video.preload = 'auto';
    video.disablePictureInPicture = true;
    video.tabIndex = -1;
    video.setAttribute('aria-hidden', 'true');
    video.src = emPe ? midia.dataset.videoPortrait : midia.dataset.video;
    video.addEventListener('playing', () => video.classList.add('is-on'), { once: true });
    midia.appendChild(video);

    /* toca só com a hero na tela */
    new IntersectionObserver((entradas) => {
      const naTela = entradas[entradas.length - 1].isIntersecting;
      if (!naTela) { video.pause(); return; }
      if (!video.ended) video.play().catch(() => { /* autoplay bloqueado: fica a foto */ });
    }, { threshold: 0.1 }).observe(midia);
  };

  if (document.readyState === 'complete') iniciar();
  else window.addEventListener('load', iniciar, { once: true });
})();
