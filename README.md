# Site — Marcenaria Trajano

Site institucional com formulário de orçamento. Node puro, sem dependências.

## Rodar

```bash
npm start
```

Abre em http://localhost:3000. Variáveis opcionais: `PORT` e `ADMIN_TOKEN`.

## Estrutura

- `public/index.html` — página (conteúdo, SEO, dados estruturados JSON-LD)
- `public/css/styles.css` — design system (tokens no `:root`) e layout
- `public/js/main.js` — navegação, animações de entrada, ampliar fotos, formulário
- `public/js/parallax.js` — parallax da hero e rolagem suave (GSAP ScrollTrigger + Lenis, em `public/js/vendor/`). Desligado para quem usa "reduzir movimento" no sistema; para pré-visualizar mesmo assim, abra com `?animacao=on`
- `public/img/` — fotos reais da empresa otimizadas em WebP
- `public/robots.txt`, `sitemap.xml`, `llms.txt` — buscadores e assistentes de IA
- `server.js` — arquivos estáticos + API
- `data/leads.jsonl` — pedidos de orçamento recebidos (um JSON por linha)

## API

- `POST /api/orcamento` — `{ nome, telefone, ambiente, mensagem }` → grava o pedido e devolve o link do WhatsApp com a mensagem pronta. Valida os campos, tem campo-isca contra robôs e limite de 5 pedidos por IP a cada 10 minutos.
- `GET /api/leads` — lista os pedidos. Só funciona com `ADMIN_TOKEN` definido, enviando `Authorization: Bearer <token>`.
- `GET /healthz` — verificação de saúde.

## Antes de publicar

1. Trocar `https://www.marcenariatrajano.com.br` pelo domínio real em `index.html`, `robots.txt`, `sitemap.xml` e `llms.txt`.
2. Conferir com a empresa os textos de processo, materiais e projeto 3D.
3. Cadastrar o site no Perfil da Empresa no Google e enviar o `sitemap.xml` no Search Console.

Sem servidor Node (hospedagem estática), basta publicar a pasta `public/`: o formulário continua funcionando e leva o pedido direto para o WhatsApp.
