/**
 * TechNova Analytics & Decision Suite — Main Application Controller
 */
(function () {
  'use strict';

  const PERSONAS = [
    {
      id: 'felipe',
      name: 'Felipe Drummond',
      role: 'CEO & Co-fundador',
      avatar: '👔',
      bg: '#DBEAFE',
      color: '#1D4ED8',
      tag: 'Decisão Board 45 Dias & ROI',
      desc: 'Simulador What-If para o Board, proteção de 40% do ARR e alocação ótima dos R$ 4 milhões.'
    },
    {
      id: 'caio',
      name: 'Caio Ventura',
      role: 'CTO & Co-fundador',
      avatar: '🖥️',
      bg: '#FEF3C7',
      color: '#B45309',
      tag: 'Ambiente (F1) & Modalidade',
      desc: 'Auditoria empírica do RTO (Presencial vs Remoto) e onde infraestrutura/ferramentas realmente importam.'
    },
    {
      id: 'juliana',
      name: 'Juliana Braga',
      role: 'VP de People (RH)',
      avatar: '🧠',
      bg: '#CCFBF1',
      color: '#0F766E',
      tag: 'Liderança (F2) & Burnout (F4)',
      desc: 'Impacto de Liderança e Equilíbrio, retenção dos 16 Staffs em risco no Cluster 1 e programa de R$ 4M.'
    },
    {
      id: 'lucas',
      name: 'Lucas Ferreira',
      role: 'Tech Lead — Squad Alpha',
      avatar: '🚀',
      bg: '#EDE9FE',
      color: '#6D28D9',
      tag: 'Performance Remota & Squads',
      desc: 'Auditoria dos Squads Alpha (1º lugar: Y=183,75) e Beta (40% do ARR), autonomia técnica e risco de churn.'
    },
    {
      id: 'priya',
      name: 'Priya Sharma',
      role: 'Eng. Manager — Squad Theta',
      avatar: '🌟',
      bg: '#DCFCE7',
      color: '#15803D',
      tag: 'Benchmark 360 & Classificador IA',
      desc: 'Playbook do Cluster 3 (Y=192,92) e Classificador Individual de Colaboradores (V1–V15 → Cluster e Ŷ).'
    }
  ];

  const STAGES = [
    { id: 1, title: 'Etapa 1: Estatística Descritiva & Auditoria' },
    { id: 2, title: 'Etapa 2: Análise Fatorial (ACP + AFE)' },
    { id: 3, title: 'Etapa 3: Análise de Cluster (Ward + K-Means)' },
    { id: 4, title: 'Etapa 4: Regressão Linear Múltipla (OLS)' },
    { id: 5, title: 'Etapa 5: Integração & Galeria Gráfica' }
  ];

  const state = {
    datasetName: 'Base Oficial TechNova (N = 150)',
    isCustomUpload: false,
    summary: window.TECHNOVA_DEFAULT_SUMMARY,
    rows: window.TECHNOVA_ENRICHED_ROWS,
    rawRows: window.TECHNOVA_RAW_ROWS,
    pendingUploadRows: null,
    mode: 'personas',
    activePersona: 'felipe',
    activeStage: 1,
    // Simulator state for Felipe Drummond
    sim: { dF1: 0.6, dF2: 1.0, dF3: 0.5, dF4: 0.9, preset: 'consultoria', rtoForced: false },
    // Individual Collaborator Simulator state for Priya Sharma
    priyaSelectedId: 21,
    priyaVScores: { V1:8, V2:10, V3:10, V4:10, V5:10, V6:8, V7:10, V8:10, V9:7, V10:8, V11:5, V12:9, V13:10, V14:9, V15:9 },
    // Explorer filters
    filterCluster: 'ALL',
    filterModalidade: 'ALL',
    filterSquad: 'ALL'
  };

  function fmt(num, digits = 2) {
    if (num === undefined || num === null || isNaN(num)) return '—';
    return Number(num).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function fmtP(p) {
    if (p === undefined || p === null || isNaN(p)) return '—';
    if (p < 0.0001) return '< 0,0001';
    return Number(p).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  }

  // --- Telemetry Header ---
  function renderTelemetry() {
    const s = state.summary;
    const ef = s.etapa2_fatorial;
    const er = s.etapa4_regressao;
    const ec = s.etapa3_cluster;
    const el = document.getElementById('telemetryPills');
    el.innerHTML = `
      <span class="tpill">🗄️ Base: <strong>${state.datasetName}</strong></span>
      <span class="tpill">👥 Amostra: <strong>N = ${s.meta.n}</strong></span>
      <span class="tpill">🧪 KMO: <strong>${fmt(ef.kmo_global, 4)}</strong> | Bartlett: <strong>p ${fmtP(ef.bartlett_p)}</strong></span>
      <span class="tpill">📐 4 Fatores Varimax: <strong>${fmt(ef.variancia_total_explicada_acp_pct, 2)}% var.</strong></span>
      <span class="tpill">🎯 Clusters: <strong>K = ${ec.perfis_k3.length}</strong></span>
      <span class="tpill">📈 Regressão R²: <strong>${fmt(er.r2 * 100, 2)}%</strong> (F = ${fmt(er.f_anova, 1)})</span>
    `;
    document.getElementById('btnRestoreDefault').style.display = state.isCustomUpload ? 'inline-flex' : 'none';
  }

  // --- Mode Switcher ---
  function setMode(mode) {
    state.mode = mode;
    document.getElementById('tabPersonas').classList.toggle('active', mode === 'personas');
    document.getElementById('tabFlow').classList.toggle('active', mode === 'flow');
    document.getElementById('tabQaData').classList.toggle('active', mode === 'qadata');

    document.getElementById('viewPersonas').style.display = mode === 'personas' ? 'block' : 'none';
    document.getElementById('viewFlow').style.display = mode === 'flow' ? 'block' : 'none';
    document.getElementById('viewQaData').style.display = mode === 'qadata' ? 'block' : 'none';

    if (mode === 'personas') renderPersonasView();
    if (mode === 'flow') renderFlowView();
    if (mode === 'qadata') renderQaDataView();
  }

  // =========================================================================
  // VIEW 1: PERSONAS HUB (5 CHARACTERS)
  // =========================================================================
  function renderPersonasView() {
    const cardsEl = document.getElementById('personaCards');
    cardsEl.innerHTML = PERSONAS.map(p => `
      <div class="persona-card ${state.activePersona === p.id ? 'active' : ''}" onclick="window.AppUI.selectPersona('${p.id}')">
        <div class="persona-header">
          <div class="persona-avatar" style="background:${p.bg}; color:${p.color};">${p.avatar}</div>
          <div>
            <div class="persona-name">${p.name}</div>
            <div class="persona-role">${p.role}</div>
          </div>
        </div>
        <span class="persona-tag" style="background:${p.bg}; color:${p.color};">${p.tag}</span>
        <p style="font-size:11.5px; color:var(--text-muted); margin-top:6px;">${p.desc}</p>
      </div>
    `).join('');

    const contentEl = document.getElementById('personaContent');
    if (state.activePersona === 'felipe') contentEl.innerHTML = renderFelipeView();
    else if (state.activePersona === 'caio') contentEl.innerHTML = renderCaioView();
    else if (state.activePersona === 'juliana') contentEl.innerHTML = renderJulianaView();
    else if (state.activePersona === 'lucas') contentEl.innerHTML = renderLucasView();
    else if (state.activePersona === 'priya') contentEl.innerHTML = renderPriyaView();
  }

  function selectPersona(id) {
    state.activePersona = id;
    renderPersonasView();
  }

  // --- 1. FELIPE DRUMMOND (CEO & BOARD ROOM) ---
  function renderFelipeView() {
    const s = state.summary;
    const er = s.etapa4_regressao;
    const ec = s.etapa3_cluster;
    const aud = s.etapa1_descritiva.auditoria;
    const modAnova = s.etapa1_descritiva.categoricas.Modalidade || { anova_y_f: 0.0122, anova_y_p: 0.9879 };

    const b0 = er.coeficientes[0]?.b_nao_padronizado || 172.85;
    const b1 = er.coeficientes[1]?.b_nao_padronizado || 9.75;
    const b2 = er.coeficientes[2]?.b_nao_padronizado || 13.44;
    const b3 = er.coeficientes[3]?.b_nao_padronizado || 4.56;
    const b4 = er.coeficientes[4]?.b_nao_padronizado || 11.85;

    const deltaY = b1 * state.sim.dF1 + b2 * state.sim.dF2 + b3 * state.sim.dF3 + b4 * state.sim.dF4;
    const newY = b0 + deltaY;
    const ySpan = (aud.y_max_observado - aud.y_min_observado) || 125;
    const deltaNorm100 = (deltaY / ySpan) * 100;
    const pctGain = (deltaY / b0) * 100;

    return `
      <div class="callout">
        <h4>👔 Painel Decisório de Felipe Drummond (CEO) — Reunião do Board em 45 Dias</h4>
        <p>
          <strong>Diagnóstico Imparcial da Consultoria:</strong> Os 4 fatores latentes explicam <strong>${fmt(er.r2 * 100, 2)}%</strong> da variação da produtividade (F = ${fmt(er.f_anova, 2)}, p &lt; 0,0001).
          A modalidade de trabalho (Presencial vs. Híbrido vs. Remoto) <strong>não possui efeito sobre a produtividade</strong> (ANOVA F = ${fmt(modAnova.anova_y_f, 4)}, p = ${fmt(modAnova.anova_y_p, 4)}).
          O principal motor de produtividade da TechNova é o <strong>Fator 2 — Liderança e Cultura (Beta = ${fmt(er.coeficientes[2]?.beta_padronizado, 4)})</strong>, seguido pelo <strong>Fator 4 — Equilíbrio Vida-Trabalho (Beta = ${fmt(er.coeficientes[4]?.beta_padronizado, 4)})</strong>.
        </p>
      </div>

      <div class="grid-4" style="margin-bottom:18px;">
        <div class="kpi-card">
          <div class="kpi-label">Produtividade Atual (Média Y)</div>
          <div class="kpi-value">${fmt(aud.y_media_observada, 2)}</div>
          <div class="kpi-foot">Escala observada: ${aud.y_min_observado} a ${aud.y_max_observado} (DP = ${fmt(aud.y_dp_observado, 2)})</div>
        </div>
        <div class="kpi-card" style="background:#F0FDFA; border-color:#5EEAD4;">
          <div class="kpi-label" style="color:#0F766E;">Produtividade Projetada (Ŷ)</div>
          <div class="kpi-value" style="color:#0F766E;">${fmt(newY, 2)} <span style="font-size:14px;">(${deltaY >= 0 ? '+' : ''}${fmt(deltaY, 2)} pts)</span></div>
          <div class="kpi-foot">Equivalente a <strong>${deltaNorm100 >= 0 ? '+' : ''}${fmt(deltaNorm100, 2)} pts</strong> na escala 0–100 (${pctGain >= 0 ? '+' : ''}${fmt(pctGain, 1)}%)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Risco de Receita Recorrente (ARR)</div>
          <div class="kpi-value" style="color:${state.sim.rtoForced ? 'var(--danger)' : 'var(--success)'};">
            ${state.sim.rtoForced ? '⚠️ 28% ARR em Risco' : '✅ 40% ARR Protegido'}
          </div>
          <div class="kpi-foot">${state.sim.rtoForced ? 'Rebelião Squads Alpha e Beta (70% churn de 40% ARR)' : 'Retenção dos Squads Alpha e Beta garantida'}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Poder Explicativo do Modelo (R²)</div>
          <div class="kpi-value">${fmt(er.r2 * 100, 2)}%</div>
          <div class="kpi-foot">R² Ajustado = ${fmt(er.r2_ajustado * 100, 2)}% | VIF = 1,000</div>
        </div>
      </div>

      <div class="grid-2">
        <!-- Simulador What-If -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">🎛️ Simulador Estratégico What-If para o Board (Equação OLS)</div>
              <div class="card-subtitle">Simule choques em desvios-padrão (DP) nos 4 fatores ou teste as propostas de Caio, Juliana e da Consultoria</div>
            </div>
          </div>

          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
            <button class="btn ${state.sim.preset === 'caio' ? 'btn-primary' : 'btn-outline'}" onclick="window.AppUI.applySimPreset('caio')">
              🏢 Cenário A: RTO Obrigatório (Tese Caio)
            </button>
            <button class="btn ${state.sim.preset === 'juliana' ? 'btn-primary' : 'btn-outline'}" onclick="window.AppUI.applySimPreset('juliana')">
              🧠 Cenário B: Programa Liderança (Tese Juliana)
            </button>
            <button class="btn ${state.sim.preset === 'consultoria' ? 'btn-primary' : 'btn-outline'}" onclick="window.AppUI.applySimPreset('consultoria')">
              ⭐ Cenário C: Plano Integrado por Cluster (Recomendado)
            </button>
          </div>

          <div class="slider-group">
            <div class="slider-head">
              <span>Fator 2 — Liderança e Cultura (B = +${fmt(b2, 2)} pts/DP | Beta = ${fmt(er.coeficientes[2]?.beta_padronizado, 3)})</span>
              <span style="color:var(--secondary);">${state.sim.dF2 >= 0 ? '+' : ''}${fmt(state.sim.dF2, 2)} DP → ${b2 * state.sim.dF2 >= 0 ? '+' : ''}${fmt(b2 * state.sim.dF2, 2)} pts</span>
            </div>
            <input type="range" min="-1.5" max="2.0" step="0.1" value="${state.sim.dF2}" oninput="window.AppUI.updateSimSlider('dF2', this.value)" />
          </div>

          <div class="slider-group">
            <div class="slider-head">
              <span>Fator 4 — Equilíbrio Vida-Trabalho (B = +${fmt(b4, 2)} pts/DP | Beta = ${fmt(er.coeficientes[4]?.beta_padronizado, 3)})</span>
              <span style="color:var(--purple);">${state.sim.dF4 >= 0 ? '+' : ''}${fmt(state.sim.dF4, 2)} DP → ${b4 * state.sim.dF4 >= 0 ? '+' : ''}${fmt(b4 * state.sim.dF4, 2)} pts</span>
            </div>
            <input type="range" min="-1.5" max="2.0" step="0.1" value="${state.sim.dF4}" oninput="window.AppUI.updateSimSlider('dF4', this.value)" />
          </div>

          <div class="slider-group">
            <div class="slider-head">
              <span>Fator 1 — Ambiente e Ferramentas (B = +${fmt(b1, 2)} pts/DP | Beta = ${fmt(er.coeficientes[1]?.beta_padronizado, 3)})</span>
              <span style="color:var(--primary);">${state.sim.dF1 >= 0 ? '+' : ''}${fmt(state.sim.dF1, 2)} DP → ${b1 * state.sim.dF1 >= 0 ? '+' : ''}${fmt(b1 * state.sim.dF1, 2)} pts</span>
            </div>
            <input type="range" min="-1.5" max="2.0" step="0.1" value="${state.sim.dF1}" oninput="window.AppUI.updateSimSlider('dF1', this.value)" />
          </div>

          <div class="slider-group">
            <div class="slider-head">
              <span>Fator 3 — Crescimento e Aprendizado (B = +${fmt(b3, 2)} pts/DP | Beta = ${fmt(er.coeficientes[3]?.beta_padronizado, 3)})</span>
              <span style="color:var(--amber);">${state.sim.dF3 >= 0 ? '+' : ''}${fmt(state.sim.dF3, 2)} DP → ${b3 * state.sim.dF3 >= 0 ? '+' : ''}${fmt(b3 * state.sim.dF3, 2)} pts</span>
            </div>
            <input type="range" min="-1.5" max="2.0" step="0.1" value="${state.sim.dF3}" oninput="window.AppUI.updateSimSlider('dF3', this.value)" />
          </div>

          <div class="callout ${state.sim.rtoForced ? 'danger' : 'info'}" style="margin-top:14px; margin-bottom:0;">
            <h4>${state.sim.rtoForced ? '🚨 Alerta do Cenário RTO Obrigatório' : '💡 Equação Preditiva Aplicada'}</h4>
            <p>
              ${state.sim.rtoForced
                ? 'Forçar o retorno presencial gera choque negativo em Autonomia (F2) e Flexibilidade (F4), reduzindo a produtividade líquida para ' + fmt(newY, 2) + ' pontos e provocando demissão em massa nos Squads Alpha e Beta.'
                : `Ŷ = ${fmt(b0, 2)} + ${fmt(b1, 2)}·(${state.sim.dF1}) + ${fmt(b2, 2)}·(${state.sim.dF2}) + ${fmt(b3, 2)}·(${state.sim.dF3}) + ${fmt(b4, 2)}·(${state.sim.dF4}) = <strong>${fmt(newY, 2)} pontos</strong>.`}
            </p>
          </div>
        </div>

        <!-- Plano de Alocação de Orçamento R$ 4 Milhões por Cluster -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">💰 Alocação Cirúrgica dos R$ 4,0 Milhões por Cluster (Plano 45 Dias)</div>
              <div class="card-subtitle">Em vez de uma política única, a TechNova deve intervir na dor específica de cada segmento</div>
            </div>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Segmento (Cluster)</th>
                  <th>Média Y Atual</th>
                  <th>Dor Crítica (Centróide)</th>
                  <th>Alocação (R$ 4M)</th>
                  <th>Ação & Meta Projetada</th>
                </tr>
              </thead>
              <tbody>
                ${ec.perfis_k3.map((p, idx) => {
                  const budgets = ['R$ 1,80M (45%)', 'R$ 1,40M (35%)', 'R$ 0,80M (20%)'];
                  const pains = [
                    `Liderança (${fmt(p.centroides_fatores.F2_Lideranca, 2)}) & Burnout (${fmt(p.centroides_fatores.F4_Equilibrio, 2)})`,
                    `Ambiente/Tools (${fmt(p.centroides_fatores.F1_Ambiente, 2)}) & Carga (${fmt(p.centroides_fatores.F4_Equilibrio, 2)})`,
                    `Crescimento/Mentoria (${fmt(p.centroides_fatores.F3_Crescimento, 2)})`
                  ];
                  const actions = [
                    'Coaching executivo de líderes + Retenção dos 16 Staffs (Meta Y → 184+)',
                    'Voucher Ergonomia/Hardware + Redesenho de Sprints (Meta Y → 185+)',
                    'Manter flexibilidade remota/híbrida + Mentoria e Carreira (Meta Y → 201+)'
                  ];
                  return `
                    <tr>
                      <td><strong>${p.rotulo_curto}</strong><br/><span style="font-size:11px; color:var(--text-muted);">n = ${p.n} (${fmt(p.pct, 1)}%)</span></td>
                      <td class="num"><span class="badge ${idx === 2 ? 'badge-green' : 'badge-amber'}">${fmt(p.y_media, 2)}</span></td>
                      <td>${pains[idx] || 'Multidimensional'}</td>
                      <td class="num"><strong>${budgets[idx] || 'Proporcional'}</strong></td>
                      <td>${actions[idx] || 'Plano focado nos fatores dominantes'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <div style="margin-top:16px;">
            <div style="font-weight:800; font-size:13px; margin-bottom:8px;">📊 Quem tinha razão? Veredito Final para o Board:</div>
            <div class="grid-3">
              <div class="kpi-card" style="padding:10px;">
                <span class="badge badge-green">1º Priya Sharma & Juliana</span>
                <p style="font-size:11.5px; margin-top:6px;"><strong>Tese Confirmada:</strong> Liderança (Beta=0,532) e Equilíbrio (Beta=0,469) respondem pelos dois maiores efeitos na produtividade.</p>
              </div>
              <div class="kpi-card" style="padding:10px;">
                <span class="badge badge-amber">2º Caio Ventura (Parcial)</span>
                <p style="font-size:11.5px; margin-top:6px;"><strong>Razão Localizada:</strong> Ferramentas e ergonomia (F1: Beta=0,386) são críticas no Cluster 1 e gargalo do Cluster 2, mas independem de RTO.</p>
              </div>
              <div class="kpi-card" style="padding:10px;">
                <span class="badge badge-purple">3º Lucas Ferreira</span>
                <p style="font-size:11.5px; margin-top:6px;"><strong>Comprovado:</strong> Squad Alpha é o #1 em produtividade (183,75) e 40% do Cluster de Alta Performance é 100% remoto.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function applySimPreset(preset) {
    state.sim.preset = preset;
    if (preset === 'caio') {
      state.sim.dF1 = 0.3;
      state.sim.dF2 = -0.6;
      state.sim.dF3 = 0.0;
      state.sim.dF4 = -0.9;
      state.sim.rtoForced = true;
    } else if (preset === 'juliana') {
      state.sim.dF1 = 0.0;
      state.sim.dF2 = 1.1;
      state.sim.dF3 = 0.5;
      state.sim.dF4 = 0.7;
      state.sim.rtoForced = false;
    } else {
      state.sim.dF1 = 0.6;
      state.sim.dF2 = 1.0;
      state.sim.dF3 = 0.5;
      state.sim.dF4 = 0.9;
      state.sim.rtoForced = false;
    }
    renderPersonasView();
  }

  function updateSimSlider(key, val) {
    state.sim[key] = parseFloat(val);
    state.sim.preset = 'custom';
    state.sim.rtoForced = false;
    renderPersonasView();
  }

  // --- 2. CAIO VENTURA (CTO — INFRAESTRUTURA, AMBIENTE & MODALIDADE) ---
  function renderCaioView() {
    const s = state.summary;
    const modCat = s.etapa1_descritiva.categoricas.Modalidade;
    const ctMod = s.etapa3_cluster.crosstabs_qui_quadrado.Modalidade;
    const segC = s.etapa5_integracao.regressao_por_cluster;
    const ec = s.etapa3_cluster;

    return `
      <div class="callout warn">
        <h4>🖥️ Painel Técnico de Caio Ventura (CTO) — Teste Empírico do RTO vs. Infraestrutura Distribuída (Fator 1)</h4>
        <p>
          <strong>Mensagem da Equipe Analítica para o CTO:</strong> Caio, testamos sua hipótese com rigor estatístico.
          A presença física no escritório (Modalidade Presencial) <strong>não gera maior produtividade</strong> (Média Presencial = 172,36 vs. Remoto = 172,96 vs. Híbrido = 173,15; ANOVA p = 0,9879).
          Contudo, <strong>você tem razão parcial e valiosa sobre o Fator 1 (Ambiente, Ferramentas, Ruído e Ergonomia)</strong>: na Regressão Segmentada, o Fator 1 é o <strong>preditor nº 1 dentro do Cluster 1 (Beta = 0,4231)</strong> e o maior déficit estrutural do <strong>Cluster 2 (Centróide F1 = −0,896, média Likert 4,91)</strong>!
        </p>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">🏢 1. Teste de Hipótese: Produtividade e Clusters por Modalidade</div>
              <div class="card-subtitle">ANOVA One-Way (F = ${fmt(modCat?.anova_y_f, 4)}, p = ${fmt(modCat?.anova_y_p, 4)}) e Qui-Quadrado (χ² = ${fmt(ctMod?.chi2, 4)}, p = ${fmt(ctMod?.p_valor, 4)})</div>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Modalidade</th>
                  <th class="num">Colaboradores (n)</th>
                  <th class="num">Média Produtividade (Y)</th>
                  <th class="num">Cluster 1 (Baixa Y)</th>
                  <th class="num">Cluster 2 (Média Y)</th>
                  <th class="num">Cluster 3 (Alta Y=192,9)</th>
                </tr>
              </thead>
              <tbody>
                ${(modCat?.table || []).map(m => {
                  const mName = m.Modalidade;
                  const c1 = ctMod?.contagem?.[mName]?.['1'] || 0;
                  const c2 = ctMod?.contagem?.[mName]?.['2'] || 0;
                  const c3 = ctMod?.contagem?.[mName]?.['3'] || 0;
                  return `
                    <tr>
                      <td><strong>${mName}</strong></td>
                      <td class="num">${m.freq} (${fmt(m.pct, 1)}%)</td>
                      <td class="num"><strong>${fmt(m.y_media, 2)}</strong> (DP=${fmt(m.y_dp, 1)})</td>
                      <td class="num">${c1} (${fmt(c1 / m.freq * 100, 1)}%)</td>
                      <td class="num">${c2} (${fmt(c2 / m.freq * 100, 1)}%)</td>
                      <td class="num"><span class="badge badge-green">${c3} (${fmt(c3 / m.freq * 100, 1)}%)</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          <p style="font-size:12px; color:var(--text-muted); margin-top:12px;">
            🔍 <strong>Evidência Crítica:</strong> Dos 50 colaboradores do <strong>Cluster 3 (Alta Performance)</strong>, <strong>20 (40%) são 100% Remotos</strong> e <strong>18 (36%) são Híbridos</strong>. Já entre os 44 colaboradores 100% Presenciais, <strong>18 (40,9%) caíram no Cluster 1 (baixa produtividade)</strong> devido a falhas de liderança.
          </p>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">🛠️ 2. Onde Caio Tem Razão: O Peso de F1 (Ambiente & Ferramentas) por Cluster</div>
              <div class="card-subtitle">Resultados da Regressão Segmentada (Parte 7.2 e Questão 10)</div>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Segmento</th>
                  <th class="num">Centróide F1 (Ambiente)</th>
                  <th class="num">Média Likert (V1–V4)</th>
                  <th class="num">Coef. B de F1</th>
                  <th class="num">Beta Padronizado F1</th>
                  <th>Diagnóstico para o CTO</th>
                </tr>
              </thead>
              <tbody>
                ${ec.perfis_k3.map(p => {
                  const sc = segC[`Cluster_${p.cluster_id}`]?.coeficientes?.F1_Ambiente || { b: 9.75, beta: 0.38, p: 0.001 };
                  return `
                    <tr>
                      <td><strong>${p.rotulo_curto}</strong></td>
                      <td class="num"><span class="badge ${p.centroides_fatores.F1_Ambiente < 0 ? 'badge-red' : 'badge-teal'}">${fmt(p.centroides_fatores.F1_Ambiente, 3)}</span></td>
                      <td class="num">${fmt(p.medias_blocos_likert.Ambiente_V1_V4, 2)} / 10</td>
                      <td class="num">+${fmt(sc.b, 2)} pts</td>
                      <td class="num"><strong>${fmt(sc.beta, 4)}</strong> (p=${fmt(sc.p, 3)})</td>
                      <td style="font-size:11.5px;">
                        ${p.cluster_id === 1 ? '<strong>1º Fator no Grupo!</strong> Boa infra sustenta entrega apesar da má liderança.' :
                          p.cluster_id === 2 ? '<strong>Gargalo Crítico!</strong> V1=5,02; V2=4,62; V3=4,94; V4=5,06. Precisa upgrade imediato!' :
                          'Infra saudável (7,08/10) potencializada por forte liderança.'}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          <div class="callout info" style="margin-top:14px; margin-bottom:0;">
            <h4>🎯 Proposta Alternativa para Caio Liderar (Sem RTO Obrigatório):</h4>
            <p>
              Em vez de obrigar 360 pessoas a irem ao escritório em 60 dias, Caio deve liderar o <strong>Programa TechNova DX (Developer Experience & Ergonomia — R$ 1,40M)</strong> focado nos 50 engenheiros do <strong>Cluster 2</strong> (que têm nota 4,62 em ferramentas V2 e 4,94 em ruído V3) e em rituais técnicos de arquitetura assíncrona + encontros presenciais trimestrais de alto impacto.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  // --- 3. JULIANA BRAGA (VP DE PEOPLE) ---
  function renderJulianaView() {
    const s = state.summary;
    const ef = s.etapa2_fatorial;
    const er = s.etapa4_regressao;
    const ec = s.etapa3_cluster;
    const ctSen = ec.crosstabs_qui_quadrado.Senioridade;

    const c1Staffs = ctSen?.contagem?.Staff?.['1'] || 16;
    const totalStaffs = (ctSen?.contagem?.Staff?.['1'] || 0) + (ctSen?.contagem?.Staff?.['2'] || 0) + (ctSen?.contagem?.Staff?.['3'] || 0) || 39;

    // Top critical collaborators in Cluster 1 (lowest F2 and F4)
    const criticalRows = [...state.rows]
      .filter(r => r.Cluster_K3 === 1)
      .sort((a, b) => (a.F2_Lideranca + a.F4_Equilibrio) - (b.F2_Lideranca + b.F4_Equilibrio))
      .slice(0, 8);

    return `
      <div class="callout">
        <h4>🧠 Painel Estratégico de Juliana Braga (VP de People) — Validação Psicométrica de Liderança, Carreira e Burnout</h4>
        <p>
          <strong>Tese Comprovada pelos Dados:</strong> Juliana, a análise multivariada valida integralmente sua proposta ao Board.
          O <strong>Fator 2 — Liderança e Cultura (Alfa = ${fmt(ef.fatores_resumo[1]?.alfa_cronbach, 4)}, Beta = ${fmt(er.coeficientes[2]?.beta_padronizado, 4)})</strong> e o
          <strong>Fator 4 — Equilíbrio Vida-Trabalho / Prevenção ao Burnout (Alfa = ${fmt(ef.fatores_resumo[3]?.alfa_cronbach, 4)}, Beta = ${fmt(er.coeficientes[4]?.beta_padronizado, 4)})</strong>
          são as duas maiores forças determinantes da produtividade na TechNova.
        </p>
      </div>

      <div class="grid-4" style="margin-bottom:18px;">
        <div class="kpi-card">
          <div class="kpi-label">Impacto de +1 DP em Liderança (F2)</div>
          <div class="kpi-value" style="color:var(--secondary);">+${fmt(er.coeficientes[2]?.b_nao_padronizado, 2)} pts</div>
          <div class="kpi-foot">1º Preditor Global (t = ${fmt(er.coeficientes[2]?.t_stat, 2)}, p &lt; 0,0001)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Impacto de +1 DP em Equilíbrio (F4)</div>
          <div class="kpi-value" style="color:var(--purple);">+${fmt(er.coeficientes[4]?.b_nao_padronizado, 2)} pts</div>
          <div class="kpi-foot">2º Preditor Global (t = ${fmt(er.coeficientes[4]?.t_stat, 2)}, p &lt; 0,0001)</div>
        </div>
        <div class="kpi-card" style="background:#FEF2F2; border-color:#FCA5A5;">
          <div class="kpi-label" style="color:var(--danger);">Staff Engineers no Cluster 1</div>
          <div class="kpi-value" style="color:var(--danger);">${c1Staffs} de ${totalStaffs} (${fmt(c1Staffs / totalStaffs * 100, 1)}%)</div>
          <div class="kpi-foot">Explica o pedido de demissão dos 3 Staffs no LinkedIn!</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Menor Média Likert da Empresa</div>
          <div class="kpi-value" style="color:var(--amber);">V11 = 5,53</div>
          <div class="kpi-foot">Mentoria (5,53), Suporte Gestor (5,90) e Treinamento (5,97)</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">📉 Raio-X Psicométrico dos Itens de People (V5 a V15) por Cluster</div>
              <div class="card-subtitle">Comparação das médias Likert (1–10) entre os 3 segmentos</div>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Var</th>
                  <th>Indicador Organizacional</th>
                  <th>Dimensão</th>
                  <th class="num">C1: Crise Liderança</th>
                  <th class="num">C2: Limitados Infra</th>
                  <th class="num">C3: Alta Perf.</th>
                  <th class="num">Correl. c/ Y</th>
                </tr>
              </thead>
              <tbody>
                ${s.etapa1_descritiva.correlacoes_com_y.filter(c => !['V1','V2','V3','V4'].includes(c.variavel)).map(c => {
                  const m1 = ec.perfis_k3[0]?.medias_originais?.[c.variavel] || 0;
                  const m2 = ec.perfis_k3[1]?.medias_originais?.[c.variavel] || 0;
                  const m3 = ec.perfis_k3[2]?.medias_originais?.[c.variavel] || 0;
                  return `
                    <tr>
                      <td><strong>${c.variavel}</strong></td>
                      <td>${c.descricao}</td>
                      <td><span class="badge ${c.dimensao === 'Liderança' ? 'badge-blue' : c.dimensao === 'Equilíbrio' ? 'badge-purple' : 'badge-amber'}">${c.dimensao}</span></td>
                      <td class="num" style="color:${m1 < 5.2 ? 'var(--danger)' : 'inherit'}; font-weight:700;">${fmt(m1, 2)}</td>
                      <td class="num">${fmt(m2, 2)}</td>
                      <td class="num" style="color:var(--success); font-weight:700;">${fmt(m3, 2)}</td>
                      <td class="num"><strong>r = ${fmt(c.r, 3)}</strong></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">🚨 Lista Prioritária de Retenção (Top 8 Colaboradores em Risco Crítico — Cluster 1)</div>
              <div class="card-subtitle">Colaboradores com piores escores combinados de Liderança (F2) e Equilíbrio/Burnout (F4)</div>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Squad</th>
                  <th>Senioridade</th>
                  <th>Modalidade</th>
                  <th class="num">F2 Liderança</th>
                  <th class="num">F4 Equilíbrio</th>
                  <th class="num">Produtiv. Y</th>
                </tr>
              </thead>
              <tbody>
                ${criticalRows.map(r => `
                  <tr>
                    <td><strong>#${r.ID}</strong></td>
                    <td>${r.Squad}</td>
                    <td><span class="badge ${r.Senioridade === 'Staff' || r.Senioridade === 'Sênior' ? 'badge-red' : 'badge-amber'}">${r.Senioridade}</span></td>
                    <td>${r.Modalidade}</td>
                    <td class="num" style="color:var(--danger);">${fmt(r.F2_Lideranca, 2)}</td>
                    <td class="num" style="color:var(--danger);">${fmt(r.F4_Equilibrio, 2)}</td>
                    <td class="num"><strong>${r.Y}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="callout" style="margin-top:14px; margin-bottom:0;">
            <h4>📋 Diretriz de Execução para o Programa de R$ 4 Milhões de Juliana:</h4>
            <p>
              1. <strong>Squads com maior concentração no Cluster 1:</strong> Squad Iota (8 casos), Squad Kappa (8 casos), Squad Gamma (7 casos) e Squad Zeta (7 casos). Substituir ou treinar imediatamente essas lideranças.<br/>
              2. <strong>Destravar Mentoria (V11 = 5,53):</strong> Na Regressão Segmentada, o Fator 3 (Crescimento/Mentoria) tem Beta = 0,242 (p = 0,007) dentro do Cluster 3. Usar os Staffs do Cluster 3 como mentores remunerados.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  // --- 4. LUCAS FERREIRA (TECH LEAD — SQUAD ALPHA) ---
  function renderLucasView() {
    const s = state.summary;
    const sqProfiles = s.etapa5_integracao.perfis_por_squad || [];
    const alpha = sqProfiles.find(sq => sq.squad === 'Squad Alpha') || sqProfiles[0];
    const beta = sqProfiles.find(sq => sq.squad === 'Squad Beta') || sqProfiles[1];

    return `
      <div class="callout info">
        <h4>🚀 Painel de Lucas Ferreira (Tech Lead — Squad Alpha) — Evidência Empírica da Rebelião Anti-RTO (40% do ARR)</h4>
        <p>
          <strong>Os Números Sustentam a Carta dos Squads Alpha e Beta:</strong> O <strong>Squad Alpha é o 1º colocado em produtividade de toda a TechNova (Média Y = ${fmt(alpha?.y_media, 2)})</strong>,
          com forte avaliação em Liderança e Autonomia (F2 = +${fmt(alpha?.F2_Lideranca, 3)}) e 41,7% de seus membros no Cluster 3 de Alta Performance.
          Já o <strong>Squad Beta (Média Y = ${fmt(beta?.y_media, 2)}, n = ${beta?.n})</strong> tem 44,4% de sua equipe presa no <strong>Cluster 2 (déficit severo de ferramentas/ergonomia F1 = −0,225)</strong> — ou seja, o Squad Beta precisa de melhores ferramentas e equilíbrio de carga, não de RTO obrigatório!
        </p>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">🏆 Ranking Oficial de Produtividade e Fatores dos 10 Squads</div>
              <div class="card-subtitle">Comparativo auditado de todos os squads de produto da TechNova</div>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pos.</th>
                  <th>Squad</th>
                  <th class="num">n</th>
                  <th class="num">Média Y</th>
                  <th class="num">F1 Amb.</th>
                  <th class="num">F2 Lid.</th>
                  <th class="num">F3 Cresc.</th>
                  <th class="num">F4 Equil.</th>
                  <th class="center">Clusters (C1/C2/C3)</th>
                </tr>
              </thead>
              <tbody>
                ${sqProfiles.map((sq, idx) => {
                  const isRebel = sq.squad === 'Squad Alpha' || sq.squad === 'Squad Beta';
                  const isTheta = sq.squad === 'Squad Theta';
                  return `
                    <tr style="${isRebel ? 'background:#EFF6FF;' : isTheta ? 'background:#F0FDF4;' : ''}">
                      <td class="center"><strong>${idx + 1}º</strong></td>
                      <td>
                        <strong>${sq.squad}</strong>
                        ${sq.squad === 'Squad Alpha' ? '<span class="badge badge-purple">Lucas (ARR)</span>' : ''}
                        ${sq.squad === 'Squad Beta' ? '<span class="badge badge-blue">ARR 40%</span>' : ''}
                        ${sq.squad === 'Squad Theta' ? '<span class="badge badge-green">Priya</span>' : ''}
                      </td>
                      <td class="num">${sq.n}</td>
                      <td class="num"><strong>${fmt(sq.y_media, 2)}</strong></td>
                      <td class="num">${fmt(sq.F1_Ambiente, 2)}</td>
                      <td class="num">${fmt(sq.F2_Lideranca, 2)}</td>
                      <td class="num">${fmt(sq.F3_Crescimento, 2)}</td>
                      <td class="num">${fmt(sq.F4_Equilibrio, 2)}</td>
                      <td class="center">${sq.clusters_dist?.C1 || 0} / ${sq.clusters_dist?.C2 || 0} / <strong>${sq.clusters_dist?.C3 || 0}</strong></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">💻 Colaboradores 100% Remotos de Alta Performance (Top 10 da Base)</div>
              <div class="card-subtitle">Evidência contra o argumento de que "o trabalho remoto matou a velocidade de entrega"</div>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Squad</th>
                  <th>Senioridade</th>
                  <th class="num">V6 Autonomia</th>
                  <th class="num">V8 Seg. Psic.</th>
                  <th class="num">V13 Flexib.</th>
                  <th class="num">Produtividade Y</th>
                </tr>
              </thead>
              <tbody>
                ${[...state.rows]
                  .filter(r => r.Modalidade === 'Remoto')
                  .sort((a, b) => b.Y - a.Y)
                  .slice(0, 10)
                  .map(r => `
                    <tr>
                      <td><strong>#${r.ID}</strong></td>
                      <td><strong>${r.Squad}</strong></td>
                      <td>${r.Senioridade}</td>
                      <td class="num">${r.V6} / 10</td>
                      <td class="num">${r.V8} / 10</td>
                      <td class="num">${r.V13} / 10</td>
                      <td class="num"><span class="badge badge-green">${r.Y} pts</span></td>
                    </tr>
                  `).join('')}
              </tbody>
            </table>
          </div>
          <div class="callout" style="margin-top:14px; margin-bottom:0;">
            <h4>🤝 Acordo Recomendado para Lucas Ferreira e Squads Alpha & Beta:</h4>
            <p>
              1. <strong>Garantia Formal de Trabalho Remoto/Flexível:</strong> Contratos aditivados garantindo regime remoto por performance medida em output/KPIs.<br/>
              2. <strong>Correção de Mentoria e Carreira no Squad Alpha:</strong> O Squad Alpha tem F3 = −0,309 (sentem falta de plano de carreira claro após o layoff). Incluir Lucas e os seniores do Alpha no comitê técnico de arquitetura junto com Caio Ventura.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  // --- 5. PRIYA SHARMA (ENGINEERING MANAGER — SQUAD THETA & AI CLASSIFIER) ---
  function renderPriyaView() {
    const pred = window.TechNovaStatsEngine.predictIndividualCollaborator(
      state.priyaVScores,
      state.summary,
      state.rows
    );
    const currentEmp = state.rows.find(r => Number(r.ID) === Number(state.priyaSelectedId));

    // Generate automatic 1-on-1 recommendations based on factor scores
    const recs = [];
    if (pred.fScores.F2_Lideranca < 0) {
      recs.push('🔴 <strong>Ação em Liderança e Segurança Psicológica (F2 baixo):</strong> Agendar 1-on-1 semanal estruturado, ampliar autonomia nas decisões de sprint (V6) e instituir reconhecimento explícito nas entregas (V7).');
    } else {
      recs.push('🟢 <strong>Liderança Saudável (F2 positivo):</strong> Manter rituais de feedback contínuo e autonomia técnica.');
    }
    if (pred.fScores.F4_Equilibrio < 0) {
      recs.push('🔴 <strong>Alerta de Sobrecarga / Burnout (F4 baixo):</strong> Renegociar imediatamente o volume de story points (V12), flexibilizar janelas de horário (V13) e bloquear acionamentos fora do expediente (pós-19h).');
    } else {
      recs.push('🟢 <strong>Equilíbrio Vida-Trabalho Sustentável (F4 positivo):</strong> Colaborador com baixa exposição ao burnout.');
    }
    if (pred.fScores.F1_Ambiente < 0) {
      recs.push('🟠 <strong>Gargalo de Ambiente e Ferramentas (F1 baixo):</strong> Liberar voucher de upgrade de hardware/ergonomia (V2/V4) e criar janelas de foco sem reuniões (no-meeting blocks para V3).');
    }
    if (pred.fScores.F3_Crescimento < 0.2) {
      recs.push('🔵 <strong>Alavanca de Crescimento e Mentoria (F3):</strong> Conectar colaborador a um Staff Engineer mentor (V11) e formalizar PDI com critérios claros de promoção (V10).');
    }

    return `
      <div class="callout">
        <h4>🌟 Laboratório de Gestão 360 de Priya Sharma & Classificador Preditivo Individual (IA Decision Support)</h4>
        <p>
          <strong>Como escalar o modelo de Priya para toda a TechNova:</strong> Selecione abaixo qualquer um dos <strong>${state.rows.length} colaboradores</strong> da base (ou ajuste livremente os 15 indicadores V1–V15)
          para calcular em tempo real seus <strong>4 Escores Fatoriais</strong>, classificá-lo automaticamente em seu <strong>Cluster</strong>, prever sua <strong>Produtividade (Ŷ)</strong> e gerar o roteiro de <em>one-on-one</em>.
        </p>
      </div>

      <div class="grid-2">
        <!-- Sliders V1..V15 -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">🎚️ Simulador & Classificador Individual de Colaborador (V1 a V15)</div>
              <div class="card-subtitle">Selecione um colaborador real da base ou personalize as notas Likert (1 a 10)</div>
            </div>
          </div>

          <div style="margin-bottom:14px;">
            <label style="font-weight:700; font-size:12.5px; display:block; margin-bottom:4px;">Carregar Colaborador da Base Ativa:</label>
            <select style="width:100%; padding:8px; border-radius:6px; border:1px solid var(--border); font-weight:600;" onchange="window.AppUI.loadCollaboratorIntoPriya(this.value)">
              ${state.rows.map(r => `
                <option value="${r.ID}" ${Number(r.ID) === Number(state.priyaSelectedId) ? 'selected' : ''}>
                  ID #${r.ID} — ${r.Squad || 'Squad'} | ${r.Senioridade || ''} | ${r.Modalidade || ''} (Y Real = ${r.Y} | ${r.Cluster_Nome || 'Cluster ' + r.Cluster_K3})
                </option>
              `).join('')}
            </select>
          </div>

          <div class="grid-2" style="gap:10px; max-height:420px; overflow-y:auto; padding-right:6px;">
            ${state.summary.etapa1_descritiva.tabela_descritiva.filter(d => d.variavel !== state.summary.meta?.targetCol && d.variavel !== 'Y').map(d => {
              const v = d.variavel;
              const val = state.priyaVScores[v] ?? 6;
              return `
                <div style="background:var(--surface-alt); padding:8px 10px; border-radius:8px; border:1px solid var(--border);">
                  <div style="display:flex; justify-content:space-between; font-size:11.5px; font-weight:700;">
                    <span>${v}: ${d.descricao.slice(0, 26)}</span>
                    <span style="color:var(--primary);">${val}/10</span>
                  </div>
                  <input type="range" min="1" max="10" step="1" value="${val}" oninput="window.AppUI.updatePriyaVScore('${v}', this.value)" />
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Resultado da Classificação e Prescrição de 1-on-1 -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">🤖 Diagnóstico Automatizado & Plano de Ação 1-on-1</div>
              <div class="card-subtitle">Cálculo instantâneo via Pesos Fatoriais Varimax + Distância Euclidiana aos Centróides + Equação OLS</div>
            </div>
          </div>

          <div class="grid-2" style="margin-bottom:16px;">
            <div class="kpi-card" style="background:#F0FDFA; border-color:#5EEAD4;">
              <div class="kpi-label" style="color:#0F766E;">Produtividade Prevista (Ŷ OLS)</div>
              <div class="kpi-value" style="color:#0F766E;">${fmt(pred.yPredito, 2)} pts</div>
              <div class="kpi-foot">${currentEmp ? `Valor Real Observado no ID #${currentEmp.ID}: <strong>${currentEmp.Y} pts</strong>` : 'Predição pelo modelo linear múltiplo'}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Cluster Identificado (Menor Distância)</div>
              <div class="kpi-value" style="font-size:17px; margin-top:8px;">
                <span class="badge ${pred.cluster.cluster_id === 3 ? 'badge-green' : pred.cluster.cluster_id === 2 ? 'badge-amber' : 'badge-red'}" style="font-size:13px; padding:4px 10px;">
                  ${pred.cluster.rotulo_curto}
                </span>
              </div>
              <div class="kpi-foot" style="margin-top:6px;">Distância Euclidiana ao centróide: ${fmt(pred.distToCentroid, 3)}</div>
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <div style="font-weight:800; font-size:13px; margin-bottom:8px;">📐 Posição do Colaborador nos 4 Escores Fatoriais Padronizados (Z):</div>
            <div class="grid-2" style="gap:10px;">
              ${[
                { k: 'F1_Ambiente', lbl: 'F1: Ambiente & Ferramentas', col: '#0F766E' },
                { k: 'F2_Lideranca', lbl: 'F2: Liderança & Cultura', col: '#1D4ED8' },
                { k: 'F3_Crescimento', lbl: 'F3: Crescimento & Mentoria', col: '#B45309' },
                { k: 'F4_Equilibrio', lbl: 'F4: Equilíbrio & Burnout', col: '#6D28D9' }
              ].map(f => {
                const z = pred.fScores[f.k] || 0;
                const pct = Math.max(5, Math.min(95, ((z + 2.5) / 5.0) * 100));
                return `
                  <div style="padding:10px; border:1px solid var(--border); border-radius:8px;">
                    <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700;">
                      <span>${f.lbl}</span>
                      <span style="color:${z >= 0 ? 'var(--success)' : 'var(--danger)'};">${z >= 0 ? '+' : ''}${fmt(z, 3)} DP</span>
                    </div>
                    <div class="bar-track">
                      <div class="bar-fill" style="width:${pct}%; background:${f.col};"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="callout info" style="margin-bottom:0;">
            <h4>📝 Roteiro Prescritivo para a Próxima Reunião 1-on-1 (Playbook Priya Sharma):</h4>
            <ul style="margin-left:18px; margin-top:6px; font-size:12.5px; line-height:1.6;">
              ${recs.map(r => `<li>${r}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  function loadCollaboratorIntoPriya(idVal) {
    state.priyaSelectedId = Number(idVal);
    const emp = state.rows.find(r => Number(r.ID) === state.priyaSelectedId);
    if (emp) {
      for (let i = 1; i <= 15; i++) {
        const k = `V${i}`;
        if (emp[k] !== undefined) state.priyaVScores[k] = Number(emp[k]);
      }
      renderPersonasView();
    }
  }

  function updatePriyaVScore(vKey, val) {
    state.priyaVScores[vKey] = Number(val);
    state.priyaSelectedId = -1;
    renderPersonasView();
  }

  // =========================================================================
  // VIEW 2: 5-STAGE ANALYTICAL FLOW
  // =========================================================================
  function renderFlowView() {
    const navEl = document.getElementById('stageNav');
    navEl.innerHTML = STAGES.map(st => `
      <button class="stage-btn ${state.activeStage === st.id ? 'active' : ''}" onclick="window.AppUI.selectStage(${st.id})">
        ${st.title}
      </button>
    `).join('');

    const contentEl = document.getElementById('stageContent');
    if (state.activeStage === 1) contentEl.innerHTML = renderStage1();
    else if (state.activeStage === 2) contentEl.innerHTML = renderStage2();
    else if (state.activeStage === 3) contentEl.innerHTML = renderStage3();
    else if (state.activeStage === 4) contentEl.innerHTML = renderStage4();
    else if (state.activeStage === 5) contentEl.innerHTML = renderStage5();
  }

  function selectStage(id) {
    state.activeStage = id;
    renderFlowView();
  }

  // --- STAGE 1: DESCRIPTIVE & AUDIT ---
  function renderStage1() {
    const e1 = state.summary.etapa1_descritiva;
    const aud = e1.auditoria;
    const cols = Object.keys(e1.matriz_correlacao);

    return `
      <div class="callout">
        <h4>🔍 Etapa 1 — Auditoria Técnica da Base & Estatística Descritiva (Parte III)</h4>
        <p>${aud.nota_auditoria_y}</p>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">📋 1.1 Medidas de Tendência Central, Dispersão e Normalidade (V1 a V15 e Y)</div>
            <div class="card-subtitle">Média, Mediana, Moda, Desvio-Padrão, Variância, Coeficiente de Variação (CV%), Assimetria e Curtose</div>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Var</th>
                <th>Descrição do Indicador</th>
                <th>Dimensão</th>
                <th class="num">Média</th>
                <th class="num">Mediana</th>
                <th class="num">Moda</th>
                <th class="num">DP</th>
                <th class="num">Variância</th>
                <th class="num">CV (%)</th>
                <th class="center">Mín–Máx</th>
                <th class="num">Assimetria</th>
                <th class="num">Curtose</th>
              </tr>
            </thead>
            <tbody>
              ${e1.tabela_descritiva.map(r => `
                <tr>
                  <td><strong>${r.variavel}</strong></td>
                  <td>${r.descricao}</td>
                  <td><span class="badge badge-teal">${r.dimensao_teorica}</span></td>
                  <td class="num"><strong>${fmt(r.media, 2)}</strong></td>
                  <td class="num">${fmt(r.mediana, 1)}</td>
                  <td class="num">${fmt(r.moda, 1)}</td>
                  <td class="num">${fmt(r.dp, 2)}</td>
                  <td class="num">${fmt(r.variancia, 2)}</td>
                  <td class="num"><strong>${fmt(r.cv_pct, 1)}%</strong></td>
                  <td class="center">${r.min} – ${r.max}</td>
                  <td class="num">${fmt(r.assimetria, 2)}</td>
                  <td class="num">${fmt(r.curtose, 2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">📊 1.2 Ranking de Correlações de Pearson com a Produtividade (Y)</div>
              <div class="card-subtitle">Variáveis que mais impulsionam diretamente o Índice de Produtividade</div>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Variável</th>
                  <th>Indicador</th>
                  <th>Dimensão</th>
                  <th class="num">Correlação (r)</th>
                  <th class="num">Valor-p</th>
                </tr>
              </thead>
              <tbody>
                ${e1.correlacoes_com_y.map((c, idx) => `
                  <tr>
                    <td class="center"><strong>${idx + 1}º</strong></td>
                    <td><strong>${c.variavel}</strong></td>
                    <td>${c.descricao}</td>
                    <td>${c.dimensao}</td>
                    <td class="num"><span class="badge ${c.r > 0.42 ? 'badge-green' : c.r > 0.25 ? 'badge-blue' : 'badge-amber'}">${fmt(c.r, 4)}</span></td>
                    <td class="num">${fmtP(c.p_valor)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">🔗 1.3 Top 15 Pares de Variáveis Likert Mais Correlacionados</div>
              <div class="card-subtitle">Evidência empírica que justifica a extração dos 4 Fatores na Etapa 2</div>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ordem</th>
                  <th>Par de Variáveis</th>
                  <th class="num">Correlação de Pearson (r)</th>
                  <th>Bloco Latente Sugerido</th>
                </tr>
              </thead>
              <tbody>
                ${e1.top_pares_likert.slice(0, 15).map((p, idx) => `
                  <tr>
                    <td class="center">${idx + 1}</td>
                    <td><strong>${p.par}</strong></td>
                    <td class="num"><strong>${fmt(p.r, 4)}</strong></td>
                    <td><span class="badge badge-teal">Alta Covariação Intra-Fator</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">🌡️ 1.4 Matriz de Correlação de Pearson Completa (${cols.length} × ${cols.length})</div>
            <div class="card-subtitle">Observe os 4 blocos diagonais bem definidos (V1–V4, V5–V8, V9–V11 e V12–V15)</div>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Var</th>
                ${cols.map(c => `<th class="center">${c}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${cols.map(rCol => `
                <tr>
                  <td><strong>${rCol}</strong></td>
                  ${cols.map(cCol => {
                    const val = e1.matriz_correlacao[rCol]?.[cCol] ?? 0;
                    const abs = Math.abs(val);
                    const bg = rCol === cCol ? '#0F172A' : (val > 0.5 ? '#CCFBF1' : val > 0.35 ? '#E0F2FE' : '#FFFFFF');
                    const fg = rCol === cCol ? '#FFFFFF' : '#0F172A';
                    return `<td class="center" style="background:${bg}; color:${fg}; font-weight:${abs > 0.5 ? '700' : '400'}; font-size:11px;">${fmt(val, 2)}</td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // --- STAGE 2: FACTOR ANALYSIS ---
  function renderStage2() {
    const ef = state.summary.etapa2_fatorial;
    return `
      <div class="grid-4" style="margin-bottom:18px;">
        <div class="kpi-card">
          <div class="kpi-label">KMO Global (Adequação)</div>
          <div class="kpi-value" style="color:var(--primary);">${fmt(ef.kmo_global, 4)}</div>
          <div class="kpi-foot">&gt; 0,70 Bom | Próximo de 0,80 (Ótimo)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Esfericidade de Bartlett</div>
          <div class="kpi-value">χ² = ${fmt(ef.bartlett_chi2, 1)}</div>
          <div class="kpi-foot">gl = ${ef.bartlett_df} | p ${fmtP(ef.bartlett_p)} (Rejeita H₀)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Variância Explicada (4 Fatores)</div>
          <div class="kpi-value" style="color:var(--secondary);">${fmt(ef.variancia_total_explicada_acp_pct, 2)}%</div>
          <div class="kpi-foot">ACP Varimax (AFE-ML Comum = ${fmt(ef.variancia_comum_afe_ml_pct, 2)}%)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">MSA Individual (Anti-Imagem)</div>
          <div class="kpi-value" style="color:var(--success);">0,616 – 0,858</div>
          <div class="kpi-foot">100% dos itens com MSA &gt; 0,50</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">📉 2.1 Autovalores, Critério de Kaiser (λ &gt; 1) e Análise Paralela de Horn</div>
              <div class="card-subtitle">Convergência exata na retenção de 4 dimensões latentes</div>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Comp.</th>
                  <th class="num">Autovalor (λ)</th>
                  <th class="num">% Variância</th>
                  <th class="num">% Acumulada</th>
                  <th class="num">Análise Paralela (P95)</th>
                  <th class="center">Decisão</th>
                </tr>
              </thead>
              <tbody>
                ${ef.autovalores_tabela.map(e => `
                  <tr style="${e.retido_kaiser ? 'background:#F0FDFA; font-weight:700;' : ''}">
                    <td class="center">${e.componente}</td>
                    <td class="num">${fmt(e.autovalor, 4)}</td>
                    <td class="num">${fmt(e.var_pct, 2)}%</td>
                    <td class="num">${fmt(e.var_acum_pct, 2)}%</td>
                    <td class="num">${fmt(e.pa_p95, 4)}</td>
                    <td class="center">${e.retido_kaiser ? '<span class="badge badge-green">RETIDO (Fator)</span>' : '<span class="badge">Descartado</span>'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">🏛️ 2.2 Resumo dos 4 Construtos Latentes e Confiabilidade (Alfa de Cronbach)</div>
              <div class="card-subtitle">Variância rotacionada Varimax e consistência interna por bloco</div>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Construto Latente</th>
                  <th class="num">Soma Quadrados</th>
                  <th class="num">% Var. Rot.</th>
                  <th class="num">Alfa Cronbach (α)</th>
                  <th class="num">Média Likert</th>
                </tr>
              </thead>
              <tbody>
                ${ef.fatores_resumo.map(f => `
                  <tr>
                    <td><strong>${f.codigo}</strong></td>
                    <td><strong>${f.nome}</strong></td>
                    <td class="num">${fmt(f.ss_loadings_rot, 3)}</td>
                    <td class="num"><strong>${fmt(f.var_rot_pct, 2)}%</strong></td>
                    <td class="num"><span class="badge badge-green">${fmt(f.alfa_cronbach, 4)}</span></td>
                    <td class="num">${fmt(f.media_itens_original, 2)} (DP=${fmt(f.dp_itens_original, 2)})</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="callout info" style="margin-top:14px; margin-bottom:0;">
            <h4>📌 Nota Metodológica (Apostila de Análise Fatorial):</h4>
            <p>
              Todos os 4 blocos superam α &gt; 0,82 (excelente consistência interna). Os escores fatoriais padronizados gerados pela rotação ortogonal Varimax possuem correlação exatamente zero entre si, garantindo ausência total de multicolinearidade nas Etapas 3 e 4.
            </p>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">🎯 2.3 Matriz de Componentes Rotacionados (Varimax), Comunalidades (h²) e MSA Anti-Imagem</div>
            <div class="card-subtitle">Cargas fatoriais ≥ 0,50 destacadas em verde — estrutura limpa sem cargas cruzadas</div>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Var</th>
                <th>Descrição do Item</th>
                <th class="num">F1: Ambiente</th>
                <th class="num">F2: Liderança</th>
                <th class="num">F3: Crescimento</th>
                <th class="num">F4: Equilíbrio</th>
                <th class="num">Comunalidade (h²)</th>
                <th class="num">Unicidade (u²)</th>
                <th class="num">MSA Diagonal</th>
                <th class="num">Carga AFE-ML</th>
              </tr>
            </thead>
            <tbody>
              ${ef.cargas_comunalidades.map(c => {
                const cellStyle = (v) => Math.abs(v) >= 0.5 ? 'background:#CCFBF1; color:#0F766E; font-weight:800;' : 'color:#64748B;';
                return `
                  <tr>
                    <td><strong>${c.variavel}</strong></td>
                    <td>${c.descricao}</td>
                    <td class="num" style="${cellStyle(c.F1_Ambiente)}">${fmt(c.F1_Ambiente, 4)}</td>
                    <td class="num" style="${cellStyle(c.F2_Lideranca)}">${fmt(c.F2_Lideranca, 4)}</td>
                    <td class="num" style="${cellStyle(c.F3_Crescimento)}">${fmt(c.F3_Crescimento, 4)}</td>
                    <td class="num" style="${cellStyle(c.F4_Equilibrio)}">${fmt(c.F4_Equilibrio, 4)}</td>
                    <td class="num"><strong>${fmt(c.comunalidade_acp, 4)}</strong></td>
                    <td class="num">${fmt(c.unicidade_acp, 4)}</td>
                    <td class="num"><span class="badge badge-blue">${fmt(c.msa_anti_imagem, 4)}</span></td>
                    <td class="num">${fmt(c.carga_afe_ml_principal, 4)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // --- STAGE 3: CLUSTER ANALYSIS ---
  function renderStage3() {
    const ec = state.summary.etapa3_cluster;
    return `
      <div class="callout">
        <h4>🧩 Etapa 3 — Análise de Cluster sobre os Escores Fatoriais (Parte V)</h4>
        <p>
          <strong>Verificação de Outliers Multivariados (Distância de Mahalanobis):</strong> D² máximo observado = <strong>${fmt(ec.mahalanobis_max_d2, 4)}</strong> (inferior ao valor crítico χ²(4; 0,99) = 13,277). Zero outliers severos; todos os N = ${state.summary.meta.n} registros foram mantidos.
          No método hierárquico de Ward, o maior salto relativo no coeficiente de aglomeração ocorre na passagem de <strong>K = 3 para K = 2 clusters (+17,91%)</strong>, confirmando K = 3 grupos naturais de 50 colaboradores cada.
        </p>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">📏 3.1 Validação Multicritério do Número de Clusters (K = 2 a 6)</div>
              <div class="card-subtitle">Cotovelo (WCSS), Silhueta, Calinski-Harabasz, Davies-Bouldin e Estatística Gap</div>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th class="center">K</th>
                  <th class="num">WCSS (Inércia)</th>
                  <th class="num">Silhueta</th>
                  <th class="num">Calinski-Harabasz</th>
                  <th class="num">Davies-Bouldin</th>
                  <th class="num">Gap Statistic</th>
                  <th class="center">Tamanhos</th>
                </tr>
              </thead>
              <tbody>
                ${ec.metricas_escolha_k.map(m => `
                  <tr style="${m.k === 3 ? 'background:#F0FDFA; font-weight:700;' : ''}">
                    <td class="center"><strong>K = ${m.k}</strong></td>
                    <td class="num">${fmt(m.wcss_inercia, 2)}</td>
                    <td class="num">${fmt(m.silhueta, 4)}</td>
                    <td class="num">${fmt(m.calinski_harabasz, 2)}</td>
                    <td class="num">${fmt(m.davies_bouldin, 4)}</td>
                    <td class="num">${fmt(m.gap_statistic, 4)}</td>
                    <td class="center">${m.tamanhos.join(' / ')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">🌿 3.2 Planejamento de Aglomeração Hierárquica (Método de Ward)</div>
              <div class="card-subtitle">Últimas etapas de fusão e salto percentual no coeficiente WSS</div>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Etapa</th>
                  <th class="center">Clusters Antes</th>
                  <th class="num">Distância Ward</th>
                  <th class="num">Coef. Aglomeração (WSS)</th>
                  <th class="num">Salto Relativo (%)</th>
                </tr>
              </thead>
              <tbody>
                ${(ec.agrupamento_ward_ultimas_10_etapas || []).slice(-6).map(w => `
                  <tr style="${w.numero_clusters_antes_salto === 3 ? 'background:#FEF3C7; font-weight:800;' : ''}">
                    <td class="center">${w.etapa}</td>
                    <td class="center">K = ${w.numero_clusters_antes_salto}</td>
                    <td class="num">${fmt(w.distancia_fusao_ward, 4)}</td>
                    <td class="num">${fmt(w.coeficiente_aglomeracao_wss, 2)}</td>
                    <td class="num">${w.salto_relativo_pct > 0 ? '+' + fmt(w.salto_relativo_pct, 2) + '%' : '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">🎯 3.3 Centróides Finais do K-Means (K = 3), ANOVA dos Fatores e Médias Likert por Cluster</div>
            <div class="card-subtitle">Fator 4 (F = 93,32) e Fator 1 (F = 58,57) e Fator 2 (F = 32,13) discriminam fortemente os grupos (p &lt; 0,0001)</div>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cluster / Rótulo Gerencial</th>
                <th class="num">Tamanho</th>
                <th class="num">F1: Ambiente (Z / Likert)</th>
                <th class="num">F2: Liderança (Z / Likert)</th>
                <th class="num">F3: Crescimento (Z / Likert)</th>
                <th class="num">F4: Equilíbrio (Z / Likert)</th>
                <th class="num">Produtividade Média (Y)</th>
              </tr>
            </thead>
            <tbody>
              ${ec.perfis_k3.map(p => `
                <tr>
                  <td><strong>${p.rotulo}</strong></td>
                  <td class="num"><strong>n = ${p.n}</strong> (${fmt(p.pct, 1)}%)</td>
                  <td class="num">${fmt(p.centroides_fatores.F1_Ambiente, 3)} (${fmt(p.medias_blocos_likert.Ambiente_V1_V4, 2)})</td>
                  <td class="num">${fmt(p.centroides_fatores.F2_Lideranca, 3)} (${fmt(p.medias_blocos_likert.Lideranca_V5_V8, 2)})</td>
                  <td class="num">${fmt(p.centroides_fatores.F3_Crescimento, 3)} (${fmt(p.medias_blocos_likert.Crescimento_V9_V11, 2)})</td>
                  <td class="num">${fmt(p.centroides_fatores.F4_Equilibrio, 3)} (${fmt(p.medias_blocos_likert.Equilibrio_V12_V15, 2)})</td>
                  <td class="num"><span class="badge ${p.cluster_id === 3 ? 'badge-green' : 'badge-amber'}" style="font-size:12.5px;">${fmt(p.y_media, 2)} (DP=${fmt(p.y_dp, 1)})</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // --- STAGE 4: MULTIPLE LINEAR REGRESSION ---
  function renderStage4() {
    const er = state.summary.etapa4_regressao;
    const pr = er.pressupostos;
    return `
      <div class="grid-4" style="margin-bottom:18px;">
        <div class="kpi-card">
          <div class="kpi-label">Coef. Determinação (R²)</div>
          <div class="kpi-value" style="color:var(--primary);">${fmt(er.r2 * 100, 2)}%</div>
          <div class="kpi-foot">R = ${fmt(er.r, 4)} | R² Ajustado = ${fmt(er.r2_ajustado * 100, 2)}%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">ANOVA da Regressão (Teste F)</div>
          <div class="kpi-value">F = ${fmt(er.f_anova, 2)}</div>
          <div class="kpi-foot">gl = (${er.gl_modelo}, ${er.gl_residuo}) | p ${fmtP(er.p_anova)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Multicolinearidade (VIF)</div>
          <div class="kpi-value" style="color:var(--success);">VIF = ${fmt(pr.vif_maximo, 3)}</div>
          <div class="kpi-foot">Ortogonalidade perfeita via Varimax</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Resíduos (Shapiro & DW)</div>
          <div class="kpi-value">DW = ${fmt(pr.durbin_watson, 3)}</div>
          <div class="kpi-foot">Shapiro p = ${fmt(pr.normalidade_shapiro_p, 3)} | Breusch-Pagan p = ${fmt(pr.homocedasticidade_breusch_pagan_p, 3)}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">📈 4.1 Tabela de Coeficientes da Regressão Linear Múltipla (Y = β₀ + β₁F1 + β₂F2 + β₃F3 + β₄F4)</div>
            <div class="card-subtitle">Todos os 4 fatores são estatisticamente significativos (p &lt; 0,001); Liderança (Beta = 0,5315) e Equilíbrio (Beta = 0,4688) lideram</div>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Termo / Fator</th>
                <th class="num">Coef. Não-Padronizado (B)</th>
                <th class="num">Erro Padrão</th>
                <th class="num">Coef. Padronizado (Beta)</th>
                <th class="num">Estatística t</th>
                <th class="num">Valor-p</th>
                <th class="center">IC 95% para B</th>
                <th class="num">VIF</th>
                <th class="num">Ganho +1 DP (Escala 0–100)</th>
              </tr>
            </thead>
            <tbody>
              ${er.coeficientes.map(c => `
                <tr>
                  <td><strong>${c.rotulo}</strong></td>
                  <td class="num"><strong>${c.b_nao_padronizado >= 0 ? '+' : ''}${fmt(c.b_nao_padronizado, 4)}</strong></td>
                  <td class="num">${fmt(c.erro_padrao, 4)}</td>
                  <td class="num">${c.termo === 'const' ? '—' : `<span class="badge badge-teal" style="font-size:12px;">${fmt(c.beta_padronizado, 4)}</span>`}</td>
                  <td class="num">${fmt(c.t_stat, 3)}</td>
                  <td class="num">${fmtP(c.p_valor)}</td>
                  <td class="center">[${fmt(c.ic95_inf, 2)} ; ${fmt(c.ic95_sup, 2)}]</td>
                  <td class="num">${fmt(c.vif, 3)}</td>
                  <td class="num">${c.termo === 'const' ? '—' : `<strong>+${fmt(c.impacto_1dp_escala_0_100, 2)} pts</strong>`}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">✅ 4.2 Checklist de Verificação dos 5 Pressupostos da Regressão (Item 6.1)</div>
          </div>
        </div>
        <div class="grid-3">
          <div class="kpi-card">
            <span class="badge badge-green">1. Normalidade dos Resíduos — OK</span>
            <p style="font-size:12px; margin-top:6px;">Shapiro-Wilk W = ${fmt(pr.normalidade_shapiro_w, 4)} (p = ${fmt(pr.normalidade_shapiro_p, 4)} &gt; 0,05) e Kolmogorov-Smirnov D = ${fmt(pr.normalidade_ks_d, 4)} (p = ${fmt(pr.normalidade_ks_p, 4)} &gt; 0,05).</p>
          </div>
          <div class="kpi-card">
            <span class="badge badge-green">2. Homocedasticidade — OK</span>
            <p style="font-size:12px; margin-top:6px;">Teste de Breusch-Pagan LM = ${fmt(pr.homocedasticidade_breusch_pagan_lm, 4)} (p = ${fmt(pr.homocedasticidade_breusch_pagan_p, 4)} &gt; 0,05). Variância dos resíduos é constante.</p>
          </div>
          <div class="kpi-card">
            <span class="badge badge-green">3. Independência & Ausência de Outliers — OK</span>
            <p style="font-size:12px; margin-top:6px;">Durbin-Watson = ${fmt(pr.durbin_watson, 4)} (próximo de 2,0). Zero observações com resíduo padronizado &gt; |3| (Cook's D máx = ${fmt(pr.cooks_distance_max, 4)}).</p>
          </div>
        </div>
      </div>
    `;
  }

  // --- STAGE 5: INTEGRATION & FIGURES GALLERY ---
  function renderStage5() {
    const ei = state.summary.etapa5_integracao;
    const segC = ei.regressao_por_cluster;

    const figures = [
      { file: 'fig01_histogramas_likert_y.png', title: 'Figura 1 — Histogramas e Curvas Normais (V1–V15 e Y)' },
      { file: 'fig02_frequencias_categoricas.png', title: 'Figura 2 — Frequências e Produtividade por Modalidade, Senioridade e Squad' },
      { file: 'fig03_matriz_correlacao.png', title: 'Figura 3 — Matriz de Correlação de Pearson (16 × 16)' },
      { file: 'fig04_scree_analise_paralela.png', title: 'Figura 4 — Scree Plot, Critério de Kaiser e Análise Paralela de Horn' },
      { file: 'fig05_cargas_fatoriais_varimax.png', title: 'Figura 5 — Cargas Fatoriais Rotacionadas (Varimax) e Comunalidades (h²)' },
      { file: 'fig06_dendrogramas_ward_variaveis.png', title: 'Figura 6 — Dendrograma de Variáveis (1−r) e Dendrograma de Casos (Ward)' },
      { file: 'fig07_metricas_escolha_k.png', title: 'Figura 7 — Validação Multicritério de K (Cotovelo, Silhueta, CH e Gap)' },
      { file: 'fig08_perfis_clusters_centroides.png', title: 'Figura 8 — Centróides Finais dos Clusters e Mapa de Segmentação' },
      { file: 'fig09_pressupostos_regressao.png', title: 'Figura 9 — Diagnóstico dos Pressupostos da Regressão e Ranking de Betas' },
      { file: 'fig10_dispersao_fatores_y.png', title: 'Figura 10 — Dispersão Linear de Y contra os 4 Escores Fatoriais' },
      { file: 'fig11_integracao_y_clusters_modalidade.png', title: 'Figura 11 — Comparação de Produtividade (Y) por Cluster e por Modalidade' },
      { file: 'fig12_regressao_segmentada_clusters.png', title: 'Figura 12 — Regressão Segmentada por Cluster: Comparação dos Betas' }
    ];

    return `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">🔬 5.1 Regressão Segmentada por Cluster (Parte 7.2 e Questão 10)</div>
            <div class="card-subtitle">Como a importância dos 4 fatores muda conforme o perfil do grupo</div>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Segmento</th>
                <th class="num">n</th>
                <th class="num">R² (R² Ajust.)</th>
                <th class="num">F1: Ambiente (Beta / p)</th>
                <th class="num">F2: Liderança (Beta / p)</th>
                <th class="num">F3: Crescimento (Beta / p)</th>
                <th class="num">F4: Equilíbrio (Beta / p)</th>
              </tr>
            </thead>
            <tbody>
              ${Object.values(segC).map(m => {
                const c = m.coeficientes;
                return `
                  <tr>
                    <td><strong>${m.rotulo}</strong></td>
                    <td class="num">${m.n}</td>
                    <td class="num"><strong>${fmt(m.r2 * 100, 2)}%</strong> (${fmt(m.r2_ajustado * 100, 1)}%)</td>
                    <td class="num">Beta = <strong>${fmt(c.F1_Ambiente?.beta, 3)}</strong> (p=${fmt(c.F1_Ambiente?.p, 3)})</td>
                    <td class="num">Beta = <strong>${fmt(c.F2_Lideranca?.beta, 3)}</strong> (p=${fmt(c.F2_Lideranca?.p, 4)})</td>
                    <td class="num">Beta = <strong>${fmt(c.F3_Crescimento?.beta, 3)}</strong> (p=${fmt(c.F3_Crescimento?.p, 3)})</td>
                    <td class="num">Beta = <strong>${fmt(c.F4_Equilibrio?.beta, 3)}</strong> (p=${fmt(c.F4_Equilibrio?.p, 3)})</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">🖼️ 5.2 Galeria Completa dos 12 Gráficos Diagnósticos Embutidos no DOCX</div>
            <div class="card-subtitle">Gerados em alta resolução pelo pipeline Python (200 DPI)</div>
          </div>
        </div>
        <div class="grid-2">
          ${figures.map(f => `
            <div class="fig-card">
              <img src="../analysis/figures/${f.file}" alt="${f.title}" loading="lazy" />
              <div class="fig-caption">${f.title}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // =========================================================================
  // VIEW 3: QUESTIONNAIRE (12 Q&A), TRIBUNAL DO MODELO & DATA EXPLORER
  // =========================================================================
  function renderQaDataView() {
    const qaList = [
      { q: '1. Adequação para Análise Fatorial (KMO, Bartlett e Blocos V1–V4 vs V5–V8)', a: 'KMO = 0,7814 (bom/ótimo) e Bartlett χ²(105) = 1.190,09 (p < 0,0001), com todos os 15 MSAs da diagonal anti-imagem entre 0,616 e 0,858 (> 0,50). A matriz de correlação mostra que V1–V4 (r entre 0,56 e 0,66) e V5–V8 (r entre 0,60 e 0,71) formam blocos ortogonais distintos (correlações cruzadas próximas de zero, entre −0,09 e +0,13).' },
      { q: '2. Número de Fatores Extraídos, Variância Explicada e Argumento de Juliana Braga', a: 'Foram extraídos 4 fatores (Kaiser λ > 1: 3,539; 2,937; 2,582; 2,174; e Análise Paralela de Horn), explicando 74,88% da variância total na ACP (65,55% na AFE-ML): F1 Ambiente (19,28%, α=0,867), F2 Liderança e Cultura (20,40%, α=0,893), F3 Crescimento (15,03%, α=0,827) e F4 Equilíbrio (20,17%, α=0,888). F2 captura exatamente a tese de Juliana Braga (cargas > 0,84 em segurança psicológica, reconhecimento, suporte e autonomia).' },
      { q: '3. Fator com Maior Correlação com Y (Produtividade) e Posição de Caio Ventura', a: 'O Fator 2 — Liderança e Cultura possui a maior correlação com Y (r = 0,5315, p < 0,0001), seguido pelo Fator 4 — Equilíbrio (r = 0,4688). O Fator 1 — Ambiente fica apenas em 3º lugar (r = 0,3858). Isso refuta a tese central de Caio Ventura de que o espaço físico seria o determinante primário da produtividade.' },
      { q: '4. Perfis dos 3 Clusters Identificados e Semelhança com o Squad de Priya Sharma', a: 'K = 3 clusters (50 colaboradores cada): Cluster 1 (Y = 161,80: ótimo ambiente +0,69, mas grave crise de liderança −0,78 e equilíbrio −0,52); Cluster 2 (Y = 163,84: boa liderança +0,44, mas ferramentas/ambiente precários −0,90 e sobrecarga −0,53); Cluster 3 (Y = 192,92: alto equilíbrio +1,05, forte liderança +0,34 e bom ambiente +0,21). O Cluster 3 espelha perfeitamente o estilo de liderança sustentável de Priya Sharma.' },
      { q: '5. Associação dos Clusters com Modalidade e Senioridade (Teste Qui-Quadrado)', a: 'Não há associação significativa com Modalidade (χ² = 5,0203, gl = 4, p = 0,2852) nem com Senioridade (χ² = 5,3406, gl = 6, p = 0,5009). Isso refuta a tese de Caio: 40% do Cluster 3 (Alta Performance) trabalha 100% Remoto e 36% Híbrido, enquanto 40,9% dos trabalhadores Presenciais estão no Cluster 1 (baixa produtividade).' },
      { q: '6. Significância da Regressão, R² e Comparação Ambiente vs. Liderança', a: 'O modelo é altamente significativo: F(4, 145) = 78,348 (p = 2,91 × 10⁻³⁵), com R² = 68,37% (R² ajustado = 67,50%). Todos os 4 fatores são significativos (p < 0,001). Liderança e Cultura (Beta = 0,5315, B = +13,44) e Equilíbrio (Beta = 0,4688, B = +11,85) são mais importantes que Ambiente de Trabalho (Beta = 0,3858, B = +9,75).' },
      { q: '7. Maior Coeficiente Padronizado (Beta) e Decisão sobre o RTO', a: 'F2 Liderança e Cultura tem o maior Beta (0,5315). Se Felipe Drummond investisse em uma única dimensão, deveria ser em Liderança. Isso mostra que o RTO obrigatório atacaria a variável errada e destruiria a autonomia e flexibilidade dos times.' },
      { q: '8. Atendimento aos Pressupostos da Regressão e Eliminação da Multicolinearidade', a: 'Todos atendidos: Normalidade dos resíduos (Shapiro-Wilk W = 0,9854, p = 0,1143; KS D = 0,054, p = 0,7542), Homocedasticidade (Breusch-Pagan LM = 1,453, p = 0,8349), Independência (Durbin-Watson = 2,3381) e Multicolinearidade zero (VIF = 1,0000 para todos os 4 fatores graças à rotação ortogonal Varimax).' },
      { q: '9. Comparação de Y entre Clusters (ANOVA e Tukey HSD)', a: 'ANOVA F(2, 147) = 33,893 (p = 8,70 × 10⁻¹³). No teste de Tukey, o Cluster 3 (192,92) supera o Cluster 1 (161,80) em +31,12 pts (p < 0,0001) e o Cluster 2 (163,84) em +29,08 pts (p < 0,0001). Nota-se que o Cluster 2 tem boa liderança (+0,44), mas só atinge alta produtividade quando combinada com Equilíbrio e Ferramentas (como ocorre no Cluster 3).' },
      { q: '10. Regressão Segmentada por Cluster e Razão Parcial de Caio Ventura', a: 'Sim, os coeficientes mudam por cluster! No Cluster 1 (R² = 48,85%), F1 Ambiente tem o maior Beta (0,4231, p = 0,0008), superando F2 (0,3712) — dando razão parcial a Caio de que ferramentas e espaço sustentam a entrega onde a gestão falha. Já no Cluster 3 (R² = 68,06%), F2 Liderança domina (Beta = 0,6246) e F3 Crescimento/Mentoria torna-se altamente significativo (Beta = 0,2421, p = 0,0070).' },
      { q: '11. Retorno de +1 Desvio-Padrão no Fator Mais Influente (Escala Original e 0–100)', a: 'Aumentar F2 Liderança e Cultura em +1 DP eleva Y em +13,44 pontos na escala original 114–239 (IC 95%: [+11,10 ; +15,77]), o que corresponde a +10,75 pontos na amplitude normalizada 0–100 (ou +7,78% sobre a média da empresa).' },
      { q: '12. Recomendação Final ao Board (45 Dias), Orçamento de R$ 4M e Impacto Projetado', a: 'Abandonar o RTO obrigatório, protegendo 40% do ARR (Squads Alpha e Beta). Alocar os R$ 4M de forma segmentada: R$ 1,80M no Cluster 1 (choque de liderança no padrão Priya Sharma e retenção dos 16 Staffs), R$ 1,40M no Cluster 2 (upgrade de ergonomia/ferramentas V1–V4 e rebalanceamento de carga) e R$ 0,80M no Cluster 3 (programa de mentoria V11 e trilha de carreira V10). Impacto projetado: elevar a produtividade média da TechNova de 172,85 para ~191,6 pontos (+18,8 pts).' }
    ];

    const filteredRows = state.rows.filter(r => {
      if (state.filterCluster !== 'ALL' && String(r.Cluster_K3) !== state.filterCluster) return false;
      if (state.filterModalidade !== 'ALL' && String(r.Modalidade) !== state.filterModalidade) return false;
      if (state.filterSquad !== 'ALL' && String(r.Squad) !== state.filterSquad) return false;
      return true;
    });

    const squadsList = [...new Set(state.rows.map(r => r.Squad).filter(Boolean))].sort();

    return `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">🎓 Parte VIII — Questionário Interpretativo Completo (12 Questões Fundamentadas)</div>
            <div class="card-subtitle">Respostas analíticas integrando Estatística Descritiva, Fatorial, Cluster e Regressão</div>
          </div>
        </div>
        <div class="grid-2">
          ${qaList.map(item => `
            <div style="background:var(--surface-alt); border:1px solid var(--border); border-radius:10px; padding:14px;">
              <div style="font-weight:800; font-size:13px; color:var(--primary-dark); margin-bottom:6px;">${item.q}</div>
              <p style="font-size:12.3px; color:var(--text);">${item.a}</p>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">🗄️ Explorador Interativo da Base de Dados Enriquecida (N = ${filteredRows.length} de ${state.rows.length})</div>
            <div class="card-subtitle">Contém as variáveis originais + Escores Fatoriais (F1..F4) + Mahalanobis D² + Cluster + Produtividade Prevista (Ŷ)</div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <select style="padding:6px 10px; border-radius:6px; border:1px solid var(--border);" onchange="window.AppUI.setExplorerFilter('filterCluster', this.value)">
              <option value="ALL">Todos os Clusters</option>
              <option value="1" ${state.filterCluster === '1' ? 'selected' : ''}>Cluster 1 (Déficit Liderança)</option>
              <option value="2" ${state.filterCluster === '2' ? 'selected' : ''}>Cluster 2 (Limitados Ambiente)</option>
              <option value="3" ${state.filterCluster === '3' ? 'selected' : ''}>Cluster 3 (Alta Performance)</option>
            </select>
            <select style="padding:6px 10px; border-radius:6px; border:1px solid var(--border);" onchange="window.AppUI.setExplorerFilter('filterModalidade', this.value)">
              <option value="ALL">Todas as Modalidades</option>
              <option value="Presencial" ${state.filterModalidade === 'Presencial' ? 'selected' : ''}>Presencial</option>
              <option value="Híbrido" ${state.filterModalidade === 'Híbrido' ? 'selected' : ''}>Híbrido</option>
              <option value="Remoto" ${state.filterModalidade === 'Remoto' ? 'selected' : ''}>Remoto</option>
            </select>
            <select style="padding:6px 10px; border-radius:6px; border:1px solid var(--border);" onchange="window.AppUI.setExplorerFilter('filterSquad', this.value)">
              <option value="ALL">Todos os Squads</option>
              ${squadsList.map(sq => `<option value="${sq}" ${state.filterSquad === sq ? 'selected' : ''}>${sq}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="table-wrap" style="max-height:460px; overflow-y:auto;">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Squad</th>
                <th>Senioridade</th>
                <th>Modalidade</th>
                <th class="num">F1 Amb.</th>
                <th class="num">F2 Lid.</th>
                <th class="num">F3 Cresc.</th>
                <th class="num">F4 Equil.</th>
                <th class="num">Mahal. D²</th>
                <th>Cluster</th>
                <th class="num">Y Real</th>
                <th class="num">Ŷ Previsto</th>
                <th class="num">Resíduo Z</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRows.map(r => `
                <tr>
                  <td><strong>#${r.ID}</strong></td>
                  <td>${r.Squad || '—'}</td>
                  <td>${r.Senioridade || '—'}</td>
                  <td>${r.Modalidade || '—'}</td>
                  <td class="num">${fmt(r.F1_Ambiente, 3)}</td>
                  <td class="num">${fmt(r.F2_Lideranca, 3)}</td>
                  <td class="num">${fmt(r.F3_Crescimento, 3)}</td>
                  <td class="num">${fmt(r.F4_Equilibrio, 3)}</td>
                  <td class="num">${fmt(r.Mahalanobis_D2, 2)}</td>
                  <td><span class="badge ${r.Cluster_K3 === 3 ? 'badge-green' : r.Cluster_K3 === 2 ? 'badge-amber' : 'badge-red'}">C${r.Cluster_K3}</span></td>
                  <td class="num"><strong>${r.Y}</strong></td>
                  <td class="num">${fmt(r.Y_Predito, 1)}</td>
                  <td class="num">${fmt(r.Residuo_Padronizado, 2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function setExplorerFilter(key, val) {
    state[key] = val;
    renderQaDataView();
  }

  // =========================================================================
  // ADAPTIVE FILE UPLOAD (.CSV / .XLSX) & EXPORT
  // =========================================================================
  function openUploadModal() {
    document.getElementById('uploadModal').classList.add('open');
  }

  function closeUploadModal() {
    document.getElementById('uploadModal').classList.remove('open');
  }

  function parseCSVText(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];
    const first = lines[0];
    const sep = first.includes(';') && !first.includes(',') ? ';' : (first.includes('\t') ? '\t' : ',');
    const headers = first.split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map((line, idx) => {
      const parts = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
      const obj = {};
      headers.forEach((h, i) => {
        const raw = parts[i] ?? '';
        const normalizedNum = raw.replace(',', '.');
        const num = Number(normalizedNum);
        obj[h] = (raw !== '' && !isNaN(num)) ? num : raw;
      });
      if (obj.ID === undefined) obj.ID = idx + 1;
      return obj;
    });
  }

  function handleFileSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const jsonRows = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        prepareColumnMapping(file.name, jsonRows);
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = function (e) {
        const jsonRows = parseCSVText(e.target.result);
        prepareColumnMapping(file.name, jsonRows);
      };
      reader.readAsText(file, 'UTF-8');
    }
  }

  function prepareColumnMapping(fileName, rows) {
    if (!rows || rows.length < 10) {
      alert('O arquivo precisa conter pelo menos 10 linhas de dados válidas.');
      return;
    }
    state.pendingUploadRows = rows;
    const cols = Object.keys(rows[0]);
    const numericCols = cols.filter(c => c.toUpperCase() !== 'ID' && rows.every(r => typeof r[c] === 'number' || !isNaN(Number(r[c]))));

    document.getElementById('mappingArea').style.display = 'block';
    document.getElementById('uploadFileName').textContent = `✅ Base Carregada: ${fileName} (N = ${rows.length} registros, ${cols.length} colunas)`;
    document.getElementById('uploadFileSummary').textContent = `Colunas detectadas: ${cols.join(', ')}`;

    const targetDefault = cols.includes('Y') ? 'Y' : numericCols[numericCols.length - 1];
    document.getElementById('selTargetCol').innerHTML = numericCols.map(c =>
      `<option value="${c}" ${c === targetDefault ? 'selected' : ''}>${c}</option>`
    ).join('');

    const featureDefault = numericCols.filter(c => c !== targetDefault && !['Cluster_K3','Y_Predito','Residuo_Padronizado','Mahalanobis_D2'].includes(c));
    document.getElementById('chkFeatureCols').innerHTML = numericCols.map(c => `
      <label style="display:inline-flex; align-items:center; gap:4px; background:#FFF; padding:4px 8px; border-radius:6px; border:1px solid var(--border); font-size:12px; cursor:pointer;">
        <input type="checkbox" class="chk-feat" value="${c}" ${featureDefault.includes(c) ? 'checked' : ''} />
        ${c}
      </label>
    `).join('');
  }

  function executeCustomUploadAnalysis() {
    const rows = state.pendingUploadRows;
    if (!rows) return;
    const targetCol = document.getElementById('selTargetCol').value;
    const nClusters = Number(document.getElementById('selClusterK').value) || 3;
    const featureCols = Array.from(document.querySelectorAll('.chk-feat:checked'))
      .map(el => el.value)
      .filter(c => c !== targetCol);

    if (featureCols.length < 4) {
      alert('Selecione pelo menos 4 variáveis quantitativas para a Análise Fatorial.');
      return;
    }

    const res = window.TechNovaStatsEngine.runAdaptivePipeline(rows, {
      featureCols,
      targetCol,
      nClusters
    });

    state.datasetName = `Upload Adaptativo (N = ${rows.length}, ${featureCols.length} Vars)`;
    state.isCustomUpload = true;
    state.summary = res.summary;
    state.rows = res.enrichedRows;
    closeUploadModal();
    renderTelemetry();
    setMode(state.mode);
  }

  function simulateNewUploadBatch() {
    // Creates a realistic Q2 2026 post-intervention batch (N=150) where leadership & equipment improved
    const simulated = window.TECHNOVA_RAW_ROWS.map((r, i) => {
      const boost = (i % 3 === 0) ? 1 : 0;
      const v5 = Math.min(10, r.V5 + boost);
      const v7 = Math.min(10, r.V7 + boost);
      const v8 = Math.min(10, r.V8 + boost);
      const v14 = Math.min(10, r.V14 + boost);
      const yNew = Math.round(r.Y + 4.5 * boost + ((i % 5) - 2));
      return {
        ...r,
        V5: v5, V7: v7, V8: v8, V14: v14,
        Y: yNew
      };
    });
    prepareColumnMapping('TechNova_Ciclo_Q2_2026_Simulado.csv', simulated);
  }

  function restoreDefaultDataset() {
    state.datasetName = 'Base Oficial TechNova (N = 150)';
    state.isCustomUpload = false;
    state.summary = window.TECHNOVA_DEFAULT_SUMMARY;
    state.rows = window.TECHNOVA_ENRICHED_ROWS;
    renderTelemetry();
    setMode(state.mode);
  }

  function exportEnrichedCSV() {
    if (!state.rows || !state.rows.length) return;
    const cols = Object.keys(state.rows[0]);
    const csvLines = [
      cols.join(','),
      ...state.rows.map(r => cols.map(c => {
        const v = r[c] ?? '';
        return typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
      }).join(','))
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'technova_base_enriquecida_fatores_clusters.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadTemplateCSV() {
    const cols = Object.keys(window.TECHNOVA_RAW_ROWS[0]);
    const csvLines = [
      cols.join(','),
      ...window.TECHNOVA_RAW_ROWS.map(r => cols.map(c => r[c]).join(','))
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_technova_150.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Expose public UI API
  window.AppUI = {
    setMode,
    selectPersona,
    selectStage,
    applySimPreset,
    updateSimSlider,
    loadCollaboratorIntoPriya,
    updatePriyaVScore,
    setExplorerFilter,
    openUploadModal,
    closeUploadModal,
    handleFileSelect,
    executeCustomUploadAnalysis,
    simulateNewUploadBatch,
    restoreDefaultDataset,
    exportEnrichedCSV,
    downloadTemplateCSV
  };

  // Initialize on DOM load
  window.addEventListener('DOMContentLoaded', () => {
    renderTelemetry();
    renderPersonasView();
  });
})();
