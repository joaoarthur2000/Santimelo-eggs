-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Cliente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT NOT NULL,
    "cnpj" TEXT,
    "tipoNegocio" TEXT NOT NULL,
    "endereco" TEXT,
    "bairro" TEXT,
    "cidade" TEXT DEFAULT 'Porto Alegre',
    "cep" TEXT,
    "responsavel" TEXT,
    "email" TEXT,
    "whatsapp" TEXT,
    "formaPagamento" TEXT,
    "notaFiscal" BOOLEAN NOT NULL DEFAULT false,
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
INSERT INTO "new_Cliente" ("ativo", "cep", "cnpj", "consumoSemanal", "criadoEm", "email", "endereco", "formaPagamento", "id", "limiteCredito", "negociacao", "nomeFantasia", "observacoes", "prazoPagamentoDias", "razaoSocial", "regiaoId", "responsavel", "tipoNegocio", "whatsapp") SELECT "ativo", "cep", "cnpj", "consumoSemanal", "criadoEm", "email", "endereco", "formaPagamento", "id", "limiteCredito", "negociacao", "nomeFantasia", "observacoes", "prazoPagamentoDias", "razaoSocial", "regiaoId", "responsavel", "tipoNegocio", "whatsapp" FROM "Cliente";
DROP TABLE "Cliente";
ALTER TABLE "new_Cliente" RENAME TO "Cliente";
CREATE TABLE "new_Pedido" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clienteId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOVO',
    "origem" TEXT NOT NULL DEFAULT 'APP',
    "dataEntrega" DATETIME NOT NULL,
    "observacao" TEXT,
    "total" REAL NOT NULL DEFAULT 0,
    "notaFiscal" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "janelaId" TEXT,
    CONSTRAINT "Pedido_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Pedido_janelaId_fkey" FOREIGN KEY ("janelaId") REFERENCES "JanelaEntrega" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Pedido" ("clienteId", "criadoEm", "dataEntrega", "id", "janelaId", "observacao", "origem", "status", "total") SELECT "clienteId", "criadoEm", "dataEntrega", "id", "janelaId", "observacao", "origem", "status", "total" FROM "Pedido";
DROP TABLE "Pedido";
ALTER TABLE "new_Pedido" RENAME TO "Pedido";
CREATE INDEX "Pedido_dataEntrega_idx" ON "Pedido"("dataEntrega");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
