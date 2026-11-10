-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "tipoNegocio" TEXT NOT NULL,
    "telefone" TEXT,
    "whatsapp" TEXT,
    "celular" BOOLEAN NOT NULL DEFAULT false,
    "endereco" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "cep" TEXT,
    "regiao" TEXT,
    "lat" REAL,
    "lng" REAL,
    "linkMaps" TEXT,
    "googlePlaceId" TEXT,
    "nota" REAL,
    "avaliacoes" INTEGER,
    "site" TEXT,
    "cnpj" TEXT,
    "razaoSocial" TEXT,
    "porte" TEXT,
    "situacaoCnpj" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOVO',
    "lote" TEXT,
    "observacoes" TEXT,
    "contatadoEm" DATETIME,
    "proximoPasso" TEXT,
    "clienteId" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_googlePlaceId_key" ON "Lead"("googlePlaceId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_whatsapp_idx" ON "Lead"("whatsapp");
