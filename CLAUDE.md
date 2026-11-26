@AGENTS.md

# EGGS by Santimelo

App de pedidos de ovos dos clientes da Santimelo (`/eggs`, instala no celular) + painel da equipe (`/painel`). Saiu do sistema da Suprema em 2026-11-02: banco, login e repositório próprios.

Next.js 16 (App Router, Turbopack) + Prisma 6 + Tailwind 4. SQLite local em `prisma/dev.db`; Postgres na nuvem depois. Comandos, logins de exemplo e telas: `README.md`.

## Comandos

- Porta **3001** (`dev`, `start`, `local`). A 3000 é do sistema da Suprema, que roda no mesmo PC.
- `npm run dev`: o `predev` (`scripts/preparar-banco.mjs`) aplica as migrações e roda o seed antes de subir.
- `npx tsc --noEmit` e `npm run lint`: rodar os dois antes de dar algo por pronto. Sem `.next/`, rodar `npx next typegen` antes do tsc (gera `PageProps`/`LayoutProps`).
- `npm run build`: pega erros que só aparecem no build de rota.
- Mudou o schema? Rodar `npx prisma migrate dev --name <nome>`. Vindo de agente, ele pode recusar por não ser interativo: gerar o SQL com `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` numa pasta nova em `prisma/migrations/` e aplicar com `prisma migrate deploy`.
- No Windows, `prisma generate` falha com EPERM e o banco não apaga se o servidor estiver rodando: parar o servidor antes.
- `db:reset` apaga o banco. Pedir consentimento antes.

## Arquitetura

- **Sem API REST.** Leitura direto no Prisma em Server Components; escrita por Server Actions (`actions.ts` ao lado de cada rota). Toda action começa com `exigirPapel(...)` ou `exigirCliente()` de `src/lib/sessao.ts`.
- **Login próprio.** Cookie HMAC `eggs_sessao` assinado com `SESSION_SECRET`, senha com scrypt. O nome do cookie é diferente do da Suprema de propósito: cookie não separa porta, e com o mesmo nome um login derrubava o outro.
  - `DIRETOR`: painel. `CLIENTE`: só o app, com `Usuario.clienteId` apontando pro `Cliente`.
  - Cliente entra com `Usuario.codigoAcesso` (EGG-XXXX) + senha; o `email` dele é interno (`<codigo>@eggs.app`). 5 erros travam 15 min.
  - O cookie só é `secure` em https (`x-forwarded-proto`): no PC é http pelo IP da rede, e o iPhone recusaria cookie secure.
- **`cacheComponents` desligado** em `next.config.ts`: tudo é dinâmico, atrás de login.
- **Catálogo:** `Item` (tipo de ovo, código fixo "1".."4") → `Produto` (caixa ou bandeja, preço). Estoque contado em caixas de 360 ovos; `Produto.fatorEstoque` é quanto 1 unidade vendida consome (bandeja de 30 = 1/12).
- **Pedido:** origem `APP` (feito no app, com `janelaId`), `WHATSAPP` ou `PAINEL` (lançado pela equipe). Preço sempre lido do banco na action: o combinado com o cliente (`PrecoCliente`) ou o de tabela.
- **Pagamento do pedido** (`src/lib/pagamento.ts`): `Pedido.formaPagamento` (Dinheiro/Pix), `condicaoPagamento` (VISTA/PRAZO) e `vencimento` são a escolha do lançamento; nulos (app ou pedido antigo) = combinado no cadastro. Ler sempre por `pagamentoDoPedido()`/`vencimentoDoPedido()`, nunca direto do cliente. Escolha na tela: `components/escolha-pagamento.tsx`.
- **Cadastro de cliente nunca trava por falta de dado** (pedido do dono): só o nome é preciso. Texto entra como foi digitado; o que parece errado vira aviso amarelo (`avisosDoCadastro`), número ilegível fica de fora. O que falta aparece em `faltaNoCadastro`.
- **Formulários**: usar `useFormulario` (`components/formulario.ts`) com `onSubmit`, não `<form action>` com `useActionState`: o React 19 limpa os campos depois da action, mesmo no erro. A action devolve `errosDoForm(r.error)` (`lib/erros.ts`) e o hook marca só os campos errados. `limpar: true` em lançamento em série.
- **Completar cadastros** (`/painel/clientes/completar`): busca em lote por nome, link do Maps ou CNPJ (`buscarCadastro`), confere e salva só o que foi preenchido (`completarCadastro`), com posição e região pelo bairro. Só nome que parece estabelecimento vem marcado: nome de pessoa não sai pra fora sem o dono marcar. Com `GOOGLE_PLACES_API_KEY` usa o Google; sem ela, OpenStreetMap. Na ficha, `PreencherPeloGoogle` faz o mesmo pra um cliente. Testar com os serviços externos simulados.
- **Dia a dia** (`/painel/dia?dia=`): vendas (pela entrega) e compras de um dia, com edição e lançamento retroativo. Novo e editar pedido usam o mesmo `pedidos/novo/form-pedido.tsx` (dados de `pedidos/dados-form.ts`). `editarPedido` refaz itens, estoque e cobrança; pedido pago não muda valor nem cliente (desfazer o pagamento antes). `criarPedido` aceita `entregue`/`recebido` só pra dia até hoje e não avisa o app do cliente. Compra: `FormCompra` lança e edita (`editarCompra`), na janela `fornecedores/janela-compra.tsx`.
- **Regras do app** em `src/lib/eggs.ts`:
  - `sincronizarCobranca` roda em toda criação ou mudança de status de pedido;
  - aviso de pagamento (`gerarAvisosDePagamento`) e preço agendado (`aplicarPrecosAgendados`) rodam quando as páginas abrem: não há tarefa agendada;
  - pedido e cancelamento viram comanda no grupo de WhatsApp EGGS-ADM (`src/lib/whatsapp.ts`, Z-API ou Evolution, vars `WHATSAPP_*`). Sem as vars nada é enviado e a aba Aplicativo mostra a comanda pra copiar.
- **Estoque** (`src/lib/estoque.ts`): extrato `MovimentoEstoque` com sinal. A venda baixa via `sincronizarBaixaDoPedido`, chamada em toda mudança de status (pode repetir sem duplicar). Custo = custo médio ponderado das compras até a data.
- **Relatórios** (`src/lib/relatorio.ts`, `/painel/relatorios`): diário, semanal e mensal, pela data de entrega, pedidos não cancelados.
  - Custo de um item = caixas equivalentes × custo médio da caixa até o fim do período. Venda sem compra lançada vai pra `semCusto` e fica fora do lucro.
  - Comparação: o dia compara com o mesmo dia da semana passada (entrega depende do dia da semana); semana e mês com o anterior.
- **Configuracao** guarda manutenção e novidades do app (`src/lib/config.ts`). A versão é o `.next/BUILD_ID`, que o app consulta em `/eggs/versao`. O link e o QR do app vêm de `linkDoApp()` (`APP_URL` ou o IP da rede, porta 3001).
- **Prospecção** (`src/lib/prospeccao.ts`, `/painel/prospeccao`, tabela `Lead`): busca no Google Places API (New) com `GOOGLE_PLACES_API_KEY`, regiões e filtros no próprio arquivo, CNPJ/porte pela BrasilAPI. Sem `server-only` de propósito: o bot (`../prospeccao-bot`) usa pela linha de comando `npx tsx scripts/prospeccao.ts`. Status em `STATUS_LEAD` (lá, não em constantes.ts).
- **Campos de status/tipo são `String`.** Os valores válidos ficam em `src/lib/constantes.ts`.
- **Datas sempre no fuso de Porto Alegre** via `src/lib/datas.ts`. Formatadores `Intl` criados uma vez só (criar por chamada deixava páginas lentíssimas).

## Convenções

- Código, nomes e textos em português. Todo texto pro cliente fala "Santimelo".
- Classes próprias em `globals.css`: `.campo`, `.botao-primario`, `.botao-secundario`, `.cartao`, `.etiqueta`, `.tabular`.
- Cores: painel em `marca-*` (tons de casca, marrom); app em `gema`/`casca`/`tomate` com fonte `font-eggs` (Bricolage, carregada no layout raiz).
- **Gráficos** (Recharts): `grafico-vendas.tsx` (custo + lucro empilhados = faturamento), `grafico-barras.tsx`, `grafico-linhas.tsx`.
  - Cores em `src/lib/cores.ts`, nunca no componente (valor exportado de arquivo `"use client"` chega vazio no servidor).
  - Custo laranja `#eb6834`, lucro azul `#2a78d6`: validados pra daltonismo. Laranja × verde reprovou (ΔE 4,6), não usar verde pro lucro.
  - Todo gráfico vem com legenda e tabela dos números.
- Grids com filhos que podem estourar levam `[&>*]:min-w-0` (sem isso ganha rolagem horizontal no celular).

## Painel no celular (iPhone, tela inicial)

- Abaixo de 1024px o painel vira app: `TopoCelular` (título, voltar, atualizar, puxar pra atualizar) e `AbasCelular` (barra de abas, "+" com os lançamentos, "Mais") em `src/app/painel/barra-celular.tsx`. Os itens do menu ficam em `itens-nav.ts` (um lugar só pro computador e pro celular). Acima disso, o menu lateral de sempre: **nenhuma mudança de celular pode alterar o computador** (usar `max-lg:`/`lg:hidden` ou o bloco do celular em `globals.css`).
- Instalação: `src/lib/app-painel.ts` (metadados, usado no painel e no login), `src/app/app-painel/manifest.webmanifest`, arte em `public/app-painel/` gerada por `scripts/gerar-icone-painel.mjs` (inverso do ícone do EGGS). Trocou a arte: subir `VERSAO_ICONE`. Escopo do manifest é `/` de propósito (o login fica em `/login`).
- Tabela no celular: `className="lista-cel"` na tabela e `data-c` nos `td`: `t` título, `v` valor, `s` apoio, `l` apoio à direita, `p` linha "rótulo … valor" (com `data-r`), `a` ação, `x` escondido. Link da linha inteira: `linha-toque`.
- Componentes: `Folha` (sobe do rodapé, fecha arrastando), `Recolhe` (bloco longo atrás de um botão; `#id` na URL já abre), `BotaoConfirma` (no dedo pede segundo toque: dinheiro e estoque; dois formulários no mesmo lugar da tela precisam de `key` diferente, senão o "armado" passa de um pro outro), `BuscaLista` (filtra linhas `data-busca` por CSS), `AcoesContato` (WhatsApp, ligar, rota), `.acao-fixa` (próximo passo fixo acima da barra), `.trilho`, `.toque`.
- Regras: campo com 16px (menos que isso o iPhone dá zoom), alvo de 44px, nada abaixo de 13px, sem rótulo miúdo em caixa alta.
- Gráficos: importar de `@/components/graficos` (entram depois da tela, um por vez e nunca durante a rolagem), nunca direto de `grafico-*.tsx`.
- Endereço: `linkDoPainel()` usa o nome do PC na rede (`<nome>.local:3001`), que não muda com o IP. QR em Painel → Aplicativo.

## Guinho (mascote)

- Estilo cartoon retrô (anos 30, braços de mangueira, luvas, olhos recortados), só com as cores oficiais da Santimelo (manual em `../ident.visual/`). Boné verde Folha Fresca com o símbolo da Santimelo.
- Arte gerada por código: `../Logo/eggs/guinho/gerar-guinho.mjs` grava os SVGs ali e os PNGs (480 × 528) em `public/eggs/guinho/`. Ajustar o Guinho = editar o gerador e rodar de novo. Versão antiga em `../Logo/eggs/guinho/v1-antigo/`.
- Componentes `Guinho`, `TituloEggs` e `POSES_GUINHO` em `src/app/eggs/guinho.tsx`. Na aba Início, `GuinhoAnimado` (`(app)/guinho-animado.tsx`): ginga parado e, a cada toque, pula e troca de pose. Só CSS (`eggs-ginga`, `eggs-pulo` em `globals.css`), sem three.js.

## Ícone do app (tela do celular)

- Símbolo da Santimelo (o "e" em forma de ovo) em Terra Fértil sobre Gema de Ovo: `public/eggs/icone.svg`, `icone-192.png`, `icone-512.png` (Android, maskable) e `apple-touch-icon.png` (iPhone). O símbolo ocupa 58% da altura pra caber na área segura do Android.
- Ao trocar a arte, subir o `?v=` em `manifest.webmanifest/route.ts`, `eggs/layout.tsx` e `marca-eggs.tsx`: senão o celular mostra o ícone guardado. Quem já instalou precisa remover e adicionar de novo.
- A faixa marrom (`Faixa` em `enfeites.tsx`) corre SEMPRE, inclusive com "reduzir movimento": pedido do dono.
