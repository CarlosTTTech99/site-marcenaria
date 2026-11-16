/**
 * Formulário de orçamento na Vercel (POST /api/orcamento).
 *
 * Usa as mesmas regras do servidor Node (lib/orcamento.js). A Vercel não tem disco gravável, então o
 * pedido não fica salvo em arquivo: vai para o registro da função (Runtime Logs) e o cliente segue
 * para o WhatsApp com a mensagem pronta, que é por onde o orçamento chega à marcenaria.
 *
 * O limite de pedidos vale por instância da função, não para a Vercel inteira.
 */
'use strict';

const crypto = require('node:crypto');
const { validarPedido, criarLimitador } = require('../lib/orcamento');

const excedeuLimite = criarLimitador();

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'desconhecido';
  if (excedeuLimite(ip)) {
    return res.status(429).json({ ok: false, erro: 'Muitos pedidos em sequência. Tente de novo em alguns minutos ou chame no WhatsApp.' });
  }

  let dados;
  try {
    /* a Vercel já interpreta JSON e formulário; corpo malformado dispara erro ao ler req.body */
    dados = req.body;
    if (typeof dados === 'string') dados = Object.fromEntries(new URLSearchParams(dados));
  } catch {
    return res.status(400).json({ ok: false, erro: 'Não foi possível ler o pedido.' });
  }
  if (!dados || typeof dados !== 'object') {
    return res.status(400).json({ ok: false, erro: 'Não foi possível ler o pedido.' });
  }

  const r = validarPedido(dados);
  if (r.robo) return res.status(200).json({ ok: true });
  if (r.erros) return res.status(422).json({ ok: false, erro: 'Confira os campos destacados.', campos: r.erros });

  const id = crypto.randomUUID();
  console.log(`[orcamento] ${new Date().toISOString()} · ${r.pedido.ambiente} · ${id}`);
  return res.status(201).json({ ok: true, id, whatsapp: r.whatsapp });
};
