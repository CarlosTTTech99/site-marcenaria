/**
 * Regras do pedido de orçamento, usadas pelo servidor Node (server.js) e pela função da Vercel
 * (api/orcamento.js), para os dois validarem exatamente igual.
 */
'use strict';

const WHATSAPP = '5515981421923';

const AMBIENTES = new Set([
  'Cozinha planejada',
  'Guarda-roupa ou closet',
  'Painel de TV / sala',
  'Dormitório / home office',
  'Móveis corporativos',
  'Outro ambiente',
]);

const limpar = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim().slice(0, max);

/**
 * Limpa e valida os dados do formulário.
 * Devolve { robo: true } quando o campo-isca veio preenchido, { erros } quando algum campo falhou,
 * ou { pedido, whatsapp } com o link do WhatsApp e a mensagem pronta.
 */
function validarPedido(dados) {
  /* campo-isca: robôs preenchem, pessoas não veem */
  if (limpar(dados.site, 200)) return { robo: true };

  const nome = limpar(dados.nome, 80);
  const telefone = limpar(dados.telefone, 20).replace(/\D/g, '');
  const ambiente = limpar(dados.ambiente, 40);
  const mensagem = limpar(dados.mensagem, 1000);

  const erros = {};
  if (nome.length < 2) erros.nome = 'Informe seu nome.';
  if (telefone.length < 10 || telefone.length > 11) erros.telefone = 'Informe o WhatsApp com DDD.';
  if (!AMBIENTES.has(ambiente)) erros.ambiente = 'Selecione o ambiente.';
  if (Object.keys(erros).length) return { erros };

  const texto = ['Olá! Vim pelo site e gostaria de um orçamento.', `Nome: ${nome}`, `Ambiente: ${ambiente}`];
  if (mensagem) texto.push(`Detalhes: ${mensagem}`);
  return {
    pedido: { nome, telefone, ambiente, mensagem },
    whatsapp: `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto.join('\n'))}`,
  };
}

/* limite simples por IP: 5 pedidos a cada 10 minutos */
function criarLimitador({ janela = 10 * 60_000, maximo = 5 } = {}) {
  const acessos = new Map();
  return function excedeuLimite(ip) {
    const agora = Date.now();
    const lista = (acessos.get(ip) || []).filter((t) => agora - t < janela);
    if (lista.length >= maximo) { acessos.set(ip, lista); return true; }
    lista.push(agora);
    acessos.set(ip, lista);
    /* limpeza de IPs antigos a cada uso, sem temporizador (a função da Vercel não mantém um) */
    if (acessos.size > 1000) {
      for (const [chave, horarios] of acessos) if (horarios.every((t) => agora - t >= janela)) acessos.delete(chave);
    }
    return false;
  };
}

module.exports = { validarPedido, criarLimitador };
