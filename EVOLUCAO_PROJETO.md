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

### 🟢 [v2.2.0] - 21/09/2026: Sistema Dual de Temas (Modo Claro Padrão & Modo Escuro Interativo)
**Objetivo**: Implementação de arquitetura de temas com suporte a **Modo Claro** (*Executive Clean Slate Glass*) e **Modo Escuro** (*Dark Navy Glassmorphism*), definindo o Modo Claro como padrão inicial obrigatório e garantindo persistência no navegador com alternância via ícones interativos.

#### Modificações Implementadas:
- **Padrão Inicial Obrigatório**:
  - Inicialização garantida no **Modo Claro**, independente das preferências do sistema operacional (`prefers-color-scheme`).
  - Script inline anti-FOUC no `<head>` para leitura e aplicação instantânea da preferência salva em `localStorage`.
- **Botão com Ícones Interativos no Cabeçalho Executivo**:
  - Posicionamento orgânico antes do botão de exportação.
  - Ícone de **Lua (🌙)** no modo claro (com animação rotacional suave ao hover) convidando para alternar ao modo escuro.
  - Ícone de **Sol (☀️)** no modo escuro convidando para o modo claro.
- **Design System Adaptativo**:
  - **Fundo**: Transição suave entre Slate Suave (`#F8FAFC` a `#EDF2F7`) e Navy Profundo (`#070D18` a `#0B172A`).
  - **Cards Translúcidos**: Adaptação de opacidade, elevação e bordas (`rgba(255, 255, 255, 0.86)` no claro).
  - **Contraste WCAG AA**: Calibração automática das cores de texto e alertas semânticos (vermelho, âmbar, azul e esmeralda) para leitura confortável e sem fadiga visual.
- **Gráfico Dinâmico Reativo (Chart.js)**:
  - Função `updateChartTheme()` que recalcula rótulos dos eixos, linhas de grade, tooltips e legendas em tempo real a cada clique de alternância, sem perda de dados ou estado dos filtros ativos.

---

### 🟢 [v2.1.1] - 21/09/2026: Instalação e Integração do Plugin Vercel
**Objetivo**: Instalação do plugin oficial `vercel/vercel-plugin` para integração com o ambiente de desenvolvimento (VS Code) e facilitação do ciclo de deploy contínuo.

#### Modificações Implementadas:
- Instalação via CLI de plugins (`npx plugins add vercel/vercel-plugin --target vscode`).
- Registro do pacote de habilidades (36 skills, 5 comandos, hooks e MCP) para orquestração e deploy na Vercel diretamente pelo assistente/editor.

---

### 🟢 [v2.1.0] - 21/09/2026: Motor de Filtragem Dinâmica por Tipo de Produto e Recortes
**Objetivo**: Permitir a análise aprofundada e ágil por tipo de produto/pacote contratado, integrando os dados brutos reais dos 100 registros para recomputação estatística instantânea de KPIs, gráficos e vulnerabilidades.

#### Modificações Implementadas:
- **Barra de Filtros Dinâmicos no Dashboard**:
  - **Filtro Principal por Produto/Plano**: Botões tipo *pills* para `Todos os Produtos (100)`, `Plano Básico (45)`, `Plano Intermediário (30)`, `Plano Avançado (12)` e `Plano Personalizado (13)`.
  - **Filtros Complementares**: Dropdowns para refino cruzado por `Segmento` e `Canal de Atendimento`.
  - **Contador de Universo Amostral**: Indicador visual mostrando exatamente quantas contas estão no recorte ativo (ex: `12 de 100 clientes (12% da base)`).
  - **Botão Limpar Filtros**: Restauração com 1 clique para a visão consolidada global.
- **Banner Contextual de Diagnóstico por Produto**:
  - **Plano Avançado (12 contas)**: Dispara alerta crítico evidenciando o **pior CSAT da empresa (2,67)** e a **maior taxa de Churn (58,3%)**, com 58,3% de detratores.
  - **Plano Personalizado (13 contas)**: Dispara alerta de MRR evidenciando o **pior NPS da empresa (-38)** e **100% de Churn no canal WhatsApp**.
  - **Plano Básico (45 contas)**: Perfil de volume com NPS de -13 e CSAT de 3,27.
  - **Plano Intermediário (30 contas)**: Perfil moderado com 40% de churn e tempo mediano de 26,2h.
- **Motor Reativo em JavaScript (`RAW_DATA`)**:
  - Incorporação dos 100 registros auditados diretamente no script do cliente (zero latência, 100% autônomo e sem necessidade de servidor).
  - Recomputação matemática em tempo real:
    - **NPS**: % Promotores, % Neutros, % Detratores e nota final com distribuição gráfica.
    - **CSAT**: Média ponderada e defasagem contra a meta de 4,20.
    - **Tempo de Resolução**: Mediana robusta, média, amplitude (min/max) e posicionamento do indicador.
    - **Risco de Churn**: Contagem e percentual exatos de clientes em alto risco.
    - **Gráfico de Canais**: Barras e rótulos atualizados dinamicamente para o produto selecionado.
    - **Painel Financeiro**: Contagem de contas ativas e ticket médio recalculados por segmento para o produto.

---

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

