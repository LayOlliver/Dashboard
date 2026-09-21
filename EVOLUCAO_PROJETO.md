# Diário de Evolução do Projeto - Dashboard Executivo de CX

> **Disciplina**: Informações e Negócios (8º Semestre)  
> **Tema**: Auditoria Rigorosa de Satisfação, Atrito Operacional e Análise de Risco de Churn  
> **Base de Dados**: `Banco/base_dados_brutos_satisfacao_100_registros.xlsx` (100 registros auditados)  
> **Arquivo Principal**: [`index.html`](./index.html)

---

## 📌 1. Visão Geral e Diretrizes Metodológicas

Este documento registra todas as alterações significativas, decisões de arquitetura de dados e melhorias visuais implementadas no projeto do Dashboard Executivo.

### Regras de Negócio Inegociáveis (Auditoria Rigorosa)
1. **NPS Metodológico (-21)**: Cálculo estrito (% Promotores - % Detratores). A média simples de 6,27 é terminantemente rejeitada por mascarar a crise de detratores (44% vs 23%).
2. **Tempo de Resolução Mediano (26,8h)**: A média aritmética de 29,2h é distorcida por assimetria e outliers extremos de até 71,0h. O uso da mediana garante robustez estatística.
3. **CSAT Geral (3,19 / 5,0)**: Medição com defasagem de 1,01 em relação à meta corporativa de 4,20.
4. **Assimetria de Faturamento (1 : 33)**: 1 conta B2B Corporativo (R$ 3.404,87) equivale ao faturamento mensal de 33 clientes B2C Standard (R$ 102,34).
5. **Gargalos Operacionais**: O WhatsApp é o canal de maior risco de evasão (75%) e pior esforço (CES 2,38). O B2B PME é o segmento com maior lentidão (34,7h).

---

## 🗓️ 2. Histórico de Versões e Alterações Significativas

### 🟢 [v2.0.0] - 21/09/2026: Modernização Visual, Gráfica e Interativa
**Objetivo**: Transformar o dashboard estático em um painel executivo moderno de alto impacto visual (*Dark Glassmorphism*), agregando gráficos embutidos e interatividade.

#### Modificações Implementadas:
- **Design System Executivo (*Dark Navy Glassmorphism*)**:
  - Paleta com fundo em degradê radial (`#070D18` a `#0B172A`) e iluminação suave no cabeçalho.
  - Cartões com efeito translúcido (`backdrop-filter: blur(14px)`), bordas refinadas e iluminação sutil de topo (*accents* em vermelho, âmbar e azul).
  - Micro-interações de elevação tridimensional (*hover lift*) nos cards.
- **Iconografia Vetorial SVG Inline**:
  - Adição de ícones vetoriais modernos em todos os cartões de KPIs, cabeçalho e seções estratégicas, sem dependência de bibliotecas pesadas externas.
- **Componentização Gráfica nos KPIs**:
  - **NPS (-21)**: Adicionada barra de distribuição horizontal tripartida (44% Detratores em vermelho, 33% Neutros em cinza, 23% Promotores em verde).
  - **CSAT (3,19)**: Adicionada barra de progresso comparativa com marcador visual pontilhado da Meta de 4,20 e tag de defasagem (-1,01).
  - **Tempo Mediano (26,8h)**: Adicionado medidor linear de amplitude/dispersão destacando a mediana e o pior outlier (71,0h).
  - **Risco de Churn (44%)**: Adicionada barra proporcional de base em risco vs base estável.
- **Gráfico de Gargalos por Canal (Chart.js 4.4)**:
  - Implementação de gradientes lineares nas barras (vermelho carmim e dourado âmbar) com cantos arredondados (`borderRadius: 6`).
  - **Filtro de Abas no Cabeçalho**: Botões de alternância dinâmica para filtrar o gráfico por:
    - *Todos (Visão Integrada)*
    - *Risco de Churn (%)*
    - *Tempo de Resolução (h)*
  - Card estilizado exclusivo para o alerta crítico do canal WhatsApp.
- **Painel de Vulnerabilidade Financeira por Segmento**:
  - Inserção de barras de proporção relativa de ticket em relação ao topo (B2B Corporativo = 100%, PME = 26,9%, B2C Prem = 8,2%, B2C Std = 3,0%).
  - Bloco infográfico comparativo **"1:33"** evidenciando a assimetria do risco de evasão.
- **Recursos Executivos Adicionais**:
  - Botão no cabeçalho para **Exportar/Imprimir Relatório** com folha de estilo customizada para impressão limpa (`@media print`).
  - Seção de **Diretrizes Estratégicas para C-Level** com 3 planos de ação imediatos categorizados por urgência.

---

### 🟡 [v1.0.0] - Versão Inicial (Baseline)
**Objetivo**: Criação da primeira estrutura do dashboard com base na planilha de auditoria de 100 registros.

#### Características Iniciais:
- Layout base em Tailwind CSS com fundo `#0B172A`.
- 4 cards de KPIs com números em destaque tipográfico e bordas laterais coloridas.
- Gráfico de barras horizontais único via Chart.js comparando Churn e Tempo de Resolução.
- 4 blocos de texto contendo os valores dos segmentos de clientes.

---

## 🗂️ 3. Estrutura Atual dos Arquivos do Projeto

```text
Dashboard/
├── Banco/
│   └── base_dados_brutos_satisfacao_100_registros.xlsx  # Dados brutos auditados
├── index.html                                          # Aplicação do dashboard executivo
├── EVOLUCAO_PROJETO.md                                 # Registro contínuo de evolução
└── .vscode/                                            # Configurações do ambiente
```

---

## 🚀 4. Sugestões de Próximas Evoluções (Backlog)

- [ ] **Simulador Interativo de Perda de MRR**: Slider onde o usuário seleciona quantas contas B2B/B2C foram perdidas e o painel calcula o impacto financeiro total.
- [ ] **Tabela Dinâmica / Modal de Detalhes da Auditoria**: Modal com busca e paginação para consulta rápida aos 100 registros da planilha.
- [ ] **Matriz de Dispersão (Scatter Plot / Quadrante)**: Gráfico de dispersão cruzando Ticket Médio x Tempo de Espera por segmento.
- [ ] **Alternador de Tema (Light / Dark)** para apresentações em projetores acadêmicos.

---

## 📝 5. Protocolo de Atualização

Toda vez que uma nova alteração significativa for realizada (ex: novo gráfico, nova métrica, reestruturação de layout, scripts ou regras de negócio):
1. Incrementar a versão no histórico (`v2.1.0`, `v2.2.0`, etc.).
2. Descrever o objetivo da alteração.
3. Listar os itens modificados ou adicionados.
4. Atualizar o checklist do backlog, se aplicável.

