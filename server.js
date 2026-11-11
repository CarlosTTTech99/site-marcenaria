/**
 * Marcenaria Trajano — servidor do site
 * Node puro (sem dependências): arquivos estáticos + API de orçamento.
 *
 *   npm start                      → http://localhost:3000
 *   PORT=8080 npm start            → outra porta
 *   ADMIN_TOKEN=segredo npm start  → habilita GET /api/leads (Authorization: Bearer segredo)
 */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const PUBLIC = path.join(__dirname, 'public');
const DATA = path.join(__dirname, 'data');
const LEADS = path.join(DATA, 'leads.jsonl');
const WHATSAPP = '5515981421923';

const AMBIENTES = new Set([
  'Cozinha planejada',
  'Guarda-roupa ou closet',
  'Painel de TV / sala',
  'Dormitório / home office',
  'Móveis corporativos',
  'Outro ambiente',
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
const COMPRESSIVEL = new Set(['.html', '.css', '.js', '.json', '.xml', '.txt', '.svg']);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    'frame-src https://www.google.com',
    "connect-src 'self'",
    "form-action 'self'",
    "base-uri 'self'",
  ].join('; '),
};

/* ---------- utilidades ---------- */
function json(res, status, body) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function lerCorpo(req, limite = 10_000) {
  return new Promise((resolve, reject) => {
    let tamanho = 0;
    const partes = [];
    req.on('data', (c) => {
      tamanho += c.length;
      if (tamanho > limite) { reject(Object.assign(new Error('corpo grande demais'), { status: 413 })); req.destroy(); return; }
      partes.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(partes).toString('utf8')));
    req.on('error', reject);
  });
}

const limpar = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim().slice(0, max);

/* limite simples por IP: 5 pedidos a cada 10 minutos */
const JANELA = 10 * 60_000;
const MAXIMO = 5;
const acessos = new Map();
function excedeuLimite(ip) {
  const agora = Date.now();
  const lista = (acessos.get(ip) || []).filter((t) => agora - t < JANELA);
  if (lista.length >= MAXIMO) { acessos.set(ip, lista); return true; }
  lista.push(agora);
  acessos.set(ip, lista);
  return false;
}
setInterval(() => {
  const agora = Date.now();
  for (const [ip, lista] of acessos) if (lista.every((t) => agora - t >= JANELA)) acessos.delete(ip);
}, JANELA).unref();

/* ---------- API ---------- */
async function criarOrcamento(req, res) {
  const ip = req.socket.remoteAddress || 'desconhecido';
  if (excedeuLimite(ip)) return json(res, 429, { ok: false, erro: 'Muitos pedidos em sequência. Tente de novo em alguns minutos ou chame no WhatsApp.' });

  let dados;
  try {
    const bruto = await lerCorpo(req);
    const tipo = req.headers['content-type'] || '';
    dados = tipo.includes('application/json') ? JSON.parse(bruto) : Object.fromEntries(new URLSearchParams(bruto));
  } catch (e) {
    return json(res, e.status || 400, { ok: false, erro: 'Não foi possível ler o pedido.' });
  }

  /* campo-isca: robôs preenchem, pessoas não veem */
  if (limpar(dados.site, 200)) return json(res, 200, { ok: true });

  const nome = limpar(dados.nome, 80);
  const telefone = limpar(dados.telefone, 20).replace(/\D/g, '');
  const ambiente = limpar(dados.ambiente, 40);
  const mensagem = limpar(dados.mensagem, 1000);

  const erros = {};
  if (nome.length < 2) erros.nome = 'Informe seu nome.';
  if (telefone.length < 10 || telefone.length > 11) erros.telefone = 'Informe o WhatsApp com DDD.';
  if (!AMBIENTES.has(ambiente)) erros.ambiente = 'Selecione o ambiente.';
  if (Object.keys(erros).length) return json(res, 422, { ok: false, erro: 'Confira os campos destacados.', campos: erros });

  const lead = { id: crypto.randomUUID(), recebidoEm: new Date().toISOString(), nome, telefone, ambiente, mensagem };
  try {
    await fsp.mkdir(DATA, { recursive: true });
    await fsp.appendFile(LEADS, JSON.stringify(lead) + '\n', 'utf8');
  } catch (e) {
    console.error('[orcamento] falha ao gravar o pedido:', e.message);
    return json(res, 500, { ok: false, erro: 'Erro ao registrar o pedido.' });
  }
  console.log(`[orcamento] ${lead.recebidoEm} · ${ambiente}`);

  const texto = ['Olá! Vim pelo site e gostaria de um orçamento.', `Nome: ${nome}`, `Ambiente: ${ambiente}`];
  if (mensagem) texto.push(`Detalhes: ${mensagem}`);
  return json(res, 201, { ok: true, id: lead.id, whatsapp: `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto.join('\n'))}` });
}

async function listarLeads(req, res) {
  if (!ADMIN_TOKEN) return json(res, 404, { ok: false });
  const recebido = Buffer.from((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  const esperado = Buffer.from(ADMIN_TOKEN);
  if (recebido.length !== esperado.length || !crypto.timingSafeEqual(recebido, esperado)) return json(res, 401, { ok: false });
  let linhas = [];
  try { linhas = (await fsp.readFile(LEADS, 'utf8')).split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { /* ainda sem pedidos */ }
  return json(res, 200, { ok: true, total: linhas.length, leads: linhas.reverse() });
}

/* ---------- arquivos estáticos ---------- */
async function servirArquivo(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { rel = '/'; }
  if (rel.endsWith('/')) rel += 'index.html';
  const arquivo = path.normalize(path.join(PUBLIC, rel));
  if (arquivo !== PUBLIC && !arquivo.startsWith(PUBLIC + path.sep)) return naoEncontrado(res);

  let info;
  try { info = await fsp.stat(arquivo); } catch { return naoEncontrado(res); }
  if (!info.isFile()) return naoEncontrado(res);

  const ext = path.extname(arquivo).toLowerCase();
  const etag = `W/"${info.size.toString(16)}-${Math.round(info.mtimeMs).toString(16)}"`;
  const cabecalhos = {
    ...SECURITY_HEADERS,
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'ETag': etag,
    /* imagens ficam 30 dias em cache; o resto é revalidado por ETag, então edições aparecem na hora */
    'Cache-Control': rel.startsWith('/img/') || rel.startsWith('/video/') ? 'public, max-age=2592000' : 'no-cache',
  };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, cabecalhos); return res.end(); }

  /* pedidos parciais: navegadores (o Safari em especial) buscam vídeo em pedaços */
  const faixa = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (faixa && !COMPRESSIVEL.has(ext) && (faixa[1] || faixa[2])) {
    let inicio = faixa[1] ? Number(faixa[1]) : Math.max(0, info.size - Number(faixa[2]));
    let fim = faixa[1] && faixa[2] ? Math.min(Number(faixa[2]), info.size - 1) : info.size - 1;
    if (inicio > fim || inicio >= info.size) {
      res.writeHead(416, { ...cabecalhos, 'Content-Range': `bytes */${info.size}` });
      return res.end();
    }
    res.writeHead(206, { ...cabecalhos, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${inicio}-${fim}/${info.size}`, 'Content-Length': fim - inicio + 1 });
    if (req.method === 'HEAD') return res.end();
    const pedaco = fs.createReadStream(arquivo, { start: inicio, end: fim });
    pedaco.on('error', () => res.destroy());
    return pedaco.pipe(res);
  }

  const aceita = req.headers['accept-encoding'] || '';
  const fluxo = fs.createReadStream(arquivo);
  fluxo.on('error', () => res.destroy());
  if (COMPRESSIVEL.has(ext) && /\bbr\b/.test(aceita)) {
    res.writeHead(200, { ...cabecalhos, 'Content-Encoding': 'br', 'Vary': 'Accept-Encoding' });
    if (req.method === 'HEAD') return res.end();
    return fluxo.pipe(zlib.createBrotliCompress()).pipe(res);
  }
  if (COMPRESSIVEL.has(ext) && /\bgzip\b/.test(aceita)) {
    res.writeHead(200, { ...cabecalhos, 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding' });
    if (req.method === 'HEAD') return res.end();
    return fluxo.pipe(zlib.createGzip()).pipe(res);
  }
  res.writeHead(200, { ...cabecalhos, 'Accept-Ranges': 'bytes', 'Content-Length': info.size });
  if (req.method === 'HEAD') { fluxo.destroy(); return res.end(); }
  return fluxo.pipe(res);
}

function naoEncontrado(res) {
  res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': MIME['.html'] });
  res.end('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Página não encontrada · Marcenaria Trajano</title><body style="font-family:Georgia,serif;background:#e9e2d8;color:#3a312a;display:grid;place-content:center;min-height:100vh;text-align:center"><h1 style="font-weight:400">Página não encontrada</h1><p><a href="/" style="color:inherit">Voltar para o início</a></p></body></html>');
}

/* ---------- roteador ---------- */
const servidor = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/api/orcamento') {
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { ok: false }); }
      return await criarOrcamento(req, res);
    }
    if (pathname === '/api/leads' && req.method === 'GET') return await listarLeads(req, res);
    if (pathname === '/healthz') return json(res, 200, { ok: true });
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); return json(res, 405, { ok: false }); }
    return await servirArquivo(req, res, pathname);
  } catch (e) {
    console.error('[servidor]', e);
    if (!res.headersSent) json(res, 500, { ok: false });
    else res.destroy();
  }
});

servidor.listen(PORT, () => console.log(`Marcenaria Trajano no ar: http://localhost:${PORT}`));
