-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN "lat" REAL;
ALTER TABLE "Cliente" ADD COLUMN "lng" REAL;

-- CreateTable
CREATE TABLE "MensagemAtendimento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "atendimentoId" INTEGER NOT NULL,
    "de" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "criadaEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lidaEm" DATETIME,
    CONSTRAINT "MensagemAtendimento_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "Atendimento" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RotaDia" (
    "dia" TEXT NOT NULL PRIMARY KEY,
    "ordem" TEXT NOT NULL,
    "kmPlanejado" REAL NOT NULL,
    "minutos" REAL NOT NULL,
    "kmReal" REAL,
    "consumoKmL" REAL NOT NULL,
    "precoLitro" REAL NOT NULL,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "MensagemAtendimento_atendimentoId_criadaEm_idx" ON "MensagemAtendimento"("atendimentoId", "criadaEm");
