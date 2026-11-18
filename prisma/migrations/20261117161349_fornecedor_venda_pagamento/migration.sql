-- CreateTable
CREATE TABLE "PagamentoFornecedor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fornecedorId" TEXT NOT NULL,
    "dia" TEXT NOT NULL,
    "valor" REAL NOT NULL,
    "observacao" TEXT,
    "autor" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PagamentoFornecedor_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PedidoItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pedidoId" INTEGER NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" REAL NOT NULL,
    "precoUnit" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    "fornecedorId" TEXT,
    CONSTRAINT "PedidoItem_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PedidoItem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PedidoItem_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PedidoItem" ("id", "pedidoId", "precoUnit", "produtoId", "quantidade", "subtotal") SELECT "id", "pedidoId", "precoUnit", "produtoId", "quantidade", "subtotal" FROM "PedidoItem";
DROP TABLE "PedidoItem";
ALTER TABLE "new_PedidoItem" RENAME TO "PedidoItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PagamentoFornecedor_fornecedorId_idx" ON "PagamentoFornecedor"("fornecedorId");
