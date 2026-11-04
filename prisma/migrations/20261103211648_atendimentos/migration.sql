-- CreateTable
CREATE TABLE "Atendimento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clienteId" TEXT NOT NULL,
    "setor" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "detalhe" TEXT,
    "pedidoId" INTEGER,
    "contato" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "nota" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvidoEm" DATETIME,
    CONSTRAINT "Atendimento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Atendimento_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Atendimento_status_criadoEm_idx" ON "Atendimento"("status", "criadoEm");
