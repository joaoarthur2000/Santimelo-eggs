-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clienteId" TEXT,
    "codigoAcesso" TEXT,
    "falhas" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoAte" DATETIME,
    "ultimoAcesso" DATETIME,
    CONSTRAINT "Usuario_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT,
    "nome" TEXT NOT NULL,
    "unidadeEstoque" TEXT NOT NULL DEFAULT 'caixa',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Produto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT,
    "itemId" TEXT NOT NULL,
    "embalagem" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "fatorEstoque" REAL,
    "preco" REAL NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Produto_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HistoricoPreco" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "produtoId" TEXT NOT NULL,
    "preco" REAL NOT NULL,
    "em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origem" TEXT NOT NULL,
    "autor" TEXT,
    CONSTRAINT "HistoricoPreco_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT NOT NULL,
    "cnpj" TEXT,
    "tipoNegocio" TEXT NOT NULL,
    "endereco" TEXT,
    "cep" TEXT,
    "responsavel" TEXT,
    "email" TEXT,
    "whatsapp" TEXT,
    "formaPagamento" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumoSemanal" REAL,
    "limiteCredito" REAL,
    "prazoPagamentoDias" INTEGER,
    "negociacao" TEXT,
    "regiaoId" TEXT,
    CONSTRAINT "Cliente_regiaoId_fkey" FOREIGN KEY ("regiaoId") REFERENCES "Regiao" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Regiao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "bairros" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "JanelaEntrega" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "regiaoId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "inicio" TEXT NOT NULL,
    "fim" TEXT NOT NULL,
    "capacidade" INTEGER NOT NULL DEFAULT 6,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "JanelaEntrega_regiaoId_fkey" FOREIGN KEY ("regiaoId") REFERENCES "Regiao" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PrecoCliente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "preco" REAL NOT NULL,
    CONSTRAINT "PrecoCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PrecoCliente_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PrecoAgendado" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "produtoId" TEXT NOT NULL,
    "preco" REAL NOT NULL,
    "aPartirDe" TEXT NOT NULL,
    "aplicadoEm" DATETIME,
    "autor" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrecoAgendado_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cobranca" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "pedidoId" INTEGER,
    "valor" REAL NOT NULL,
    "vencimento" TEXT NOT NULL,
    "pagoEm" DATETIME,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cobranca_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Cobranca_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Mensagem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "chave" TEXT,
    "autor" TEXT NOT NULL,
    "criadaEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lidaEm" DATETIME,
    CONSTRAINT "Mensagem_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clienteId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOVO',
    "origem" TEXT NOT NULL DEFAULT 'APP',
    "dataEntrega" DATETIME NOT NULL,
    "observacao" TEXT,
    "total" REAL NOT NULL DEFAULT 0,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "janelaId" TEXT,
    CONSTRAINT "Pedido_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Pedido_janelaId_fkey" FOREIGN KEY ("janelaId") REFERENCES "JanelaEntrega" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PedidoItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pedidoId" INTEGER NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" REAL NOT NULL,
    "precoUnit" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    CONSTRAINT "PedidoItem_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PedidoItem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MovimentoEstoque" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "data" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "quantidade" REAL NOT NULL,
    "custoUnit" REAL,
    "origem" TEXT,
    "fornecedor" TEXT,
    "pedidoId" INTEGER,
    "observacao" TEXT,
    "autor" TEXT NOT NULL,
    CONSTRAINT "MovimentoEstoque_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovimentoEstoque_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Configuracao" (
    "chave" TEXT NOT NULL PRIMARY KEY,
    "valor" TEXT NOT NULL,
    "alterado" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_clienteId_key" ON "Usuario"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_codigoAcesso_key" ON "Usuario"("codigoAcesso");

-- CreateIndex
CREATE UNIQUE INDEX "Item_codigo_key" ON "Item"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Item_nome_key" ON "Item"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_codigo_key" ON "Produto"("codigo");

-- CreateIndex
CREATE INDEX "HistoricoPreco_produtoId_em_idx" ON "HistoricoPreco"("produtoId", "em");

-- CreateIndex
CREATE UNIQUE INDEX "Regiao_nome_key" ON "Regiao"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "JanelaEntrega_regiaoId_diaSemana_inicio_key" ON "JanelaEntrega"("regiaoId", "diaSemana", "inicio");

-- CreateIndex
CREATE UNIQUE INDEX "PrecoCliente_clienteId_produtoId_key" ON "PrecoCliente"("clienteId", "produtoId");

-- CreateIndex
CREATE INDEX "PrecoAgendado_aPartirDe_idx" ON "PrecoAgendado"("aPartirDe");

-- CreateIndex
CREATE UNIQUE INDEX "Cobranca_pedidoId_key" ON "Cobranca"("pedidoId");

-- CreateIndex
CREATE INDEX "Cobranca_vencimento_idx" ON "Cobranca"("vencimento");

-- CreateIndex
CREATE UNIQUE INDEX "Mensagem_chave_key" ON "Mensagem"("chave");

-- CreateIndex
CREATE INDEX "Mensagem_clienteId_criadaEm_idx" ON "Mensagem"("clienteId", "criadaEm");

-- CreateIndex
CREATE INDEX "Pedido_dataEntrega_idx" ON "Pedido"("dataEntrega");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_data_idx" ON "MovimentoEstoque"("data");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_itemId_data_idx" ON "MovimentoEstoque"("itemId", "data");
