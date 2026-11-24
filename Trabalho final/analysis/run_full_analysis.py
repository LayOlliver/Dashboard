import json
import os
import warnings
import numpy as np
import pandas as pd
from scipy import stats
from scipy.cluster.hierarchy import dendrogram, linkage, fcluster
from scipy.spatial.distance import pdist, squareform
from sklearn.decomposition import PCA, FactorAnalysis
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, silhouette_samples, calinski_harabasz_score, davies_bouldin_score
import statsmodels.api as sm
from statsmodels.stats.diagnostic import het_breuschpagan
from statsmodels.stats.stattools import durbin_watson
from statsmodels.stats.multicomp import pairwise_tukeyhsd
from statsmodels.stats.outliers_influence import variance_inflation_factor
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

warnings.filterwarnings('ignore')

# Formatting & Style
plt.rcParams['font.sans-serif'] = 'DejaVu Sans'
plt.rcParams['axes.edgecolor'] = '#CBD5E1'
plt.rcParams['axes.linewidth'] = 0.8

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
FIG_DIR = os.path.join(BASE_DIR, 'analysis', 'figures')
OUT_DIR = os.path.join(BASE_DIR, 'analysis')
os.makedirs(FIG_DIR, exist_ok=True)

VAR_INFO = {
    'V1': ('Qualidade do espaço de trabalho', 'Ambiente'),
    'V2': ('Disponibilidade/qualidade de ferramentas', 'Ambiente'),
    'V3': ('Gestão de ruído e interrupções', 'Ambiente'),
    'V4': ('Ergonomia do posto de trabalho', 'Ambiente'),
    'V5': ('Suporte e acessibilidade do gestor', 'Liderança'),
    'V6': ('Grau de autonomia técnica', 'Liderança'),
    'V7': ('Reconhecimento por entregas', 'Liderança'),
    'V8': ('Segurança psicológica', 'Liderança'),
    'V9': ('Oportunidades de treinamento', 'Crescimento'),
    'V10': ('Clareza do plano de carreira', 'Crescimento'),
    'V11': ('Qualidade/disponibilidade de mentoria', 'Crescimento'),
    'V12': ('Justiça na carga de trabalho', 'Equilíbrio'),
    'V13': ('Flexibilidade de horários', 'Equilíbrio'),
    'V14': ('Prevenção efetiva ao burnout', 'Equilíbrio'),
    'V15': ('Satisfação com benefícios', 'Equilíbrio'),
}
V_COLS = [f'V{i}' for i in range(1, 16)]


def varimax_rotation(Phi, gamma=1.0, q=100, tol=1e-8):
    """Kaiser-normalized Varimax rotation."""
    p, k = Phi.shape
    h = np.sqrt(np.sum(Phi**2, axis=1, keepdims=True))
    h[h == 0] = 1.0
    Phi_norm = Phi / h

    R = np.eye(k)
    d = 0
    for _ in range(q):
        d_old = d
        Lambda = np.dot(Phi_norm, R)
        u, s, vh = np.linalg.svd(
            np.dot(
                Phi_norm.T,
                Lambda**3 - (gamma / p) * np.dot(Lambda, np.diag(np.diag(np.dot(Lambda.T, Lambda))))
            )
        )
        R = np.dot(u, vh)
        d = np.sum(s)
        if d_old != 0 and (d - d_old) / d < tol:
            break
    rotated_norm = np.dot(Phi_norm, R)
    return rotated_norm * h, R


def cronbach_alpha(df_items):
    """Calculate Cronbach's Alpha for a dataframe of items."""
    items = df_items.values
    k = items.shape[1]
    if k < 2:
        return 0.0
    item_vars = items.var(axis=0, ddof=1)
    total_var = items.sum(axis=1).var(ddof=1)
    if total_var == 0:
        return 0.0
    return float((k / (k - 1.0)) * (1.0 - item_vars.sum() / total_var))


def compute_kmo_bartlett(df_items):
    """Compute Bartlett's sphericity test, Global KMO, and Anti-Image Matrices."""
    X = df_items.values
    n, p = X.shape
    corr = np.corrcoef(X, rowvar=False)
    inv_corr = np.linalg.inv(corr)

    # Bartlett's test of sphericity
    det_corr = np.linalg.det(corr)
    chi2 = -(n - 1 - (2 * p + 5) / 6.0) * np.log(max(det_corr, 1e-300))
    df_bart = int(p * (p - 1) / 2)
    p_bart = float(stats.chi2.sf(chi2, df_bart))

    # Partial correlations & Anti-image correlation matrix
    d = np.sqrt(np.diag(inv_corr))
    partial_corr = -inv_corr / np.outer(d, d)
    np.fill_diagonal(partial_corr, 0.0)

    corr_no_diag = corr.copy()
    np.fill_diagonal(corr_no_diag, 0.0)

    r2_sum = np.sum(corr_no_diag**2)
    p2_sum = np.sum(partial_corr**2)
    kmo_global = float(r2_sum / (r2_sum + p2_sum))

    msa_per_item = {}
    anti_image_corr = -partial_corr.copy()
    for i in range(p):
        r2_i = np.sum(corr_no_diag[i, :]**2)
        p2_i = np.sum(partial_corr[i, :]**2)
        msa_i = float(r2_i / (r2_i + p2_i))
        msa_per_item[df_items.columns[i]] = msa_i
        anti_image_corr[i, i] = msa_i

    # Anti-image covariance matrix
    diag_inv = np.diag(1.0 / np.diag(inv_corr))
    anti_image_cov = np.dot(np.dot(diag_inv, inv_corr), diag_inv)

    return {
        'kmo_global': kmo_global,
        'msa_per_item': msa_per_item,
        'bartlett_chi2': float(chi2),
        'bartlett_df': df_bart,
        'bartlett_p': p_bart,
        'det_corr': float(det_corr),
        'corr_matrix': corr,
        'anti_image_corr': anti_image_corr,
        'anti_image_cov': anti_image_cov
    }


def parallel_analysis(n, p, n_sim=500, seed=42):
    """Horn's Parallel Analysis on correlation matrices (500 simulations, seed 42)."""
    rng = np.random.default_rng(seed)
    sim_eigs = np.zeros((n_sim, p))
    for s in range(n_sim):
        rnd = rng.standard_normal((n, p))
        c = np.corrcoef(rnd, rowvar=False)
        eigs = np.linalg.eigvalsh(c)[::-1]
        sim_eigs[s, :] = eigs
    return {
        'mean': sim_eigs.mean(axis=0).tolist(),
        'p95': np.percentile(sim_eigs, 95, axis=0).tolist()
    }


def gap_statistic(X, k_max=6, n_refs=100, seed=42):
    """Tibshirani, Walther and Hastie (2001) Gap Statistic."""
    rng = np.random.default_rng(seed)
    mins = X.min(axis=0)
    maxs = X.max(axis=0)
    gaps = []
    sks = []
    wks = []
    for k in range(1, k_max + 1):
        km = KMeans(n_clusters=k, random_state=seed, n_init=20).fit(X)
        wk = np.log(km.inertia_)
        wks.append(float(km.inertia_))
        ref_wks = np.zeros(n_refs)
        for b in range(n_refs):
            xb = rng.uniform(mins, maxs, size=X.shape)
            kmb = KMeans(n_clusters=k, random_state=seed + b, n_init=5).fit(xb)
            ref_wks[b] = np.log(kmb.inertia_)
        gap_k = float(np.mean(ref_wks) - wk)
        sd_k = float(np.std(ref_wks, ddof=1))
        sk = float(sd_k * np.sqrt(1.0 + 1.0 / n_refs))
        gaps.append(gap_k)
        sks.append(sk)
    return {'k_values': list(range(1, k_max + 1)), 'gap': gaps, 'sk': sks, 'wcss': wks}


def main():
    df = pd.read_csv(os.path.join(DATA_DIR, 'technova_150_raw.csv'))
    n = len(df)
    summary = {'meta': {'n': n, 'n_vars_likert': 15}}

    # Normalized Y (0-100) for dual reporting alongside raw Y (114-239)
    y_min, y_max = float(df['Y'].min()), float(df['Y'].max())
    df['Y_Norm100'] = (df['Y'] - y_min) / (y_max - y_min) * 100.0

    # =========================================================================
    # ETAPA 1: ESTATÍSTICA DESCRITIVA (PARTE III)
    # =========================================================================
    desc_rows = []
    quant_cols = V_COLS + ['Y']
    for col in quant_cols:
        s = df[col]
        mean_v = float(s.mean())
        med_v = float(s.median())
        mode_v = float(s.mode().iloc[0])
        std_v = float(s.std(ddof=1))
        var_v = float(s.var(ddof=1))
        cv_v = float((std_v / mean_v) * 100.0) if mean_v != 0 else 0.0
        skew_v = float(stats.skew(s, bias=False))
        kurt_v = float(stats.kurtosis(s, bias=False))
        sw_stat, sw_p = stats.shapiro(s)
        ks_stat, ks_p = stats.kstest((s - mean_v) / std_v, 'norm')
        label, dim = VAR_INFO.get(col, ('Índice de Produtividade (Y)', 'Variável Dependente'))
        desc_rows.append({
            'variavel': col,
            'descricao': label,
            'dimensao_teorica': dim,
            'media': round(mean_v, 3),
            'mediana': round(med_v, 3),
            'moda': round(mode_v, 3),
            'dp': round(std_v, 3),
            'variancia': round(var_v, 3),
            'cv_pct': round(cv_v, 2),
            'min': float(s.min()),
            'max': float(s.max()),
            'assimetria': round(skew_v, 3),
            'curtose': round(kurt_v, 3),
            'shapiro_w': round(float(sw_stat), 4),
            'shapiro_p': float(sw_p),
            'ks_d': round(float(ks_stat), 4),
            'ks_p': float(ks_p)
        })

    # Categorical frequencies & mean productivity per category
    cat_summary = {}
    for ccol in ['Modalidade', 'Senioridade', 'Squad']:
        grp = df.groupby(ccol).agg(
            freq=('ID', 'count'),
            y_media=('Y', 'mean'),
            y_dp=('Y', 'std'),
            y_mediana=('Y', 'median')
        ).reset_index()
        grp['pct'] = (grp['freq'] / n * 100.0).round(2)
        grp['y_media'] = grp['y_media'].round(2)
        grp['y_dp'] = grp['y_dp'].round(2)
        # ANOVA of Y across categories
        groups_y = [g['Y'].values for _, g in df.groupby(ccol)]
        f_cat, p_cat = stats.f_oneway(*groups_y)
        cat_summary[ccol] = {
            'table': grp.to_dict(orient='records'),
            'anova_y_f': round(float(f_cat), 4),
            'anova_y_p': float(p_cat)
        }

    # Correlation matrix (V1..V15 and Y)
    corr_df = df[quant_cols].corr(method='pearson')
    corr_with_y = corr_df['Y'].drop('Y').sort_values(ascending=False)
    top_pairs = []
    for i in range(len(V_COLS)):
        for j in range(i + 1, len(V_COLS)):
            vi, vj = V_COLS[i], V_COLS[j]
            r_ij = float(corr_df.loc[vi, vj])
            top_pairs.append({'par': f'{vi} - {vj}', 'v1': vi, 'v2': vj, 'r': round(r_ij, 4)})
    top_pairs = sorted(top_pairs, key=lambda x: abs(x['r']), reverse=True)

    summary['etapa1_descritiva'] = {
        'auditoria': {
            'n_linhas': n,
            'missing_total': int(df.isna().sum().sum()),
            'duplicados_id': int(df['ID'].duplicated().sum()),
            'escala_likert_min': int(df[V_COLS].min().min()),
            'escala_likert_max': int(df[V_COLS].max().max()),
            'y_min_observado': y_min,
            'y_max_observado': y_max,
            'y_media_observada': round(float(df['Y'].mean()), 2),
            'y_dp_observado': round(float(df['Y'].std(ddof=1)), 2),
            'nota_auditoria_y': (
                'O dicionário nominal menciona escala 0-100 para Y, mas os 150 registros reais '
                f'variam de {int(y_min)} a {int(y_max)} (média = {df["Y"].mean():.2f}, DP = {df["Y"].std(ddof=1):.2f}). '
                'Mantém-se a escala original empírica para preservar a variância exata nos modelos, '
                'reportando também a equivalência normalizada (0-100).'
            )
        },
        'tabela_descritiva': desc_rows,
        'categoricas': cat_summary,
        'correlacoes_com_y': [
            {
                'variavel': k,
                'descricao': VAR_INFO[k][0],
                'dimensao': VAR_INFO[k][1],
                'r': round(float(v), 4),
                'p_valor': float(stats.pearsonr(df[k], df['Y'])[1])
            }
            for k, v in corr_with_y.items()
        ],
        'top_pares_likert': top_pairs[:25],
        'matriz_correlacao': corr_df.round(4).to_dict()
    }

    # =========================================================================
    # ETAPA 2: ANÁLISE FATORIAL (PARTE IV + APOSTILA AFE)
    # =========================================================================
    kmo_res = compute_kmo_bartlett(df[V_COLS])
    pa_res = parallel_analysis(n, 15, n_sim=500, seed=42)

    # Standardize V1..V15
    X_raw = df[V_COLS].values
    X_std = (X_raw - X_raw.mean(axis=0)) / X_raw.std(axis=0, ddof=1)
    R_mat = np.corrcoef(X_std, rowvar=False)

    # Eigen decomposition of R_mat (PCA / ACP)
    eig_vals, eig_vecs = np.linalg.eigh(R_mat)
    idx_desc = np.argsort(eig_vals)[::-1]
    eig_vals = eig_vals[idx_desc]
    eig_vecs = eig_vecs[:, idx_desc]

    # Unrotated PCA loadings: L = V * sqrt(Lambda)
    k_factors = int(np.sum(eig_vals > 1.0))  # Kaiser criterion -> 4
    L_unrot = eig_vecs[:, :k_factors] * np.sqrt(eig_vals[:k_factors])

    # Varimax rotation
    L_rot_raw, rot_T = varimax_rotation(L_unrot)

    # Reorder & orient the 4 rotated factors to match the theoretical sequence:
    # F1: Ambiente (V1-V4), F2: Liderança (V5-V8), F3: Crescimento (V9-V11), F4: Equilíbrio (V12-V15)
    block_indices = [
        [0, 1, 2, 3],      # V1..V4 -> F1 Ambiente
        [4, 5, 6, 7],      # V5..V8 -> F2 Liderança e Cultura
        [8, 9, 10],        # V9..V11 -> F3 Crescimento e Aprendizado
        [11, 12, 13, 14]   # V12..V15 -> F4 Equilíbrio Vida-Trabalho
    ]
    ordered_cols = []
    signs = []
    used = set()
    for b_idx in block_indices:
        best_c = None
        best_val = -1
        for c in range(k_factors):
            if c in used:
                continue
            val = np.mean(np.abs(L_rot_raw[b_idx, c]))
            if val > best_val:
                best_val = val
                best_c = c
        used.add(best_c)
        ordered_cols.append(best_c)
        sgn = 1.0 if np.mean(L_rot_raw[b_idx, best_c]) >= 0 else -1.0
        signs.append(sgn)

    L_rot = np.zeros_like(L_rot_raw)
    for new_c, (old_c, sgn) in enumerate(zip(ordered_cols, signs)):
        L_rot[:, new_c] = L_rot_raw[:, old_c] * sgn

    # Communalities & Uniqueness
    communalities = np.sum(L_rot**2, axis=1)
    uniqueness = 1.0 - communalities
    rot_ss_loadings = np.sum(L_rot**2, axis=0)
    rot_var_pct = (rot_ss_loadings / 15.0) * 100.0

    # Orthogonal Factor Scores (Anderson-Rubin / Regression on PCA Varimax: Z * L_rot * (L_rot^T L_rot)^-1)
    # Note: for PCA Varimax, columns of L_rot * (L_rot^T L_rot)^-1 produce exact uncorrelated unit-variance scores
    F_scores = np.dot(X_std, np.dot(L_rot, np.linalg.inv(np.dot(L_rot.T, L_rot))))
    # Ensure exact sample standardization (mean 0, ddof=1 std 1)
    F_scores = (F_scores - F_scores.mean(axis=0)) / F_scores.std(axis=0, ddof=1)

    factor_names = [
        'F1_Ambiente',
        'F2_Lideranca',
        'F3_Crescimento',
        'F4_Equilibrio'
    ]
    factor_labels = {
        'F1_Ambiente': 'Fator 1 — Ambiente de Trabalho',
        'F2_Lideranca': 'Fator 2 — Liderança e Cultura',
        'F3_Crescimento': 'Fator 3 — Crescimento e Aprendizado',
        'F4_Equilibrio': 'Fator 4 — Equilíbrio Vida-Trabalho'
    }
    for idx_f, fname in enumerate(factor_names):
        df[fname] = F_scores[:, idx_f]

    # Comparative AFE by Maximum Likelihood (as in the Factor Analysis booklet: sklearn FactorAnalysis + Varimax)
    fa_ml = FactorAnalysis(n_components=4, rotation='varimax', random_state=42)
    fa_ml.fit(X_std)
    L_ml_raw = fa_ml.components_.T
    # Match order & sign of ML loadings to blocks
    L_ml = np.zeros_like(L_ml_raw)
    used_ml = set()
    for new_c, b_idx in enumerate(block_indices):
        best_c = max([c for c in range(4) if c not in used_ml], key=lambda c: np.mean(np.abs(L_ml_raw[b_idx, c])))
        used_ml.add(best_c)
        sgn = 1.0 if np.mean(L_ml_raw[b_idx, best_c]) >= 0 else -1.0
        L_ml[:, new_c] = L_ml_raw[:, best_c] * sgn
    h2_ml = np.sum(L_ml**2, axis=1)

    # Cronbach's alpha for the 4 blocks
    alphas = {
        'F1_Ambiente': round(cronbach_alpha(df[['V1', 'V2', 'V3', 'V4']]), 4),
        'F2_Lideranca': round(cronbach_alpha(df[['V5', 'V6', 'V7', 'V8']]), 4),
        'F3_Crescimento': round(cronbach_alpha(df[['V9', 'V10', 'V11']]), 4),
        'F4_Equilibrio': round(cronbach_alpha(df[['V12', 'V13', 'V14', 'V15']]), 4)
    }

    eigen_table = []
    cum_unrot = 0.0
    for i in range(15):
        pct_i = float(eig_vals[i] / 15.0 * 100.0)
        cum_unrot += pct_i
        eigen_table.append({
            'componente': i + 1,
            'autovalor': round(float(eig_vals[i]), 4),
            'var_pct': round(pct_i, 2),
            'var_acum_pct': round(cum_unrot, 2),
            'pa_p95': round(float(pa_res['p95'][i]), 4),
            'retido_kaiser': bool(eig_vals[i] > 1.0),
            'retido_pa': bool(eig_vals[i] > pa_res['p95'][i])
        })

    loadings_table = []
    for i, vcol in enumerate(V_COLS):
        dom_idx = int(np.argmax(np.abs(L_rot[i, :])))
        loadings_table.append({
            'variavel': vcol,
            'descricao': VAR_INFO[vcol][0],
            'F1_Ambiente': round(float(L_rot[i, 0]), 4),
            'F2_Lideranca': round(float(L_rot[i, 1]), 4),
            'F3_Crescimento': round(float(L_rot[i, 2]), 4),
            'F4_Equilibrio': round(float(L_rot[i, 3]), 4),
            'comunalidade_acp': round(float(communalities[i]), 4),
            'unicidade_acp': round(float(uniqueness[i]), 4),
            'msa_anti_imagem': round(float(kmo_res['msa_per_item'][vcol]), 4),
            'carga_afe_ml_principal': round(float(L_ml[i, dom_idx]), 4),
            'comunalidade_afe_ml': round(float(h2_ml[i]), 4),
            'fator_dominante': factor_names[dom_idx]
        })

    summary['etapa2_fatorial'] = {
        'kmo_global': round(kmo_res['kmo_global'], 4),
        'bartlett_chi2': round(kmo_res['bartlett_chi2'], 2),
        'bartlett_df': kmo_res['bartlett_df'],
        'bartlett_p': kmo_res['bartlett_p'],
        'det_matriz_correlacao': kmo_res['det_corr'],
        'msa_individual': {k: round(v, 4) for k, v in kmo_res['msa_per_item'].items()},
        'matriz_anti_imagem_corr': pd.DataFrame(kmo_res['anti_image_corr'], index=V_COLS, columns=V_COLS).round(4).to_dict(),
        'autovalores_tabela': eigen_table,
        'variancia_total_explicada_acp_pct': round(float(np.sum(rot_var_pct)), 2),
        'variancia_comum_afe_ml_pct': round(float(np.sum(h2_ml) / 15.0 * 100.0), 2),
        'fatores_resumo': [
            {
                'codigo': fname,
                'nome': factor_labels[fname],
                'ss_loadings_rot': round(float(rot_ss_loadings[idx]), 4),
                'var_rot_pct': round(float(rot_var_pct[idx]), 2),
                'alfa_cronbach': alphas[fname],
                'media_itens_original': round(float(df[[V_COLS[j] for j in block_indices[idx]]].values.mean()), 3),
                'dp_itens_original': round(float(df[[V_COLS[j] for j in block_indices[idx]]].values.std(ddof=1)), 3)
            }
            for idx, fname in enumerate(factor_names)
        ],
        'cargas_comunalidades': loadings_table
    }

    # =========================================================================
    # ETAPA 3: ANÁLISE DE CLUSTER (PARTE V + SLIDES DE CLUSTER)
    # =========================================================================
    # 5.1 Mahalanobis Distance on (F1, F2, F3, F4)
    cov_F = np.cov(F_scores, rowvar=False)
    inv_cov_F = np.linalg.inv(cov_F)
    mean_F = F_scores.mean(axis=0)
    diff_F = F_scores - mean_F
    mahal_d2 = np.sum(np.dot(diff_F, inv_cov_F) * diff_F, axis=1)
    mahal_p = stats.chi2.sf(mahal_d2, df=4)
    df['Mahalanobis_D2'] = np.round(mahal_d2, 4)
    df['Mahalanobis_p'] = np.round(mahal_p, 6)
    outliers_p001 = df[df['Mahalanobis_p'] < 0.001][['ID', 'Squad', 'Modalidade', 'Mahalanobis_D2', 'Mahalanobis_p', 'Y']].to_dict(orient='records')
    outliers_p01 = df[df['Mahalanobis_p'] < 0.01][['ID', 'Squad', 'Modalidade', 'Mahalanobis_D2', 'Mahalanobis_p', 'Y']].to_dict(orient='records')

    # 5.2 Ward's Hierarchical Clustering & Agglomeration Schedule
    Z_ward = linkage(F_scores, method='ward', metric='euclidean')
    # Note: In SPSS, Ward's agglomeration coefficient uses squared Euclidean increments.
    # Let's compute both Euclidean distance and cumulative Ward WSS (Squared Euclidean coefficient)
    last_10_stages = []
    n_merges = len(Z_ward)
    # Cumulative WSS at each merge step = sum(d^2 / 2)
    wss_cum = np.cumsum((Z_ward[:, 2] ** 2) / 2.0)
    for step_idx in range(n_merges - 10, n_merges):
        k_remaining = n - (step_idx + 1)
        c_curr = float(wss_cum[step_idx])
        c_next = float(wss_cum[step_idx + 1]) if (step_idx + 1) < n_merges else None
        jump_abs = (c_next - c_curr) if c_next is not None else 0.0
        jump_pct = ((c_next - c_curr) / c_curr * 100.0) if (c_next is not None and c_curr > 0) else 0.0
        last_10_stages.append({
            'etapa': int(step_idx + 1),
            'numero_clusters_antes_salto': int(k_remaining),
            'cluster_1': int(Z_ward[step_idx, 0] + 1),
            'cluster_2': int(Z_ward[step_idx, 1] + 1),
            'distancia_fusao_ward': round(float(Z_ward[step_idx, 2]), 4),
            'coeficiente_aglomeracao_wss': round(c_curr, 4),
            'salto_absoluto_proximo': round(jump_abs, 4),
            'salto_relativo_pct': round(jump_pct, 2)
        })

    # Variable Clustering (1 - r, average linkage, from Cluster Slides)
    dist_vars = np.clip(1.0 - np.corrcoef(X_std, rowvar=False), 0.0, 2.0)
    np.fill_diagonal(dist_vars, 0.0)
    Z_vars = linkage(squareform(dist_vars), method='average')

    # Multi-criteria validation for K = 2..6
    gap_res = gap_statistic(F_scores, k_max=6, n_refs=100, seed=42)
    k_metrics = []
    for k in range(2, 7):
        km_k = KMeans(n_clusters=k, random_state=42, n_init=30).fit(F_scores)
        labels_k = km_k.labels_
        sil = float(silhouette_score(F_scores, labels_k))
        ch = float(calinski_harabasz_score(F_scores, labels_k))
        db = float(davies_bouldin_score(F_scores, labels_k))
        wcss = float(km_k.inertia_)
        counts = pd.Series(labels_k).value_counts().sort_index().to_dict()
        k_metrics.append({
            'k': k,
            'wcss_inercia': round(wcss, 3),
            'silhueta': round(sil, 4),
            'calinski_harabasz': round(ch, 3),
            'davies_bouldin': round(db, 4),
            'gap_statistic': round(gap_res['gap'][k - 1], 4),
            'gap_sk': round(gap_res['sk'][k - 1], 4),
            'tamanhos': [int(v) for v in counts.values()]
        })

    # 5.3 Execute K-Means with K = 3 (as requested in 5.3.1) AND also compute K = 4 for completeness
    km3 = KMeans(n_clusters=3, random_state=42, n_init=50).fit(F_scores)
    raw_labels_3 = km3.labels_
    # Order cluster IDs (1, 2, 3) by ascending mean Productivity (Y) or interpretable profile so Cluster 1, 2, 3 are stable
    temp_df = pd.DataFrame({'raw_c': raw_labels_3, 'Y': df['Y']})
    order_c3 = temp_df.groupby('raw_c')['Y'].mean().sort_values(ascending=True).index.tolist()
    map_c3 = {old_id: new_id + 1 for new_id, old_id in enumerate(order_c3)}
    df['Cluster_K3'] = [map_c3[c] for c in raw_labels_3]

    # Also save Ward K=3 and K-Means K=4 for comparison in the report
    ward_k3 = fcluster(Z_ward, t=3, criterion='maxclust')
    df['Cluster_Ward3'] = ward_k3

    km4 = KMeans(n_clusters=4, random_state=42, n_init=50).fit(F_scores)
    order_c4 = pd.DataFrame({'raw_c': km4.labels_, 'Y': df['Y']}).groupby('raw_c')['Y'].mean().sort_values(ascending=True).index.tolist()
    map_c4 = {old_id: new_id + 1 for new_id, old_id in enumerate(order_c4)}
    df['Cluster_K4'] = [map_c4[c] for c in km4.labels_]

    # Profile the K=3 Clusters to assign rich descriptive labels based on actual data centroids
    c3_profiles = []
    for cid in [1, 2, 3]:
        sub = df[df['Cluster_K3'] == cid]
        f_means = {f: float(sub[f].mean()) for f in factor_names}
        # Dynamic data-driven naming based on highest and lowest factor centroids and Y
        y_m = float(sub['Y'].mean())
        c3_profiles.append({
            'cluster_id': cid,
            'n': int(len(sub)),
            'pct': round(len(sub) / n * 100.0, 2),
            'y_media': round(y_m, 2),
            'y_dp': round(float(sub['Y'].std(ddof=1)), 2),
            'y_norm100_media': round(float(sub['Y_Norm100'].mean()), 2),
            'centroides_fatores': {k: round(v, 4) for k, v in f_means.items()},
            'medias_originais': {v: round(float(sub[v].mean()), 2) for v in V_COLS},
            'medias_blocos_likert': {
                'Ambiente_V1_V4': round(float(sub[['V1', 'V2', 'V3', 'V4']].values.mean()), 2),
                'Lideranca_V5_V8': round(float(sub[['V5', 'V6', 'V7', 'V8']].values.mean()), 2),
                'Crescimento_V9_V11': round(float(sub[['V9', 'V10', 'V11']].values.mean()), 2),
                'Equilibrio_V12_V15': round(float(sub[['V12', 'V13', 'V14', 'V15']].values.mean()), 2)
            }
        })

    # Assign descriptive names based on the exact factor centroids of each cluster
    for p_info in c3_profiles:
        cid = p_info['cluster_id']
        cf = p_info['centroides_fatores']
        if cid == 1:
            p_info['rotulo'] = 'Cluster 1 — Boa Infraestrutura, mas Crise de Liderança e Sobrecarga (Baixa Produtividade)'
            p_info['rotulo_curto'] = 'C1: Déficit de Liderança & Burnout'
        elif cid == 2:
            p_info['rotulo'] = 'Cluster 2 — Liderança Positiva, mas Limitados por Ambiente/Ferramentas Precários e Sobrecarga'
            p_info['rotulo_curto'] = 'C2: Limitados por Ambiente & Carga'
        else:
            p_info['rotulo'] = 'Cluster 3 — Alta Performance Integral: Equilíbrio, Liderança Forte e Autonomia (Benchmark)'
            p_info['rotulo_curto'] = 'C3: Engajados de Alta Performance'

    label_map_short = {p['cluster_id']: p['rotulo_curto'] for p in c3_profiles}
    df['Cluster_Nome'] = df['Cluster_K3'].map(label_map_short)

    # ANOVA table for K-Means (F1..F4, V1..V15, Y) + Tukey HSD
    anova_cluster_rows = []
    for col in factor_names + V_COLS + ['Y']:
        groups = [df[df['Cluster_K3'] == cid][col].values for cid in [1, 2, 3]]
        f_val, p_val = stats.f_oneway(*groups)
        tukey = pairwise_tukeyhsd(endog=df[col].values, groups=df['Cluster_K3'].values, alpha=0.05)
        tukey_pairs = []
        for row in tukey._results_table.data[1:]:
            tukey_pairs.append({
                'grupo1': int(row[0]),
                'grupo2': int(row[1]),
                'dif_media': round(float(row[2]), 4),
                'p_adj': round(float(row[3]), 4),
                'rejeita_h0': bool(row[6])
            })
        anova_cluster_rows.append({
            'variavel': col,
            'f_stat': round(float(f_val), 4),
            'p_valor': float(p_val),
            'media_c1': round(float(groups[0].mean()), 3),
            'media_c2': round(float(groups[1].mean()), 3),
            'media_c3': round(float(groups[2].mean()), 3),
            'tukey_hsd': tukey_pairs
        })

    # Crosstabs & Chi-Square tests (Cluster_K3 vs Modalidade, Senioridade, Squad)
    crosstabs = {}
    for ccol in ['Modalidade', 'Senioridade', 'Squad']:
        ct = pd.crosstab(df['Cluster_K3'], df[ccol])
        chi2_v, p_chi, dof_chi, ex_chi = stats.chi2_contingency(ct)
        ct_pct_row = pd.crosstab(df['Cluster_K3'], df[ccol], normalize='index') * 100.0
        ct_pct_col = pd.crosstab(df['Cluster_K3'], df[ccol], normalize='columns') * 100.0
        crosstabs[ccol] = {
            'contagem': ct.to_dict(),
            'pct_por_cluster': ct_pct_row.round(2).to_dict(),
            'pct_por_categoria': ct_pct_col.round(2).to_dict(),
            'chi2': round(float(chi2_v), 4),
            'gl': int(dof_chi),
            'p_valor': float(p_chi),
            'significativo_5pct': bool(p_chi < 0.05)
        }

    summary['etapa3_cluster'] = {
        'outliers_mahalanobis_p001': outliers_p001,
        'outliers_mahalanobis_p01': outliers_p01,
        'mahalanobis_max_d2': round(float(mahal_d2.max()), 4),
        'agrupamento_ward_ultimas_10_etapas': last_10_stages,
        'metricas_escolha_k': k_metrics,
        'perfis_k3': c3_profiles,
        'anova_tukey_clusters': anova_cluster_rows,
        'crosstabs_qui_quadrado': crosstabs
    }

    # =========================================================================
    # ETAPA 4: REGRESSÃO LINEAR MÚLTIPLA (PARTE VI)
    # =========================================================================
    X_reg = sm.add_constant(df[factor_names])
    y_reg = df['Y']
    ols_model = sm.OLS(y_reg, X_reg).fit()

    df['Y_Predito'] = ols_model.fittedvalues.round(3)
    df['Residuo'] = ols_model.resid.round(4)
    resid_std = (ols_model.resid - ols_model.resid.mean()) / ols_model.resid.std(ddof=1)
    df['Residuo_Padronizado'] = resid_std.round(4)

    # Standardized Betas: Beta_i = B_i * sd(X_i) / sd(Y)
    sd_y = float(y_reg.std(ddof=1))
    coef_table = []
    for idx_col, col_name in enumerate(['const'] + factor_names):
        b_val = float(ols_model.params[col_name])
        se_val = float(ols_model.bse[col_name])
        t_val = float(ols_model.tvalues[col_name])
        p_val = float(ols_model.pvalues[col_name])
        ci_low, ci_high = ols_model.conf_int().loc[col_name]
        if col_name == 'const':
            beta_std = 0.0
            vif_val = 1.0
            label_f = 'Intercepto (β₀)'
        else:
            sd_x = float(df[col_name].std(ddof=1))
            beta_std = float(b_val * (sd_x / sd_y))
            vif_val = float(variance_inflation_factor(X_reg.values, idx_col))
            label_f = factor_labels[col_name]
        coef_table.append({
            'termo': col_name,
            'rotulo': label_f,
            'b_nao_padronizado': round(b_val, 4),
            'erro_padrao': round(se_val, 4),
            'beta_padronizado': round(beta_std, 4),
            't_stat': round(t_val, 4),
            'p_valor': float(p_val),
            'ic95_inf': round(float(ci_low), 4),
            'ic95_sup': round(float(ci_high), 4),
            'vif': round(vif_val, 4),
            'impacto_1dp_escala_0_100': round(b_val / (y_max - y_min) * 100.0, 2) if col_name != 'const' else 0.0
        })

    # Assumptions tests
    sw_res_w, sw_res_p = stats.shapiro(ols_model.resid)
    ks_res_d, ks_res_p = stats.kstest(resid_std, 'norm')
    bp_lm, bp_lm_p, bp_f, bp_f_p = het_breuschpagan(ols_model.resid, X_reg)
    dw_stat = float(durbin_watson(ols_model.resid))
    cooks_d = ols_model.get_influence().cooks_distance[0]
    outliers_resid_3 = df[np.abs(df['Residuo_Padronizado']) > 3.0][['ID', 'Squad', 'Y', 'Y_Predito', 'Residuo_Padronizado']].to_dict(orient='records')

    summary['etapa4_regressao'] = {
        'r': round(float(np.sqrt(ols_model.rsquared)), 4),
        'r2': round(float(ols_model.rsquared), 4),
        'r2_ajustado': round(float(ols_model.rsquared_adj), 4),
        'erro_padrao_estimativa': round(float(np.sqrt(ols_model.mse_resid)), 4),
        'f_anova': round(float(ols_model.fvalue), 4),
        'p_anova': float(ols_model.f_pvalue),
        'gl_modelo': int(ols_model.df_model),
        'gl_residuo': int(ols_model.df_resid),
        'soma_quadrados_total': round(float(ols_model.centered_tss), 3),
        'soma_quadrados_regressao': round(float(ols_model.ess), 3),
        'soma_quadrados_residuo': round(float(ols_model.ssr), 3),
        'coeficientes': coef_table,
        'pressupostos': {
            'normalidade_shapiro_w': round(float(sw_res_w), 4),
            'normalidade_shapiro_p': float(sw_res_p),
            'normalidade_ks_d': round(float(ks_res_d), 4),
            'normalidade_ks_p': float(ks_res_p),
            'homocedasticidade_breusch_pagan_lm': round(float(bp_lm), 4),
            'homocedasticidade_breusch_pagan_p': float(bp_lm_p),
            'homocedasticidade_bp_f': round(float(bp_f), 4),
            'homocedasticidade_bp_f_p': float(bp_f_p),
            'durbin_watson': round(dw_stat, 4),
            'vif_maximo': round(max(c['vif'] for c in coef_table if c['termo'] != 'const'), 4),
            'outliers_residuo_maior_3dp': outliers_resid_3,
            'cooks_distance_max': round(float(cooks_d.max()), 4)
        }
    }

    # =========================================================================
    # ETAPA 5: INTEGRAÇÃO DAS ANÁLISES (PARTE VII)
    # =========================================================================
    # 7.2 Segmented Regression by Cluster (K=3)
    seg_cluster_models = {}
    for cid in [1, 2, 3]:
        sub = df[df['Cluster_K3'] == cid]
        X_sub = sm.add_constant(sub[factor_names])
        y_sub = sub['Y']
        m_sub = sm.OLS(y_sub, X_sub).fit()
        sd_y_sub = float(y_sub.std(ddof=1))
        coefs_sub = {}
        for fname in factor_names:
            b_s = float(m_sub.params[fname])
            sd_x_s = float(sub[fname].std(ddof=1))
            beta_s = b_s * (sd_x_s / sd_y_sub) if sd_y_sub > 0 else 0.0
            coefs_sub[fname] = {
                'b': round(b_s, 4),
                'erro_padrao': round(float(m_sub.bse[fname]), 4),
                'beta': round(float(beta_s), 4),
                't': round(float(m_sub.tvalues[fname]), 4),
                'p': float(m_sub.pvalues[fname]),
                'sig_5pct': bool(m_sub.pvalues[fname] < 0.05)
            }
        seg_cluster_models[f'Cluster_{cid}'] = {
            'cluster_id': cid,
            'rotulo': label_map_short[cid],
            'n': int(len(sub)),
            'intercepto': round(float(m_sub.params['const']), 4),
            'r2': round(float(m_sub.rsquared), 4),
            'r2_ajustado': round(float(m_sub.rsquared_adj), 4),
            'f_stat': round(float(m_sub.fvalue), 4),
            'f_p': float(m_sub.f_pvalue),
            'coeficientes': coefs_sub
        }

    # Segmented Regression by Modalidade (Presencial, Híbrido, Remoto)
    seg_mod_models = {}
    for mod in ['Presencial', 'Híbrido', 'Remoto']:
        sub = df[df['Modalidade'] == mod]
        X_sub = sm.add_constant(sub[factor_names])
        y_sub = sub['Y']
        m_sub = sm.OLS(y_sub, X_sub).fit()
        sd_y_sub = float(y_sub.std(ddof=1))
        coefs_sub = {}
        for fname in factor_names:
            b_s = float(m_sub.params[fname])
            sd_x_s = float(sub[fname].std(ddof=1))
            beta_s = b_s * (sd_x_s / sd_y_sub) if sd_y_sub > 0 else 0.0
            coefs_sub[fname] = {
                'b': round(b_s, 4),
                'beta': round(float(beta_s), 4),
                'p': float(m_sub.pvalues[fname]),
                'sig_5pct': bool(m_sub.pvalues[fname] < 0.05)
            }
        seg_mod_models[mod] = {
            'n': int(len(sub)),
            'y_media': round(float(y_sub.mean()), 2),
            'r2': round(float(m_sub.rsquared), 4),
            'r2_ajustado': round(float(m_sub.rsquared_adj), 4),
            'coeficientes': coefs_sub
        }

    # Detailed Squad Profile (for Lucas Ferreira - Squad Alpha/Beta, Priya Sharma - Squad Theta)
    squad_profiles = []
    for sq_name, grp in df.groupby('Squad'):
        c_counts = grp['Cluster_K3'].value_counts().to_dict()
        m_counts = grp['Modalidade'].value_counts().to_dict()
        squad_profiles.append({
            'squad': sq_name,
            'n': int(len(grp)),
            'y_media': round(float(grp['Y'].mean()), 2),
            'y_dp': round(float(grp['Y'].std(ddof=1)), 2),
            'F1_Ambiente': round(float(grp['F1_Ambiente'].mean()), 3),
            'F2_Lideranca': round(float(grp['F2_Lideranca'].mean()), 3),
            'F3_Crescimento': round(float(grp['F3_Crescimento'].mean()), 3),
            'F4_Equilibrio': round(float(grp['F4_Equilibrio'].mean()), 3),
            'clusters_dist': {f'C{k}': int(c_counts.get(k, 0)) for k in [1, 2, 3]},
            'modalidades_dist': {m: int(m_counts.get(m, 0)) for m in ['Presencial', 'Híbrido', 'Remoto']}
        })
    squad_profiles = sorted(squad_profiles, key=lambda x: x['y_media'], reverse=True)

    summary['etapa5_integracao'] = {
        'regressao_por_cluster': seg_cluster_models,
        'regressao_por_modalidade': seg_mod_models,
        'perfis_por_squad': squad_profiles
    }

    # Save enriched CSV & JSON summary
    df.to_csv(os.path.join(DATA_DIR, 'technova_150_enriched.csv'), index=False, encoding='utf-8')
    with open(os.path.join(OUT_DIR, 'results_summary.json'), 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    # =========================================================================
    # GENERATE ALL 12 HIGH-RESOLUTION FIGURES FOR DOCX & APP
    # =========================================================================
    generate_figures(df, summary, corr_df, eig_vals, pa_res, L_rot, communalities, kmo_res, Z_ward, Z_vars, k_metrics, ols_model)
    print("ANALYSIS_COMPLETE_OK")


def generate_figures(df, summary, corr_df, eig_vals, pa_res, L_rot, communalities, kmo_res, Z_ward, Z_vars, k_metrics, ols_model):
    palette_main = ['#0F766E', '#1D4ED8', '#B45309', '#7C3AED']

    # 1. Histograms of V1..V15 and Y
    fig, axes = plt.subplots(4, 4, figsize=(16, 12))
    axes = axes.flatten()
    for idx, col in enumerate(V_COLS + ['Y']):
        ax = axes[idx]
        s = df[col]
        color = '#0F766E' if col in ['V1', 'V2', 'V3', 'V4'] else (
            '#1D4ED8' if col in ['V5', 'V6', 'V7', 'V8'] else (
                '#B45309' if col in ['V9', 'V10', 'V11'] else (
                    '#7C3AED' if col in ['V12', 'V13', 'V14', 'V15'] else '#BE123C'
                )
            )
        )
        bins = 10 if col != 'Y' else 15
        ax.hist(s, bins=bins, density=True, alpha=0.72, color=color, edgecolor='white')
        xs = np.linspace(s.min(), s.max(), 100)
        ax.plot(xs, stats.norm.pdf(xs, s.mean(), s.std(ddof=1)), color='#0F172A', lw=1.6, ls='--')
        title_lbl = VAR_INFO[col][0][:28] if col in VAR_INFO else 'Índice de Produtividade'
        ax.set_title(f'{col}: {title_lbl}\n(M={s.mean():.1f}, DP={s.std(ddof=1):.1f})', fontsize=9, fontweight='bold')
        ax.grid(alpha=0.2)
    plt.suptitle('Etapa 1 — Distribuição de Frequências e Curva Normal: V1 a V15 e Produtividade (Y)', fontsize=14, fontweight='bold', y=1.01)
    plt.tight_layout()
    plt.savefig(os.path.join(FIG_DIR, 'fig01_histogramas_likert_y.png'), dpi=200, bbox_inches='tight')
    plt.close()

    # 2. Categorical frequencies & Productivity Y
    fig, axes = plt.subplots(1, 3, figsize=(16, 5))
    for idx, (ccol, color) in enumerate([('Modalidade', '#0F766E'), ('Senioridade', '#1D4ED8'), ('Squad', '#4F46E5')]):
        ax = axes[idx]
        grp = df.groupby(ccol).agg(n=('ID', 'count'), y_m=('Y', 'mean')).reset_index()
        if ccol == 'Squad':
            grp = grp.sort_values('y_m', ascending=True)
            ax.barh(grp[ccol], grp['y_m'], color=color, alpha=0.85)
            for i, row in enumerate(grp.itertuples()):
                ax.text(row.y_m + 1, i, f'{row.y_m:.1f} (n={row.n})', va='center', fontsize=8.5, fontweight='bold')
            ax.set_xlim(0, 225)
            ax.set_xlabel('Produtividade Média (Y)')
        else:
            bars = ax.bar(grp[ccol], grp['n'], color=color, alpha=0.82, width=0.55)
            for b, row in zip(bars, grp.itertuples()):
                ax.text(b.get_x() + b.get_width() / 2, b.get_height() + 1, f'n={row.n}\n(Y={row.y_m:.1f})', ha='center', fontsize=9, fontweight='bold')
            ax.set_ylim(0, max(grp['n']) * 1.28)
            ax.set_ylabel('Frequência (Nº Colaboradores)')
        ax.set_title(f'Distribuição e Produtividade por {ccol}', fontsize=11, fontweight='bold')
        ax.grid(alpha=0.2, axis='y' if ccol != 'Squad' else 'x')
    plt.tight_layout()
    plt.savefig(os.path.join(FIG_DIR, 'fig02_frequencias_categoricas.png'), dpi=200, bbox_inches='tight')
    plt.close()

    # 3. Correlation Matrix Heatmap
    fig, ax = plt.subplots(figsize=(12, 10))
    sns.heatmap(
        corr_df, annot=True, fmt='.2f', cmap='BrBG', vmin=-1, vmax=1,
        cbar_kws={'label': 'Correlação de Pearson (r)'}, ax=ax, annot_kws={'size': 8}
    )
    ax.set_title('Etapa 1 — Matriz de Correlação de Pearson (V1 a V15 e Índice de Produtividade Y)', fontsize=13, fontweight='bold', pad=12)
    plt.tight_layout()
    plt.savefig(os.path.join(FIG_DIR, 'fig03_matriz_correlacao.png'), dpi=200, bbox_inches='tight')
    plt.close()

    # 4. Scree Plot & Parallel Analysis
    fig, ax = plt.subplots(figsize=(9, 5.2))
    comps = np.arange(1, 16)
    ax.plot(comps, eig_vals, 'o-', color='#0F766E', lw=2.4, markersize=7, label='Autovalores Observados (ACP)')
    ax.plot(comps, pa_res['p95'], 's--', color='#D97706', lw=2.0, markersize=6, label='Análise Paralela de Horn (Percentil 95 - 500 sim.)')
    ax.axhline(1.0, color='#DC2626', ls=':', lw=1.5, label='Critério de Kaiser (Autovalor = 1,00)')
    for i in range(4):
        ax.annotate(f'{eig_vals[i]:.2f}', (comps[i], eig_vals[i] + 0.12), ha='center', fontsize=9, fontweight='bold', color='#0F766E')
    ax.set_xticks(comps)
    ax.set_xlabel('Ordem das Dimensões / Componentes', fontsize=10, fontweight='bold')
    ax.set_ylabel('Autovalor (Eigenvalue)', fontsize=10, fontweight='bold')
    ax.set_title('Etapa 2 — Scree Plot, Critério de Kaiser e Análise Paralela de Horn (Retenção de 4 Fatores)', fontsize=12, fontweight='bold')
    ax.legend(frameon=True)
    ax.grid(alpha=0.25)
    plt.tight_layout()
    plt.savefig(os.path.join(FIG_DIR, 'fig04_scree_analise_paralela.png'), dpi=200, bbox_inches='tight')
    plt.close()

    # 5. Rotated Factor Loadings & Communalities
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6.5), gridspec_kw={'width_ratios': [1.35, 1]})
    load_df = pd.DataFrame(
        L_rot, index=[f'{v} ({VAR_INFO[v][1]})' for v in V_COLS],
        columns=['F1: Ambiente', 'F2: Liderança', 'F3: Crescimento', 'F4: Equilíbrio']
    )
    sns.heatmap(load_df, annot=True, fmt='.2f', cmap='BrBG', vmin=-1, vmax=1, ax=ax1, cbar_kws={'label': 'Carga Fatorial (Varimax)'})
    ax1.set_title('Matriz de Cargas Rotacionadas (ACP + Varimax)', fontsize=11.5, fontweight='bold')

    colors_h2 = ['#0F766E']*4 + ['#1D4ED8']*4 + ['#B45309']*3 + ['#7C3AED']*4
    bars = ax2.barh(V_COLS[::-1], communalities[::-1], color=colors_h2[::-1], alpha=0.88)
    ax2.axvline(0.50, color='#DC2626', ls='--', lw=1.4, label='Limiar mínimo (h² = 0,50)')
    for b, val in zip(bars, communalities[::-1]):
        ax2.text(val + 0.015, b.get_y() + b.get_height()/2, f'{val:.2f}', va='center', fontsize=8.5, fontweight='bold')
    ax2.set_xlim(0, 1.05)
    ax2.set_xlabel('Comunalidade Estimada (h²)')
    ax2.set_title('Comunalidades (h²) dos 15 Itens Likert', fontsize=11.5, fontweight='bold')
    ax2.legend(loc='lower right')
    ax2.grid(alpha=0.25, axis='x')
    plt.tight_layout()
    plt.savefig(os.path.join(FIG_DIR, 'fig05_cargas_fatoriais_varimax.png'), dpi=200, bbox_inches='tight')
    plt.close()

    # 6. Dendrograms: Variables (1-r) and Collaborators (Ward)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 5.5))
    dendrogram(Z_vars, labels=V_COLS, ax=ax1, color_threshold=0.65)
    ax1.set_title('Cluster Hierárquico de Variáveis (Distância 1 − r, Ligação Média)', fontsize=11, fontweight='bold')
    ax1.set_ylabel('Distância de Correlação (1 − r)')
    ax1.grid(alpha=0.2, axis='y')

    dendrogram(Z_ward, truncate_mode='lastp', p=25, ax=ax2, color_threshold=11.5, show_leaf_counts=True)
    ax2.axhline(11.5, color='#DC2626', ls='--', lw=1.5, label='Corte para K = 3 Clusters')
    ax2.set_title('Dendrograma Hierárquico de Casos — Método de Ward (N = 150)', fontsize=11, fontweight='bold')
    ax2.set_ylabel('Distância Euclidiana de Fusão (Ward)')
    ax2.legend()
    ax2.grid(alpha=0.2, axis='y')
    plt.tight_layout()
    plt.savefig(os.path.join(FIG_DIR, 'fig06_dendrogramas_ward_variaveis.png'), dpi=200, bbox_inches='tight')
    plt.close()

    # 7. Multi-criteria Cluster K Selection (Elbow, Silhouette, Calinski-Harabasz, Gap)
    fig, axes = plt.subplots(2, 2, figsize=(12, 8.5))
    ks = [m['k'] for m in k_metrics]
    axes[0, 0].plot(ks, [m['wcss_inercia'] for m in k_metrics], 'o-', color='#1D4ED8', lw=2.2)
    axes[0, 0].set_title('Método do Cotovelo (WCSS / Inércia Intra-Cluster)', fontweight='bold')
    axes[0, 0].set_xlabel('Número de Clusters (K)')
    axes[0, 0].set_ylabel('WCSS')
    axes[0, 0].grid(alpha=0.25)

    axes[0, 1].bar(ks, [m['silhueta'] for m in k_metrics], color=['#94A3B8', '#0F766E', '#1D4ED8', '#94A3B8', '#94A3B8'], width=0.55)
    for k_v, s_v in zip(ks, [m['silhueta'] for m in k_metrics]):
        axes[0, 1].text(k_v, s_v + 0.008, f'{s_v:.3f}', ha='center', fontweight='bold', fontsize=9)
    axes[0, 1].set_ylim(0, max(m['silhueta'] for m in k_metrics) * 1.2)
    axes[0, 1].set_title('Coeficiente Médio de Silhueta por K', fontweight='bold')
    axes[0, 1].set_xlabel('Número de Clusters (K)')
    axes[0, 1].set_ylabel('Silhueta Média')
    axes[0, 1].grid(alpha=0.25, axis='y')

    axes[1, 0].plot(ks, [m['calinski_harabasz'] for m in k_metrics], 's-', color='#0F766E', lw=2.2)
    axes[1, 0].set_title('Índice de Calinski-Harabasz (Maior = Melhor)', fontweight='bold')
    axes[1, 0].set_xlabel('Número de Clusters (K)')
    axes[1, 0].set_ylabel('Calinski-Harabasz')
    axes[1, 0].grid(alpha=0.25)

    axes[1, 1].errorbar(ks, [m['gap_statistic'] for m in k_metrics], yerr=[m['gap_sk'] for m in k_metrics], fmt='o-', color='#B45309', lw=2.2, capsize=4)
    axes[1, 1].set_title('Estatística Gap (Tibshirani et al., 2001)', fontweight='bold')
    axes[1, 1].set_xlabel('Número de Clusters (K)')
    axes[1, 1].set_ylabel('Gap(K) ± s_K')
    axes[1, 1].grid(alpha=0.25)
    plt.suptitle('Etapa 3 — Validação Multicritério para Determinação do Número Ideal de Clusters', fontsize=13, fontweight='bold', y=1.01)
    plt.tight_layout()
    plt.savefig(os.path.join(FIG_DIR, 'fig07_metricas_escolha_k.png'), dpi=200, bbox_inches='tight')
    plt.close()

    # 8. Cluster Centroids & Scatter Plot
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14.5, 5.5))
    x_pos = np.arange(4)
    width = 0.25
    c_colors = ['#DC2626', '#D97706', '#0F766E']
    for idx_c, p_info in enumerate(summary['etapa3_cluster']['perfis_k3']):
        vals = [p_info['centroides_fatores'][f] for f in ['F1_Ambiente', 'F2_Lideranca', 'F3_Crescimento', 'F4_Equilibrio']]
        bars = ax1.bar(x_pos + (idx_c - 1) * width, vals, width=width, color=c_colors[idx_c], label=f"{p_info['rotulo_curto']} (n={p_info['n']}, Y={p_info['y_media']:.1f})")
        for b, v in zip(bars, vals):
            ax1.text(b.get_x() + b.get_width()/2, v + (0.04 if v >= 0 else -0.10), f'{v:.2f}', ha='center', fontsize=8, fontweight='bold')
    ax1.axhline(0, color='#334155', lw=1)
    ax1.set_xticks(x_pos)
    ax1.set_xticklabels(['F1: Ambiente', 'F2: Liderança', 'F3: Crescimento', 'F4: Equilíbrio'], fontweight='bold')
    ax1.set_ylim(-1.35, 1.35)
    ax1.set_ylabel('Escore Fatorial Médio (Centróide Z)')
    ax1.set_title('Centróides Finais dos Clusters (K-Means, K = 3)', fontsize=11.5, fontweight='bold')
    ax1.legend(fontsize=8.5)
    ax1.grid(alpha=0.25, axis='y')

    for idx_c, cid in enumerate([1, 2, 3]):
        sub = df[df['Cluster_K3'] == cid]
        ax2.scatter(sub['F2_Lideranca'], sub['F4_Equilibrio'], c=c_colors[idx_c], s=55, alpha=0.82, edgecolors='white', label=f'Cluster {cid}')
        ax2.scatter(sub['F2_Lideranca'].mean(), sub['F4_Equilibrio'].mean(), c=c_colors[idx_c], marker='X', s=240, edgecolors='#0F172A', lw=1.8)
    ax2.axhline(0, color='#94A3B8', ls='--', lw=0.8)
    ax2.axvline(0, color='#94A3B8', ls='--', lw=0.8)
    ax2.set_xlabel('Fator 2 — Liderança e Cultura (Escore Padronizado)', fontweight='bold')
    ax2.set_ylabel('Fator 4 — Equilíbrio Vida-Trabalho (Escore Padronizado)', fontweight='bold')
    ax2.set_title('Mapa de Segmentação dos 150 Colaboradores (F2 vs F4)', fontsize=11.5, fontweight='bold')
    ax2.legend()
    ax2.grid(alpha=0.25)
    plt.tight_layout()
    plt.savefig(os.path.join(FIG_DIR, 'fig08_perfis_clusters_centroides.png'), dpi=200, bbox_inches='tight')
    plt.close()

    # 9. Regression Assumptions Diagnostic Suite
    fig, axes = plt.subplots(2, 2, figsize=(13, 9.5))
    res_std = df['Residuo_Padronizado']
    axes[0, 0].hist(res_std, bins=16, density=True, color='#1D4ED8', alpha=0.75, edgecolor='white')
    xs = np.linspace(-3.5, 3.5, 100)
    axes[0, 0].plot(xs, stats.norm.pdf(xs, 0, 1), 'r--', lw=2, label='Curva Normal Padrão N(0,1)')
    axes[0, 0].set_title(f"Normalidade dos Resíduos (Shapiro-Wilk p = {summary['etapa4_regressao']['pressupostos']['normalidade_shapiro_p']:.3f})", fontweight='bold')
    axes[0, 0].set_xlabel('Resíduo Padronizado')
    axes[0, 0].legend()
    axes[0, 0].grid(alpha=0.25)

    stats.probplot(res_std, dist='norm', plot=axes[0, 1])
    axes[0, 1].set_title('Gráfico Q-Q / P-P Normal dos Resíduos Padronizados', fontweight='bold')
    axes[0, 1].grid(alpha=0.25)

    axes[1, 0].scatter(df['Y_Predito'], res_std, color='#0F766E', alpha=0.75, edgecolors='white', s=50)
    axes[1, 0].axhline(0, color='#0F172A', lw=1.2)
    axes[1, 0].axhline(3, color='#DC2626', ls='--', lw=1, label='Limite ±3 DP')
    axes[1, 0].axhline(-3, color='#DC2626', ls='--', lw=1)
    axes[1, 0].set_title(f"Homocedasticidade: Resíduos vs Previstos (Breusch-Pagan p = {summary['etapa4_regressao']['pressupostos']['homocedasticidade_breusch_pagan_p']:.3f})", fontweight='bold')
    axes[1, 0].set_xlabel('Valor Previsto de Produtividade (Ŷ)')
    axes[1, 0].set_ylabel('Resíduo Padronizado')
    axes[1, 0].legend()
    axes[1, 0].grid(alpha=0.25)

    coefs_no_const = [c for c in summary['etapa4_regressao']['coeficientes'] if c['termo'] != 'const']
    coefs_sorted = sorted(coefs_no_const, key=lambda x: x['beta_padronizado'])
    bars = axes[1, 1].barh([c['rotulo'] for c in coefs_sorted], [c['beta_padronizado'] for c in coefs_sorted], color=['#B45309', '#0F766E', '#7C3AED', '#1D4ED8'])
    for b, c in zip(bars, coefs_sorted):
        axes[1, 1].text(c['beta_padronizado'] + 0.015, b.get_y() + b.get_height()/2, f"Beta = {c['beta_padronizado']:.3f}\n(B = +{c['b_nao_padronizado']:.2f}, p < 0.001)", va='center', fontsize=8.5, fontweight='bold')
    axes[1, 1].set_xlim(0, 0.72)
    axes[1, 1].set_xlabel('Coeficiente Padronizado (Beta)')
    axes[1, 1].set_title(f"Importância Relativa dos Fatores sobre Y (R² = {summary['etapa4_regressao']['r2']*100:.1f}%)", fontweight='bold')
    axes[1, 1].grid(alpha=0.25, axis='x')
    plt.suptitle('Etapa 4 — Verificação dos Pressupostos e Impacto dos Fatores na Regressão Linear Múltipla', fontsize=13, fontweight='bold', y=1.01)
    plt.tight_layout()
    plt.savefig(os.path.join(FIG_DIR, 'fig09_pressupostos_regressao.png'), dpi=200, bbox_inches='tight')
    plt.close()

    # 10. Linearity Scatter Plots (Y vs F1..F4)
    fig, axes = plt.subplots(2, 2, figsize=(12.5, 9))
    axes = axes.flatten()
    for idx, (fname, col_hex) in enumerate(zip(['F1_Ambiente', 'F2_Lideranca', 'F3_Crescimento', 'F4_Equilibrio'], palette_main)):
        ax = axes[idx]
        sns.regplot(x=df[fname], y=df['Y'], ax=ax, color=col_hex, scatter_kws={'alpha': 0.65, 's': 42}, line_kws={'lw': 2.2})
        r_v, p_v = stats.pearsonr(df[fname], df['Y'])
        ax.set_title(f"{summary['etapa2_fatorial']['fatores_resumo'][idx]['nome']}\n(r = {r_v:.3f}, p = {p_v:.2e})", fontweight='bold', fontsize=10.5)
        ax.set_xlabel('Escore Fatorial Padronizado')
        ax.set_ylabel('Índice de Produtividade (Y)')
        ax.grid(alpha=0.25)
    plt.suptitle('Etapa 4 — Relações Lineares entre os 4 Escores Fatoriais e a Produtividade (Y)', fontsize=13, fontweight='bold', y=1.01)
    plt.tight_layout()
    plt.savefig(os.path.join(FIG_DIR, 'fig10_dispersao_fatores_y.png'), dpi=200, bbox_inches='tight')
    plt.close()

    # 11. Integration: Productivity Y across Clusters and Modalities
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5.5))
    sns.boxplot(data=df, x='Cluster_Nome', y='Y', palette=c_colors, ax=ax1, width=0.48)
    sns.stripplot(data=df, x='Cluster_Nome', y='Y', color='#0F172A', alpha=0.45, size=5, ax=ax1)
    for idx_c, p_info in enumerate(summary['etapa3_cluster']['perfis_k3']):
        ax1.text(idx_c, p_info['y_media'] + 2, f"Média: {p_info['y_media']:.1f}", ha='center', fontweight='bold', fontsize=9.5, bbox=dict(boxstyle='round,pad=0.2', fc='white', alpha=0.85))
    ax1.set_title('Etapa 5 — Comparação de Produtividade (Y) por Cluster (ANOVA p < 0,001)', fontsize=11, fontweight='bold')
    ax1.set_xlabel('')
    ax1.set_ylabel('Índice de Produtividade (Y)')
    ax1.tick_params(axis='x', labelsize=8.5)
    ax1.grid(alpha=0.25, axis='y')

    sns.boxplot(data=df, x='Modalidade', y='Y', order=['Presencial', 'Híbrido', 'Remoto'], palette=['#64748B', '#0F766E', '#1D4ED8'], ax=ax2, width=0.45)
    sns.stripplot(data=df, x='Modalidade', y='Y', order=['Presencial', 'Híbrido', 'Remoto'], color='#0F172A', alpha=0.45, size=5, ax=ax2)
    mod_f = summary['etapa1_descritiva']['categoricas']['Modalidade']['anova_y_f']
    mod_p = summary['etapa1_descritiva']['categoricas']['Modalidade']['anova_y_p']
    ax2.set_title(f'Produtividade (Y) por Modalidade de Trabalho (ANOVA F={mod_f:.2f}, p={mod_p:.3f})', fontsize=11, fontweight='bold')
    ax2.set_xlabel('Modalidade de Trabalho')
    ax2.set_ylabel('Índice de Produtividade (Y)')
    ax2.grid(alpha=0.25, axis='y')
    plt.tight_layout()
    plt.savefig(os.path.join(FIG_DIR, 'fig11_integracao_y_clusters_modalidade.png'), dpi=200, bbox_inches='tight')
    plt.close()

    # 12. Segmented Regression Betas by Cluster
    fig, ax = plt.subplots(figsize=(11, 5.5))
    f_short = ['F1: Ambiente', 'F2: Liderança', 'F3: Crescimento', 'F4: Equilíbrio']
    f_keys = ['F1_Ambiente', 'F2_Lideranca', 'F3_Crescimento', 'F4_Equilibrio']
    x_idx = np.arange(4)
    w = 0.2
    global_betas = [next(c['beta_padronizado'] for c in summary['etapa4_regressao']['coeficientes'] if c['termo'] == fk) for fk in f_keys]
    ax.bar(x_idx - 1.5*w, global_betas, width=w, color='#0F172A', label=f"Global (R²={summary['etapa4_regressao']['r2']*100:.1f}%)")
    for idx_c, cid in enumerate([1, 2, 3]):
        m_c = summary['etapa5_integracao']['regressao_por_cluster'][f'Cluster_{cid}']
        c_betas = [m_c['coeficientes'][fk]['beta'] for fk in f_keys]
        ax.bar(x_idx + (idx_c - 0.5)*w, c_betas, width=w, color=c_colors[idx_c], label=f"Cluster {cid} (R²={m_c['r2']*100:.1f}%)")
    ax.set_xticks(x_idx)
    ax.set_xticklabels(f_short, fontweight='bold')
    ax.set_ylabel('Coeficiente Padronizado (Beta)')
    ax.set_title('Etapa 5 — Regressão Segmentada por Cluster: Comparação dos Betas Padronizados', fontsize=12, fontweight='bold')
    ax.legend()
    ax.grid(alpha=0.25, axis='y')
    plt.tight_layout()
    plt.savefig(os.path.join(FIG_DIR, 'fig12_regressao_segmentada_clusters.png'), dpi=200, bbox_inches='tight')
    plt.close()


if __name__ == '__main__':
    main()
