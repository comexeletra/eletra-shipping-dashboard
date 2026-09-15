# Eletra Shipping Dashboard

Dashboard COMEX migrado para React + TypeScript + Vite. O frontend é uma SPA estática, pronta para Cloudflare Pages.

## Desenvolvimento

Requer Node.js 20.19 ou superior.

```sh
npm install
cp .env.example .env
npm run dev
```

`VITE_FUP_SHEET_URL` é opcional. Quando definido com uma URL CSV publicada do Google Sheets, a tela FUP faz a carga inicial dessa fonte. Valores com prefixo `VITE_` são públicos no bundle; nunca coloque segredos no `.env` do frontend.

## Validação

```sh
npm run check
npm run audit:production
```

## Cloudflare Pages

Use as configurações abaixo no projeto Pages:

| Campo | Valor |
| --- | --- |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js | `20.19` ou superior |

O build só publica `dist/`. Os HTMLs legados e a planilha `.xlsx` da raiz não são enviados para o Cloudflare.

## Segurança e evolução

- Não há senha administrativa nem configuração OAuth embutida no novo frontend.
- Dados importados ficam apenas na memória do navegador; não são persistidos em `localStorage`.
- `_headers` aplica CSP, proteção contra clickjacking e políticas de navegador no Cloudflare.
- Arquivos locais aceitos são `.xlsx`, `.xls` e `.csv`, até 15 MB; fontes remotas aceitam somente CSV publicado por Google Sheets, via HTTPS, até 10 MB e com tempo limite de 15 segundos.
- A importação limita a 10.000 registros, 150 colunas e 5.000 caracteres por célula para preservar a responsividade.
- A leitura de planilhas usa SheetJS 0.20.3, distribuído pelo fornecedor; o pacote `xlsx` no npm está desatualizado na versão 0.18.5. A atualização elimina as vulnerabilidades identificadas pela auditoria.
- Para dados não públicos, implemente uma API em Cloudflare Workers com Cloudflare Access e guarde credenciais em Secrets. Um frontend React, por si só, não protege dados nem segredos.
