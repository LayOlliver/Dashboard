/**
 * TechNova Analytics & Decision Suite — Automated Application Controller
 * Recalculates all 3 tabs, 5 statistical stages, and dynamic SVG charts automatically
 * for any uploaded CSV or XLSX dataset.
 */
(function () {
  'use strict';

  const PERSONAS = [
    {
      id: 'felipe',
      name: 'Felipe Drummond',
      role: 'CEO • Visão Executiva',
      avatar: '👔',
      bg: '#DBEAFE',
      color: '#1D4ED8',
      tag: 'Simulador What-If & Segmentos',
      desc: 'Simulador dinâmico pela equação OLS e diagnóstico objetivo dos segmentos (clusters) recalculados.'
    },
    {
      id: 'caio',
      name: 'Caio Ventura',
      role: 'CTO • Estrutura & Categorias',
      avatar: '🖥️',
      bg: '#FEF3C7',
      color: '#B45309',
      tag: 'Categorias (ANOVA/χ²) & Fatores',
      desc: 'Auditoria estatística por variável categórica e impacto segmentado de qualquer fator por cluster.'
    },
    {
      id: 'juliana',
      name: 'Juliana Braga',
      role: 'VP de People • Indicadores',
      avatar: '🧠',
      bg: '#CCFBF1',
      color: '#0F766E',
      tag: 'Raio-X de Itens & Prioridades',
      desc: 'Mapeamento dos principais fatores preditores, médias por cluster e registros prioritários no Cluster 1.'
    },
    {
      id: 'lucas',
      name: 'Lucas Ferreira',
      role: 'Tech Lead • Grupos & Desempenho',
      avatar: '🚀',
      bg: '#EDE9FE',
      color: '#6D28D9',
      tag: 'Ranking de Grupos & Top 10',
      desc: 'Comparativo dinâmico entre grupos categóricos e listagem dos registros de maior desempenho na base.'
    },
    {
      id: 'priya',
      name: 'Priya Sharma',
      role: 'Eng. Manager • Classificador',
      avatar: '🌟',
      bg: '#DCFCE7',
      color: '#15803D',
      tag: 'Simulador & Classificador Individual',
      desc: 'Cálculo em tempo real de escores fatoriais, classificação no cluster mais próximo e previsão Ŷ.'
    }
  ];

  const STAGES = [
    { id: 1, title: 'Etapa 1: Estatística Descritiva & Auditoria' },
    { id: 2, title: 'Etapa 2: Análise Fatorial (ACP + AFE)' },
    { id: 3, title: 'Etapa 3: Análise de Cluster (Ward + K-Means)' },
    { id: 4, title: 'Etapa 4: Regressão Linear Múltipla (OLS)' },
    { id: 5, title: 'Etapa 5: Integração & Painel Gráfico Dinâmico' }
  ];

  const PALETTE = ['#0F766E', '#1D4ED8', '#B45309', '#6D28D9', '#DC2626', '#0284C7'];
  const CLUSTER_COLORS = ['#DC2626', '#D97706', '#15803D', '#1D4ED8', '#6D28D9', '#0F766E'];

  const state = {
    datasetName: 'Base Padrão (N = 150)',
    isCustomUpload: false,
    summary: null,
    rows: [],
    rawRows: window.TECHNOVA_RAW_ROWS || [],
    pendingUploadRows: null,
    pendingFileName: '',
    mode: 'personas',
    activePersona: 'felipe',
    activeStage: 1,
    // Dynamic UI controls
    simDeltas: {},
    simPreset: 'base',
    caioCatCol: null,
    caioFactorCode: null,
    lucasGroupCol: null,
    lucasFilterVal: 'ALL',
    priyaSelectedId: null,
    priyaVScores: {},
    explorerFilters: { cluster: 'ALL', cat1: 'ALL', cat2: 'ALL', search: '' }
  };

  // --- Formatting & HTML Escape Helpers ---
  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmt(num, digits = 2) {
    if (num === undefined || num === null || isNaN(num)) return '—';
    return Number(num).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function fmtP(p) {
    if (p === undefined || p === null || isNaN(p)) return '—';
    if (p < 0.0001) return '< 0,0001';
    return Number(p).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  }

  function clusterBadgeClass(cid, totalK) {
    if (cid === totalK) return 'badge-green';
    if (cid === 1) return 'badge-red';
    return 'badge-amber';
  }

  // --- Unified Dataset Application (Default & Upload) ---
  function applyDataset(rows, datasetName, config = {}, isCustom = false) {
    const res = window.TechNovaStatsEngine.runAdaptivePipeline(rows, config);
    state.datasetName = datasetName;
    state.isCustomUpload = isCustom;
    state.summary = res.summary;
    state.rows = res.enrichedRows;

    const meta = res.summary.meta;
    // Reset dynamic simulator state
    state.simDeltas = {};
    meta.factorCodes.forEach(fc => { state.simDeltas[fc] = 0; });
    state.simPreset = 'base';

    // Reset persona selectors to match active dataset columns
    state.caioCatCol = meta.primaryCatCol || meta.catCols[0] || null;
    state.caioFactorCode = meta.factorCodes[0] || null;
    state.lucasGroupCol = meta.defaultGroupCol || meta.catCols[0] || null;
    state.lucasFilterVal = 'ALL';

    // Reset Priya individual classifier to first row of active dataset
    const firstRow = state.rows[0];
    state.priyaSelectedId = firstRow ? firstRow.ID : null;
    state.priyaVScores = {};
    meta.featureCols.forEach(col => {
      state.priyaVScores[col] = firstRow ? Number(firstRow[col]) : 0;
    });

    // Reset Explorer filters
    state.explorerFilters = { cluster: 'ALL', cat1: 'ALL', cat2: 'ALL', search: '' };

    renderTelemetry();
    setMode(state.mode);
  }

  // --- Telemetry Header ---
  function renderTelemetry() {
    const s = state.summary;
    if (!s) return;
    const ef = s.etapa2_fatorial;
    const er = s.etapa4_regressao;
    const ec = s.etapa3_cluster;
    const el = document.getElementById('telemetryPills');
    el.innerHTML = `
      <span class="tpill">🗄️ Base: <strong>${esc(state.datasetName)}</strong></span>
      <span class="tpill">👥 Amostra: <strong>N = ${s.meta.n}</strong> (${s.meta.n_vars_likert} vars → ${esc(s.meta.targetCol)})</span>
      <span class="tpill">🧪 KMO: <strong>${fmt(ef.kmo_global, 4)}</strong> | Bartlett: <strong>p ${fmtP(ef.bartlett_p)}</strong></span>
      <span class="tpill">📐 ${s.meta.n_fatores} Fatores Varimax: <strong>${fmt(ef.variancia_total_explicada_acp_pct, 2)}% var.</strong></span>
      <span class="tpill">🎯 Clusters: <strong>K = ${ec.perfis_k3.length}</strong></span>
      <span class="tpill">📈 Regressão R²: <strong>${fmt(er.r2 * 100, 2)}%</strong> (F = ${fmt(er.f_anova, 1)})</span>
    `;
    const btnRestore = document.getElementById('btnRestoreDefault');
    if (btnRestore) btnRestore.style.display = state.isCustomUpload ? 'inline-flex' : 'none';
  }

  // --- Mode Switcher ---
  function setMode(mode) {
    state.mode = mode;
    document.getElementById('tabPersonas').classList.toggle('active', mode === 'personas');
    document.getElementById('tabFlow').classList.toggle('active', mode === 'flow');
    document.getElementById('tabDataExplorer').classList.toggle('active', mode === 'explorer');

    document.getElementById('viewPersonas').style.display = mode === 'personas' ? 'block' : 'none';
    document.getElementById('viewFlow').style.display = mode === 'flow' ? 'block' : 'none';
    document.getElementById('viewDataExplorer').style.display = mode === 'explorer' ? 'block' : 'none';

    if (mode === 'personas') renderPersonasView();
    if (mode === 'flow') renderFlowView();
    if (mode === 'explorer') renderDataExplorerView();
  }

  // =========================================================================
  // DYNAMIC SVG CHART BUILDERS (100% RECALCULATED ON ANY DATASET)
  // =========================================================================
  function buildHistogramSVG(values, label) {
    const W = 540, H = 240, padL = 44, padR = 16, padT = 18, padB = 36;
    const minV = Math.min(...values), maxV = Math.max(...values);
    const span = (maxV - minV) || 1;
    const bins = Math.min(12, Math.max(6, Math.round(Math.sqrt(values.length))));
    const counts = new Array(bins).fill(0);
    values.forEach(v => {
      const idx = Math.min(bins - 1, Math.floor(((v - minV) / span) * bins));
      counts[idx]++;
    });
    const maxC = Math.max(...counts, 1);
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const bw = plotW / bins;
    const meanV = values.reduce((a, b) => a + b, 0) / values.length;
    const meanX = padL + ((meanV - minV) / span) * plotW;

    const bars = counts.map((c, i) => {
      const bh = (c / maxC) * plotH;
      const x = padL + i * bw + 2;
      const y = padT + plotH - bh;
      const bStart = minV + (i / bins) * span;
      return `
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(4, bw - 4).toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="#0F766E" opacity="0.85"></rect>
        ${c > 0 ? `<text x="${(x + (bw - 4) / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" font-size="9.5" fill="#334155" font-weight="700">${c}</text>` : ''}
        ${i % 2 === 0 ? `<text x="${x.toFixed(1)}" y="${H - 16}" font-size="9.5" fill="#64748B">${fmt(bStart, 1)}</text>` : ''}
      `;
    }).join('');

    return `
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}">
        <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="#CBD5E1" />
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#CBD5E1" />
        ${bars}
        <line x1="${meanX.toFixed(1)}" y1="${padT}" x2="${meanX.toFixed(1)}" y2="${padT + plotH}" stroke="#DC2626" stroke-width="2" stroke-dasharray="4 3" />
        <text x="${Math.min(W - 85, meanX + 5).toFixed(1)}" y="${padT + 12}" font-size="10" fill="#DC2626" font-weight="700">Média = ${fmt(meanV, 2)}</text>
        <text x="${W / 2}" y="${H - 2}" text-anchor="middle" font-size="10.5" fill="#475569" font-weight="700">${esc(label)}</text>
      </svg>
    `;
  }

  function buildScreeSVG(autovalores) {
    const W = 540, H = 240, padL = 44, padR = 20, padT = 18, padB = 34;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const maxEig = Math.max(...autovalores.map(a => Math.max(a.autovalor, a.pa_p95)), 1.5) * 1.1;
    const n = autovalores.length;
    const xAt = (i) => padL + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
    const yAt = (v) => padT + plotH - (v / maxEig) * plotH;

    const eigPts = autovalores.map((a, i) => `${xAt(i).toFixed(1)},${yAt(a.autovalor).toFixed(1)}`).join(' ');
    const paPts = autovalores.map((a, i) => `${xAt(i).toFixed(1)},${yAt(a.pa_p95).toFixed(1)}`).join(' ');
    const yKaiser = yAt(1.0);

    const dots = autovalores.map((a, i) => {
      const cx = xAt(i), cy = yAt(a.autovalor);
      return `
        <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${a.retido ? 5 : 3.5}" fill="${a.retido ? '#0F766E' : '#94A3B8'}" stroke="#FFF" stroke-width="1.5" />
        ${a.retido ? `<text x="${cx.toFixed(1)}" y="${(cy - 8).toFixed(1)}" text-anchor="middle" font-size="9.5" fill="#0F766E" font-weight="700">${fmt(a.autovalor, 2)}</text>` : ''}
        <text x="${cx.toFixed(1)}" y="${H - 14}" text-anchor="middle" font-size="9.5" fill="#64748B">${a.componente}</text>
      `;
    }).join('');

    return `
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}">
        <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="#CBD5E1" />
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#CBD5E1" />
        <line x1="${padL}" y1="${yKaiser.toFixed(1)}" x2="${W - padR}" y2="${yKaiser.toFixed(1)}" stroke="#DC2626" stroke-dasharray="5 4" stroke-width="1.5" />
        <text x="${W - padR - 4}" y="${(yKaiser - 4).toFixed(1)}" text-anchor="end" font-size="9.5" fill="#DC2626" font-weight="700">Kaiser (λ = 1,0)</text>
        <polyline fill="none" stroke="#1D4ED8" stroke-width="2" stroke-dasharray="4 3" points="${paPts}" />
        <polyline fill="none" stroke="#0F766E" stroke-width="2.5" points="${eigPts}" />
        ${dots}
        <text x="12" y="${padT + 10}" font-size="9.5" fill="#64748B">${fmt(maxEig, 1)}</text>
        <text x="${W / 2}" y="${H - 1}" text-anchor="middle" font-size="10" fill="#475569" font-weight="700">Componente</text>
      </svg>
      <div class="chart-legend">
        <span class="legend-item"><span class="legend-dot" style="background:#0F766E;"></span>Autovalor Observado</span>
        <span class="legend-item"><span class="legend-dot" style="background:#1D4ED8;"></span>Análise Paralela (Horn P95)</span>
        <span class="legend-item"><span class="legend-dot" style="background:#DC2626;"></span>Critério de Kaiser (λ = 1)</span>
      </div>
    `;
  }

  function buildLoadingsHeatmapSVG(cargas, factorMeta) {
    const k = factorMeta.length;
    const rows = cargas.length;
    const cellW = Math.max(64, Math.min(96, Math.floor(380 / k)));
    const cellH = 22;
    const padL = 90, padT = 30, padR = 12, padB = 10;
    const W = padL + k * cellW + padR;
    const H = padT + rows * cellH + padB;

    const headers = factorMeta.map((fm, c) =>
      `<text x="${padL + c * cellW + cellW / 2}" y="19" text-anchor="middle" font-size="10.5" fill="#0F172A" font-weight="800">${esc(fm.nome_curto.slice(0, 12))}</text>`
    ).join('');

    const cells = cargas.map((row, r) => {
      const y = padT + r * cellH;
      const rowLabel = `<text x="${padL - 8}" y="${y + 15}" text-anchor="end" font-size="10.5" fill="#334155" font-weight="700">${esc(row.variavel.slice(0, 12))}</text>`;
      const cols = factorMeta.map((fm, c) => {
        const val = row[fm.codigo] ?? 0;
        const abs = Math.abs(val);
        const alpha = Math.min(0.95, abs);
        const fill = val >= 0
          ? `rgba(15, 118, 110, ${(alpha * 0.85).toFixed(2)})`
          : `rgba(220, 38, 38, ${(alpha * 0.85).toFixed(2)})`;
        const txtCol = abs >= 0.5 ? '#FFFFFF' : '#334155';
        const x = padL + c * cellW;
        return `
          <rect x="${x + 1}" y="${y + 1}" width="${cellW - 2}" height="${cellH - 2}" rx="3" fill="${fill}" />
          <text x="${x + cellW / 2}" y="${y + 15}" text-anchor="middle" font-size="10" fill="${txtCol}" font-weight="${abs >= 0.5 ? '800' : '500'}">${fmt(val, 2)}</text>
        `;
      }).join('');
      return rowLabel + cols;
    }).join('');

    return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}">${headers}${cells}</svg>`;
  }

  function buildClusterMetricsSVG(metricas, selectedK) {
    const W = 540, H = 240, padL = 48, padR = 48, padT = 20, padB = 34;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const n = metricas.length;
    const maxWcss = Math.max(...metricas.map(m => m.wcss_inercia), 1) * 1.08;
    const maxSil = Math.max(...metricas.map(m => m.silhueta), 0.3) * 1.15;
    const minSil = Math.min(0, ...metricas.map(m => m.silhueta));
    const silSpan = (maxSil - minSil) || 1;

    const xAt = (i) => padL + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
    const yWcss = (v) => padT + plotH - (v / maxWcss) * plotH;
    const ySil = (v) => padT + plotH - ((v - minSil) / silSpan) * plotH;

    const wcssPts = metricas.map((m, i) => `${xAt(i).toFixed(1)},${yWcss(m.wcss_inercia).toFixed(1)}`).join(' ');
    const silPts = metricas.map((m, i) => `${xAt(i).toFixed(1)},${ySil(m.silhueta).toFixed(1)}`).join(' ');

    const markers = metricas.map((m, i) => {
      const x = xAt(i), y1 = yWcss(m.wcss_inercia), y2 = ySil(m.silhueta);
      const isSel = m.k === selectedK;
      return `
        ${isSel ? `<line x1="${x.toFixed(1)}" y1="${padT}" x2="${x.toFixed(1)}" y2="${padT + plotH}" stroke="#0F766E" stroke-dasharray="3 3" stroke-width="1.5" />` : ''}
        <circle cx="${x.toFixed(1)}" cy="${y1.toFixed(1)}" r="${isSel ? 5.5 : 4}" fill="#1D4ED8" stroke="#FFF" stroke-width="1.5" />
        <circle cx="${x.toFixed(1)}" cy="${y2.toFixed(1)}" r="${isSel ? 5.5 : 4}" fill="#0F766E" stroke="#FFF" stroke-width="1.5" />
        <text x="${x.toFixed(1)}" y="${(y2 - 8).toFixed(1)}" text-anchor="middle" font-size="9.5" fill="#0F766E" font-weight="700">${fmt(m.silhueta, 3)}</text>
        <text x="${x.toFixed(1)}" y="${H - 14}" text-anchor="middle" font-size="10.5" fill="${isSel ? '#0F766E' : '#475569'}" font-weight="${isSel ? '800' : '600'}">K=${m.k}</text>
      `;
    }).join('');

    return `
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}">
        <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="#CBD5E1" />
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#1D4ED8" opacity="0.4" />
        <line x1="${W - padR}" y1="${padT}" x2="${W - padR}" y2="${padT + plotH}" stroke="#0F766E" opacity="0.4" />
        <polyline fill="none" stroke="#1D4ED8" stroke-width="2.2" points="${wcssPts}" />
        <polyline fill="none" stroke="#0F766E" stroke-width="2.2" points="${silPts}" />
        ${markers}
        <text x="6" y="${padT + 8}" font-size="9.5" fill="#1D4ED8" font-weight="700">WCSS</text>
        <text x="${W - 4}" y="${padT + 8}" text-anchor="end" font-size="9.5" fill="#0F766E" font-weight="700">Silhueta</text>
      </svg>
      <div class="chart-legend">
        <span class="legend-item"><span class="legend-dot" style="background:#1D4ED8;"></span>WCSS / Inércia (Cotovelo)</span>
        <span class="legend-item"><span class="legend-dot" style="background:#0F766E;"></span>Índice de Silhueta (Ativo: K=${selectedK})</span>
      </div>
    `;
  }

  function buildCentroidsBarSVG(perfis, factorMeta) {
    const W = 540, H = 250, padL = 44, padR = 16, padT = 18, padB = 42;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const kFactors = factorMeta.length;
    const K = perfis.length;
    const allVals = perfis.flatMap(p => factorMeta.map(fm => p.centroides_fatores[fm.codigo] || 0));
    const maxAbs = Math.max(1.2, ...allVals.map(v => Math.abs(v))) * 1.15;
    const yZero = padT + plotH / 2;
    const scaleY = (plotH / 2) / maxAbs;
    const groupW = plotW / kFactors;
    const barW = Math.min(28, (groupW - 14) / K);

    const groups = factorMeta.map((fm, fi) => {
      const gx = padL + fi * groupW + (groupW - K * barW) / 2;
      const bars = perfis.map((p, ci) => {
        const val = p.centroides_fatores[fm.codigo] || 0;
        const h = Math.abs(val) * scaleY;
        const y = val >= 0 ? yZero - h : yZero;
        const x = gx + ci * barW;
        const col = CLUSTER_COLORS[ci % CLUSTER_COLORS.length];
        return `
          <rect x="${(x + 1).toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(4, barW - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${col}" opacity="0.88" />
          <text x="${(x + barW / 2).toFixed(1)}" y="${(val >= 0 ? y - 3 : y + h + 9).toFixed(1)}" text-anchor="middle" font-size="8.5" fill="${col}" font-weight="700">${fmt(val, 2)}</text>
        `;
      }).join('');
      return `
        ${bars}
        <text x="${(padL + fi * groupW + groupW / 2).toFixed(1)}" y="${H - 14}" text-anchor="middle" font-size="10" fill="#334155" font-weight="700">${esc(fm.nome_curto.slice(0, 14))}</text>
      `;
    }).join('');

    const legend = perfis.map((p, ci) =>
      `<span class="legend-item"><span class="legend-dot" style="background:${CLUSTER_COLORS[ci % CLUSTER_COLORS.length]};"></span>C${p.cluster_id} (n=${p.n})</span>`
    ).join('');

    return `
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}">
        <line x1="${padL}" y1="${yZero.toFixed(1)}" x2="${W - padR}" y2="${yZero.toFixed(1)}" stroke="#64748B" stroke-width="1.2" />
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#CBD5E1" />
        <text x="${padL - 6}" y="${padT + 8}" text-anchor="end" font-size="9" fill="#64748B">+${fmt(maxAbs, 1)}</text>
        <text x="${padL - 6}" y="${yZero + 3}" text-anchor="end" font-size="9" fill="#64748B">0</text>
        <text x="${padL - 6}" y="${padT + plotH}" text-anchor="end" font-size="9" fill="#64748B">-${fmt(maxAbs, 1)}</text>
        ${groups}
      </svg>
      <div class="chart-legend">${legend}</div>
    `;
  }

  function buildClusterTargetBarSVG(perfis, targetCol) {
    const W = 540, H = 230, padL = 52, padR = 20, padT = 22, padB = 42;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const maxVal = Math.max(...perfis.map(p => p.y_media + p.y_dp), 1) * 1.08;
    const minVal = Math.min(0, ...perfis.map(p => p.y_media - p.y_dp));
    const span = (maxVal - minVal) || 1;
    const yAt = (v) => padT + plotH - ((v - minVal) / span) * plotH;
    const slotW = plotW / perfis.length;
    const barW = Math.min(64, slotW * 0.55);

    const items = perfis.map((p, idx) => {
      const cx = padL + idx * slotW + slotW / 2;
      const yTop = yAt(p.y_media);
      const yBase = yAt(minVal);
      const yHi = yAt(p.y_media + p.y_dp);
      const yLo = yAt(Math.max(minVal, p.y_media - p.y_dp));
      const col = CLUSTER_COLORS[idx % CLUSTER_COLORS.length];
      return `
        <rect x="${(cx - barW / 2).toFixed(1)}" y="${yTop.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(2, yBase - yTop).toFixed(1)}" rx="5" fill="${col}" opacity="0.82" />
        <line x1="${cx.toFixed(1)}" y1="${yHi.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${yLo.toFixed(1)}" stroke="#0F172A" stroke-width="1.8" />
        <line x1="${(cx - 7).toFixed(1)}" y1="${yHi.toFixed(1)}" x2="${(cx + 7).toFixed(1)}" y2="${yHi.toFixed(1)}" stroke="#0F172A" stroke-width="1.8" />
        <line x1="${(cx - 7).toFixed(1)}" y1="${yLo.toFixed(1)}" x2="${(cx + 7).toFixed(1)}" y2="${yLo.toFixed(1)}" stroke="#0F172A" stroke-width="1.8" />
        <text x="${cx.toFixed(1)}" y="${(yHi - 6).toFixed(1)}" text-anchor="middle" font-size="10.5" fill="#0F172A" font-weight="800">${fmt(p.y_media, 2)}</text>
        <text x="${cx.toFixed(1)}" y="${H - 22}" text-anchor="middle" font-size="10.5" fill="#334155" font-weight="700">Cluster ${p.cluster_id}</text>
        <text x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="9.5" fill="#64748B">n=${p.n} (${fmt(p.pct, 1)}%)</text>
      `;
    }).join('');

    return `
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}">
        <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="#CBD5E1" />
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#CBD5E1" />
        <text x="${padL - 6}" y="${padT + 8}" text-anchor="end" font-size="9.5" fill="#64748B">${fmt(maxVal, 0)}</text>
        <text x="${padL - 6}" y="${padT + plotH}" text-anchor="end" font-size="9.5" fill="#64748B">${fmt(minVal, 0)}</text>
        ${items}
      </svg>
      <div class="chart-legend"><span class="legend-item">Média de ${esc(targetCol)} ± 1 Desvio-Padrão por Cluster</span></div>
    `;
  }

  function buildBetasBarSVG(coeficientes) {
    const preds = [...coeficientes.slice(1)].sort((a, b) => Math.abs(b.beta_padronizado) - Math.abs(a.beta_padronizado));
    const rowH = 34;
    const W = 540, H = Math.max(170, 44 + preds.length * rowH);
    const padL = 175, padR = 54, padT = 16, padB = 26;
    const plotW = W - padL - padR;
    const maxAbs = Math.max(0.2, ...preds.map(p => Math.abs(p.beta_padronizado))) * 1.15;
    const hasNeg = preds.some(p => p.beta_padronizado < 0);
    const xZero = hasNeg ? padL + plotW / 2 : padL;
    const scaleX = (hasNeg ? plotW / 2 : plotW) / maxAbs;

    const bars = preds.map((c, idx) => {
      const y = padT + idx * rowH;
      const beta = c.beta_padronizado;
      const bw = Math.abs(beta) * scaleX;
      const x = beta >= 0 ? xZero : xZero - bw;
      const col = beta >= 0 ? PALETTE[idx % PALETTE.length] : '#DC2626';
      const lbl = (c.rotulo || c.termo).slice(0, 26);
      return `
        <text x="${padL - 8}" y="${y + 17}" text-anchor="end" font-size="11" fill="#1E293B" font-weight="700">${esc(lbl)}</text>
        <rect x="${x.toFixed(1)}" y="${y + 4}" width="${Math.max(3, bw).toFixed(1)}" height="20" rx="4" fill="${col}" opacity="0.88" />
        <text x="${(beta >= 0 ? x + bw + 6 : x - 6).toFixed(1)}" y="${y + 18}" text-anchor="${beta >= 0 ? 'start' : 'end'}" font-size="10.5" fill="#0F172A" font-weight="800">${beta >= 0 ? '+' : ''}${fmt(beta, 3)}</text>
      `;
    }).join('');

    return `
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}">
        <line x1="${xZero.toFixed(1)}" y1="${padT - 4}" x2="${xZero.toFixed(1)}" y2="${H - padB}" stroke="#64748B" stroke-width="1.2" />
        ${bars}
        <text x="${W / 2}" y="${H - 6}" text-anchor="middle" font-size="10" fill="#475569" font-weight="700">Coeficiente Padronizado (Beta)</text>
      </svg>
    `;
  }

  function buildScatterSVG(points, xLabel, yLabel, opts = {}) {
    const W = 540, H = 240, padL = 48, padR = 18, padT = 18, padB = 36;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = opts.forceZeroSymmetric ? -Math.max(3.2, ...ys.map(Math.abs)) : Math.min(...ys);
    const maxY = opts.forceZeroSymmetric ? Math.max(3.2, ...ys.map(Math.abs)) : Math.max(...ys);
    const spanX = (maxX - minX) || 1, spanY = (maxY - minY) || 1;
    const xAt = (v) => padL + ((v - minX) / spanX) * plotW;
    const yAt = (v) => padT + plotH - ((v - minY) / spanY) * plotH;

    let refLine = '';
    if (opts.diagonal) {
      const lo = Math.max(minX, minY), hi = Math.min(maxX, maxY);
      refLine = `<line x1="${xAt(lo).toFixed(1)}" y1="${yAt(lo).toFixed(1)}" x2="${xAt(hi).toFixed(1)}" y2="${yAt(hi).toFixed(1)}" stroke="#DC2626" stroke-dasharray="5 4" stroke-width="1.6" />`;
    }
    if (opts.zeroLine) {
      const y0 = yAt(0);
      refLine += `<line x1="${padL}" y1="${y0.toFixed(1)}" x2="${W - padR}" y2="${y0.toFixed(1)}" stroke="#DC2626" stroke-dasharray="5 4" stroke-width="1.5" />`;
      if (minY < -3 && maxY > 3) {
        refLine += `<line x1="${padL}" y1="${yAt(3).toFixed(1)}" x2="${W - padR}" y2="${yAt(3).toFixed(1)}" stroke="#94A3B8" stroke-dasharray="2 3" />`;
        refLine += `<line x1="${padL}" y1="${yAt(-3).toFixed(1)}" x2="${W - padR}" y2="${yAt(-3).toFixed(1)}" stroke="#94A3B8" stroke-dasharray="2 3" />`;
      }
    }

    const dots = points.map(pt => {
      const col = CLUSTER_COLORS[((pt.cluster || 1) - 1) % CLUSTER_COLORS.length];
      return `<circle cx="${xAt(pt.x).toFixed(1)}" cy="${yAt(pt.y).toFixed(1)}" r="3.4" fill="${col}" opacity="0.72" />`;
    }).join('');

    return `
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}">
        <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="#CBD5E1" />
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#CBD5E1" />
        ${refLine}
        ${dots}
        <text x="${padL - 6}" y="${padT + 8}" text-anchor="end" font-size="9" fill="#64748B">${fmt(maxY, 1)}</text>
        <text x="${padL - 6}" y="${padT + plotH}" text-anchor="end" font-size="9" fill="#64748B">${fmt(minY, 1)}</text>
        <text x="${padL}" y="${H - 18}" font-size="9" fill="#64748B">${fmt(minX, 1)}</text>
        <text x="${W - padR}" y="${H - 18}" text-anchor="end" font-size="9" fill="#64748B">${fmt(maxX, 1)}</text>
        <text x="${W / 2}" y="${H - 4}" text-anchor="middle" font-size="10" fill="#475569" font-weight="700">${esc(xLabel)} vs. ${esc(yLabel)}</text>
      </svg>
    `;
  }

  // =========================================================================
  // VIEW 1: PERSONAS HUB (5 ADAPTIVE PANELS — ZERO HARDCODED VERDICTS)
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

  // --- 1. FELIPE DRUMMOND (EXECUTIVE WHAT-IF & SEGMENTS) ---
  function renderFelipeView() {
    const s = state.summary;
    const er = s.etapa4_regressao;
    const ec = s.etapa3_cluster;
    const aud = s.etapa1_descritiva.auditoria;
    const targetCol = s.meta.targetCol;
    const factorMeta = s.meta.factorMeta;
    const predCoefs = er.coeficientes.slice(1);
    const sortedByBeta = [...predCoefs].sort((a, b) => Math.abs(b.beta_padronizado) - Math.abs(a.beta_padronizado));
    const topFactor = sortedByBeta[0];

    const b0 = er.coeficientes[0]?.b_nao_padronizado ?? 0;
    let deltaY = 0;
    predCoefs.forEach(c => {
      const d = state.simDeltas[c.termo] || 0;
      deltaY += c.b_nao_padronizado * d;
    });
    const newY = b0 + deltaY;
    const ySpan = (aud.y_max_observado - aud.y_min_observado) || 1;
    const deltaNorm100 = (deltaY / ySpan) * 100;
    const pctGain = b0 !== 0 ? (deltaY / Math.abs(b0)) * 100 : 0;

    const eqTerms = predCoefs.map(c => {
      const d = state.simDeltas[c.termo] || 0;
      return `${c.b_nao_padronizado >= 0 ? '+' : '−'} ${fmt(Math.abs(c.b_nao_padronizado), 2)}·(${fmt(d, 1)})`;
    }).join(' ');

    const getFactorShort = (code) => factorMeta.find(f => f.codigo === code)?.nome_curto || code;

    return `
      <div class="grid-4" style="margin-bottom:18px;">
        <div class="kpi-card">
          <div class="kpi-label">Média Atual (${esc(targetCol)})</div>
          <div class="kpi-value">${fmt(aud.y_media_observada, 2)}</div>
          <div class="kpi-foot">Faixa: ${fmt(aud.y_min_observado, 1)} a ${fmt(aud.y_max_observado, 1)} (DP = ${fmt(aud.y_dp_observado, 2)})</div>
        </div>
        <div class="kpi-card" style="background:#F0FDFA; border-color:#5EEAD4;">
          <div class="kpi-label" style="color:#0F766E;">Projeção Simulada (Ŷ)</div>
          <div class="kpi-value" style="color:#0F766E;">${fmt(newY, 2)} <span style="font-size:14px;">(${deltaY >= 0 ? '+' : ''}${fmt(deltaY, 2)})</span></div>
          <div class="kpi-foot">${deltaNorm100 >= 0 ? '+' : ''}${fmt(deltaNorm100, 2)} pts na escala 0–100 (${pctGain >= 0 ? '+' : ''}${fmt(pctGain, 1)}%)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Poder Explicativo (R²)</div>
          <div class="kpi-value">${fmt(er.r2 * 100, 2)}%</div>
          <div class="kpi-foot">R² Ajust. = ${fmt(er.r2_ajustado * 100, 2)}% | F = ${fmt(er.f_anova, 2)} (p ${fmtP(er.p_anova)})</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Principal Fator Preditor</div>
          <div class="kpi-value" style="font-size:17px; color:var(--secondary); margin-top:8px;">${esc(topFactor?.nome_curto || topFactor?.termo || '—')}</div>
          <div class="kpi-foot">Beta = ${fmt(topFactor?.beta_padronizado, 4)} | B = ${topFactor?.b_nao_padronizado >= 0 ? '+' : ''}${fmt(topFactor?.b_nao_padronizado, 2)}/DP</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">🎛️ Simulador What-If Dinâmico (Equação OLS — ${predCoefs.length} Fatores)</div>
              <div class="card-subtitle">Simule variações em desvios-padrão (DP) nos fatores extraídos automaticamente da base ativa</div>
            </div>
          </div>

          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
            <button class="btn ${state.simPreset === 'base' ? 'btn-primary' : 'btn-outline'}" onclick="window.AppUI.applySimPreset('base')">
              ↺ Base (0 DP)
            </button>
            <button class="btn ${state.simPreset === 'top1' ? 'btn-primary' : 'btn-outline'}" onclick="window.AppUI.applySimPreset('top1')">
              🎯 Foco no #1 Fator (+1,0 DP)
            </button>
            <button class="btn ${state.simPreset === 'balanced' ? 'btn-primary' : 'btn-outline'}" onclick="window.AppUI.applySimPreset('balanced')">
              ⚖️ Melhoria Equilibrada (+0,5 DP)
            </button>
            <button class="btn ${state.simPreset === 'adverse' ? 'btn-primary' : 'btn-outline'}" onclick="window.AppUI.applySimPreset('adverse')">
              📉 Cenário Adverso (−0,5 DP)
            </button>
          </div>

          ${sortedByBeta.map((c, idx) => {
            const d = state.simDeltas[c.termo] || 0;
            const contrib = c.b_nao_padronizado * d;
            const col = PALETTE[idx % PALETTE.length];
            return `
              <div class="slider-group">
                <div class="slider-head">
                  <span>${esc(c.rotulo)} (B = ${c.b_nao_padronizado >= 0 ? '+' : ''}${fmt(c.b_nao_padronizado, 2)} | β = ${fmt(c.beta_padronizado, 3)})</span>
                  <span style="color:${col}; white-space:nowrap;">${d >= 0 ? '+' : ''}${fmt(d, 1)} DP → ${contrib >= 0 ? '+' : ''}${fmt(contrib, 2)}</span>
                </div>
                <input type="range" min="-2.0" max="2.0" step="0.1" value="${d}" oninput="window.AppUI.updateSimSlider('${esc(c.termo)}', this.value)" />
              </div>
            `;
          }).join('')}

          <div class="callout info" style="margin-top:14px; margin-bottom:0;">
            <h4>💡 Equação OLS Aplicada</h4>
            <p>Ŷ = ${fmt(b0, 2)} ${eqTerms} = <strong>${fmt(newY, 2)}</strong></p>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">🎯 Mapa Automático de Segmentos (K = ${ec.perfis_k3.length} Clusters)</div>
              <div class="card-subtitle">Resumo quantitativo dos centróides e médias de ${esc(targetCol)} calculados na base ativa</div>
            </div>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Segmento</th>
                  <th class="num">n (%)</th>
                  <th class="num">Média ${esc(targetCol)}</th>
                  <th>Menor Centróide (Déficit)</th>
                  <th>Maior Centróide (Destaque)</th>
                </tr>
              </thead>
              <tbody>
                ${ec.perfis_k3.map(p => {
                  const minCode = p.fator_menor_centroide;
                  const maxCode = p.fator_maior_centroide;
                  return `
                    <tr>
                      <td><strong>Cluster ${p.cluster_id}</strong><br/><span style="font-size:11px; color:var(--text-muted);">${esc(p.rotulo_curto)}</span></td>
                      <td class="num"><strong>${p.n}</strong> (${fmt(p.pct, 1)}%)</td>
                      <td class="num"><span class="badge ${clusterBadgeClass(p.cluster_id, ec.perfis_k3.length)}">${fmt(p.y_media, 2)}</span></td>
                      <td>${esc(getFactorShort(minCode))} <strong style="color:var(--danger);">(${fmt(p.centroides_fatores[minCode], 2)})</strong></td>
                      <td>${esc(getFactorShort(maxCode))} <strong style="color:var(--success);">(${fmt(p.centroides_fatores[maxCode], 2)})</strong></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <div style="margin-top:16px;">
            ${buildClusterTargetBarSVG(ec.perfis_k3, targetCol)}
          </div>
        </div>
      </div>
    `;
  }

  function applySimPreset(preset) {
    const s = state.summary;
    const preds = s.etapa4_regressao.coeficientes.slice(1);
    const sorted = [...preds].sort((a, b) => Math.abs(b.beta_padronizado) - Math.abs(a.beta_padronizado));
    state.simPreset = preset;
    preds.forEach(c => {
      if (preset === 'base') state.simDeltas[c.termo] = 0;
      else if (preset === 'top1') state.simDeltas[c.termo] = (c.termo === sorted[0]?.termo) ? 1.0 : 0;
      else if (preset === 'balanced') state.simDeltas[c.termo] = 0.5;
      else if (preset === 'adverse') state.simDeltas[c.termo] = -0.5;
    });
    renderPersonasView();
  }

  function updateSimSlider(factorCode, val) {
    state.simDeltas[factorCode] = parseFloat(val);
    state.simPreset = 'custom';
    renderPersonasView();
  }

  // --- 2. CAIO VENTURA (CATEGORICAL AUDIT & FACTOR IMPACT BY CLUSTER) ---
  function renderCaioView() {
    const s = state.summary;
    const meta = s.meta;
    const ec = s.etapa3_cluster;
    const segC = s.etapa5_integracao.regressao_por_cluster;
    const catCols = meta.catCols;
    const activeCatCol = catCols.includes(state.caioCatCol) ? state.caioCatCol : (catCols[0] || null);
    const activeFactor = meta.factorCodes.includes(state.caioFactorCode) ? state.caioFactorCode : meta.factorCodes[0];
    const activeFactorMeta = meta.factorMeta.find(f => f.codigo === activeFactor) || { codigo: activeFactor, nome: activeFactor };

    let catCardHtml = `
      <div class="callout info" style="margin-bottom:0;">
        <h4>Sem variáveis categóricas detectadas</h4>
        <p>A base carregada contém apenas variáveis numéricas. O painel ao lado permanece ativo com a regressão segmentada por cluster.</p>
      </div>
    `;

    if (activeCatCol) {
      const catInfo = s.etapa1_descritiva.categoricas[activeCatCol];
      const ct = ec.crosstabs_qui_quadrado[activeCatCol];
      catCardHtml = `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>${esc(activeCatCol)}</th>
                <th class="num">n (%)</th>
                <th class="num">Média ${esc(meta.targetCol)} (DP)</th>
                ${ec.perfis_k3.map(p => `<th class="num">C${p.cluster_id}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${(catInfo?.table || []).map(row => {
                const key = row.categoria;
                return `
                  <tr>
                    <td><strong>${esc(key)}</strong></td>
                    <td class="num">${row.freq} (${fmt(row.pct, 1)}%)</td>
                    <td class="num"><strong>${fmt(row.y_media, 2)}</strong> (DP=${fmt(row.y_dp, 1)})</td>
                    ${ec.perfis_k3.map(p => {
                      const cnt = ct?.contagem?.[key]?.[String(p.cluster_id)] || 0;
                      const pct = row.freq ? (cnt / row.freq) * 100 : 0;
                      return `<td class="num">${cnt} (${fmt(pct, 1)}%)</td>`;
                    }).join('')}
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div class="callout ${catInfo?.anova_y_p < 0.05 ? '' : 'info'}" style="margin-top:14px; margin-bottom:0;">
          <h4>Resultado dos Testes Estatísticos (${esc(activeCatCol)})</h4>
          <p>
            <strong>ANOVA sobre ${esc(meta.targetCol)}:</strong> F = ${fmt(catInfo?.anova_y_f, 4)}, p = ${fmtP(catInfo?.anova_y_p)}
            (${catInfo?.anova_y_p < 0.05 ? 'diferença estatisticamente significativa a 5%' : 'sem diferença significativa entre categorias a 5%'}).<br/>
            <strong>Qui-Quadrado vs. Clusters:</strong> χ² = ${fmt(ct?.chi2, 4)} (gl = ${ct?.gl}), p = ${fmtP(ct?.p_valor)}
            (${ct?.significativo_5pct ? 'associação significativa a 5%' : 'distribuição independente dos clusters a 5%'}).
          </p>
        </div>
      `;
    }

    return `
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">🏢 1. Auditoria Categórica: ${esc(meta.targetCol)} & Clusters</div>
              <div class="card-subtitle">Testes ANOVA One-Way e Qui-Quadrado recalculados automaticamente</div>
            </div>
            ${catCols.length ? `
              <select class="control-select" onchange="window.AppUI.setCaioCatCol(this.value)">
                ${catCols.map(c => `<option value="${esc(c)}" ${c === activeCatCol ? 'selected' : ''}>Coluna: ${esc(c)}</option>`).join('')}
              </select>
            ` : ''}
          </div>
          ${catCardHtml}
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">🛠️ 2. Impacto Segmentado por Cluster (${esc(activeFactorMeta.nome_curto || activeFactor)})</div>
              <div class="card-subtitle">Centróide e regressão OLS segmentada dentro de cada cluster</div>
            </div>
            <select class="control-select" onchange="window.AppUI.setCaioFactor(this.value)">
              ${meta.factorMeta.map(fm => `<option value="${esc(fm.codigo)}" ${fm.codigo === activeFactor ? 'selected' : ''}>${esc(fm.nome)}</option>`).join('')}
            </select>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cluster</th>
                  <th class="num">n</th>
                  <th class="num">Centróide Z</th>
                  <th class="num">Média Itens</th>
                  <th class="num">Coef. B</th>
                  <th class="num">Beta (p-valor)</th>
                  <th class="num">R² Cluster</th>
                </tr>
              </thead>
              <tbody>
                ${ec.perfis_k3.map(p => {
                  const seg = segC[`Cluster_${p.cluster_id}`];
                  const sc = seg?.coeficientes?.[activeFactor];
                  const z = p.centroides_fatores[activeFactor] ?? 0;
                  return `
                    <tr>
                      <td><strong>Cluster ${p.cluster_id}</strong></td>
                      <td class="num">${p.n}</td>
                      <td class="num"><span class="badge ${z < 0 ? 'badge-red' : 'badge-teal'}">${z >= 0 ? '+' : ''}${fmt(z, 3)}</span></td>
                      <td class="num">${fmt(p.medias_por_fator_original?.[activeFactor], 2)}</td>
                      <td class="num">${sc && sc.b !== null ? (sc.b >= 0 ? '+' : '') + fmt(sc.b, 2) : '—'}</td>
                      <td class="num">${sc && sc.beta !== null ? `<strong>${fmt(sc.beta, 3)}</strong> (p=${fmtP(sc.p)})` : 'n insuf.'}</td>
                      <td class="num">${seg && seg.r2 !== null ? fmt(seg.r2 * 100, 1) + '%' : '—'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          <div style="margin-top:14px;">
            ${buildCentroidsBarSVG(ec.perfis_k3, meta.factorMeta)}
          </div>
        </div>
      </div>
    `;
  }

  function setCaioCatCol(col) {
    state.caioCatCol = col;
    renderPersonasView();
  }

  function setCaioFactor(fc) {
    state.caioFactorCode = fc;
    renderPersonasView();
  }

  // --- 3. JULIANA BRAGA (CRITICAL INDICATORS & PRIORITY LIST) ---
  function renderJulianaView() {
    const s = state.summary;
    const meta = s.meta;
    const er = s.etapa4_regressao;
    const ec = s.etapa3_cluster;
    const descFeatures = s.etapa1_descritiva.tabela_descritiva.filter(d => d.variavel !== meta.targetCol);
    const lowestVar = [...descFeatures].sort((a, b) => a.media - b.media)[0];
    const sortedPreds = [...er.coeficientes.slice(1)].sort((a, b) => Math.abs(b.beta_padronizado) - Math.abs(a.beta_padronizado));
    const top1 = sortedPreds[0];
    const top2 = sortedPreds[1] || sortedPreds[0];
    const c1 = ec.perfis_k3[0];

    const f1Code = top1?.termo;
    const f2Code = top2?.termo;
    const criticalRows = [...state.rows]
      .filter(r => r.Cluster_K === 1)
      .sort((a, b) => ((a[f1Code] || 0) + (a[f2Code] || 0)) - ((b[f1Code] || 0) + (b[f2Code] || 0)))
      .slice(0, 10);

    const showCats = meta.catCols.slice(0, 2);

    return `
      <div class="grid-4" style="margin-bottom:18px;">
        <div class="kpi-card">
          <div class="kpi-label">1º Preditor (${esc(top1?.nome_curto || '—')})</div>
          <div class="kpi-value" style="color:var(--secondary);">${top1?.b_nao_padronizado >= 0 ? '+' : ''}${fmt(top1?.b_nao_padronizado, 2)} / DP</div>
          <div class="kpi-foot">Beta = ${fmt(top1?.beta_padronizado, 4)} | p ${fmtP(top1?.p_valor)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">2º Preditor (${esc(top2?.nome_curto || '—')})</div>
          <div class="kpi-value" style="color:var(--purple);">${top2?.b_nao_padronizado >= 0 ? '+' : ''}${fmt(top2?.b_nao_padronizado, 2)} / DP</div>
          <div class="kpi-foot">Beta = ${fmt(top2?.beta_padronizado, 4)} | p ${fmtP(top2?.p_valor)}</div>
        </div>
        <div class="kpi-card" style="background:#FEF2F2; border-color:#FCA5A5;">
          <div class="kpi-label" style="color:var(--danger);">Cluster 1 (Menor ${esc(meta.targetCol)})</div>
          <div class="kpi-value" style="color:var(--danger);">${c1?.n || 0} reg. (${fmt(c1?.pct, 1)}%)</div>
          <div class="kpi-foot">Média ${esc(meta.targetCol)} = ${fmt(c1?.y_media, 2)} (DP = ${fmt(c1?.y_dp, 2)})</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Menor Média Entre Preditores</div>
          <div class="kpi-value" style="color:var(--amber);">${esc(lowestVar?.variavel || '—')} = ${fmt(lowestVar?.media, 2)}</div>
          <div class="kpi-foot">${esc(lowestVar?.descricao || '')} (DP = ${fmt(lowestVar?.dp, 2)})</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">📉 Raio-X das Variáveis Preditoras por Cluster (${meta.featureCols.length} itens)</div>
              <div class="card-subtitle">Médias originais em cada cluster (C1..C${ec.perfis_k3.length}) e correlação de Pearson com ${esc(meta.targetCol)}</div>
            </div>
          </div>
          <div class="table-wrap" style="max-height:460px; overflow-y:auto;">
            <table>
              <thead>
                <tr>
                  <th>Var</th>
                  <th>Indicador</th>
                  ${ec.perfis_k3.map(p => `<th class="num">C${p.cluster_id}</th>`).join('')}
                  <th class="num">r c/ ${esc(meta.targetCol)}</th>
                </tr>
              </thead>
              <tbody>
                ${s.etapa1_descritiva.correlacoes_com_y.map(c => `
                  <tr>
                    <td><strong>${esc(c.variavel)}</strong></td>
                    <td>${esc(c.descricao)}</td>
                    ${ec.perfis_k3.map(p => {
                      const val = p.medias_originais?.[c.variavel];
                      return `<td class="num">${fmt(val, 2)}</td>`;
                    }).join('')}
                    <td class="num"><span class="badge ${Math.abs(c.r) > 0.4 ? 'badge-green' : Math.abs(c.r) > 0.25 ? 'badge-blue' : 'badge-amber'}">${fmt(c.r, 3)}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">🚨 Registros Prioritários no Cluster 1 (Top 10 Menores Escores)</div>
              <div class="card-subtitle">Ordenados pela soma combinada dos 2 principais preditores (${esc(top1?.nome_curto || f1Code)} e ${esc(top2?.nome_curto || f2Code)})</div>
            </div>
          </div>
          <div class="table-wrap" style="max-height:460px; overflow-y:auto;">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  ${showCats.map(cc => `<th>${esc(cc)}</th>`).join('')}
                  <th class="num">${esc(top1?.nome_curto || f1Code)}</th>
                  ${f2Code !== f1Code ? `<th class="num">${esc(top2?.nome_curto || f2Code)}</th>` : ''}
                  <th class="num">${esc(meta.targetCol)}</th>
                  <th class="num">Ŷ</th>
                </tr>
              </thead>
              <tbody>
                ${criticalRows.map(r => `
                  <tr>
                    <td><strong>#${esc(r.ID)}</strong></td>
                    ${showCats.map(cc => `<td>${esc(r[cc] ?? '—')}</td>`).join('')}
                    <td class="num" style="color:${r[f1Code] < 0 ? 'var(--danger)' : 'inherit'};">${fmt(r[f1Code], 2)}</td>
                    ${f2Code !== f1Code ? `<td class="num" style="color:${r[f2Code] < 0 ? 'var(--danger)' : 'inherit'};">${fmt(r[f2Code], 2)}</td>` : ''}
                    <td class="num"><strong>${fmt(r[meta.targetCol], 2)}</strong></td>
                    <td class="num">${fmt(r.Y_Predito, 1)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // --- 4. LUCAS FERREIRA (GROUPS RANKING & TOP PERFORMERS) ---
  function renderLucasView() {
    const s = state.summary;
    const meta = s.meta;
    const catCols = meta.catCols;
    const groupCol = catCols.includes(state.lucasGroupCol) ? state.lucasGroupCol : (catCols[0] || null);
    const profiles = groupCol ? (s.etapa5_integracao.perfis_por_coluna_categorica[groupCol] || []) : [];
    const K = s.etapa3_cluster.perfis_k3.length;

    const filterCatCol = meta.primaryCatCol;
    const filterOptions = filterCatCol
      ? [...new Set(state.rows.map(r => String(r[filterCatCol] ?? 'N/A')))].sort()
      : [];
    const activeFilter = (filterCatCol && filterOptions.includes(state.lucasFilterVal)) ? state.lucasFilterVal : 'ALL';

    const topVars = s.etapa1_descritiva.correlacoes_com_y.slice(0, 3);
    const topRows = [...state.rows]
      .filter(r => activeFilter === 'ALL' || String(r[filterCatCol] ?? 'N/A') === activeFilter)
      .sort((a, b) => Number(b[meta.targetCol]) - Number(a[meta.targetCol]))
      .slice(0, 10);

    return `
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">🏆 Ranking de Desempenho por Grupo (${esc(groupCol || 'Sem agrupamento')})</div>
              <div class="card-subtitle">Média de ${esc(meta.targetCol)}, escores fatoriais médios e distribuição de clusters</div>
            </div>
            ${catCols.length ? `
              <select class="control-select" onchange="window.AppUI.setLucasGroupCol(this.value)">
                ${catCols.map(c => `<option value="${esc(c)}" ${c === groupCol ? 'selected' : ''}>Agrupar por: ${esc(c)}</option>`).join('')}
              </select>
            ` : ''}
          </div>
          ${groupCol ? `
            <div class="table-wrap" style="max-height:460px; overflow-y:auto;">
              <table>
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>${esc(groupCol)}</th>
                    <th class="num">n</th>
                    <th class="num">Média ${esc(meta.targetCol)}</th>
                    ${meta.factorMeta.map(fm => `<th class="num">${esc(fm.nome_curto.slice(0, 9))}</th>`).join('')}
                    <th class="center">Clusters (${Array.from({ length: K }, (_, i) => `C${i + 1}`).join('/')})</th>
                  </tr>
                </thead>
                <tbody>
                  ${profiles.map((g, idx) => `
                    <tr>
                      <td class="center"><strong>${idx + 1}º</strong></td>
                      <td><strong>${esc(g.grupo)}</strong></td>
                      <td class="num">${g.n}</td>
                      <td class="num"><strong>${fmt(g.y_media, 2)}</strong></td>
                      ${meta.factorCodes.map(fc => `<td class="num">${fmt(g[fc], 2)}</td>`).join('')}
                      <td class="center">${Array.from({ length: K }, (_, i) => g.clusters_dist[`C${i + 1}`] || 0).join(' / ')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="callout info" style="margin-bottom:0;">
              <h4>Sem coluna categórica para agrupamento</h4>
              <p>A base enviada contém apenas colunas numéricas. Consulte os Top 10 registros individuais no painel ao lado.</p>
            </div>
          `}
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">⭐ Top 10 Registros de Maior ${esc(meta.targetCol)}</div>
              <div class="card-subtitle">Exibindo as 3 variáveis mais correlacionadas com ${esc(meta.targetCol)} na base ativa</div>
            </div>
            ${filterCatCol ? `
              <select class="control-select" onchange="window.AppUI.setLucasFilterVal(this.value)">
                <option value="ALL">${esc(filterCatCol)}: Todos</option>
                ${filterOptions.map(v => `<option value="${esc(v)}" ${v === activeFilter ? 'selected' : ''}>${esc(v)}</option>`).join('')}
              </select>
            ` : ''}
          </div>
          <div class="table-wrap" style="max-height:460px; overflow-y:auto;">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  ${groupCol ? `<th>${esc(groupCol)}</th>` : ''}
                  ${topVars.map(tv => `<th class="num">${esc(tv.variavel)}</th>`).join('')}
                  <th class="center">Cluster</th>
                  <th class="num">${esc(meta.targetCol)}</th>
                </tr>
              </thead>
              <tbody>
                ${topRows.map(r => `
                  <tr>
                    <td><strong>#${esc(r.ID)}</strong></td>
                    ${groupCol ? `<td>${esc(r[groupCol] ?? '—')}</td>` : ''}
                    ${topVars.map(tv => `<td class="num">${fmt(r[tv.variavel], 1)}</td>`).join('')}
                    <td class="center"><span class="badge ${clusterBadgeClass(r.Cluster_K, K)}">C${r.Cluster_K}</span></td>
                    <td class="num"><span class="badge badge-green">${fmt(r[meta.targetCol], 2)}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function setLucasGroupCol(col) {
    state.lucasGroupCol = col;
    renderPersonasView();
  }

  function setLucasFilterVal(val) {
    state.lucasFilterVal = val;
    renderPersonasView();
  }

  // --- 5. PRIYA SHARMA (DYNAMIC INDIVIDUAL CLASSIFIER) ---
  function renderPriyaView() {
    const s = state.summary;
    const meta = s.meta;
    const K = s.etapa3_cluster.perfis_k3.length;
    const pred = window.TechNovaStatsEngine.predictIndividualCollaborator(state.priyaVScores, s);
    const currentEmp = state.rows.find(r => String(r.ID) === String(state.priyaSelectedId));

    const coefMap = {};
    s.etapa4_regressao.coeficientes.slice(1).forEach(c => { coefMap[c.termo] = c; });

    const alerts = meta.factorMeta.map(fm => {
      const z = pred.fScores[fm.codigo] || 0;
      const c = coefMap[fm.codigo];
      const status = z < -0.5 ? '🔴 Abaixo da média' : z > 0.5 ? '🟢 Acima da média' : '🟡 Próximo à média';
      return `${status} — <strong>${esc(fm.nome)}</strong>: escore Z = <strong>${z >= 0 ? '+' : ''}${fmt(z, 2)} DP</strong> (peso na regressão: β = ${fmt(c?.beta_padronizado, 3)}, B = ${c?.b_nao_padronizado >= 0 ? '+' : ''}${fmt(c?.b_nao_padronizado, 2)}/DP).`;
    });

    const descFeatures = s.etapa1_descritiva.tabela_descritiva.filter(d => d.variavel !== meta.targetCol);

    return `
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">🎚️ Simulador & Classificador Individual (${meta.featureCols.length} Variáveis)</div>
              <div class="card-subtitle">Carregue um registro da base ativa ou ajuste os sliders na escala real de cada coluna</div>
            </div>
          </div>

          <div style="margin-bottom:14px;">
            <label style="font-weight:700; font-size:12.5px; display:block; margin-bottom:4px;">Carregar Registro da Base Ativa (N = ${state.rows.length}):</label>
            <select class="control-select" style="width:100%; padding:8px; font-weight:600;" onchange="window.AppUI.loadCollaboratorIntoPriya(this.value)">
              <option value="__custom__" ${!currentEmp ? 'selected' : ''}>— Perfil Personalizado Manualmente —</option>
              ${state.rows.map(r => {
                const catPreview = meta.catCols.slice(0, 2).map(cc => r[cc]).filter(Boolean).join(' | ');
                return `
                  <option value="${esc(r.ID)}" ${String(r.ID) === String(state.priyaSelectedId) ? 'selected' : ''}>
                    ID #${esc(r.ID)}${catPreview ? ' — ' + esc(catPreview) : ''} (${esc(meta.targetCol)} = ${fmt(r[meta.targetCol], 2)} | C${r.Cluster_K})
                  </option>
                `;
              }).join('')}
            </select>
          </div>

          <div class="grid-2" style="gap:10px; max-height:430px; overflow-y:auto; padding-right:6px;">
            ${descFeatures.map(d => {
              const v = d.variavel;
              const val = state.priyaVScores[v] ?? d.media;
              const span = (d.max - d.min) || 1;
              const step = (Number.isInteger(d.min) && Number.isInteger(d.max) && span <= 20) ? 1 : Number((span / 50).toFixed(2)) || 0.1;
              return `
                <div style="background:var(--surface-alt); padding:8px 10px; border-radius:8px; border:1px solid var(--border);">
                  <div style="display:flex; justify-content:space-between; font-size:11.5px; font-weight:700; gap:6px;">
                    <span>${esc(v)}: ${esc(d.descricao.slice(0, 24))}</span>
                    <span style="color:var(--primary); white-space:nowrap;">${fmt(val, step < 1 ? 1 : 0)}</span>
                  </div>
                  <input type="range" min="${d.min}" max="${d.max}" step="${step}" value="${val}" oninput="window.AppUI.updatePriyaVScore('${esc(v)}', this.value)" />
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">🤖 Classificação & Previsão Automatizada</div>
              <div class="card-subtitle">Pesos Varimax exatos + Distância Euclidiana aos ${K} Centróides + Equação OLS ativa</div>
            </div>
          </div>

          <div class="grid-2" style="margin-bottom:16px;">
            <div class="kpi-card" style="background:#F0FDFA; border-color:#5EEAD4;">
              <div class="kpi-label" style="color:#0F766E;">${esc(meta.targetCol)} Previsto (Ŷ OLS)</div>
              <div class="kpi-value" style="color:#0F766E;">${fmt(pred.yPredito, 2)}</div>
              <div class="kpi-foot">${currentEmp ? `Valor real no ID #${esc(currentEmp.ID)}: <strong>${fmt(currentEmp[meta.targetCol], 2)}</strong>` : 'Cálculo em tempo real pelo modelo OLS'}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Cluster Classificado</div>
              <div class="kpi-value" style="font-size:16px; margin-top:8px;">
                <span class="badge ${clusterBadgeClass(pred.cluster.cluster_id, K)}" style="font-size:12.5px; padding:4px 10px;">
                  ${esc(pred.cluster.rotulo_curto)}
                </span>
              </div>
              <div class="kpi-foot" style="margin-top:6px;">Distância Euclidiana ao centróide: ${fmt(pred.distToCentroid, 3)}</div>
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <div style="font-weight:800; font-size:13px; margin-bottom:8px;">📐 Escores Fatoriais Padronizados (Z) — ${meta.n_fatores} Fatores:</div>
            <div class="grid-2" style="gap:10px;">
              ${meta.factorMeta.map((fm, idx) => {
                const z = pred.fScores[fm.codigo] || 0;
                const pct = Math.max(5, Math.min(95, ((z + 2.5) / 5.0) * 100));
                const col = PALETTE[idx % PALETTE.length];
                return `
                  <div style="padding:10px; border:1px solid var(--border); border-radius:8px;">
                    <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700; gap:6px;">
                      <span>${esc(fm.nome_curto)}</span>
                      <span style="color:${z >= 0 ? 'var(--success)' : 'var(--danger)'};">${z >= 0 ? '+' : ''}${fmt(z, 3)} DP</span>
                    </div>
                    <div class="bar-track">
                      <div class="bar-fill" style="width:${pct}%; background:${col};"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="callout info" style="margin-bottom:0;">
            <h4>📋 Leitura Automática dos Escores Fatoriais</h4>
            <ul style="margin-left:18px; margin-top:6px; font-size:12.3px; line-height:1.6;">
              ${alerts.map(a => `<li>${a}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  function loadCollaboratorIntoPriya(idVal) {
    if (idVal === '__custom__') return;
    const emp = state.rows.find(r => String(r.ID) === String(idVal));
    if (emp) {
      state.priyaSelectedId = emp.ID;
      state.summary.meta.featureCols.forEach(col => {
        state.priyaVScores[col] = Number(emp[col]);
      });
      renderPersonasView();
    }
  }

  function updatePriyaVScore(vKey, val) {
    state.priyaVScores[vKey] = Number(val);
    state.priyaSelectedId = null;
    renderPersonasView();
  }

  // =========================================================================
  // VIEW 2: 5-STAGE ANALYTICAL FLOW (100% AUTOMATIC RECALCULATION)
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
    const s = state.summary;
    const meta = s.meta;
    const e1 = s.etapa1_descritiva;
    const aud = e1.auditoria;
    const cols = Object.keys(e1.matriz_correlacao);
    const catKeys = Object.keys(e1.categoricas || {});

    return `
      <div class="callout">
        <h4>🔍 Etapa 1 — Auditoria Automática da Base & Estatística Descritiva</h4>
        <p>${esc(aud.nota_auditoria_y)}</p>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">📋 1.1 Medidas de Tendência Central, Dispersão e Normalidade (${meta.featureCols.length} Preditores + ${esc(meta.targetCol)})</div>
            <div class="card-subtitle">Recalculadas automaticamente: Média, Mediana, Moda, DP, Variância, CV%, Assimetria, Curtose e Teste KS</div>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Var</th>
                <th>Descrição</th>
                <th>Papel</th>
                <th class="num">Média</th>
                <th class="num">Mediana</th>
                <th class="num">Moda</th>
                <th class="num">DP</th>
                <th class="num">CV (%)</th>
                <th class="center">Mín–Máx</th>
                <th class="num">Assim.</th>
                <th class="num">Curtose</th>
                <th class="num">KS (p)</th>
              </tr>
            </thead>
            <tbody>
              ${e1.tabela_descritiva.map(r => `
                <tr>
                  <td><strong>${esc(r.variavel)}</strong></td>
                  <td>${esc(r.descricao)}</td>
                  <td><span class="badge ${r.variavel === meta.targetCol ? 'badge-blue' : 'badge-teal'}">${esc(r.dimensao_teorica)}</span></td>
                  <td class="num"><strong>${fmt(r.media, 2)}</strong></td>
                  <td class="num">${fmt(r.mediana, 2)}</td>
                  <td class="num">${fmt(r.moda, 1)}</td>
                  <td class="num">${fmt(r.dp, 2)}</td>
                  <td class="num"><strong>${fmt(r.cv_pct, 1)}%</strong></td>
                  <td class="center">${fmt(r.min, 1)} – ${fmt(r.max, 1)}</td>
                  <td class="num">${fmt(r.assimetria, 2)}</td>
                  <td class="num">${fmt(r.curtose, 2)}</td>
                  <td class="num">${fmtP(r.ks_p)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      ${catKeys.length ? `
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">🏷️ 1.2 Variáveis Categóricas & ANOVA sobre ${esc(meta.targetCol)}</div>
              <div class="card-subtitle">Frequências, médias de ${esc(meta.targetCol)} e teste F One-Way recalculados para cada coluna categórica</div>
            </div>
          </div>
          <div class="grid-${Math.min(3, catKeys.length)}">
            ${catKeys.map(ck => {
              const info = e1.categoricas[ck];
              return `
                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>${esc(ck)}</th>
                        <th class="num">n (%)</th>
                        <th class="num">Média ${esc(meta.targetCol)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${info.table.map(row => `
                        <tr>
                          <td><strong>${esc(row.categoria)}</strong></td>
                          <td class="num">${row.freq} (${fmt(row.pct, 1)}%)</td>
                          <td class="num">${fmt(row.y_media, 2)} ± ${fmt(row.y_dp, 1)}</td>
                        </tr>
                      `).join('')}
                      <tr style="background:#EFF6FF;">
                        <td colspan="3" style="font-size:11.5px; font-weight:700; color:var(--secondary);">
                          ANOVA: F = ${fmt(info.anova_y_f, 3)} | p = ${fmtP(info.anova_y_p)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">📊 1.3 Correlações de Pearson com ${esc(meta.targetCol)}</div>
              <div class="card-subtitle">Ordenadas por magnitude absoluta de correlação |r|</div>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Variável</th>
                  <th>Indicador</th>
                  <th class="num">Correlação (r)</th>
                  <th class="num">Valor-p</th>
                </tr>
              </thead>
              <tbody>
                ${e1.correlacoes_com_y.map((c, idx) => `
                  <tr>
                    <td class="center"><strong>${idx + 1}º</strong></td>
                    <td><strong>${esc(c.variavel)}</strong></td>
                    <td>${esc(c.descricao)}</td>
                    <td class="num"><span class="badge ${Math.abs(c.r) > 0.4 ? 'badge-green' : Math.abs(c.r) > 0.25 ? 'badge-blue' : 'badge-amber'}">${fmt(c.r, 4)}</span></td>
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
              <div class="card-title">🔗 1.4 Top 15 Pares de Preditores Mais Correlacionados</div>
              <div class="card-subtitle">Covariação entre variáveis observadas que fundamenta a Análise Fatorial</div>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ordem</th>
                  <th>Par de Variáveis</th>
                  <th class="num">Correlação (r)</th>
                  <th>Intensidade</th>
                </tr>
              </thead>
              <tbody>
                ${e1.top_pares_likert.slice(0, 15).map((p, idx) => `
                  <tr>
                    <td class="center">${idx + 1}</td>
                    <td><strong>${esc(p.par)}</strong></td>
                    <td class="num"><strong>${fmt(p.r, 4)}</strong></td>
                    <td><span class="badge ${Math.abs(p.r) >= 0.5 ? 'badge-teal' : Math.abs(p.r) >= 0.3 ? 'badge-blue' : 'badge-amber'}">${Math.abs(p.r) >= 0.5 ? 'Forte' : Math.abs(p.r) >= 0.3 ? 'Moderada' : 'Fraca'}</span></td>
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
            <div class="card-title">🌡️ 1.5 Matriz de Correlação de Pearson (${cols.length} × ${cols.length})</div>
            <div class="card-subtitle">Valores ≥ 0,50 destacados em verde-água; valores ≤ −0,50 em vermelho claro</div>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Var</th>
                ${cols.map(c => `<th class="center">${esc(c)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${cols.map(rCol => `
                <tr>
                  <td><strong>${esc(rCol)}</strong></td>
                  ${cols.map(cCol => {
                    const val = e1.matriz_correlacao[rCol]?.[cCol] ?? 0;
                    const abs = Math.abs(val);
                    const bg = rCol === cCol ? '#0F172A' : (val >= 0.5 ? '#CCFBF1' : val >= 0.35 ? '#E0F2FE' : val <= -0.5 ? '#FEE2E2' : '#FFFFFF');
                    const fg = rCol === cCol ? '#FFFFFF' : '#0F172A';
                    return `<td class="center" style="background:${bg}; color:${fg}; font-weight:${abs >= 0.5 ? '700' : '400'}; font-size:11px;">${fmt(val, 2)}</td>`;
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
    const s = state.summary;
    const meta = s.meta;
    const ef = s.etapa2_fatorial;
    const kmoLabel = ef.kmo_global >= 0.8 ? 'Ótimo (≥ 0,80)' : ef.kmo_global >= 0.7 ? 'Bom (0,70–0,79)' : ef.kmo_global >= 0.6 ? 'Mediano (0,60–0,69)' : ef.kmo_global >= 0.5 ? 'Aceitável (≥ 0,50)' : 'Baixo (< 0,50)';

    return `
      <div class="grid-4" style="margin-bottom:18px;">
        <div class="kpi-card">
          <div class="kpi-label">KMO Global (Adequação)</div>
          <div class="kpi-value" style="color:var(--primary);">${fmt(ef.kmo_global, 4)}</div>
          <div class="kpi-foot">${kmoLabel}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Esfericidade de Bartlett</div>
          <div class="kpi-value">χ² = ${fmt(ef.bartlett_chi2, 1)}</div>
          <div class="kpi-foot">gl = ${ef.bartlett_df} | p ${fmtP(ef.bartlett_p)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Variância Explicada (${meta.n_fatores} Fatores)</div>
          <div class="kpi-value" style="color:var(--secondary);">${fmt(ef.variancia_total_explicada_acp_pct, 2)}%</div>
          <div class="kpi-foot">ACP Varimax (AFE-PAF Comum = ${fmt(ef.variancia_comum_afe_ml_pct, 2)}%)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">MSA Individual (Anti-Imagem)</div>
          <div class="kpi-value" style="color:${ef.msa_min >= 0.5 ? 'var(--success)' : 'var(--amber)'};">${fmt(ef.msa_min, 3)} – ${fmt(ef.msa_max, 3)}</div>
          <div class="kpi-foot">${ef.msa_acima_050} de ${meta.n_vars_likert} itens com MSA ≥ 0,50</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">📉 2.1 Scree Plot, Critério de Kaiser (λ &gt; 1) e Análise Paralela de Horn</div>
              <div class="card-subtitle">${meta.n_fatores} dimensões latentes extraídas automaticamente (Monte Carlo P95)</div>
            </div>
          </div>
          <div style="margin-bottom:14px;">
            ${buildScreeSVG(ef.autovalores_tabela)}
          </div>
          <div class="table-wrap" style="max-height:280px; overflow-y:auto;">
            <table>
              <thead>
                <tr>
                  <th>Comp.</th>
                  <th class="num">Autovalor (λ)</th>
                  <th class="num">% Var.</th>
                  <th class="num">% Acum.</th>
                  <th class="num">Horn P95</th>
                  <th class="center">Status</th>
                </tr>
              </thead>
              <tbody>
                ${ef.autovalores_tabela.map(e => `
                  <tr style="${e.retido ? 'background:#F0FDFA; font-weight:700;' : ''}">
                    <td class="center">${e.componente}</td>
                    <td class="num">${fmt(e.autovalor, 4)}</td>
                    <td class="num">${fmt(e.var_pct, 2)}%</td>
                    <td class="num">${fmt(e.var_acum_pct, 2)}%</td>
                    <td class="num">${fmt(e.pa_p95, 4)}</td>
                    <td class="center">${e.retido ? '<span class="badge badge-green">RETIDO</span>' : '<span class="badge">Descartado</span>'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">🏛️ 2.2 Resumo dos ${meta.n_fatores} Fatores Extraídos & Alfa de Cronbach Real</div>
              <div class="card-subtitle">Variância rotacionada Varimax e consistência interna calculada sobre os itens dominantes</div>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fator</th>
                  <th>Itens Dominantes</th>
                  <th class="num">SS Rot.</th>
                  <th class="num">% Var.</th>
                  <th class="num">Cronbach (α)</th>
                  <th class="num">Média Itens</th>
                </tr>
              </thead>
              <tbody>
                ${ef.fatores_resumo.map(f => `
                  <tr>
                    <td><strong>${esc(f.nome)}</strong></td>
                    <td style="font-size:11.5px;">${esc((f.itens_dominantes || []).join(', ')) || '—'}</td>
                    <td class="num">${fmt(f.ss_loadings_rot, 3)}</td>
                    <td class="num"><strong>${fmt(f.var_rot_pct, 2)}%</strong></td>
                    <td class="num">
                      ${f.alfa_cronbach !== null
                        ? `<span class="badge ${f.alfa_cronbach >= 0.7 ? 'badge-green' : f.alfa_cronbach >= 0.6 ? 'badge-amber' : 'badge-red'}">${fmt(f.alfa_cronbach, 4)}</span>`
                        : '—'}
                    </td>
                    <td class="num">${f.media_itens_original !== null ? `${fmt(f.media_itens_original, 2)} (DP=${fmt(f.dp_itens_original, 2)})` : '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div style="margin-top:14px;">
            <div class="chart-title">Mapa de Calor das Cargas Varimax</div>
            ${buildLoadingsHeatmapSVG(ef.cargas_comunalidades, meta.factorMeta)}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">🎯 2.3 Matriz de Componentes Rotacionados (Varimax), Comunalidades (h²) e MSA Anti-Imagem</div>
            <div class="card-subtitle">Cargas fatoriais |λ| ≥ 0,50 destacadas automaticamente — ${meta.n_fatores} colunas fatoriais dinâmicas</div>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Var</th>
                <th>Descrição</th>
                ${meta.factorMeta.map(fm => `<th class="num">${esc(fm.nome_curto)}</th>`).join('')}
                <th class="num">h² (ACP)</th>
                <th class="num">u²</th>
                <th class="num">MSA</th>
                <th class="num">Carga AFE-PAF</th>
              </tr>
            </thead>
            <tbody>
              ${ef.cargas_comunalidades.map(c => {
                const cellStyle = (v) => Math.abs(v) >= 0.5 ? 'background:#CCFBF1; color:#0F766E; font-weight:800;' : 'color:#64748B;';
                return `
                  <tr>
                    <td><strong>${esc(c.variavel)}</strong></td>
                    <td>${esc(c.descricao)}</td>
                    ${meta.factorMeta.map(fm => {
                      const v = c[fm.codigo] ?? 0;
                      return `<td class="num" style="${cellStyle(v)}">${fmt(v, 4)}</td>`;
                    }).join('')}
                    <td class="num"><strong>${fmt(c.comunalidade_acp, 4)}</strong></td>
                    <td class="num">${fmt(c.unicidade_acp, 4)}</td>
                    <td class="num"><span class="badge ${c.msa_anti_imagem >= 0.5 ? 'badge-blue' : 'badge-red'}">${fmt(c.msa_anti_imagem, 4)}</span></td>
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
    const s = state.summary;
    const meta = s.meta;
    const ec = s.etapa3_cluster;
    const K = ec.perfis_k3.length;
    const factorAnovas = ec.anova_tukey_clusters.filter(a => meta.factorCodes.includes(a.variavel));
    const targetAnova = ec.anova_tukey_clusters.find(a => a.variavel === meta.targetCol);

    return `
      <div class="callout">
        <h4>🧩 Etapa 3 — Análise de Cluster sobre os ${meta.n_fatores} Escores Fatoriais (Ward Real + K-Means++)</h4>
        <p>
          <strong>Verificação de Outliers Multivariados (Mahalanobis):</strong> D² máximo = <strong>${fmt(ec.mahalanobis_max_d2, 3)}</strong>
          (crítico χ²(${meta.n_fatores}; 0,99) = ${fmt(ec.mahalanobis_critico_p01, 3)}).
          Detectados <strong>${ec.outliers_mahalanobis_p01.length}</strong> registro(s) com p &lt; 0,01 e <strong>${ec.outliers_mahalanobis_p001.length}</strong> com p &lt; 0,001.<br/>
          <strong>Aglomeração Hierárquica de Ward (calculada na base ativa):</strong> maior salto relativo de WSS ocorre em <strong>K = ${ec.ward_k_sugerido} → K = ${Math.max(1, ec.ward_k_sugerido - 1)} (+${fmt(ec.ward_salto_max_pct, 2)}%)</strong>. Solução ativa exibida: <strong>K = ${K} clusters</strong>.
        </p>
      </div>

      <div class="grid-2" style="margin-bottom:18px;">
        <div class="chart-card">
          <div class="chart-title">📈 Curvas de Validação de Clusters (WCSS & Silhueta)</div>
          <div class="chart-subtitle">Avaliação automática de K = 2 até K = ${ec.metricas_escolha_k[ec.metricas_escolha_k.length - 1]?.k || 6}</div>
          ${buildClusterMetricsSVG(ec.metricas_escolha_k, K)}
        </div>
        <div class="chart-card">
          <div class="chart-title">🎯 Perfil dos Centróides dos ${K} Clusters por Fator</div>
          <div class="chart-subtitle">Médias padronizadas (Z) de cada fator nos segmentos recalculados</div>
          ${buildCentroidsBarSVG(ec.perfis_k3, meta.factorMeta)}
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">📏 3.1 Validação Multicritério de K (Cálculos Reais)</div>
              <div class="card-subtitle">WCSS, Silhueta, Calinski-Harabasz, Davies-Bouldin e Gap Statistic</div>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th class="center">K</th>
                  <th class="num">WCSS</th>
                  <th class="num">Silhueta</th>
                  <th class="num">Calinski-H.</th>
                  <th class="num">Davies-B.</th>
                  <th class="num">Gap Stat.</th>
                  <th class="center">Tamanhos</th>
                </tr>
              </thead>
              <tbody>
                ${ec.metricas_escolha_k.map(m => `
                  <tr style="${m.k === K ? 'background:#F0FDFA; font-weight:700;' : ''}">
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
              <div class="card-title">🌿 3.2 Planejamento de Aglomeração Hierárquica (Ward Real)</div>
              <div class="card-subtitle">Últimas etapas de fusão calculadas diretamente sobre os escores fatoriais</div>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th class="center">Etapa</th>
                  <th class="center">K Antes</th>
                  <th class="num">Dist. Ward</th>
                  <th class="num">Coef. WSS</th>
                  <th class="num">Salto (%)</th>
                </tr>
              </thead>
              <tbody>
                ${(ec.agrupamento_ward_ultimas_10_etapas || []).slice(-6).map(w => `
                  <tr style="${w.numero_clusters_antes_salto === ec.ward_k_sugerido ? 'background:#FEF3C7; font-weight:800;' : ''}">
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
            <div class="card-title">🎯 3.3 Centróides Finais do K-Means (K = ${K}) e ANOVA entre Clusters</div>
            <div class="card-subtitle">
              ANOVA ${esc(meta.targetCol)}: F = ${fmt(targetAnova?.f_stat, 2)} (p ${fmtP(targetAnova?.p_valor)}) |
              Fatores: ${factorAnovas.map(fa => `${meta.factorMeta.find(fm => fm.codigo === fa.variavel)?.nome_curto || fa.variavel} (F=${fmt(fa.f_stat, 1)})`).join(' • ')}
            </div>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cluster / Rótulo Automático</th>
                <th class="num">Tamanho</th>
                ${meta.factorMeta.map(fm => `<th class="num">${esc(fm.nome_curto)} (Z / Orig.)</th>`).join('')}
                <th class="num">Média ${esc(meta.targetCol)} (DP)</th>
              </tr>
            </thead>
            <tbody>
              ${ec.perfis_k3.map(p => `
                <tr>
                  <td><strong>${esc(p.rotulo)}</strong></td>
                  <td class="num"><strong>n = ${p.n}</strong> (${fmt(p.pct, 1)}%)</td>
                  ${meta.factorMeta.map(fm => {
                    const z = p.centroides_fatores[fm.codigo] ?? 0;
                    const orig = p.medias_por_fator_original?.[fm.codigo];
                    return `<td class="num">${fmt(z, 3)} ${orig !== null && orig !== undefined ? `(${fmt(orig, 2)})` : ''}</td>`;
                  }).join('')}
                  <td class="num"><span class="badge ${clusterBadgeClass(p.cluster_id, K)}" style="font-size:12.5px;">${fmt(p.y_media, 2)} (DP=${fmt(p.y_dp, 1)})</span></td>
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
    const s = state.summary;
    const meta = s.meta;
    const er = s.etapa4_regressao;
    const pr = er.pressupostos;
    const preds = er.coeficientes.slice(1);
    const sigCount = preds.filter(c => c.p_valor < 0.05).length;

    const normOk = pr.normalidade_shapiro_p >= 0.05 || pr.normalidade_ks_p >= 0.05;
    const homoOk = pr.homocedasticidade_breusch_pagan_p >= 0.05;
    const dwOk = pr.durbin_watson >= 1.5 && pr.durbin_watson <= 2.5;
    const vifOk = pr.vif_maximo < 5;
    const outOk = pr.outliers_residuo_maior_3dp.length === 0 && pr.cooks_distance_max < 1;

    const eqStr = `${meta.targetCol} = β₀ ` + preds.map((_, i) => `+ β${i + 1}F${i + 1}`).join(' ');
    const residScatter = state.rows.map(r => ({ x: r.Y_Predito, y: r.Residuo_Padronizado, cluster: r.Cluster_K }));

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
          <div class="kpi-label">Multicolinearidade (VIF Máx.)</div>
          <div class="kpi-value" style="color:${vifOk ? 'var(--success)' : 'var(--danger)'};">VIF = ${fmt(pr.vif_maximo, 3)}</div>
          <div class="kpi-foot">${vifOk ? 'Sem multicolinearidade (< 5,0)' : 'Atenção: VIF elevado'}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Durbin-Watson & Erro Padrão</div>
          <div class="kpi-value">DW = ${fmt(pr.durbin_watson, 3)}</div>
          <div class="kpi-foot">Erro Padrão Estimativa = ${fmt(er.erro_padrao_estimativa, 2)}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">📈 4.1 Coeficientes da Regressão Linear Múltipla (${esc(eqStr)})</div>
            <div class="card-subtitle">${sigCount} de ${preds.length} fator(es) estatisticamente significativo(s) a 5% (p &lt; 0,05)</div>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Termo / Fator</th>
                <th class="num">Coef. B</th>
                <th class="num">Erro Padrão</th>
                <th class="num">Beta Padronizado</th>
                <th class="num">Estatística t</th>
                <th class="num">Valor-p</th>
                <th class="center">IC 95% para B</th>
                <th class="num">VIF</th>
                <th class="num">+1 DP (Escala 0–100)</th>
              </tr>
            </thead>
            <tbody>
              ${er.coeficientes.map(c => `
                <tr>
                  <td><strong>${esc(c.rotulo)}</strong></td>
                  <td class="num"><strong>${c.b_nao_padronizado >= 0 ? '+' : ''}${fmt(c.b_nao_padronizado, 4)}</strong></td>
                  <td class="num">${fmt(c.erro_padrao, 4)}</td>
                  <td class="num">${c.termo === 'const' ? '—' : `<span class="badge badge-teal" style="font-size:12px;">${fmt(c.beta_padronizado, 4)}</span>`}</td>
                  <td class="num">${fmt(c.t_stat, 3)}</td>
                  <td class="num">${fmtP(c.p_valor)}</td>
                  <td class="center">[${fmt(c.ic95_inf, 2)} ; ${fmt(c.ic95_sup, 2)}]</td>
                  <td class="num">${fmt(c.vif, 3)}</td>
                  <td class="num">${c.termo === 'const' ? '—' : `<strong>${c.impacto_1dp_escala_0_100 >= 0 ? '+' : ''}${fmt(c.impacto_1dp_escala_0_100, 2)} pts</strong>`}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">✅ 4.2 Verificação Automatizada dos Pressupostos da Regressão (Testes Reais)</div>
            <div class="card-subtitle">Todos os diagnósticos abaixo são recalculados diretamente sobre os resíduos da base ativa</div>
          </div>
        </div>
        <div class="grid-4">
          <div class="kpi-card">
            <span class="badge ${normOk ? 'badge-green' : 'badge-amber'}">1. Normalidade — ${normOk ? 'OK' : 'Atenção'}</span>
            <p style="font-size:12px; margin-top:6px;">Shapiro-Francia W' = ${fmt(pr.normalidade_shapiro_w, 4)} (p = ${fmtP(pr.normalidade_shapiro_p)}) | KS D = ${fmt(pr.normalidade_ks_d, 4)} (p = ${fmtP(pr.normalidade_ks_p)}).</p>
          </div>
          <div class="kpi-card">
            <span class="badge ${homoOk ? 'badge-green' : 'badge-amber'}">2. Homocedasticidade — ${homoOk ? 'OK' : 'Atenção'}</span>
            <p style="font-size:12px; margin-top:6px;">Breusch-Pagan LM = ${fmt(pr.homocedasticidade_breusch_pagan_lm, 4)} (p = ${fmtP(pr.homocedasticidade_breusch_pagan_p)}) | F = ${fmt(pr.homocedasticidade_bp_f, 3)}.</p>
          </div>
          <div class="kpi-card">
            <span class="badge ${dwOk ? 'badge-green' : 'badge-amber'}">3. Independência — ${dwOk ? 'OK' : 'Atenção'}</span>
            <p style="font-size:12px; margin-top:6px;">Durbin-Watson = ${fmt(pr.durbin_watson, 4)} (faixa ideal de independência: 1,50 a 2,50).</p>
          </div>
          <div class="kpi-card">
            <span class="badge ${outOk ? 'badge-green' : 'badge-amber'}">4. Outliers & Influência — ${outOk ? 'OK' : 'Atenção'}</span>
            <p style="font-size:12px; margin-top:6px;">Resíduos |Z| &gt; 3: <strong>${pr.outliers_residuo_maior_3dp.length}</strong> | Distância de Cook máx.: <strong>${fmt(pr.cooks_distance_max, 4)}</strong>.</p>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <div class="chart-card">
          <div class="chart-title">📊 Importância Relativa dos Fatores (Betas Padronizados)</div>
          <div class="chart-subtitle">Impacto padronizado de cada fator sobre ${esc(meta.targetCol)}</div>
          ${buildBetasBarSVG(er.coeficientes)}
        </div>
        <div class="chart-card">
          <div class="chart-title">🔍 Resíduos Padronizados vs. Valores Previstos (Ŷ)</div>
          <div class="chart-subtitle">Verificação visual de homocedasticidade e ausência de padrão nos resíduos</div>
          ${buildScatterSVG(residScatter, 'Ŷ Previsto', 'Resíduo Z', { zeroLine: true, forceZeroSymmetric: true })}
        </div>
      </div>
    `;
  }

  // --- STAGE 5: INTEGRATION & DYNAMIC VISUAL PANEL ---
  function renderStage5() {
    const s = state.summary;
    const meta = s.meta;
    const ei = s.etapa5_integracao;
    const segC = ei.regressao_por_cluster;
    const segCat = ei.regressao_por_categoria || {};
    const segCatKeys = Object.keys(segCat);

    const yValues = state.rows.map(r => Number(r[meta.targetCol]));
    const obsVsPred = state.rows.map(r => ({ x: r.Y_Predito, y: Number(r[meta.targetCol]), cluster: r.Cluster_K }));
    const residVsPred = state.rows.map(r => ({ x: r.Y_Predito, y: r.Residuo_Padronizado, cluster: r.Cluster_K }));

    return `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">🔬 5.1 Regressão Segmentada por Cluster (K = ${meta.n_clusters})</div>
            <div class="card-subtitle">Comparação dinâmica dos coeficientes padronizados (Beta) e R² dentro de cada cluster</div>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Segmento</th>
                <th class="num">n</th>
                <th class="num">R² (R² Ajust.)</th>
                ${meta.factorMeta.map(fm => `<th class="num">${esc(fm.nome_curto)} (Beta / p)</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${Object.values(segC).map(m => `
                <tr>
                  <td><strong>${esc(m.rotulo)}</strong></td>
                  <td class="num">${m.n}</td>
                  <td class="num">${m.valido ? `<strong>${fmt(m.r2 * 100, 2)}%</strong> (${fmt(m.r2_ajustado * 100, 1)}%)` : 'n insuf.'}</td>
                  ${meta.factorMeta.map(fm => {
                    const c = m.coeficientes?.[fm.codigo];
                    return `<td class="num">${c && c.beta !== null ? `β = <strong>${fmt(c.beta, 3)}</strong> (p=${fmtP(c.p)})` : '—'}</td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      ${segCatKeys.length ? `
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">🏷️ 5.2 Regressão Segmentada por ${esc(ei.primary_cat_col)}</div>
              <div class="card-subtitle">Modelos OLS recalculados separadamente para cada categoria de ${esc(ei.primary_cat_col)}</div>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>${esc(ei.primary_cat_col)}</th>
                  <th class="num">n</th>
                  <th class="num">R² (R² Ajust.)</th>
                  ${meta.factorMeta.map(fm => `<th class="num">${esc(fm.nome_curto)} (Beta / p)</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${segCatKeys.map(k => {
                  const m = segCat[k];
                  return `
                    <tr>
                      <td><strong>${esc(m.rotulo)}</strong></td>
                      <td class="num">${m.n}</td>
                      <td class="num">${m.valido ? `<strong>${fmt(m.r2 * 100, 2)}%</strong> (${fmt(m.r2_ajustado * 100, 1)}%)` : 'n insuf.'}</td>
                      ${meta.factorMeta.map(fm => {
                        const c = m.coeficientes?.[fm.codigo];
                        return `<td class="num">${c && c.beta !== null ? `β = <strong>${fmt(c.beta, 3)}</strong> (p=${fmtP(c.p)})` : '—'}</td>`;
                      }).join('')}
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">📊 5.${segCatKeys.length ? '3' : '2'} Painel Gráfico Integrado (100% Dinâmico — Recalculado em Tempo Real)</div>
            <div class="card-subtitle">Todos os 9 gráficos abaixo são gerados diretamente a partir da base carregada atualmente</div>
          </div>
        </div>
        <div class="grid-2">
          <div class="chart-card">
            <div class="chart-title">1. Distribuição da Variável Alvo (${esc(meta.targetCol)})</div>
            <div class="chart-subtitle">Histograma e média observada (N = ${meta.n})</div>
            ${buildHistogramSVG(yValues, meta.targetCol)}
          </div>

          <div class="chart-card">
            <div class="chart-title">2. Scree Plot & Análise Paralela de Horn</div>
            <div class="chart-subtitle">Autovalores observados vs. Kaiser (λ = 1) e P95 simulado</div>
            ${buildScreeSVG(s.etapa2_fatorial.autovalores_tabela)}
          </div>

          <div class="chart-card">
            <div class="chart-title">3. Mapa de Calor das Cargas Fatoriais (Varimax)</div>
            <div class="chart-subtitle">${meta.n_vars_likert} variáveis × ${meta.n_fatores} fatores rotacionados</div>
            ${buildLoadingsHeatmapSVG(s.etapa2_fatorial.cargas_comunalidades, meta.factorMeta)}
          </div>

          <div class="chart-card">
            <div class="chart-title">4. Validação Multicritério de Clusters (WCSS & Silhueta)</div>
            <div class="chart-subtitle">Comparativo automático de K = 2 a ${s.etapa3_cluster.metricas_escolha_k[s.etapa3_cluster.metricas_escolha_k.length - 1]?.k || 6}</div>
            ${buildClusterMetricsSVG(s.etapa3_cluster.metricas_escolha_k, meta.n_clusters)}
          </div>

          <div class="chart-card">
            <div class="chart-title">5. Centróides dos Clusters nos ${meta.n_fatores} Fatores</div>
            <div class="chart-subtitle">Assinatura fatorial padronizada (Z) de cada segmento</div>
            ${buildCentroidsBarSVG(s.etapa3_cluster.perfis_k3, meta.factorMeta)}
          </div>

          <div class="chart-card">
            <div class="chart-title">6. ${esc(meta.targetCol)} por Cluster (Média ± DP)</div>
            <div class="chart-subtitle">Comparação do desempenho médio entre os ${meta.n_clusters} segmentos</div>
            ${buildClusterTargetBarSVG(s.etapa3_cluster.perfis_k3, meta.targetCol)}
          </div>

          <div class="chart-card">
            <div class="chart-title">7. Ranking de Impacto na Regressão (Betas Padronizados)</div>
            <div class="chart-subtitle">R² = ${fmt(s.etapa4_regressao.r2 * 100, 2)}% | F = ${fmt(s.etapa4_regressao.f_anova, 2)}</div>
            ${buildBetasBarSVG(s.etapa4_regressao.coeficientes)}
          </div>

          <div class="chart-card">
            <div class="chart-title">8. Diagnóstico OLS: ${esc(meta.targetCol)} Observado vs. Previsto (Ŷ)</div>
            <div class="chart-subtitle">Pontos coloridos por cluster; linha tracejada indica ajuste perfeito (Y = Ŷ)</div>
            ${buildScatterSVG(obsVsPred, 'Ŷ Previsto', `${meta.targetCol} Real`, { diagonal: true })}
          </div>
        </div>

        <div class="chart-card" style="margin-top:16px;">
          <div class="chart-title">9. Dispersão dos Resíduos Padronizados vs. Ŷ Previsto</div>
          <div class="chart-subtitle">Faixa ±3 DP tracejada | Outliers |Z| &gt; 3 detectados: ${s.etapa4_regressao.pressupostos.outliers_residuo_maior_3dp.length}</div>
          ${buildScatterSVG(residVsPred, 'Ŷ Previsto', 'Resíduo Padronizado (Z)', { zeroLine: true, forceZeroSymmetric: true })}
        </div>
      </div>
    `;
  }

  // =========================================================================
  // VIEW 3: ENRICHED DATA EXPLORER ONLY
  // =========================================================================
  function renderDataExplorerView() {
    const s = state.summary;
    const meta = s.meta;
    const K = s.etapa3_cluster.perfis_k3.length;
    const catCols = meta.catCols;
    const cat1 = catCols[0] || null;
    const cat2 = catCols[1] || null;
    const displayCats = catCols.slice(0, 3);

    const f = state.explorerFilters;
    const searchLower = (f.search || '').trim().toLowerCase();

    const filteredRows = state.rows.filter(r => {
      if (f.cluster !== 'ALL' && String(r.Cluster_K) !== f.cluster) return false;
      if (cat1 && f.cat1 !== 'ALL' && String(r[cat1] ?? 'N/A') !== f.cat1) return false;
      if (cat2 && f.cat2 !== 'ALL' && String(r[cat2] ?? 'N/A') !== f.cat2) return false;
      if (searchLower) {
        const hay = [r.ID, ...displayCats.map(c => r[c]), r.Cluster_Nome].join(' ').toLowerCase();
        if (!hay.includes(searchLower)) return false;
      }
      return true;
    });

    const cat1Vals = cat1 ? [...new Set(state.rows.map(r => String(r[cat1] ?? 'N/A')))].sort() : [];
    const cat2Vals = cat2 ? [...new Set(state.rows.map(r => String(r[cat2] ?? 'N/A')))].sort() : [];

    document.getElementById('dataExplorerContent').innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">🗄️ Explorador Interativo da Base Enriquecida (Exibindo ${filteredRows.length} de ${state.rows.length} registros)</div>
            <div class="card-subtitle">Variáveis categóricas + ${meta.n_fatores} Escores Fatoriais + Mahalanobis D² + Cluster + ${esc(meta.targetCol)} Real, Previsto (Ŷ) e Resíduo Z</div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
            <input type="text" class="control-input" placeholder="Buscar ID ou grupo..." value="${esc(f.search)}" oninput="window.AppUI.setExplorerFilter('search', this.value)" style="min-width:170px;" />
            <select class="control-select" onchange="window.AppUI.setExplorerFilter('cluster', this.value)">
              <option value="ALL">Todos os Clusters (K=${K})</option>
              ${s.etapa3_cluster.perfis_k3.map(p => `
                <option value="${p.cluster_id}" ${f.cluster === String(p.cluster_id) ? 'selected' : ''}>
                  ${esc(p.rotulo_curto)}
                </option>
              `).join('')}
            </select>
            ${cat1 ? `
              <select class="control-select" onchange="window.AppUI.setExplorerFilter('cat1', this.value)">
                <option value="ALL">${esc(cat1)}: Todos</option>
                ${cat1Vals.map(v => `<option value="${esc(v)}" ${f.cat1 === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}
              </select>
            ` : ''}
            ${cat2 ? `
              <select class="control-select" onchange="window.AppUI.setExplorerFilter('cat2', this.value)">
                <option value="ALL">${esc(cat2)}: Todos</option>
                ${cat2Vals.map(v => `<option value="${esc(v)}" ${f.cat2 === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}
              </select>
            ` : ''}
          </div>
        </div>
        <div class="table-wrap" style="max-height:580px; overflow-y:auto;">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                ${displayCats.map(c => `<th>${esc(c)}</th>`).join('')}
                ${meta.factorMeta.map(fm => `<th class="num">${esc(fm.nome_curto.slice(0, 11))}</th>`).join('')}
                <th class="num">Mahal. D²</th>
                <th class="center">Cluster</th>
                <th class="num">${esc(meta.targetCol)} Real</th>
                <th class="num">Ŷ Previsto</th>
                <th class="num">Resíduo Z</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRows.map(r => `
                <tr>
                  <td><strong>#${esc(r.ID)}</strong></td>
                  ${displayCats.map(c => `<td>${esc(r[c] ?? '—')}</td>`).join('')}
                  ${meta.factorCodes.map(fc => `<td class="num">${fmt(r[fc], 3)}</td>`).join('')}
                  <td class="num">${fmt(r.Mahalanobis_D2, 2)}</td>
                  <td class="center"><span class="badge ${clusterBadgeClass(r.Cluster_K, K)}">C${r.Cluster_K}</span></td>
                  <td class="num"><strong>${fmt(r[meta.targetCol], 2)}</strong></td>
                  <td class="num">${fmt(r.Y_Predito, 2)}</td>
                  <td class="num" style="color:${Math.abs(r.Residuo_Padronizado) > 3 ? 'var(--danger)' : 'inherit'};">${fmt(r.Residuo_Padronizado, 2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function setExplorerFilter(key, val) {
    state.explorerFilters[key] = val;
    renderDataExplorerView();
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

  function splitCSVLine(line, sep) {
    const out = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === sep && !inQuotes) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  }

  function parseCSVText(text) {
    const clean = text.replace(/^\uFEFF/, '');
    const lines = clean.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];
    const first = lines[0];
    const sep = first.includes(';') && !first.includes(',') ? ';' : (first.includes('\t') ? '\t' : ',');
    const headers = splitCSVLine(first, sep).map(h => h.replace(/^"|"$/g, '').trim());
    return lines.slice(1).map((line, idx) => {
      const parts = splitCSVLine(line, sep).map(v => v.replace(/^"|"$/g, '').trim());
      const obj = {};
      headers.forEach((h, i) => {
        const raw = parts[i] ?? '';
        const normalizedNum = (sep === ';' && raw.includes(',')) ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(',', '.');
        const num = Number(normalizedNum);
        obj[h] = (raw !== '' && !isNaN(num)) ? num : raw;
      });
      if (obj.ID === undefined && obj.id === undefined) obj.ID = idx + 1;
      return obj;
    });
  }

  function processUploadedFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
      if (!window.XLSX) {
        alert('Biblioteca XLSX indisponível offline. Converta o arquivo para .CSV e tente novamente.');
        return;
      }
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

  function handleFileSelect(event) {
    const file = event.target.files?.[0];
    processUploadedFile(file);
    event.target.value = '';
  }

  function prepareColumnMapping(fileName, rows) {
    if (!rows || rows.length < 10) {
      alert('O arquivo precisa conter pelo menos 10 linhas de dados válidas.');
      return;
    }
    state.pendingUploadRows = rows;
    state.pendingFileName = fileName;
    const cols = Object.keys(rows[0]);
    const numericCols = cols.filter(c => {
      if (/^id$/i.test(c)) return false;
      let valid = 0;
      for (const r of rows) {
        const v = r[c];
        if (v !== '' && v !== null && v !== undefined && !isNaN(Number(v))) valid++;
      }
      return valid >= rows.length * 0.8;
    });

    if (numericCols.length < 3) {
      alert('A base precisa conter pelo menos 3 colunas numéricas (1 variável alvo + 2 preditoras).');
      return;
    }

    document.getElementById('mappingArea').style.display = 'block';
    document.getElementById('uploadFileName').textContent = `✅ Base Carregada: ${fileName} (N = ${rows.length} registros, ${cols.length} colunas)`;
    document.getElementById('uploadFileSummary').textContent = `Colunas detectadas: ${cols.join(', ')}`;

    const targetDefault = cols.includes('Y') ? 'Y' : numericCols[numericCols.length - 1];
    document.getElementById('selTargetCol').innerHTML = numericCols.map(c =>
      `<option value="${esc(c)}" ${c === targetDefault ? 'selected' : ''}>${esc(c)}</option>`
    ).join('');

    const ignoreDerived = new Set(['Cluster_K', 'Cluster_K3', 'Cluster_Ward3', 'Cluster_K4', 'Y_Predito', 'Y_Norm100', 'Residuo', 'Residuo_Padronizado', 'Mahalanobis_D2', 'Mahalanobis_p', 'Cooks_D']);
    const featureDefault = numericCols.filter(c => c !== targetDefault && !ignoreDerived.has(c) && !/^F\d+_/i.test(c));
    document.getElementById('chkFeatureCols').innerHTML = numericCols.map(c => `
      <label style="display:inline-flex; align-items:center; gap:4px; background:#FFF; padding:4px 8px; border-radius:6px; border:1px solid var(--border); font-size:12px; cursor:pointer;">
        <input type="checkbox" class="chk-feat" value="${esc(c)}" ${featureDefault.includes(c) ? 'checked' : ''} />
        ${esc(c)}
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

    if (featureCols.length < 3) {
      alert('Selecione pelo menos 3 variáveis quantitativas preditoras (além da variável alvo) para a Análise Fatorial.');
      return;
    }

    try {
      const label = state.pendingFileName
        ? `${state.pendingFileName} (N = ${rows.length})`
        : `Upload Dinâmico (N = ${rows.length}, ${featureCols.length} Vars)`;
      applyDataset(rows, label, { featureCols, targetCol, nClusters }, true);
      closeUploadModal();
    } catch (err) {
      alert('Erro ao recalcular a base: ' + (err?.message || err));
    }
  }

  function simulateNewUploadBatch() {
    const simulated = state.rawRows.map((r, i) => {
      const boost = (i % 3 === 0) ? 1 : ((i % 5 === 0) ? -1 : 0);
      const clamp10 = (v) => Math.max(1, Math.min(10, v));
      return {
        ...r,
        V2: clamp10(r.V2 + boost),
        V5: clamp10(r.V5 + boost),
        V7: clamp10(r.V7 + boost),
        V8: clamp10(r.V8 + boost),
        V14: clamp10(r.V14 + boost),
        Y: Math.round(r.Y + 6.0 * boost + ((i % 7) - 3))
      };
    });
    prepareColumnMapping('Ciclo_Simulado_Novo.csv', simulated);
  }

  function restoreDefaultDataset() {
    applyDataset(state.rawRows, `Base Padrão (N = ${state.rawRows.length})`, { nClusters: 3 }, false);
  }

  function exportEnrichedCSV() {
    if (!state.rows || !state.rows.length) return;
    const cols = Object.keys(state.rows[0]);
    const csvLines = [
      cols.join(','),
      ...state.rows.map(r => cols.map(c => {
        const v = r[c] ?? '';
        const s = String(v);
        return (s.includes(',') || s.includes('"')) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(','))
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'base_enriquecida_fatores_clusters.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadTemplateCSV() {
    if (!state.rawRows || !state.rawRows.length) return;
    const cols = Object.keys(state.rawRows[0]);
    const csvLines = [
      cols.join(','),
      ...state.rawRows.map(r => cols.map(c => r[c]).join(','))
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_base_dados.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function bindDropZone() {
    const dz = document.getElementById('dropZone');
    if (!dz) return;
    dz.addEventListener('dragover', (e) => {
      e.preventDefault();
      dz.classList.add('dragover');
    });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.classList.remove('dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file) processUploadedFile(file);
    });
  }

  // Expose public UI API
  window.AppUI = {
    setMode,
    selectPersona,
    selectStage,
    applySimPreset,
    updateSimSlider,
    setCaioCatCol,
    setCaioFactor,
    setLucasGroupCol,
    setLucasFilterVal,
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

  // Initialize cleanly through the automated statistical engine
  window.addEventListener('DOMContentLoaded', () => {
    bindDropZone();
    applyDataset(state.rawRows, `Base Padrão (N = ${state.rawRows.length})`, { nClusters: 3 }, false);
  });
})();
