/**
 * Parallax da hero — adaptação do componente "parallax-scrolling" (GSAP ScrollTrigger + Lenis)
 * para HTML puro. Cada camada desce uma fração diferente da altura da hero enquanto a página
 * rola, o que dá a sensação de profundidade: a foto fica "longe", o letreiro mais perto.
 *
 * Quem pede menos movimento no sistema (prefers-reduced-motion) não recebe parallax nem
 * rolagem suave. Para pré-visualizar mesmo assim, abra a página com ?animacao=on.
 */
(() => {
  'use strict';
  const hero = document.querySelector('[data-parallax]');
  if (!hero || !window.gsap || !window.ScrollTrigger) return;

  const forcar = new URLSearchParams(location.search).get('animacao') === 'on';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches && !forcar) return;

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* fração da altura da hero que cada camada desce até a hero sair da tela */
  const CAMADAS = { 1: 0.4, 2: 0.24 };
  const altura = () => hero.offsetHeight;

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: hero,
      start: 0,
      end: () => hero.offsetTop + altura(),
      scrub: 0,
      invalidateOnRefresh: true,
    },
  });
  Object.entries(CAMADAS).forEach(([camada, fracao]) => {
    tl.to(hero.querySelectorAll(`[data-parallax-layer="${camada}"]`), { y: () => altura() * fracao }, 0);
  });
  /* a base da hero se dissolve na cor da página, e o letreiro afunda nela */
  tl.to(hero.querySelectorAll('[data-parallax-fade]'), { opacity: 1 }, 0);

  /* rolagem suave (só com mouse/trackpad; no toque o Lenis mantém a rolagem nativa) */
  if (!window.Lenis) return;
  const lenis = new Lenis();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((tempo) => lenis.raf(tempo * 1000));
  gsap.ticker.lagSmoothing(0);

  /* links internos (#contato etc.): o salto nativo do navegador brigava com o Lenis e a página
     ia parar no lugar errado, então o próprio Lenis conduz a rolagem até a seção */
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const alvo = document.getElementById(link.getAttribute('href').slice(1));
    if (!alvo) return;
    e.preventDefault();
    const margem = parseFloat(getComputedStyle(alvo).scrollMarginTop) || 0;
    const destino = Math.max(0, alvo.getBoundingClientRect().top + window.scrollY - margem);
    lenis.scrollTo(destino, {
      onComplete: () => {
        history.pushState(null, '', link.getAttribute('href'));
        /* leva o foco do teclado junto, como o salto nativo faria */
        alvo.setAttribute('tabindex', '-1');
        alvo.focus({ preventScroll: true });
      },
    });
  });

  /* com uma foto ampliada aberta, a página não rola por trás */
  const zoom = document.getElementById('zoom');
  if (zoom) {
    new MutationObserver(() => (zoom.open ? lenis.stop() : lenis.start()))
      .observe(zoom, { attributes: true, attributeFilter: ['open'] });
  }
})();
