-- Robo comercial do WhatsApp. So acrescenta: uma coluna opcional em "appointments"
-- e duas tabelas novas. Nao altera nem apaga dado existente.
-- Aplicar ANTES do deploy: sem estas tabelas, o webhook erra para todo mundo.

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "lembretePuladoMotivo" TEXT;

-- CreateTable
CREATE TABLE "conversas_comerciais" (
    "telefone" TEXT NOT NULL,
    "nome" TEXT,
    "etapa" TEXT NOT NULL DEFAULT 'p1',
    "origem" TEXT,
    "papel" TEXT,
    "barbeiros" TEXT,
    "agenda" TEXT,
    "perguntasNaoEntendidas" TEXT[],
    "naoEntendidasSeguidas" INTEGER NOT NULL DEFAULT 0,
    "souClienteEm" TIMESTAMP(3),
    "iniciadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaMensagemEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encerradaEm" TIMESTAMP(3),

    CONSTRAINT "conversas_comerciais_pkey" PRIMARY KEY ("telefone")
);

-- CreateTable
CREATE TABLE "pedidos_parar" (
    "telefone" TEXT NOT NULL,
    "pedidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedidos_parar_pkey" PRIMARY KEY ("telefone")
);

-- CreateIndex
CREATE INDEX "conversas_comerciais_ultimaMensagemEm_idx" ON "conversas_comerciais"("ultimaMensagemEm");

