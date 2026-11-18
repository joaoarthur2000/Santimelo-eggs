-- Forma do pagamento ao fornecedor (Pix ou Dinheiro). Pagamentos antigos ficam sem.
ALTER TABLE "PagamentoFornecedor" ADD COLUMN "forma" TEXT;
