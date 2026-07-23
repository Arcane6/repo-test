-- ============================================================================
-- CONTROLE FÍSICO-FINANCEIRO — DDL (Oracle) — schema NTW_OP
-- Padrão: EVENT LOG / append-only (nunca UPDATE, só INSERT). Cada linha é um
-- lançamento auditável; o "estado atual" de um item = a linha de maior
-- ID_EVENTO para aquele ITEM_ID.
--
-- Camadas cobertas por agora: ACESSO e TRANSPORTE. Core fica de fora
-- (decisão do usuário: "ESQUECE CORE POR AGORA, NAO CRIE TABELA PARA ELE
-- POR AGORA") — pode ser adicionado depois seguindo o mesmo padrão.
-- ============================================================================

-- ============================================================================
-- 1) ACESSO — espelha as dimensões já usadas no módulo Acesso Móvel
--    (TECNOLOGIA 2G/3G/4G/5G, CLASSIFICACAO_CASA Nova/Existente)
-- ============================================================================
CREATE TABLE NTW_OP.CTRL_ACESSO_EVENTOS (
    ID_EVENTO           NUMBER          GENERATED ALWAYS AS IDENTITY,
    ITEM_ID             VARCHAR2(64)    NOT NULL,   -- chave estável do item rastreado (não muda entre eventos)

    -- Escopo do projeto/planejamento
    PROJETO             VARCHAR2(200)   NOT NULL,
    ANO_PLANO           NUMBER(4)       NOT NULL,   -- ano do plano (2025, 2026...)
    IBGE_ID             NUMBER(7),                  -- IBGE 7 dígitos (join com MUNICIPIOS_FECHAMENTO)
    UF                  VARCHAR2(2),
    MUNICIPIO           VARCHAR2(120),
    REGIONAL            VARCHAR2(10),

    -- Dimensão específica de Acesso
    TECNOLOGIA          VARCHAR2(10),               -- 2G/3G/4G/5G
    CLASSIFICACAO_CASA  VARCHAR2(30),               -- CASA NOVA / CASA EXISTENTE

    -- Físico (datas de marco/planejamento)
    STATUS              VARCHAR2(30)    NOT NULL,   -- PLANEJADO / EM_EXECUCAO / CONCLUIDO / CANCELADO
    DATA_PLANEJADA      DATE,                       -- data-alvo do marco (ex.: entrada em operação)
    DATA_REALIZADA      DATE,                       -- data em que de fato aconteceu (NULL até realizar)

    -- Financeiro (planejado × realizado, lado a lado)
    VALOR_PLANEJADO     NUMBER(18,2),
    VALOR_REALIZADO     NUMBER(18,2),
    MOEDA               VARCHAR2(3)     DEFAULT 'BRL' NOT NULL,

    -- Auditoria do lançamento (o EVENTO em si, não o marco de negócio acima)
    TIPO_EVENTO         VARCHAR2(30)    NOT NULL,   -- PLANEJAMENTO / ATUALIZACAO_STATUS / REALIZACAO / REVISAO_FINANCEIRA / CANCELAMENTO
    DATA_EVENTO         DATE            DEFAULT SYSDATE NOT NULL,  -- quando ESTE lançamento foi feito
    USUARIO_LANCAMENTO  VARCHAR2(60)    NOT NULL,
    OBSERVACAO          VARCHAR2(1000),

    CONSTRAINT PK_CTRL_ACESSO_EVENTOS PRIMARY KEY (ID_EVENTO),
    CONSTRAINT CK_CTRL_ACESSO_STATUS CHECK (STATUS IN ('PLANEJADO','EM_EXECUCAO','CONCLUIDO','CANCELADO')),
    CONSTRAINT CK_CTRL_ACESSO_TIPO_EVT CHECK (TIPO_EVENTO IN
        ('PLANEJAMENTO','ATUALIZACAO_STATUS','REALIZACAO','REVISAO_FINANCEIRA','CANCELAMENTO'))
);
CREATE INDEX IX_CTRL_ACESSO_ITEM   ON NTW_OP.CTRL_ACESSO_EVENTOS (ITEM_ID, ID_EVENTO);
CREATE INDEX IX_CTRL_ACESSO_ANO    ON NTW_OP.CTRL_ACESSO_EVENTOS (ANO_PLANO, PROJETO);

-- ============================================================================
-- 2) TRANSPORTE — espelha as dimensões do módulo Transporte
--    (MIDIA FO/MW/SAT/LL/SLS, CAPACIDADE 10G/1G/<1G, do TIPO_TX)
-- ============================================================================
CREATE TABLE NTW_OP.CTRL_TRANSPORTE_EVENTOS (
    ID_EVENTO           NUMBER          GENERATED ALWAYS AS IDENTITY,
    ITEM_ID             VARCHAR2(64)    NOT NULL,

    PROJETO             VARCHAR2(200)   NOT NULL,
    ANO_PLANO           NUMBER(4)       NOT NULL,
    IBGE_ID             NUMBER(7),
    UF                  VARCHAR2(2),
    MUNICIPIO           VARCHAR2(120),
    REGIONAL            VARCHAR2(10),

    -- Dimensão específica de Transporte
    MIDIA               VARCHAR2(10),               -- FO/MW/SAT/LL/SLS
    CAPACIDADE          VARCHAR2(10),               -- 10G/1G/<1G/Outros

    STATUS              VARCHAR2(30)    NOT NULL,
    DATA_PLANEJADA      DATE,
    DATA_REALIZADA      DATE,

    VALOR_PLANEJADO     NUMBER(18,2),
    VALOR_REALIZADO     NUMBER(18,2),
    MOEDA               VARCHAR2(3)     DEFAULT 'BRL' NOT NULL,

    TIPO_EVENTO         VARCHAR2(30)    NOT NULL,
    DATA_EVENTO         DATE            DEFAULT SYSDATE NOT NULL,
    USUARIO_LANCAMENTO  VARCHAR2(60)    NOT NULL,
    OBSERVACAO          VARCHAR2(1000),

    CONSTRAINT PK_CTRL_TRANSPORTE_EVENTOS PRIMARY KEY (ID_EVENTO),
    CONSTRAINT CK_CTRL_TRANSP_STATUS CHECK (STATUS IN ('PLANEJADO','EM_EXECUCAO','CONCLUIDO','CANCELADO')),
    CONSTRAINT CK_CTRL_TRANSP_TIPO_EVT CHECK (TIPO_EVENTO IN
        ('PLANEJAMENTO','ATUALIZACAO_STATUS','REALIZACAO','REVISAO_FINANCEIRA','CANCELAMENTO'))
);
CREATE INDEX IX_CTRL_TRANSP_ITEM ON NTW_OP.CTRL_TRANSPORTE_EVENTOS (ITEM_ID, ID_EVENTO);
CREATE INDEX IX_CTRL_TRANSP_ANO  ON NTW_OP.CTRL_TRANSPORTE_EVENTOS (ANO_PLANO, PROJETO);

-- ============================================================================
-- VIEW UNIFICADA (LONG, cross-camada) — pra BI/grid consumirem uma fonte só.
-- Sempre traz TODOS os eventos (histórico completo); quem quiser só o
-- "estado atual" filtra por ID_EVENTO = MAX(ID_EVENTO) OVER (PARTITION BY
-- ITEM_ID) — ver VW_CONTROLE_ATUAL abaixo.
-- ============================================================================
CREATE OR REPLACE VIEW NTW_OP.VW_CONTROLE_FISICO_FINANCEIRO AS
SELECT 'ACESSO' AS CAMADA, ID_EVENTO, ITEM_ID, PROJETO, ANO_PLANO, IBGE_ID, UF, MUNICIPIO, REGIONAL,
       TECNOLOGIA AS DIMENSAO_1, CLASSIFICACAO_CASA AS DIMENSAO_2,
       STATUS, DATA_PLANEJADA, DATA_REALIZADA, VALOR_PLANEJADO, VALOR_REALIZADO, MOEDA,
       TIPO_EVENTO, DATA_EVENTO, USUARIO_LANCAMENTO, OBSERVACAO
FROM NTW_OP.CTRL_ACESSO_EVENTOS
UNION ALL
SELECT 'TRANSPORTE', ID_EVENTO, ITEM_ID, PROJETO, ANO_PLANO, IBGE_ID, UF, MUNICIPIO, REGIONAL,
       MIDIA, CAPACIDADE,
       STATUS, DATA_PLANEJADA, DATA_REALIZADA, VALOR_PLANEJADO, VALOR_REALIZADO, MOEDA,
       TIPO_EVENTO, DATA_EVENTO, USUARIO_LANCAMENTO, OBSERVACAO
FROM NTW_OP.CTRL_TRANSPORTE_EVENTOS;

-- ============================================================================
-- "ESTADO ATUAL" — a linha de evento mais recente por ITEM_ID (o que a grid
-- edita/exibe por padrão; o histórico completo fica na view acima).
-- ============================================================================
CREATE OR REPLACE VIEW NTW_OP.VW_CONTROLE_ATUAL AS
SELECT *
FROM (
    SELECT v.*,
           ROW_NUMBER() OVER (PARTITION BY CAMADA, ITEM_ID ORDER BY ID_EVENTO DESC) AS RN
    FROM NTW_OP.VW_CONTROLE_FISICO_FINANCEIRO v
)
WHERE RN = 1;
