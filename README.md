# EGGS by Santimelo

Logística de ovos da Santimelo em um sistema só:
- **App EGGS** (`/eggs`): os clientes (padarias, confeitarias, restaurantes) pedem ovos pelo celular, escolhem dia e horário de entrega, veem preços, pagamentos e mensagens.
- **Painel da equipe** (`/painel`): pedidos, clientes, preços, entregas, cobranças, estoque, aplicativo e **relatórios de vendas** (diário, semanal e mensal).

## Rodar no computador

Precisa do Node 20 ou mais novo. Roda na porta **3001** (a 3000 é do sistema da Suprema).

**Pra usar no dia a dia:** dois cliques em `Iniciar EGGS.bat`. Ele instala o que faltar, prepara o banco, gera a versão rápida e abre http://localhost:3001/painel. Pra parar, feche a janela preta.

**Pra desenvolver:**

```bash
npm install
npm run dev
```

Na primeira vez, os dois criam o `.env` (com uma chave de sessão nova) e o banco local (`prisma/dev.db`) com os produtos reais e dados de exemplo.

### Acessos de exemplo

| Quem | Entra com | Senha | Vai pra |
|---|---|---|---|
| João Arthur (equipe) | joao@santimelo.local | `senha123` | Painel |
| Padaria Pão Quente | EGG-PADR | `ovos123` | App |
| Confeitaria Doce Gema | EGG-DCGM | `ovos123` | App |
| Smash Burger POA | EGG-SMSH | `ovos123` | App |
| Bella Massa Restaurante | EGG-BELL | `ovos123` | App |

Trocar as senhas antes de colocar na nuvem.

## Painel

- **Início:** entregas de hoje e amanhã, caixas em estoque (e pra quantos dias dá), quanto há a receber, faturamento e lucro do mês, caixas que entraram × saíram, valor da caixa (custo × venda), margem de cada produto e o formulário de compra/perda/contagem.
- **Relatórios:** diário, semanal ou mensal, com setas, data e botão de imprimir/PDF:
  - faturamento, custo dos ovos, lucro, margem, caixas vendidas e pedidos, cada um comparado com o período anterior (o dia compara com o mesmo dia da semana passada);
  - destaque do melhor dia e do produto que mais deu lucro;
  - gráfico dia a dia com custo + lucro empilhados (a barra inteira é o faturamento);
  - lucro por produto e tabela com quantidade, custo unitário, faturamento, custo, lucro e margem de cada produto;
  - quem mais comprou e as compras de ovos do período.
- **Pedidos:** por dia de entrega, com a lista do que separar. "Novo pedido" lança um pedido que chegou por WhatsApp ou telefone, já com o preço combinado do cliente.
- **Clientes:** cadastro, acesso ao app (gera código `EGG-XXXX` e senha, com mensagem pronta pro WhatsApp), negociação, preço combinado, mensagens, destravar e senha nova.
- **Preços:** preço de cada produto e mudança agendada (o cliente vê antes de valer).
- **Entregas:** regiões, dias, horários e vagas.
- **Cobranças:** em aberto, vencidas e marcar pago.
- **Estoque:** saldo por tipo de ovo, custo médio, valor, quantos dias dura e o extrato.
- **Aplicativo:** QR code do app, versão e novidades, aviso pra todos, modo manutenção, quem está usando e o grupo de WhatsApp EGGS-ADM.

## App (cliente)

- **Início:** mensagens, próxima entrega, próximo pagamento e preço da caixa hoje.
- **Pedir:** ovos, dia e horário com vagas da região; botão verde "Fazer pedido" leva ao passo que falta.
- **Pedido feito:** "Parabéns pela compra", data combinada e frete grátis; a comanda vai pro grupo EGGS-ADM.
- **Pedidos, Preços, Agenda e Conta.**
- **Instalar no celular:** botão "Instalar" (iPhone: Compartilhar → Adicionar à Tela de Início; Android: Instalar app).
- **Rodando no PC:** o celular precisa estar no mesmo Wi-Fi e o Windows precisa deixar o Node.js receber conexões (rede "Privada" e Node permitido no Firewall). Endereço: `http://<IP do PC>:3001/eggs`.

## Grupo de WhatsApp EGGS-ADM

Pedido e cancelamento do app viram comanda no grupo. Precisa de um número robô (chip separado) num provedor (Z-API ou Evolution API), dentro do grupo, e das variáveis `WHATSAPP_*` no `.env` (ver `.env.example`). Sem isso nada é enviado: a aba Aplicativo mostra a comanda do último pedido com botão de copiar.

## Custo e lucro

- Toda compra de ovos é lançada no estoque com o custo por caixa (Início ou Estoque). O custo de cada venda é caixas × custo médio das compras até aquela data.
- Venda de um tipo de ovo que nunca teve compra lançada aparece como "sem custo" e fica fora do lucro (o relatório avisa).

## Comandos

| Comando | O que faz |
|---|---|
| `npm run local` | Prepara o banco, gera o build e sobe a versão rápida (é o que o `Iniciar EGGS.bat` roda) |
| `npm run dev` | Prepara o banco e sobe o servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run lint` | ESLint |
| `npm run db:seed` | Carrega os dados de exemplo nas tabelas que estiverem vazias |
| `npm run db:reset` | **Apaga o banco** e recria com os dados de exemplo |
| `npm run db:studio` | Abre o Prisma Studio pra ver e editar o banco |

## Ir pra nuvem (próximo passo)

1. Criar um banco Postgres (Neon, Supabase ou similar).
2. Em `prisma/schema.prisma`, trocar `provider = "sqlite"` por `"postgresql"`, apontar o `DATABASE_URL` pro banco novo e rodar `npx prisma migrate dev`.
3. Publicar (Vercel ou similar) com `DATABASE_URL` e `SESSION_SECRET` configurados.
4. Configurar `APP_URL` (ex: `https://eggs.santimelo.com.br`): o QR code e as mensagens de acesso passam a usar esse endereço.
5. Trocar as senhas de exemplo.
