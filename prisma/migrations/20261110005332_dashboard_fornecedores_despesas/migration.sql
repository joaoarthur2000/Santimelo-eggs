-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "contato" TEXT,
    "produtos" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Despesa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dia" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "valor" REAL NOT NULL,
    "formaPagamento" TEXT,
    "autor" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MovimentoEstoque" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "data" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "quantidade" REAL NOT NULL,
    "custoUnit" REAL,
    "origem" TEXT,
    "fornecedor" TEXT,
    "fornecedorId" TEXT,
    "pedidoId" INTEGER,
    "observacao" TEXT,
    "autor" TEXT NOT NULL,
    CONSTRAINT "MovimentoEstoque_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovimentoEstoque_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MovimentoEstoque_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MovimentoEstoque" ("autor", "custoUnit", "data", "fornecedor", "id", "itemId", "observacao", "origem", "pedidoId", "quantidade", "tipo") SELECT "autor", "custoUnit", "data", "fornecedor", "id", "itemId", "observacao", "origem", "pedidoId", "quantidade", "tipo" FROM "MovimentoEstoque";
DROP TABLE "MovimentoEstoque";
ALTER TABLE "new_MovimentoEstoque" RENAME TO "MovimentoEstoque";
CREATE INDEX "MovimentoEstoque_data_idx" ON "MovimentoEstoque"("data");
CREATE INDEX "MovimentoEstoque_itemId_data_idx" ON "MovimentoEstoque"("itemId", "data");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Fornecedor_nome_key" ON "Fornecedor"("nome");

-- CreateIndex
CREATE INDEX "Despesa_dia_idx" ON "Despesa"("dia");
