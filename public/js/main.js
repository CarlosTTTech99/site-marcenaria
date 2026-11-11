(() => {
  'use strict';
  const WHATSAPP = '5515981421923';
  const doc = document.documentElement;
  doc.classList.add('js');

  /* ano do rodapé */
  const ano = document.getElementById('ano');
  if (ano) ano.textContent = new Date().getFullYear();

  /* navegação: material translúcido depois do topo */
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('is-stuck', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* revelar ao rolar (uma vez só) */
  const items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach((el) => io.observe(el));
  } else {
    items.forEach((el) => el.classList.add('is-in'));
  }

  /* ampliar fotos */
  const zoom = document.getElementById('zoom');
  if (zoom && zoom.showModal) {
    const big = zoom.querySelector('img');
    document.querySelectorAll('[data-zoom]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const img = btn.querySelector('img');
        big.src = img.dataset.full || img.currentSrc || img.src;
        big.alt = img.alt;
        zoom.showModal();
      });
    });
    zoom.addEventListener('click', (e) => { if (e.target !== zoom.querySelector('img')) zoom.close(); });
  }

  /* formulário de orçamento */
  const form = document.getElementById('form-orcamento');
  if (!form) return;
  const tel = form.elements.telefone;
  const erro = form.querySelector('.form__error');
  const done = form.querySelector('.form__done');
  const botao = form.querySelector('.form__submit');

  tel.addEventListener('input', () => {
    const d = tel.value.replace(/\D/g, '').slice(0, 11);
    let out = d;
    if (d.length > 2) out = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 6) {
      const corte = d.length === 11 ? 7 : 6;
      out = `(${d.slice(0, 2)}) ${d.slice(2, corte)}-${d.slice(corte)}`;
    }
    tel.value = out;
  });

  const mensagemWhatsApp = (d) => {
    const linhas = [
      'Olá! Vim pelo site e gostaria de um orçamento.',
      `Nome: ${d.nome}`,
      `Ambiente: ${d.ambiente}`,
    ];
    if (d.mensagem) linhas.push(`Detalhes: ${d.mensagem}`);
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(linhas.join('\n'))}`;
  };

  const validar = (d) => {
    const invalidos = [];
    if (d.nome.length < 2) invalidos.push('nome');
    const n = d.telefone.replace(/\D/g, '');
    if (n.length < 10 || n.length > 11) invalidos.push('telefone');
    if (!d.ambiente) invalidos.push('ambiente');
    return invalidos;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = {
      nome: form.elements.nome.value.trim(),
      telefone: tel.value.trim(),
      ambiente: form.elements.ambiente.value,
      mensagem: form.elements.mensagem.value.trim(),
      site: form.elements.site.value,
    };
    ['nome', 'telefone', 'ambiente'].forEach((n) => form.elements[n].removeAttribute('aria-invalid'));
    const invalidos = validar(d);
    if (invalidos.length) {
      invalidos.forEach((n) => form.elements[n].setAttribute('aria-invalid', 'true'));
      erro.textContent = 'Confira nome, WhatsApp com DDD e o ambiente desejado.';
      erro.hidden = false;
      form.elements[invalidos[0]].focus();
      return;
    }
    erro.hidden = true;
    botao.disabled = true;
    botao.querySelector('span').textContent = 'Enviando…';

    let link = mensagemWhatsApp(d);
    try {
      const r = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 422 || r.status === 429) {
        erro.textContent = j.erro || 'Não foi possível enviar agora. Tente pelo WhatsApp.';
        erro.hidden = false;
        botao.disabled = false;
        botao.querySelector('span').textContent = 'Pedir orçamento';
        return;
      }
      if (j.whatsapp) link = j.whatsapp;
    } catch (_) {
      /* sem servidor (hospedagem estática): o pedido segue pelo WhatsApp */
    }
    done.querySelector('[data-wa]').href = link;
    done.hidden = false;
    done.querySelector('[data-wa]').focus();
  });
})();
