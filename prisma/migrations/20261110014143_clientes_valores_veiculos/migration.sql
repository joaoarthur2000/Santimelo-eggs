-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN "valorCusto" REAL;
ALTER TABLE "Cliente" ADD COLUMN "valorVenda" REAL;

-- AlterTable
ALTER TABLE "Cobranca" ADD COLUMN "descricao" TEXT;

-- CreateTable
CREATE TABLE "Veiculo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apelido" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "placa" TEXT NOT NULL,
    "combustivel" TEXT NOT NULL DEFAULT 'Gasolina',
    "consumoKmL" REAL NOT NULL,
    "precoLitro" REAL NOT NULL,
    "kmAtual" INTEGER,
    "ipvaAnual" REAL NOT NULL DEFAULT 0,
    "seguroAnual" REAL NOT NULL DEFAULT 0,
    "licenciamentoAnual" REAL NOT NULL DEFAULT 0,
    "outrosFixosAnual" REAL NOT NULL DEFAULT 0,
    "manutencaoPorKm" REAL NOT NULL DEFAULT 0,
    "pneusPorKm" REAL NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GastoVeiculo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "veiculoId" TEXT NOT NULL,
    "dia" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT,
    "valor" REAL NOT NULL,
    "litros" REAL,
    "km" INTEGER,
    "autor" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GastoVeiculo_veiculoId_fkey" FOREIGN KEY ("veiculoId") REFERENCES "Veiculo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Veiculo_placa_key" ON "Veiculo"("placa");

-- CreateIndex
CREATE INDEX "GastoVeiculo_veiculoId_dia_idx" ON "GastoVeiculo"("veiculoId", "dia");
