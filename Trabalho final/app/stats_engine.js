/**
 * Adaptive Multivariate Statistical Engine (5-Stage Automated Pipeline)
 * Runs 100% client-side on any uploaded CSV / XLSX dataset with real statistical tests
 * and zero static fallbacks.
 */
(function (root) {
  'use strict';

  // Optional friendly labels used only when uploaded headers match V1..V15
  const KNOWN_VAR_META = {
    V1: { desc: 'Qualidade do espaço de trabalho', dim: 'Ambiente' },
    V2: { desc: 'Disponibilidade/qualidade de ferramentas', dim: 'Ambiente' },
    V3: { desc: 'Gestão de ruído e interrupções', dim: 'Ambiente' },
    V4: { desc: 'Ergonomia do posto de trabalho', dim: 'Ambiente' },
    V5: { desc: 'Suporte e acessibilidade do gestor', dim: 'Liderança' },
    V6: { desc: 'Grau de autonomia técnica', dim: 'Liderança' },
    V7: { desc: 'Reconhecimento por entregas', dim: 'Liderança' },
    V8: { desc: 'Segurança psicológica', dim: 'Liderança' },
    V9: { desc: 'Oportunidades de treinamento', dim: 'Crescimento' },
    V10: { desc: 'Clareza do plano de carreira', dim: 'Crescimento' },
    V11: { desc: 'Qualidade/disponibilidade de mentoria', dim: 'Crescimento' },
    V12: { desc: 'Justiça na carga de trabalho', dim: 'Equilíbrio' },
    V13: { desc: 'Flexibilidade de horários', dim: 'Equilíbrio' },
    V14: { desc: 'Equilíbrio vida-trabalho', dim: 'Equilíbrio' },
    V15: { desc: 'Prevenção ao burnout e pausas', dim: 'Equilíbrio' }
  };

  const SEMANTIC_BLOCKS = [
    { key: 'F1_Ambiente', label: 'Fator 1 — Ambiente de Trabalho', short: 'Ambiente', items: ['V1', 'V2', 'V3', 'V4'], order: 1 },
    { key: 'F2_Lideranca', label: 'Fator 2 — Liderança e Cultura', short: 'Liderança', items: ['V5', 'V6', 'V7', 'V8'], order: 2 },
    { key: 'F3_Crescimento', label: 'Fator 3 — Crescimento e Aprendizado', short: 'Crescimento', items: ['V9', 'V10', 'V11'], order: 3 },
    { key: 'F4_Equilibrio', label: 'Fator 4 — Equilíbrio Vida-Trabalho', short: 'Equilíbrio', items: ['V12', 'V13', 'V14', 'V15'], order: 4 }
  ];

  // --- Mathematical & Statistical Distribution Helpers ---
  function logGamma(z) {
    const c = [
      76.18009172947146, -86.50532032941677, 24.01409824083091,
      -1.231739572450155, 0.001208650973866179, -0.000005395239384953
    ];
    let x = z, y = z;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) ser += c[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }

  function erf(x) {
    const sign = x >= 0 ? 1 : -1;
    const ax = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * ax);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-ax * ax);
    return sign * y;
  }

  function normalCDF(z) {
    return 0.5 * (1 + erf(z / Math.SQRT2));
  }

  function normalInv(p) {
    if (p <= 0) return -8;
    if (p >= 1) return 8;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const pLow = 0.02425, pHigh = 1 - pLow;
    let q, r;
    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= pHigh) {
      q = p - 0.5;
      r = q * q;
      return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
  }

  function tCritical95(df) {
    if (df <= 1) return 12.706;
    if (df === 2) return 4.303;
    const z = 1.95996398454;
    const z3 = z * z * z, z5 = z3 * z * z, z7 = z5 * z * z;
    return z + (z3 + z) / (4 * df) + (5 * z5 + 16 * z3 + 3 * z) / (96 * df * df) +
      (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / (384 * df * df * df);
  }

  function betacf(a, b, x) {
    const MAXIT = 150, EPS = 3e-9, FPMIN = 1e-30;
    let qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= MAXIT; m++) {
      let m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c;
      if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c;
      if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      let del = d * c;
      h *= del;
      if (Math.abs(del - 1.0) < EPS) break;
    }
    return h;
  }

  function betai(a, b, x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
    return 1 - bt * betacf(b, a, 1 - x) / b;
  }

  function fTestPValue(F, df1, df2) {
    if (!isFinite(F) || F <= 0 || df1 <= 0 || df2 <= 0) return 1.0;
    const x = df2 / (df2 + df1 * F);
    return Math.max(0, Math.min(1, betai(0.5 * df2, 0.5 * df1, x)));
  }

  function tTestPValue(t, df) {
    if (!isFinite(t) || df <= 0) return 1.0;
    return fTestPValue(t * t, 1, df);
  }

  function gammp(a, x) {
    if (x <= 0 || a <= 0) return 0;
    if (x < a + 1) {
      let ap = a, del = 1 / a, sum = del;
      for (let n = 1; n <= 150; n++) {
        ap += 1;
        del *= x / ap;
        sum += del;
        if (Math.abs(del) < Math.abs(sum) * 3e-9) break;
      }
      return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
    } else {
      const FPMIN = 1e-30;
      let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
      for (let i = 1; i <= 150; i++) {
        let an = -i * (i - a);
        b += 2;
        d = an * d + b;
        if (Math.abs(d) < FPMIN) d = FPMIN;
        c = b + an / c;
        if (Math.abs(c) < FPMIN) c = FPMIN;
        d = 1 / d;
        let del = d * c;
        h *= del;
        if (Math.abs(del - 1) < 3e-9) break;
      }
      return 1 - Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
    }
  }

  function chi2PValue(chi2, df) {
    if (!isFinite(chi2) || chi2 <= 0 || df <= 0) return 1.0;
    return Math.max(0, Math.min(1, 1 - gammp(0.5 * df, 0.5 * chi2)));
  }

  function chi2Critical(pUpper, df) {
    // Wilson-Hilferty starting guess + bisection refinement for exact chi2 quantile
    const targetP = 1 - pUpper; // e.g., 0.99 for upper tail 0.01
    const z = normalInv(targetP);
    const w = 1 - 2 / (9 * df) + z * Math.sqrt(2 / (9 * df));
    let guess = df * Math.pow(Math.max(0.1, w), 3);
    let lo = Math.max(0.001, guess * 0.5), hi = Math.max(guess * 2, df + 40);
    for (let it = 0; it < 40; it++) {
      const mid = 0.5 * (lo + hi);
      if (chi2PValue(mid, df) > pUpper) lo = mid;
      else hi = mid;
    }
    return 0.5 * (lo + hi);
  }

  // --- Basic Array Statistics ---
  function mean(arr) {
    if (!arr.length) return 0;
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
  }

  function variance(arr, ddof = 1) {
    if (arr.length <= ddof) return 0;
    const m = mean(arr);
    let s = 0;
    for (let i = 0; i < arr.length; i++) {
      const d = arr[i] - m;
      s += d * d;
    }
    return s / (arr.length - ddof);
  }

  function std(arr, ddof = 1) {
    return Math.sqrt(Math.max(0, variance(arr, ddof)));
  }

  function median(arr) {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 !== 0 ? s[mid] : 0.5 * (s[mid - 1] + s[mid]);
  }

  function mode(arr) {
    const counts = new Map();
    let bestVal = arr[0] || 0, bestCount = -1;
    for (const v of arr) {
      const k = Math.round(v * 100) / 100;
      const c = (counts.get(k) || 0) + 1;
      counts.set(k, c);
      if (c > bestCount) {
        bestCount = c;
        bestVal = k;
      }
    }
    return bestVal;
  }

  function skewness(arr) {
    const n = arr.length;
    if (n < 3) return 0;
    const m = mean(arr), s = std(arr, 1);
    if (s === 0) return 0;
    let sum3 = 0;
    for (let i = 0; i < n; i++) sum3 += Math.pow((arr[i] - m) / s, 3);
    return (n / ((n - 1) * (n - 2))) * sum3;
  }

  function kurtosis(arr) {
    const n = arr.length;
    if (n < 4) return 0;
    const m = mean(arr), s = std(arr, 1);
    if (s === 0) return 0;
    let sum4 = 0;
    for (let i = 0; i < n; i++) sum4 += Math.pow((arr[i] - m) / s, 4);
    const term1 = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3)) * sum4;
    const term2 = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
    return term1 - term2;
  }

  function pearsonR(x, y) {
    const n = x.length;
    if (n < 2) return 0;
    const mx = mean(x), my = mean(y);
    let num = 0, dx2 = 0, dy2 = 0;
    for (let i = 0; i < n; i++) {
      const dx = x[i] - mx, dy = y[i] - my;
      num += dx * dy;
      dx2 += dx * dx;
      dy2 += dy * dy;
    }
    const den = Math.sqrt(dx2 * dy2);
    return den === 0 ? 0 : Math.max(-1, Math.min(1, num / den));
  }

  function ksNormalityTest(arr) {
    const n = arr.length;
    if (n < 5) return { d: 0, p: 1 };
    const m = mean(arr), s = std(arr, 1);
    if (s === 0) return { d: 0, p: 1 };
    const zs = arr.map(v => (v - m) / s).sort((a, b) => a - b);
    let d = 0;
    for (let i = 0; i < n; i++) {
      const cdf = normalCDF(zs[i]);
      const d1 = Math.abs((i + 1) / n - cdf);
      const d2 = Math.abs(cdf - i / n);
      if (d1 > d) d = d1;
      if (d2 > d) d = d2;
    }
    const en = Math.sqrt(n);
    const lam = (en + 0.12 + 0.11 / en) * d;
    let sum = 0;
    for (let k = 1; k <= 60; k++) {
      const term = Math.exp(-2 * k * k * lam * lam);
      sum += (k % 2 === 1 ? 1 : -1) * term;
      if (term < 1e-10) break;
    }
    const p = Math.max(0, Math.min(1, 2 * sum));
    return { d, p };
  }

  function shapiroFranciaTest(arr) {
    const n = arr.length;
    if (n < 5) return { w: 1, p: 1 };
    const sorted = [...arr].sort((a, b) => a - b);
    const mVec = Array.from({ length: n }, (_, i) => normalInv((i + 1 - 0.375) / (n + 0.25)));
    const r = pearsonR(sorted, mVec);
    const w = Math.min(0.999999, Math.max(0.0001, r * r));
    // Royston (1993) approximation for Shapiro-Francia W'
    const u = Math.log(n);
    const v = Math.log(u) - u;
    const mu = -1.2725 + 1.0521 * v;
    const sigma = 1.0308 - 0.26758 * (Math.log(u) + 2 / u);
    const z = (Math.log(1 - w) - mu) / (sigma || 1);
    const p = Math.max(0, Math.min(1, 1 - normalCDF(z)));
    return { w, p };
  }

  function cronbachAlpha(itemArrays, signs) {
    const k = itemArrays.length;
    if (k < 2) return null;
    const n = itemArrays[0].length;
    if (n < 3) return null;
    let sumItemVar = 0;
    const totals = new Array(n).fill(0);
    for (let c = 0; c < k; c++) {
      const sgn = signs && signs[c] < 0 ? -1 : 1;
      const arr = itemArrays[c];
      sumItemVar += variance(arr, 1);
      for (let i = 0; i < n; i++) totals[i] += sgn * arr[i];
    }
    const totalVar = variance(totals, 1);
    if (totalVar <= 1e-12) return 0;
    const alpha = (k / (k - 1)) * (1 - sumItemVar / totalVar);
    return Math.max(-1, Math.min(1, alpha));
  }

  function oneWayAnova(groups) {
    const valid = groups.filter(g => g && g.length > 0);
    const k = valid.length;
    if (k < 2) return { f: 0, p: 1 };
    const all = valid.flat();
    const N = all.length;
    if (N <= k) return { f: 0, p: 1 };
    const grandMean = mean(all);
    let ssb = 0, ssw = 0;
    for (const g of valid) {
      const gm = mean(g);
      ssb += g.length * Math.pow(gm - grandMean, 2);
      for (const v of g) ssw += Math.pow(v - gm, 2);
    }
    const df1 = k - 1, df2 = N - k;
    const msb = ssb / df1, msw = ssw / df2;
    const f = msw === 0 ? 0 : msb / msw;
    return { f, p: fTestPValue(f, df1, df2) };
  }

  // --- Seeded PRNG ---
  function createPRNG(seed = 42) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // --- Matrix Algebra ---
  function matMul(A, B) {
    const m = A.length, k = A[0].length, n = B[0].length;
    const C = Array.from({ length: m }, () => new Array(n).fill(0));
    for (let i = 0; i < m; i++) {
      for (let p = 0; p < k; p++) {
        const aip = A[i][p];
        for (let j = 0; j < n; j++) C[i][j] += aip * B[p][j];
      }
    }
    return C;
  }

  function matTranspose(A) {
    const m = A.length, n = A[0].length;
    const T = Array.from({ length: n }, () => new Array(m).fill(0));
    for (let i = 0; i < m; i++)
      for (let j = 0; j < n; j++) T[j][i] = A[i][j];
    return T;
  }

  function matInvAndDet(M) {
    const n = M.length;
    const A = M.map(r => [...r]);
    const I = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (__, j) => (i === j ? 1 : 0))
    );
    let det = 1;
    for (let i = 0; i < n; i++) {
      let pivot = i;
      for (let r = i + 1; r < n; r++) {
        if (Math.abs(A[r][i]) > Math.abs(A[pivot][i])) pivot = r;
      }
      if (pivot !== i) {
        [A[i], A[pivot]] = [A[pivot], A[i]];
        [I[i], I[pivot]] = [I[pivot], I[i]];
        det = -det;
      }
      const pv = A[i][i];
      if (Math.abs(pv) < 1e-12) {
        det = 0;
        A[i][i] = 1e-12;
      } else {
        det *= pv;
      }
      const invPv = 1 / A[i][i];
      for (let j = 0; j < n; j++) {
        A[i][j] *= invPv;
        I[i][j] *= invPv;
      }
      for (let r = 0; r < n; r++) {
        if (r !== i) {
          const factor = A[r][i];
          for (let j = 0; j < n; j++) {
            A[r][j] -= factor * A[i][j];
            I[r][j] -= factor * I[i][j];
          }
        }
      }
    }
    return { inv: I, det };
  }

  function jacobiEigen(S, maxIter = 250, tol = 1e-10) {
    const n = S.length;
    const A = S.map(r => [...r]);
    const V = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (__, j) => (i === j ? 1 : 0))
    );
    for (let iter = 0; iter < maxIter; iter++) {
      let maxVal = 0, p = 0, q = 1;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (Math.abs(A[i][j]) > maxVal) {
            maxVal = Math.abs(A[i][j]);
            p = i;
            q = j;
          }
        }
      }
      if (maxVal < tol) break;
      const app = A[p][p], aqq = A[q][q], apq = A[p][q];
      const theta = 0.5 * Math.atan2(2 * apq, aqq - app);
      const c = Math.cos(theta), s = Math.sin(theta);
      for (let i = 0; i < n; i++) {
        if (i !== p && i !== q) {
          const aip = A[i][p], aiq = A[i][q];
          A[i][p] = A[p][i] = c * aip - s * aiq;
          A[i][q] = A[q][i] = s * aip + c * aiq;
        }
      }
      A[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
      A[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
      A[p][q] = A[q][p] = 0;
      for (let i = 0; i < n; i++) {
        const vip = V[i][p], viq = V[i][q];
        V[i][p] = c * vip - s * viq;
        V[i][q] = s * vip + c * viq;
      }
    }
    const vals = A.map((r, i) => r[i]);
    const order = vals.map((_, i) => i).sort((a, b) => vals[b] - vals[a]);
    const sortedVals = order.map(i => Math.max(0, vals[i]));
    const sortedVecs = Array.from({ length: n }, (_, r) => order.map(c => V[r][c]));
    return { values: sortedVals, vectors: sortedVecs };
  }

  function varimaxPairwise(Loadings, maxIter = 100, tol = 1e-7) {
    const p = Loadings.length, k = Loadings[0].length;
    if (k < 2) return Loadings.map(r => [...r]);
    const h = Loadings.map(row => {
      const ss = row.reduce((a, b) => a + b * b, 0);
      return ss > 1e-12 ? Math.sqrt(ss) : 1.0;
    });
    const L = Loadings.map((row, i) => row.map(v => v / h[i]));

    for (let iter = 0; iter < maxIter; iter++) {
      let maxAngle = 0;
      for (let c1 = 0; c1 < k; c1++) {
        for (let c2 = c1 + 1; c2 < k; c2++) {
          let uSum = 0, vSum = 0, A = 0, B = 0;
          const uArr = [], vArr = [];
          for (let i = 0; i < p; i++) {
            const x = L[i][c1], y = L[i][c2];
            const u = x * x - y * y;
            const v = 2 * x * y;
            uArr.push(u);
            vArr.push(v);
            uSum += u;
            vSum += v;
          }
          for (let i = 0; i < p; i++) {
            A += 2 * uArr[i] * vArr[i];
            B += uArr[i] * uArr[i] - vArr[i] * vArr[i];
          }
          const num = A - (2 * uSum * vSum) / p;
          const den = B - (uSum * uSum - vSum * vSum) / p;
          const phi = 0.25 * Math.atan2(num, den);
          if (Math.abs(phi) > maxAngle) maxAngle = Math.abs(phi);
          if (Math.abs(phi) > tol) {
            const cosP = Math.cos(phi), sinP = Math.sin(phi);
            for (let i = 0; i < p; i++) {
              const x = L[i][c1], y = L[i][c2];
              L[i][c1] = x * cosP + y * sinP;
              L[i][c2] = -x * sinP + y * cosP;
            }
          }
        }
      }
      if (maxAngle < tol) break;
    }
    return L.map((row, i) => row.map(v => v * h[i]));
  }

  // --- Horn's Parallel Analysis (Monte Carlo P95) ---
  function parallelAnalysisP95(n, p, seed = 2026) {
    const nIter = p > 22 ? 20 : 40;
    const rand = createPRNG(seed);
    const randn = () => {
      const u1 = Math.max(1e-12, rand());
      const u2 = rand();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    };
    const samples = Array.from({ length: p }, () => []);
    for (let it = 0; it < nIter; it++) {
      const cols = Array.from({ length: p }, () => {
        const a = new Array(n);
        for (let i = 0; i < n; i++) a[i] = randn();
        const m = mean(a), s = std(a, 1) || 1;
        for (let i = 0; i < n; i++) a[i] = (a[i] - m) / s;
        return a;
      });
      const Rrand = Array.from({ length: p }, () => new Array(p).fill(1));
      for (let i = 0; i < p; i++) {
        for (let j = i + 1; j < p; j++) {
          let dot = 0;
          for (let r = 0; r < n; r++) dot += cols[i][r] * cols[j][r];
          const val = dot / (n - 1);
          Rrand[i][j] = Rrand[j][i] = val;
        }
      }
      const { values } = jacobiEigen(Rrand, 120, 1e-6);
      for (let c = 0; c < p; c++) samples[c].push(values[c]);
    }
    return samples.map(arr => {
      arr.sort((a, b) => a - b);
      const idx = Math.min(arr.length - 1, Math.floor(0.95 * (arr.length - 1)));
      return arr[idx];
    });
  }

  // --- Iterated Principal Axis Factoring (AFE-PAF) ---
  function computePAF(R, R_inv, kFactors) {
    const p = R.length;
    let h2 = Array.from({ length: p }, (_, i) => {
      const rii = R_inv[i][i];
      const smc = rii > 1 ? 1 - 1 / rii : 0.5;
      return Math.max(0.05, Math.min(0.99, smc));
    });
    let L = Array.from({ length: p }, () => new Array(kFactors).fill(0));
    for (let iter = 0; iter < 15; iter++) {
      const Rred = R.map((row, i) => row.map((v, j) => (i === j ? h2[i] : v)));
      const { values, vectors } = jacobiEigen(Rred, 180, 1e-8);
      L = Array.from({ length: p }, (_, i) =>
        Array.from({ length: kFactors }, (__, c) => vectors[i][c] * Math.sqrt(Math.max(0, values[c])))
      );
      let maxDiff = 0;
      const newH2 = L.map(row => Math.min(0.995, row.reduce((a, b) => a + b * b, 0)));
      for (let i = 0; i < p; i++) maxDiff = Math.max(maxDiff, Math.abs(newH2[i] - h2[i]));
      h2 = newH2;
      if (maxDiff < 1e-4) break;
    }
    const Lrot = varimaxPairwise(L);
    for (let c = 0; c < kFactors; c++) {
      const colSum = Lrot.reduce((acc, row) => acc + Math.pow(row[c], 3), 0);
      if (colSum < 0) {
        for (let i = 0; i < p; i++) Lrot[i][c] = -Lrot[i][c];
      }
    }
    const finalH2 = Lrot.map(row => Math.min(1, row.reduce((a, b) => a + b * b, 0)));
    const commonVarPct = (finalH2.reduce((a, b) => a + b, 0) / p) * 100;
    return { loadings: Lrot, h2: finalH2, commonVarPct };
  }

  // --- K-Means++, Silhouette, Davies-Bouldin & Gap Statistic ---
  function runKMeans(X, K, seed = 42, nInit = 12) {
    const n = X.length, d = X[0].length;
    const rand = createPRNG(seed);
    const dist2 = (a, b) => {
      let sum = 0;
      for (let j = 0; j < d; j++) sum += (a[j] - b[j]) * (a[j] - b[j]);
      return sum;
    };

    let bestInertia = Infinity, bestLabels = null, bestCenters = null;
    for (let init = 0; init < nInit; init++) {
      const centers = [[...X[Math.floor(rand() * n)]]];
      while (centers.length < K) {
        const d2s = X.map(pt => Math.min(...centers.map(c => dist2(pt, c))));
        const total = d2s.reduce((a, b) => a + b, 0);
        if (total <= 1e-12) {
          centers.push([...X[Math.floor(rand() * n)]]);
          continue;
        }
        let r = rand() * total, picked = n - 1;
        for (let i = 0; i < n; i++) {
          r -= d2s[i];
          if (r <= 0) { picked = i; break; }
        }
        centers.push([...X[picked]]);
      }

      let labels = new Array(n).fill(0);
      for (let it = 0; it < 80; it++) {
        let changed = false;
        for (let i = 0; i < n; i++) {
          let bestC = 0, minD = Infinity;
          for (let c = 0; c < K; c++) {
            const dd = dist2(X[i], centers[c]);
            if (dd < minD) { minD = dd; bestC = c; }
          }
          if (labels[i] !== bestC) { labels[i] = bestC; changed = true; }
        }
        if (!changed) break;
        const sums = Array.from({ length: K }, () => new Array(d).fill(0));
        const counts = new Array(K).fill(0);
        for (let i = 0; i < n; i++) {
          const c = labels[i];
          counts[c]++;
          for (let j = 0; j < d; j++) sums[c][j] += X[i][j];
        }
        for (let c = 0; c < K; c++) {
          if (counts[c] > 0) {
            for (let j = 0; j < d; j++) centers[c][j] = sums[c][j] / counts[c];
          }
        }
      }
      let inertia = 0;
      for (let i = 0; i < n; i++) inertia += dist2(X[i], centers[labels[i]]);
      if (inertia < bestInertia) {
        bestInertia = inertia;
        bestLabels = labels;
        bestCenters = centers;
      }
    }
    return { labels: bestLabels, centers: bestCenters, inertia: bestInertia };
  }

  function computeSilhouette(X, labels, K) {
    const n = X.length, d = X[0].length;
    const dist = (a, b) => {
      let s = 0;
      for (let j = 0; j < d; j++) s += (a[j] - b[j]) * (a[j] - b[j]);
      return Math.sqrt(s);
    };
    let totalSil = 0;
    for (let i = 0; i < n; i++) {
      const ci = labels[i];
      const clusterDistSums = new Array(K).fill(0);
      const clusterCounts = new Array(K).fill(0);
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const cj = labels[j];
        clusterDistSums[cj] += dist(X[i], X[j]);
        clusterCounts[cj]++;
      }
      const ai = clusterCounts[ci] > 0 ? clusterDistSums[ci] / clusterCounts[ci] : 0;
      let bi = Infinity;
      for (let c = 0; c < K; c++) {
        if (c !== ci && clusterCounts[c] > 0) {
          const avg = clusterDistSums[c] / clusterCounts[c];
          if (avg < bi) bi = avg;
        }
      }
      if (!isFinite(bi)) bi = 0;
      const denom = Math.max(ai, bi);
      totalSil += denom > 0 ? (bi - ai) / denom : 0;
    }
    return totalSil / n;
  }

  function computeDaviesBouldin(X, labels, centers, K) {
    const n = X.length, d = X[0].length;
    const dist = (a, b) => {
      let s = 0;
      for (let j = 0; j < d; j++) s += (a[j] - b[j]) * (a[j] - b[j]);
      return Math.sqrt(s);
    };
    const S = new Array(K).fill(0);
    const counts = new Array(K).fill(0);
    for (let i = 0; i < n; i++) {
      const c = labels[i];
      S[c] += dist(X[i], centers[c]);
      counts[c]++;
    }
    for (let c = 0; c < K; c++) S[c] = counts[c] > 0 ? S[c] / counts[c] : 0;
    let dbSum = 0, validK = 0;
    for (let i = 0; i < K; i++) {
      if (counts[i] === 0) continue;
      let maxR = 0;
      for (let j = 0; j < K; j++) {
        if (i === j || counts[j] === 0) continue;
        const mij = dist(centers[i], centers[j]);
        const rij = mij > 1e-12 ? (S[i] + S[j]) / mij : 0;
        if (rij > maxR) maxR = rij;
      }
      dbSum += maxR;
      validK++;
    }
    return validK > 0 ? dbSum / validK : 0;
  }

  function computeGapStatistic(X, k, observedInertia, B = 8, seed = 777) {
    const n = X.length, d = X[0].length;
    const rand = createPRNG(seed + k * 31);
    const mins = Array.from({ length: d }, (_, j) => Math.min(...X.map(r => r[j])));
    const maxs = Array.from({ length: d }, (_, j) => Math.max(...X.map(r => r[j])));
    const logRef = [];
    for (let b = 0; b < B; b++) {
      const Xref = Array.from({ length: n }, () =>
        Array.from({ length: d }, (_, j) => mins[j] + rand() * (maxs[j] - mins[j]))
      );
      const kmRef = runKMeans(Xref, k, seed + b * 17 + k, 3);
      logRef.push(Math.log(Math.max(kmRef.inertia, 1e-12)));
    }
    const meanLogRef = mean(logRef);
    const sdLogRef = std(logRef, 1);
    const gap = meanLogRef - Math.log(Math.max(observedInertia, 1e-12));
    const sk = sdLogRef * Math.sqrt(1 + 1 / B);
    return { gap, sk };
  }

  // --- Real Ward Hierarchical Agglomerative Clustering ---
  function runWardAgglomeration(X) {
    // Subsample deterministically only if N > 400 to keep browser responsive
    let pts = X;
    if (X.length > 400) {
      const step = X.length / 320;
      pts = [];
      for (let i = 0; i < 320; i++) pts.push(X[Math.floor(i * step)]);
    }
    const m = pts.length;
    const d = pts[0].length;
    const clusters = pts.map((p, idx) => ({ id: idx, size: 1, center: [...p], active: true }));

    const wardDelta = (c1, c2) => {
      let sq = 0;
      for (let j = 0; j < d; j++) {
        const diff = c1.center[j] - c2.center[j];
        sq += diff * diff;
      }
      return ((c1.size * c2.size) / (c1.size + c2.size)) * sq;
    };

    // Precompute upper-triangular Ward merge costs
    const cost = Array.from({ length: m }, () => new Float64Array(m));
    for (let i = 0; i < m; i++) {
      for (let j = i + 1; j < m; j++) {
        cost[i][j] = wardDelta(clusters[i], clusters[j]);
      }
    }

    const activeIdx = Array.from({ length: m }, (_, i) => i);
    const stages = [];
    let totalWSS = 0;

    for (let step = 1; step < m; step++) {
      let bestI = 0, bestJ = 1, minDelta = Infinity;
      const len = activeIdx.length;
      for (let a = 0; a < len; a++) {
        const ia = activeIdx[a];
        for (let b = a + 1; b < len; b++) {
          const ib = activeIdx[b];
          const val = ia < ib ? cost[ia][ib] : cost[ib][ia];
          if (val < minDelta) {
            minDelta = val;
            bestI = a;
            bestJ = b;
          }
        }
      }

      const iIdx = activeIdx[bestI];
      const jIdx = activeIdx[bestJ];
      const ci = clusters[iIdx];
      const cj = clusters[jIdx];

      const kBefore = len;
      const prevWSS = totalWSS;
      totalWSS += minDelta;
      const jumpPct = prevWSS > 1e-9 ? ((totalWSS - prevWSS) / prevWSS) * 100 : 0;

      stages.push({
        etapa: step,
        numero_clusters_antes_salto: kBefore,
        distancia_fusao_ward: Number(Math.sqrt(2 * minDelta).toFixed(4)),
        coeficiente_aglomeracao_wss: Number(totalWSS.toFixed(2)),
        salto_relativo_pct: Number(jumpPct.toFixed(2))
      });

      // Merge cj into ci
      const newSize = ci.size + cj.size;
      for (let dim = 0; dim < d; dim++) {
        ci.center[dim] = (ci.center[dim] * ci.size + cj.center[dim] * cj.size) / newSize;
      }
      ci.size = newSize;
      cj.active = false;
      activeIdx.splice(bestJ, 1);

      // Update distances involving iIdx
      for (let a = 0; a < activeIdx.length; a++) {
        const kIdx = activeIdx[a];
        if (kIdx === iIdx) continue;
        const delta = wardDelta(ci, clusters[kIdx]);
        if (iIdx < kIdx) cost[iIdx][kIdx] = delta;
        else cost[kIdx][iIdx] = delta;
      }
    }

    const last10 = stages.slice(-10);
    // Find largest relative jump among practical cluster counts (K = 2..6 before merge)
    const candidates = last10.filter(s => s.numero_clusters_antes_salto >= 2 && s.numero_clusters_antes_salto <= 6);
    let bestWardStage = candidates[0] || last10[last10.length - 1];
    candidates.forEach(s => {
      if (s.salto_relativo_pct > (bestWardStage?.salto_relativo_pct ?? -1)) bestWardStage = s;
    });

    return {
      ultimas_10_etapas: last10,
      k_sugerido: bestWardStage ? bestWardStage.numero_clusters_antes_salto : 3,
      salto_max_pct: bestWardStage ? bestWardStage.salto_relativo_pct : 0
    };
  }

  // --- Multiple Linear Regression OLS ---
  function fitOLS(X_cols, y) {
    const n = y.length, k = X_cols.length;
    const p = k + 1;
    const X = Array.from({ length: n }, (_, i) => [1, ...X_cols.map(col => col[i])]);
    const XT = matTranspose(X);
    const XTX = matMul(XT, X);
    const { inv: XTX_inv } = matInvAndDet(XTX);
    const XTy = XT.map(row => row.reduce((acc, v, i) => acc + v * y[i], 0));
    const B = XTX_inv.map(row => row.reduce((acc, v, j) => acc + v * XTy[j], 0));

    const yHat = X.map(row => row.reduce((acc, v, j) => acc + v * B[j], 0));
    const resid = y.map((yi, i) => yi - yHat[i]);
    const yMean = mean(y);
    const sst = y.reduce((acc, yi) => acc + Math.pow(yi - yMean, 2), 0);
    const ssr = resid.reduce((acc, r) => acc + r * r, 0);
    const sse = Math.max(0, sst - ssr);
    const dfModel = k, dfResid = Math.max(1, n - p);
    const r2 = sst > 0 ? sse / sst : 0;
    const r2Adj = 1 - (1 - r2) * ((n - 1) / dfResid);
    const mse = ssr / dfResid;
    const seEst = Math.sqrt(mse);
    const fStat = dfModel > 0 && mse > 0 ? (sse / dfModel) / mse : 0;
    const fP = fTestPValue(fStat, dfModel, dfResid);

    const seB = Array.from({ length: p }, (_, j) => Math.sqrt(Math.max(0, mse * XTX_inv[j][j])));
    const tStats = B.map((b, j) => (seB[j] > 0 ? b / seB[j] : 0));
    const pVals = tStats.map(t => tTestPValue(t, dfResid));
    const sdY = std(y, 1);
    const betas = B.map((b, j) => {
      if (j === 0 || sdY === 0) return 0;
      return b * (std(X_cols[j - 1], 1) / sdY);
    });

    // Durbin-Watson
    let dwNum = 0;
    for (let i = 1; i < n; i++) dwNum += Math.pow(resid[i] - resid[i - 1], 2);
    const dw = ssr > 0 ? dwNum / ssr : 2.0;

    // Hat matrix diagonal & Cook's Distance
    const leverages = new Array(n).fill(0);
    const cooksD = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let hii = 0;
      for (let a = 0; a < p; a++) {
        let sumB = 0;
        for (let b = 0; b < p; b++) sumB += XTX_inv[a][b] * X[i][b];
        hii += X[i][a] * sumB;
      }
      hii = Math.max(0, Math.min(0.999, hii));
      leverages[i] = hii;
      cooksD[i] = mse > 0 ? (resid[i] * resid[i] / (p * mse)) * (hii / Math.pow(1 - hii, 2)) : 0;
    }

    // Real VIF via inverse of predictor correlation matrix
    let vifs = new Array(k).fill(1.0);
    if (k >= 2) {
      const Rpred = Array.from({ length: k }, (_, i) =>
        Array.from({ length: k }, (__, j) => (i === j ? 1 : pearsonR(X_cols[i], X_cols[j])))
      );
      const { inv: RpredInv } = matInvAndDet(Rpred);
      vifs = Array.from({ length: k }, (_, j) => Math.max(1.0, RpredInv[j][j]));
    }

    return {
      B, seB, betas, tStats, pVals, vifs,
      r: Math.sqrt(Math.max(0, r2)), r2, r2Adj, seEst, mse,
      fStat, fP, dfModel, dfResid, sst, sse, ssr,
      yHat, resid, dw, leverages, cooksD
    };
  }

  // --- Full 5-Stage Automated Pipeline on Any Dataset ---
  function runAdaptivePipeline(rawInputRows, config = {}) {
    if (!Array.isArray(rawInputRows) || rawInputRows.length < 10) {
      throw new Error('A base de dados precisa ter pelo menos 10 registros válidos.');
    }

    const allCols = Object.keys(rawInputRows[0]);
    const idCol = allCols.find(c => /^id$/i.test(c)) || null;
    const targetCol = config.targetCol || (allCols.includes('Y') ? 'Y' : allCols[allCols.length - 1]);

    // Determine numeric feature columns if not explicitly provided
    let featureCols = config.featureCols;
    if (!featureCols || !featureCols.length) {
      const vCols = allCols.filter(c => /^V\d+$/i.test(c) && c !== targetCol);
      if (vCols.length >= 4) {
        featureCols = vCols;
      } else {
        featureCols = allCols.filter(c => {
          if (c === targetCol || c === idCol) return false;
          let validNum = 0;
          for (const r of rawInputRows) {
            const v = r[c];
            if (v !== '' && v !== null && v !== undefined && !isNaN(Number(v))) validNum++;
          }
          return validNum >= rawInputRows.length * 0.8;
        });
      }
    }
    featureCols = featureCols.filter(c => c !== targetCol);
    const p = featureCols.length;
    if (p < 2) throw new Error('Selecione pelo menos 2 variáveis quantitativas preditoras.');

    // Detect categorical columns (excluding ID, target, features, and derived cols)
    const derivedIgnore = new Set(['Y_Norm100', 'Mahalanobis_D2', 'Mahalanobis_p', 'Cluster_K3', 'Cluster_Ward3', 'Cluster_K4', 'Cluster_Nome', 'Y_Predito', 'Residuo', 'Residuo_Padronizado']);
    const catCols = (config.catCols || allCols.filter(c => {
      if (c === idCol || c === targetCol || featureCols.includes(c) || derivedIgnore.has(c)) return false;
      if (/^F\d+_/i.test(c)) return false;
      const uniq = new Set(rawInputRows.map(r => String(r[c] ?? '').trim()).filter(Boolean));
      return uniq.size >= 2 && uniq.size <= Math.min(30, Math.floor(rawInputRows.length * 0.6));
    }));

    // Real missing & duplicate ID audit, plus mean-imputation for any isolated missing cells
    let missingTotal = 0;
    const seenIds = new Set();
    let duplicadosId = 0;
    const colMeansPre = {};
    [...featureCols, targetCol].forEach(col => {
      const vals = rawInputRows
        .map(r => (r[col] === '' || r[col] === null || r[col] === undefined ? NaN : Number(r[col])))
        .filter(v => isFinite(v));
      colMeansPre[col] = vals.length ? mean(vals) : 0;
    });

    const rows = rawInputRows.map((r, idx) => {
      const copy = { ...r };
      if (idCol) {
        const idKey = String(r[idCol]);
        if (seenIds.has(idKey)) duplicadosId++;
        seenIds.add(idKey);
      } else {
        copy.ID = idx + 1;
      }
      [...featureCols, targetCol].forEach(col => {
        const rawVal = r[col];
        const num = (rawVal === '' || rawVal === null || rawVal === undefined) ? NaN : Number(rawVal);
        if (!isFinite(num)) {
          missingTotal++;
          copy[col] = colMeansPre[col];
        } else {
          copy[col] = num;
        }
      });
      return copy;
    });

    const n = rows.length;
    const getVarDesc = (col) => {
      if (config.varDescriptions && config.varDescriptions[col]) return config.varDescriptions[col];
      if (KNOWN_VAR_META[col]) return KNOWN_VAR_META[col].desc;
      return col === targetCol ? `Variável Dependente (${col})` : `Indicador ${col}`;
    };
    const getVarDim = (col) => {
      if (col === targetCol) return 'Variável Alvo';
      if (KNOWN_VAR_META[col]) return KNOWN_VAR_META[col].dim;
      return 'Preditor';
    };

    const X_cols = featureCols.map(col => rows.map(r => Number(r[col])));
    const y_arr = rows.map(r => Number(r[targetCol]));
    const yMin = Math.min(...y_arr), yMax = Math.max(...y_arr);
    const ySpan = (yMax - yMin) || 1;
    const featFlat = X_cols.flat();

    // =========================================================================
    // STAGE 1: DESCRIPTIVE STATISTICS & AUDIT
    // =========================================================================
    const descTable = [...featureCols, targetCol].map(col => {
      const arr = rows.map(r => Number(r[col]));
      const m = mean(arr), s = std(arr, 1), v = variance(arr, 1);
      const ks = ksNormalityTest(arr);
      const sf = shapiroFranciaTest(arr);
      return {
        variavel: col,
        descricao: getVarDesc(col),
        dimensao_teorica: getVarDim(col),
        media: Number(m.toFixed(3)),
        mediana: Number(median(arr).toFixed(3)),
        moda: Number(mode(arr).toFixed(3)),
        dp: Number(s.toFixed(3)),
        variancia: Number(v.toFixed(3)),
        cv_pct: Number((m !== 0 ? (s / Math.abs(m)) * 100 : 0).toFixed(2)),
        min: Number(Math.min(...arr).toFixed(2)),
        max: Number(Math.max(...arr).toFixed(2)),
        assimetria: Number(skewness(arr).toFixed(3)),
        curtose: Number(kurtosis(arr).toFixed(3)),
        shapiro_w: Number(sf.w.toFixed(4)),
        shapiro_p: sf.p,
        ks_d: Number(ks.d.toFixed(4)),
        ks_p: ks.p
      };
    });

    const categoricas = {};
    for (const ccol of catCols) {
      const groupsMap = new Map();
      rows.forEach((r, idx) => {
        const key = String(r[ccol] ?? 'N/A').trim() || 'N/A';
        if (!groupsMap.has(key)) groupsMap.set(key, []);
        groupsMap.get(key).push(y_arr[idx]);
      });
      const table = [];
      const groupArrays = [];
      for (const [kVal, gArr] of [...groupsMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        groupArrays.push(gArr);
        table.push({
          categoria: kVal,
          [ccol]: kVal,
          freq: gArr.length,
          pct: Number(((gArr.length / n) * 100).toFixed(2)),
          y_media: Number(mean(gArr).toFixed(2)),
          y_dp: Number(std(gArr, 1).toFixed(2)),
          y_mediana: Number(median(gArr).toFixed(2))
        });
      }
      const anovaRes = oneWayAnova(groupArrays);
      categoricas[ccol] = {
        coluna: ccol,
        table,
        anova_y_f: Number(anovaRes.f.toFixed(4)),
        anova_y_p: anovaRes.p
      };
    }

    const allQuantCols = [...featureCols, targetCol];
    const allQuantArrs = [...X_cols, y_arr];
    const matriz_correlacao = {};
    allQuantCols.forEach((c1, i) => {
      matriz_correlacao[c1] = {};
      allQuantCols.forEach((c2, j) => {
        matriz_correlacao[c1][c2] = Number(pearsonR(allQuantArrs[i], allQuantArrs[j]).toFixed(4));
      });
    });

    const correlacoes_com_y = featureCols.map((col, i) => {
      const rVal = pearsonR(X_cols[i], y_arr);
      const tVal = Math.abs(rVal) < 0.999999 ? rVal * Math.sqrt((n - 2) / (1 - rVal * rVal)) : 99;
      return {
        variavel: col,
        descricao: getVarDesc(col),
        dimensao: getVarDim(col),
        r: Number(rVal.toFixed(4)),
        p_valor: tTestPValue(tVal, n - 2)
      };
    }).sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

    const top_pares_likert = [];
    for (let i = 0; i < p; i++) {
      for (let j = i + 1; j < p; j++) {
        top_pares_likert.push({
          par: `${featureCols[i]} - ${featureCols[j]}`,
          v1: featureCols[i],
          v2: featureCols[j],
          r: Number(pearsonR(X_cols[i], X_cols[j]).toFixed(4))
        });
      }
    }
    top_pares_likert.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

    // =========================================================================
    // STAGE 2: FACTOR ANALYSIS (KMO, BARTLETT, HORN PA, ACP VARIMAX, AFE-PAF)
    // =========================================================================
    const R = Array.from({ length: p }, (_, i) =>
      Array.from({ length: p }, (__, j) => (i === j ? 1 : pearsonR(X_cols[i], X_cols[j])))
    );
    const { inv: R_inv, det: detR } = matInvAndDet(R);
    const bartlettChi2 = Math.max(0, -(n - 1 - (2 * p + 5) / 6) * Math.log(Math.max(Math.abs(detR), 1e-30)));
    const bartlettDf = (p * (p - 1)) / 2;
    const bartlettP = chi2PValue(bartlettChi2, bartlettDf);

    let r2Sum = 0, p2Sum = 0;
    const msa_individual = {};
    const anti_image_corr = {};
    for (let i = 0; i < p; i++) {
      let r2i = 0, p2i = 0;
      anti_image_corr[featureCols[i]] = {};
      for (let j = 0; j < p; j++) {
        if (i !== j) {
          const rij = R[i][j];
          const pij = -R_inv[i][j] / Math.sqrt(Math.max(1e-12, Math.abs(R_inv[i][i] * R_inv[j][j])));
          r2i += rij * rij;
          p2i += pij * pij;
          r2Sum += rij * rij;
          p2Sum += pij * pij;
          anti_image_corr[featureCols[i]][featureCols[j]] = Number((-pij).toFixed(4));
        }
      }
      const msa_i = (r2i + p2i) > 0 ? r2i / (r2i + p2i) : 0.5;
      msa_individual[featureCols[i]] = Number(msa_i.toFixed(4));
      anti_image_corr[featureCols[i]][featureCols[i]] = Number(msa_i.toFixed(4));
    }
    const kmoGlobal = (r2Sum + p2Sum) > 0 ? r2Sum / (r2Sum + p2Sum) : 0.5;
    const msaValues = Object.values(msa_individual);
    const msaMin = Math.min(...msaValues);
    const msaMax = Math.max(...msaValues);
    const msaAbove05 = msaValues.filter(v => v >= 0.5).length;

    const { values: eigVals, vectors: eigVecs } = jacobiEigen(R);
    const paP95 = parallelAnalysisP95(n, p, 2026);
    let kFactors = config.nFactors || eigVals.filter(v => v > 1.0).length;
    kFactors = Math.max(Math.min(2, p), Math.min(kFactors, Math.min(6, p)));

    const L_unrot = Array.from({ length: p }, (_, i) =>
      Array.from({ length: kFactors }, (__, c) => eigVecs[i][c] * Math.sqrt(Math.max(0, eigVals[c])))
    );
    let L_rot = varimaxPairwise(L_unrot);

    // Orient each factor so its dominant loadings are positive
    for (let c = 0; c < kFactors; c++) {
      const colSum = L_rot.reduce((acc, row) => acc + Math.pow(row[c], 3), 0);
      if (colSum < 0) {
        for (let i = 0; i < p; i++) L_rot[i][c] = -L_rot[i][c];
      }
    }

    // Determine semantic or data-driven names for each factor & align canonical order if TechNova items match
    const rawFactorInfo = Array.from({ length: kFactors }, (_, c) => {
      const domIdx = [];
      for (let i = 0; i < p; i++) {
        let bestC = 0;
        for (let cc = 1; cc < kFactors; cc++) {
          if (Math.abs(L_rot[i][cc]) > Math.abs(L_rot[i][bestC])) bestC = cc;
        }
        if (bestC === c) domIdx.push(i);
      }
      const domVars = domIdx.map(i => featureCols[i]);
      const topVars = [...featureCols]
        .map((vc, i) => ({ vc, absL: Math.abs(L_rot[i][c]) }))
        .sort((a, b) => b.absL - a.absL)
        .slice(0, 3)
        .map(o => o.vc);
      return { origCol: c, domIdx, domVars, topVars, matchedBlock: null };
    });

    const usedBlocks = new Set();
    rawFactorInfo.forEach(info => {
      let bestBlock = null, bestOverlap = 0;
      SEMANTIC_BLOCKS.forEach(blk => {
        if (usedBlocks.has(blk.key)) return;
        const overlap = info.domVars.filter(v => blk.items.includes(v)).length;
        if (overlap >= 2 && overlap > bestOverlap) {
          bestOverlap = overlap;
          bestBlock = blk;
        }
      });
      if (bestBlock) {
        info.matchedBlock = bestBlock;
        usedBlocks.add(bestBlock.key);
      }
    });

    // If semantic blocks matched, sort factors in canonical block order (F1..F4); otherwise by rotated variance desc
    const ssPerRawCol = Array.from({ length: kFactors }, (_, c) => L_rot.reduce((acc, row) => acc + row[c] * row[c], 0));
    const colOrder = rawFactorInfo
      .map((info, idx) => ({
        idx,
        sortKey: info.matchedBlock ? info.matchedBlock.order : (100 - ssPerRawCol[idx])
      }))
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(o => o.idx);

    L_rot = L_rot.map(row => colOrder.map(c => row[c]));
    const orderedInfo = colOrder.map(c => rawFactorInfo[c]);

    const factorMeta = orderedInfo.map((info, newIdx) => {
      if (info.matchedBlock) {
        return {
          codigo: info.matchedBlock.key,
          nome: info.matchedBlock.label,
          nome_curto: info.matchedBlock.short
        };
      }
      const preview = info.topVars.slice(0, 2).join(', ');
      return {
        codigo: `F${newIdx + 1}`,
        nome: `Fator ${newIdx + 1} (${preview})`,
        nome_curto: `F${newIdx + 1} (${info.topVars[0] || ''})`
      };
    });
    const factorCodes = factorMeta.map(m => m.codigo);

    // Real Principal Axis Factoring (AFE-PAF)
    const paf = computePAF(R, R_inv, kFactors);

    // Standardize X_cols (n x p)
    const featMeans = X_cols.map(col => mean(col));
    const featSds = X_cols.map(col => std(col, 1) || 1);
    const Z_cols = X_cols.map((col, idx) => col.map(v => (v - featMeans[idx]) / featSds[idx]));
    const Z = Array.from({ length: n }, (_, i) => Z_cols.map(col => col[i]));

    // Factor scores via exact Varimax regression weights: W = L_rot * (L_rot^T L_rot)^-1
    const LT = matTranspose(L_rot);
    const LTL = matMul(LT, L_rot);
    const { inv: LTL_inv } = matInvAndDet(LTL);
    const W_weights = matMul(L_rot, LTL_inv); // p x kFactors
    const F_raw = matMul(Z, W_weights);

    const F_raw_means = Array.from({ length: kFactors }, (_, c) => mean(F_raw.map(r => r[c])));
    const F_raw_sds = Array.from({ length: kFactors }, (_, c) => std(F_raw.map(r => r[c]), 1) || 1);
    const F_cols = Array.from({ length: kFactors }, (_, c) =>
      F_raw.map(r => (r[c] - F_raw_means[c]) / F_raw_sds[c])
    );
    const F_mat = Array.from({ length: n }, (_, i) => F_cols.map(col => col[i]));

    let cumPct = 0;
    const autovalores_tabela = eigVals.map((ev, idx) => {
      const pct = (ev / p) * 100;
      cumPct += pct;
      const paVal = paP95[idx] ?? 1.0;
      return {
        componente: idx + 1,
        autovalor: Number(ev.toFixed(4)),
        var_pct: Number(pct.toFixed(2)),
        var_acum_pct: Number(cumPct.toFixed(2)),
        pa_p95: Number(paVal.toFixed(4)),
        retido_kaiser: ev > 1.0,
        retido_pa: ev > paVal,
        retido: idx < kFactors
      };
    });

    const cargas_comunalidades = featureCols.map((vcol, i) => {
      const row = L_rot[i];
      const h2 = row.reduce((a, b) => a + b * b, 0);
      let domIdx = 0;
      for (let c = 1; c < kFactors; c++) {
        if (Math.abs(row[c]) > Math.abs(row[domIdx])) domIdx = c;
      }
      // Best matching PAF loading magnitude for this item
      const pafRow = paf.loadings[i];
      let bestPaf = pafRow[0] || 0;
      for (let c = 1; c < kFactors; c++) {
        if (Math.abs(pafRow[c]) > Math.abs(bestPaf)) bestPaf = pafRow[c];
      }
      const obj = {
        variavel: vcol,
        descricao: getVarDesc(vcol),
        comunalidade_acp: Number(h2.toFixed(4)),
        unicidade_acp: Number(Math.max(0, 1 - h2).toFixed(4)),
        msa_anti_imagem: msa_individual[vcol],
        carga_afe_ml_principal: Number(Math.abs(bestPaf).toFixed(4)),
        comunalidade_afe_ml: Number(paf.h2[i].toFixed(4)),
        fator_dominante: factorCodes[domIdx]
      };
      factorCodes.forEach((fc, c) => { obj[fc] = Number(row[c].toFixed(4)); });
      return obj;
    });

    const fatores_resumo = factorMeta.map((fm, c) => {
      const fc = fm.codigo;
      const ss = L_rot.reduce((acc, row) => acc + row[c] * row[c], 0);
      const domIndices = featureCols
        .map((_, i) => i)
        .filter(i => cargas_comunalidades[i].fator_dominante === fc);
      const itemArrays = domIndices.map(i => X_cols[i]);
      const itemSigns = domIndices.map(i => (L_rot[i][c] >= 0 ? 1 : -1));
      const alpha = cronbachAlpha(itemArrays, itemSigns);
      const flatVals = domIndices.flatMap(i => X_cols[i]);
      return {
        codigo: fc,
        nome: fm.nome,
        nome_curto: fm.nome_curto,
        itens_dominantes: domIndices.map(i => featureCols[i]),
        ss_loadings_rot: Number(ss.toFixed(4)),
        var_rot_pct: Number(((ss / p) * 100).toFixed(2)),
        alfa_cronbach: alpha !== null ? Number(alpha.toFixed(4)) : null,
        media_itens_original: flatVals.length ? Number(mean(flatVals).toFixed(3)) : null,
        dp_itens_original: flatVals.length ? Number(std(flatVals, 1).toFixed(3)) : null
      };
    });

    // =========================================================================
    // STAGE 3: CLUSTER ANALYSIS (MAHALANOBIS, WARD, K-MEANS++, MULTICRITERIA)
    // =========================================================================
    // Real Mahalanobis D² using covariance inverse of F_mat
    const F_cov = Array.from({ length: kFactors }, (_, i) =>
      Array.from({ length: kFactors }, (__, j) => {
        let s = 0;
        for (let r = 0; r < n; r++) s += F_cols[i][r] * F_cols[j][r];
        return s / (n - 1);
      })
    );
    const { inv: F_cov_inv } = matInvAndDet(F_cov);
    const mahalanobisD2 = F_mat.map(vec => {
      let d2 = 0;
      for (let a = 0; a < kFactors; a++) {
        let inner = 0;
        for (let b = 0; b < kFactors; b++) inner += F_cov_inv[a][b] * vec[b];
        d2 += vec[a] * inner;
      }
      return Math.max(0, d2);
    });
    const mahalanobisP = mahalanobisD2.map(d2 => chi2PValue(d2, kFactors));
    const mahalCritP01 = chi2Critical(0.01, kFactors);
    const mahalCritP001 = chi2Critical(0.001, kFactors);
    const outliersMahalP01 = [];
    const outliersMahalP001 = [];
    rows.forEach((r, i) => {
      const idVal = idCol ? r[idCol] : r.ID;
      if (mahalanobisP[i] < 0.01) outliersMahalP01.push({ id: idVal, d2: Number(mahalanobisD2[i].toFixed(3)), p: mahalanobisP[i] });
      if (mahalanobisP[i] < 0.001) outliersMahalP001.push({ id: idVal, d2: Number(mahalanobisD2[i].toFixed(3)), p: mahalanobisP[i] });
    });

    // Real Ward Agglomeration
    const wardRes = runWardAgglomeration(F_mat);

    const maxK = Math.min(6, Math.max(2, Math.floor(n / 4)));
    const targetK = Math.max(2, Math.min(config.nClusters || 3, maxK));
    const totalTSS = F_mat.reduce((acc, vec) => acc + vec.reduce((s, v) => s + v * v, 0), 0);

    const metricas_escolha_k = [];
    for (let k = 2; k <= maxK; k++) {
      const km = runKMeans(F_mat, k, 42, 12);
      const sil = computeSilhouette(F_mat, km.labels, k);
      const db = computeDaviesBouldin(F_mat, km.labels, km.centers, k);
      const gapObj = computeGapStatistic(F_mat, k, km.inertia, 8, 777);
      const counts = new Array(k).fill(0);
      km.labels.forEach(l => counts[l]++);
      const bss = Math.max(0, totalTSS - km.inertia);
      const ch = km.inertia > 1e-12 && n > k ? ((bss / (k - 1)) / (km.inertia / (n - k))) : 0;
      metricas_escolha_k.push({
        k,
        wcss_inercia: Number(km.inertia.toFixed(3)),
        silhueta: Number(sil.toFixed(4)),
        calinski_harabasz: Number(ch.toFixed(2)),
        davies_bouldin: Number(db.toFixed(4)),
        gap_statistic: Number(gapObj.gap.toFixed(4)),
        gap_sk: Number(gapObj.sk.toFixed(4)),
        tamanhos: counts
      });
    }

    const kmSelected = runKMeans(F_mat, targetK, 42, 24);
    const rawClusterY = Array.from({ length: targetK }, (_, c) => {
      const ys = y_arr.filter((_, i) => kmSelected.labels[i] === c);
      return { c, ym: ys.length ? mean(ys) : 0 };
    }).sort((a, b) => a.ym - b.ym);
    const cMap = {};
    rawClusterY.forEach((obj, newIdx) => { cMap[obj.c] = newIdx + 1; });
    const clusterIds = kmSelected.labels.map(c => cMap[c]);

    const perfis_k3 = Array.from({ length: targetK }, (_, idx) => {
      const cid = idx + 1;
      const memberIdx = clusterIds.map((c, i) => (c === cid ? i : -1)).filter(i => i >= 0);
      const ys = memberIdx.map(i => y_arr[i]);
      const centroides_fatores = {};
      const medias_por_fator_original = {};

      factorMeta.forEach((fm, c) => {
        const fc = fm.codigo;
        centroides_fatores[fc] = Number((memberIdx.length ? mean(memberIdx.map(i => F_cols[c][i])) : 0).toFixed(4));
        const domVars = fatores_resumo[c].itens_dominantes;
        const origVals = domVars.flatMap(vc => {
          const vi = featureCols.indexOf(vc);
          return memberIdx.map(i => X_cols[vi][i]);
        });
        medias_por_fator_original[fc] = origVals.length ? Number(mean(origVals).toFixed(2)) : null;
      });

      const medias_originais = {};
      featureCols.forEach((vcol, vi) => {
        medias_originais[vcol] = Number((memberIdx.length ? mean(memberIdx.map(i => X_cols[vi][i])) : 0).toFixed(2));
      });

      // Data-driven cluster label from lowest & highest factor centroids
      const sortedCentroids = factorMeta
        .map(fm => ({ fm, val: centroides_fatores[fm.codigo] }))
        .sort((a, b) => a.val - b.val);
      const worstF = sortedCentroids[0];
      const bestF = sortedCentroids[sortedCentroids.length - 1];
      let shortLabel;
      if (cid === targetK) {
        shortLabel = `C${cid}: Alto ${targetCol} (+${bestF.fm.nome_curto})`;
      } else if (cid === 1) {
        shortLabel = `C${cid}: Baixo ${targetCol} (−${worstF.fm.nome_curto})`;
      } else {
        shortLabel = `C${cid}: Intermediário (−${worstF.fm.nome_curto})`;
      }

      return {
        cluster_id: cid,
        n: memberIdx.length,
        pct: Number(((memberIdx.length / n) * 100).toFixed(2)),
        y_media: Number((ys.length ? mean(ys) : 0).toFixed(2)),
        y_dp: Number((ys.length > 1 ? std(ys, 1) : 0).toFixed(2)),
        y_norm100_media: Number((ys.length ? ((mean(ys) - yMin) / ySpan) * 100 : 0).toFixed(2)),
        centroides_fatores,
        medias_originais,
        medias_por_fator_original,
        fator_menor_centroide: worstF.fm.codigo,
        fator_maior_centroide: bestF.fm.codigo,
        rotulo: shortLabel,
        rotulo_curto: shortLabel
      };
    });

    // Crosstabs & Chi-Square for all categorical columns
    const crosstabs_qui_quadrado = {};
    for (const ccol of catCols) {
      const cats = [...new Set(rows.map(r => String(r[ccol] ?? 'N/A').trim() || 'N/A'))].sort();
      const contagem = {};
      const pct_por_cluster = {};
      const pct_por_categoria = {};
      cats.forEach(cat => {
        contagem[cat] = {};
        pct_por_cluster[cat] = {};
        pct_por_categoria[cat] = {};
      });
      const colTotals = {};
      cats.forEach(cat => { colTotals[cat] = rows.filter(r => (String(r[ccol] ?? 'N/A').trim() || 'N/A') === cat).length; });
      const rowTotals = {};
      for (let cid = 1; cid <= targetK; cid++) rowTotals[cid] = clusterIds.filter(c => c === cid).length;

      let chi2 = 0;
      for (let cid = 1; cid <= targetK; cid++) {
        for (const cat of cats) {
          const obs = rows.filter((r, i) => clusterIds[i] === cid && (String(r[ccol] ?? 'N/A').trim() || 'N/A') === cat).length;
          contagem[cat][String(cid)] = obs;
          pct_por_cluster[cat][String(cid)] = Number((rowTotals[cid] ? (obs / rowTotals[cid]) * 100 : 0).toFixed(2));
          pct_por_categoria[cat][String(cid)] = Number((colTotals[cat] ? (obs / colTotals[cat]) * 100 : 0).toFixed(2));
          const exp = (rowTotals[cid] * colTotals[cat]) / n;
          if (exp > 0) chi2 += Math.pow(obs - exp, 2) / exp;
        }
      }
      const gl = Math.max(1, (targetK - 1) * (cats.length - 1));
      const pChi = chi2PValue(chi2, gl);
      crosstabs_qui_quadrado[ccol] = {
        coluna: ccol,
        categorias: cats,
        contagem, pct_por_cluster, pct_por_categoria,
        chi2: Number(chi2.toFixed(4)), gl, p_valor: pChi, significativo_5pct: pChi < 0.05
      };
    }

    // One-Way ANOVA across all K clusters
    const anova_tukey_clusters = [...factorCodes, ...featureCols, targetCol].map(colName => {
      const getVal = (i) => {
        const fIdx = factorCodes.indexOf(colName);
        if (fIdx >= 0) return F_cols[fIdx][i];
        if (colName === targetCol) return y_arr[i];
        const vIdx = featureCols.indexOf(colName);
        return vIdx >= 0 ? X_cols[vIdx][i] : 0;
      };
      const groups = Array.from({ length: targetK }, (_, idx) => {
        const cid = idx + 1;
        return clusterIds.map((c, i) => (c === cid ? getVal(i) : null)).filter(v => v !== null);
      });
      const anova = oneWayAnova(groups);
      return {
        variavel: colName,
        f_stat: Number(anova.f.toFixed(4)),
        p_valor: anova.p,
        medias_por_cluster: groups.map(g => Number((g.length ? mean(g) : 0).toFixed(3)))
      };
    });

    // =========================================================================
    // STAGE 4: MULTIPLE LINEAR REGRESSION (OLS) + REAL RESIDUAL DIAGNOSTICS
    // =========================================================================
    const ols = fitOLS(F_cols, y_arr);
    const tCrit = tCritical95(ols.dfResid);
    const coeficientes = [
      {
        termo: 'const',
        rotulo: 'Intercepto (β₀)',
        nome_curto: 'Intercepto',
        b_nao_padronizado: Number(ols.B[0].toFixed(4)),
        erro_padrao: Number(ols.seB[0].toFixed(4)),
        beta_padronizado: 0,
        t_stat: Number(ols.tStats[0].toFixed(4)),
        p_valor: ols.pVals[0],
        ic95_inf: Number((ols.B[0] - tCrit * ols.seB[0]).toFixed(4)),
        ic95_sup: Number((ols.B[0] + tCrit * ols.seB[0]).toFixed(4)),
        vif: 1.0,
        impacto_1dp_escala_0_100: 0
      },
      ...factorMeta.map((fm, idx) => {
        const b = ols.B[idx + 1], se = ols.seB[idx + 1];
        return {
          termo: fm.codigo,
          rotulo: fm.nome,
          nome_curto: fm.nome_curto,
          b_nao_padronizado: Number(b.toFixed(4)),
          erro_padrao: Number(se.toFixed(4)),
          beta_padronizado: Number(ols.betas[idx + 1].toFixed(4)),
          t_stat: Number(ols.tStats[idx + 1].toFixed(4)),
          p_valor: ols.pVals[idx + 1],
          ic95_inf: Number((b - tCrit * se).toFixed(4)),
          ic95_sup: Number((b + tCrit * se).toFixed(4)),
          vif: Number(ols.vifs[idx].toFixed(4)),
          impacto_1dp_escala_0_100: Number(((b / ySpan) * 100).toFixed(2))
        };
      })
    ];

    // Real residual assumption tests
    const residStd = std(ols.resid, 1) || 1;
    const residZ = ols.resid.map(r => r / residStd);
    const residSF = shapiroFranciaTest(ols.resid);
    const residKS = ksNormalityTest(ols.resid);

    // Real Breusch-Pagan test: regress e_i^2 on F_cols
    const residSq = ols.resid.map(r => r * r);
    const bpOls = fitOLS(F_cols, residSq);
    const bpLM = n * bpOls.r2;
    const bpP = chi2PValue(bpLM, kFactors);

    const outliersResid3 = [];
    rows.forEach((r, i) => {
      if (Math.abs(residZ[i]) > 3.0) {
        outliersResid3.push({ id: idCol ? r[idCol] : r.ID, z: Number(residZ[i].toFixed(3)) });
      }
    });
    const maxCooksD = Math.max(...ols.cooksD);
    const maxVif = Math.max(...ols.vifs);

    // =========================================================================
    // STAGE 5: INTEGRATION (SEGMENTED REGRESSIONS & GROUP PROFILES)
    // =========================================================================
    const buildSegmentedOls = (memberIdx, label, extra = {}) => {
      const subF = F_cols.map(col => memberIdx.map(i => col[i]));
      const subY = memberIdx.map(i => y_arr[i]);
      const validSub = memberIdx.length > kFactors + 2;
      const subOls = validSub ? fitOLS(subF, subY) : null;
      const coefsObj = {};
      factorCodes.forEach((fc, idx) => {
        coefsObj[fc] = subOls ? {
          b: Number(subOls.B[idx + 1].toFixed(4)),
          erro_padrao: Number(subOls.seB[idx + 1].toFixed(4)),
          beta: Number(subOls.betas[idx + 1].toFixed(4)),
          t: Number(subOls.tStats[idx + 1].toFixed(4)),
          p: subOls.pVals[idx + 1],
          sig_5pct: subOls.pVals[idx + 1] < 0.05
        } : { b: null, erro_padrao: null, beta: null, t: null, p: null, sig_5pct: false };
      });
      return {
        ...extra,
        rotulo: label,
        n: memberIdx.length,
        valido: validSub,
        intercepto: subOls ? Number(subOls.B[0].toFixed(4)) : null,
        r2: subOls ? Number(subOls.r2.toFixed(4)) : null,
        r2_ajustado: subOls ? Number(subOls.r2Adj.toFixed(4)) : null,
        f_stat: subOls ? Number(subOls.fStat.toFixed(4)) : null,
        f_p: subOls ? subOls.fP : null,
        coeficientes: coefsObj
      };
    };

    const regressao_por_cluster = {};
    for (let cid = 1; cid <= targetK; cid++) {
      const mIdx = clusterIds.map((c, i) => (c === cid ? i : -1)).filter(i => i >= 0);
      regressao_por_cluster[`Cluster_${cid}`] = buildSegmentedOls(
        mIdx,
        perfis_k3[cid - 1].rotulo_curto,
        { cluster_id: cid }
      );
    }

    // Segmented regression by primary categorical column (e.g., Modalidade or first catCol)
    const primaryCatCol = catCols.includes('Modalidade') ? 'Modalidade' : (catCols[0] || null);
    const regressao_por_categoria = {};
    if (primaryCatCol) {
      const cats = [...new Set(rows.map(r => String(r[primaryCatCol] ?? 'N/A').trim() || 'N/A'))].sort();
      cats.forEach(cat => {
        const mIdx = rows
          .map((r, i) => ((String(r[primaryCatCol] ?? 'N/A').trim() || 'N/A') === cat ? i : -1))
          .filter(i => i >= 0);
        regressao_por_categoria[cat] = buildSegmentedOls(mIdx, cat, { categoria: cat, coluna: primaryCatCol });
      });
    }

    // Dynamic group profiles for ALL categorical columns
    const perfis_por_coluna_categorica = {};
    catCols.forEach(ccol => {
      const vals = [...new Set(rows.map(r => String(r[ccol] ?? 'N/A').trim() || 'N/A'))];
      const list = vals.map(v => {
        const sIdx = rows
          .map((r, i) => ((String(r[ccol] ?? 'N/A').trim() || 'N/A') === v ? i : -1))
          .filter(i => i >= 0);
        const clusters_dist = {};
        for (let cid = 1; cid <= targetK; cid++) {
          clusters_dist[`C${cid}`] = sIdx.filter(i => clusterIds[i] === cid).length;
        }
        const obj = {
          grupo: v,
          squad: v,
          n: sIdx.length,
          y_media: Number(mean(sIdx.map(i => y_arr[i])).toFixed(2)),
          y_dp: Number((sIdx.length > 1 ? std(sIdx.map(i => y_arr[i]), 1) : 0).toFixed(2)),
          clusters_dist
        };
        factorCodes.forEach((fc, c) => {
          obj[fc] = Number(mean(sIdx.map(i => F_cols[c][i])).toFixed(3));
        });
        return obj;
      }).sort((a, b) => b.y_media - a.y_media);
      perfis_por_coluna_categorica[ccol] = list;
    });

    const defaultGroupCol = catCols.includes('Squad') ? 'Squad' : (catCols[0] || null);
    const perfis_por_squad = defaultGroupCol ? perfis_por_coluna_categorica[defaultGroupCol] : [];

    // Enriched rows for Explorer, Charts & CSV Export
    const enrichedRows = rows.map((r, i) => {
      const enr = { ...r };
      if (enr.ID === undefined) enr.ID = idCol ? r[idCol] : (i + 1);
      enr.Y_Norm100 = Number((((y_arr[i] - yMin) / ySpan) * 100).toFixed(2));
      factorCodes.forEach((fc, c) => {
        enr[fc] = Number(F_cols[c][i].toFixed(4));
      });
      enr.Mahalanobis_D2 = Number(mahalanobisD2[i].toFixed(4));
      enr.Mahalanobis_p = Number(mahalanobisP[i].toFixed(6));
      enr.Cluster_K = clusterIds[i];
      enr.Cluster_K3 = clusterIds[i];
      enr.Cluster_Nome = perfis_k3[clusterIds[i] - 1].rotulo_curto;
      enr.Y_Predito = Number(ols.yHat[i].toFixed(2));
      enr.Residuo = Number(ols.resid[i].toFixed(3));
      enr.Residuo_Padronizado = Number(residZ[i].toFixed(4));
      enr.Cooks_D = Number(ols.cooksD[i].toFixed(5));
      return enr;
    });

    const summary = {
      meta: {
        n,
        n_vars_likert: p,
        n_fatores: kFactors,
        n_clusters: targetK,
        idCol: idCol || 'ID',
        featureCols,
        targetCol,
        catCols,
        primaryCatCol,
        defaultGroupCol,
        factorCodes,
        factorMeta
      },
      etapa1_descritiva: {
        auditoria: {
          n_linhas: n,
          missing_total: missingTotal,
          duplicados_id: duplicadosId,
          escala_preditores_min: Number(Math.min(...featFlat).toFixed(2)),
          escala_preditores_max: Number(Math.max(...featFlat).toFixed(2)),
          y_min_observado: Number(yMin.toFixed(2)),
          y_max_observado: Number(yMax.toFixed(2)),
          y_media_observada: Number(mean(y_arr).toFixed(2)),
          y_dp_observado: Number(std(y_arr, 1).toFixed(2)),
          nota_auditoria_y: `Base processada automaticamente com N = ${n} registros, ${p} variáveis quantitativas preditoras e ${catCols.length} variável(is) categórica(s). Alvo "${targetCol}": mínimo ${Number(yMin.toFixed(2))}, máximo ${Number(yMax.toFixed(2))}, média ${mean(y_arr).toFixed(2)} (DP = ${std(y_arr, 1).toFixed(2)}). Missing tratados: ${missingTotal} | IDs duplicados: ${duplicadosId}.`
        },
        tabela_descritiva: descTable,
        categoricas,
        correlacoes_com_y,
        top_pares_likert: top_pares_likert.slice(0, 25),
        matriz_correlacao
      },
      etapa2_fatorial: {
        kmo_global: Number(kmoGlobal.toFixed(4)),
        bartlett_chi2: Number(bartlettChi2.toFixed(2)),
        bartlett_df: bartlettDf,
        bartlett_p: bartlettP,
        det_matriz_correlacao: detR,
        msa_individual,
        msa_min: Number(msaMin.toFixed(4)),
        msa_max: Number(msaMax.toFixed(4)),
        msa_acima_050: msaAbove05,
        matriz_anti_imagem_corr: anti_image_corr,
        autovalores_tabela,
        variancia_total_explicada_acp_pct: autovalores_tabela[kFactors - 1]?.var_acum_pct ?? 0,
        variancia_comum_afe_ml_pct: Number(paf.commonVarPct.toFixed(2)),
        fatores_resumo,
        cargas_comunalidades,
        // Scoring metadata for exact individual prediction
        scoring_model: {
          featureCols,
          featMeans,
          featSds,
          W_weights,
          F_raw_means,
          F_raw_sds
        }
      },
      etapa3_cluster: {
        outliers_mahalanobis_p001: outliersMahalP001,
        outliers_mahalanobis_p01: outliersMahalP01,
        mahalanobis_critico_p01: Number(mahalCritP01.toFixed(3)),
        mahalanobis_critico_p001: Number(mahalCritP001.toFixed(3)),
        mahalanobis_max_d2: Number(Math.max(...mahalanobisD2).toFixed(4)),
        agrupamento_ward_ultimas_10_etapas: wardRes.ultimas_10_etapas,
        ward_k_sugerido: wardRes.k_sugerido,
        ward_salto_max_pct: wardRes.salto_max_pct,
        metricas_escolha_k,
        perfis_k3,
        anova_tukey_clusters,
        crosstabs_qui_quadrado
      },
      etapa4_regressao: {
        r: Number(ols.r.toFixed(4)),
        r2: Number(ols.r2.toFixed(4)),
        r2_ajustado: Number(ols.r2Adj.toFixed(4)),
        erro_padrao_estimativa: Number(ols.seEst.toFixed(4)),
        f_anova: Number(ols.fStat.toFixed(4)),
        p_anova: ols.fP,
        gl_modelo: ols.dfModel,
        gl_residuo: ols.dfResid,
        soma_quadrados_total: Number(ols.sst.toFixed(2)),
        soma_quadrados_regressao: Number(ols.sse.toFixed(2)),
        soma_quadrados_residuo: Number(ols.ssr.toFixed(2)),
        coeficientes,
        pressupostos: {
          normalidade_shapiro_w: Number(residSF.w.toFixed(4)),
          normalidade_shapiro_p: residSF.p,
          normalidade_ks_d: Number(residKS.d.toFixed(4)),
          normalidade_ks_p: residKS.p,
          homocedasticidade_breusch_pagan_lm: Number(bpLM.toFixed(4)),
          homocedasticidade_breusch_pagan_p: bpP,
          homocedasticidade_bp_f: Number(bpOls.fStat.toFixed(4)),
          homocedasticidade_bp_f_p: bpOls.fP,
          durbin_watson: Number(ols.dw.toFixed(4)),
          vif_maximo: Number(maxVif.toFixed(4)),
          outliers_residuo_maior_3dp: outliersResid3,
          cooks_distance_max: Number(maxCooksD.toFixed(4)),
          cooks_distance_gt1_count: ols.cooksD.filter(d => d > 1).length
        }
      },
      etapa5_integracao: {
        regressao_por_cluster,
        regressao_por_categoria,
        primary_cat_col: primaryCatCol,
        perfis_por_coluna_categorica,
        perfis_por_squad
      }
    };

    return { summary, enrichedRows };
  }

  // --- Dynamic Individual Classifier & Predictor ---
  function predictIndividualCollaborator(vScores, activeSummary) {
    const ef = activeSummary.etapa2_fatorial;
    const ec = activeSummary.etapa3_cluster;
    const er = activeSummary.etapa4_regressao;
    const fCodes = activeSummary.meta.factorCodes;
    const sm = ef.scoring_model;

    // 1. Compute exact standardized Varimax factor scores using active model weights
    const fScores = {};
    if (sm && sm.W_weights) {
      const zVec = sm.featureCols.map((col, idx) => {
        const val = vScores[col] !== undefined ? Number(vScores[col]) : sm.featMeans[idx];
        return (val - sm.featMeans[idx]) / (sm.featSds[idx] || 1);
      });
      fCodes.forEach((fc, c) => {
        let raw = 0;
        for (let i = 0; i < zVec.length; i++) raw += zVec[i] * sm.W_weights[i][c];
        fScores[fc] = (raw - sm.F_raw_means[c]) / (sm.F_raw_sds[c] || 1);
      });
    } else {
      fCodes.forEach(fc => { fScores[fc] = 0; });
    }

    // 2. Classify into nearest K-Means cluster centroid across all extracted factors
    let bestCluster = ec.perfis_k3[0];
    let minDist2 = Infinity;
    ec.perfis_k3.forEach(prof => {
      let d2 = 0;
      fCodes.forEach(fc => {
        const diff = (fScores[fc] || 0) - (prof.centroides_fatores[fc] || 0);
        d2 += diff * diff;
      });
      if (d2 < minDist2) {
        minDist2 = d2;
        bestCluster = prof;
      }
    });

    // 3. Predict target Y via active OLS equation
    let yHat = er.coeficientes[0]?.b_nao_padronizado || 0;
    er.coeficientes.slice(1).forEach(c => {
      yHat += c.b_nao_padronizado * (fScores[c.termo] || 0);
    });

    return {
      fScores,
      cluster: bestCluster,
      distToCentroid: Math.sqrt(minDist2),
      yPredito: yHat
    };
  }

  const api = {
    runAdaptivePipeline,
    predictIndividualCollaborator
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.TechNovaStatsEngine = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
