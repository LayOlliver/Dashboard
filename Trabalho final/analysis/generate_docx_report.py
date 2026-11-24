import json
import os
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIG_DIR = os.path.join(BASE_DIR, 'analysis', 'figures')
OUT_DIR = os.path.join(BASE_DIR, 'analysis')


def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), fill_hex)
    tcPr.append(shd)


def add_styled_table(doc, headers, rows, header_bg='0F172A'):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = 'Table Grid'
    table.alignment = WD_TABLE_ALIGNMENT.CENTER

    hdr_cells = table.rows[0].cells
    for i, h_text in enumerate(headers):
        hdr_cells[i].text = str(h_text)
        set_cell_background(hdr_cells[i], header_bg)
        for p in hdr_cells[i].paragraphs:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for r in p.runs:
                r.font.bold = True
                r.font.size = Pt(9)
                r.font.color.rgb = RGBColor(255, 255, 255)

    for r_idx, r_data in enumerate(rows):
        row_cells = table.rows[r_idx + 1].cells
        bg = 'F8FAFC' if r_idx % 2 == 1 else 'FFFFFF'
        for c_idx, val in enumerate(r_data):
            row_cells[c_idx].text = str(val)
            set_cell_background(row_cells[c_idx], bg)
            for p in row_cells[c_idx].paragraphs:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT if c_idx in (0, 1) and len(str(val)) > 10 else WD_ALIGN_PARAGRAPH.CENTER
                for r in p.runs:
                    r.font.size = Pt(8.5)
                    r.font.color.rgb = RGBColor(15, 23, 42)
    doc.add_paragraph()
    return table


def add_heading_styled(doc, text, level=1):
    h = doc.add_heading(text, level=level)
    for r in h.runs:
        r.font.color.rgb = RGBColor(15, 23, 42) if level == 1 else RGBColor(15, 118, 110)
    return h


def add_callout(doc, title, body, bg_hex='F0FDFA'):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.rows[0].cells[0]
    set_cell_background(cell, bg_hex)
    p = cell.paragraphs[0]
    r_title = p.add_run(f"📌 {title}\n")
    r_title.bold = True
    r_title.font.size = Pt(10)
    r_title.font.color.rgb = RGBColor(15, 118, 110)
    r_body = p.add_run(body)
    r_body.font.size = Pt(9.5)
    r_body.font.color.rgb = RGBColor(30, 41, 59)
    doc.add_paragraph()


def add_figure(doc, filename, caption, width_in=6.2):
    fpath = os.path.join(FIG_DIR, filename)
    if os.path.exists(fpath):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run()
        run.add_picture(fpath, width=Inches(width_in))
        cap = doc.add_paragraph(caption)
        cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for r in cap.runs:
            r.font.italic = True
            r.font.size = Pt(8.5)
            r.font.color.rgb = RGBColor(71, 85, 105)
        doc.add_paragraph()


def main():
    with open(os.path.join(OUT_DIR, 'results_summary.json'), 'r', encoding='utf-8') as f:
        res = json.load(f)

    doc = Document()

    # Page Margins
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    # =========================================================================
    # CAPA INSTITUCIONAL
    # =========================================================================
    p_top = doc.add_paragraph()
    p_top.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_uni = p_top.add_run(
        "UNIVERSIDADE FEDERAL DE UBERLÂNDIA (UFU)\n"
        "FACULDADE DE GESTÃO E NEGÓCIOS — FAGEN\n"
        "Disciplina: Informações e Negócios | Prof. Darly Fernando Andrade\n\n"
    )
    r_uni.bold = True
    r_uni.font.size = Pt(12)
    r_uni.font.color.rgb = RGBColor(15, 23, 42)

    r_title = p_top.add_run("TRABALHO FINAL INTEGRADO 5 — ESTUDO DE CASO TECHNOVA\n")
    r_title.bold = True
    r_title.font.size = Pt(18)
    r_title.font.color.rgb = RGBColor(15, 118, 110)

    r_sub = p_top.add_run(
        "Diagnóstico Multivariado de Produtividade em Equipes de Tecnologia:\n"
        "Fluxo Analítico Integrado em 5 Etapas, Recomendações por Personagem e Plataforma Adaptativa com IA\n\n"
    )
    r_sub.font.size = Pt(12)
    r_sub.font.color.rgb = RGBColor(51, 65, 85)

    add_callout(
        doc,
        "EQUIPE TÉCNICA ANALÍTICA CONVOCADA (SQUAD DE CONSULTORIA)",
        "• Líder de Ciência de Dados & Econometria: Coordenação Geral, Regressão Linear Múltipla (OLS) e Regressão Segmentada.\n"
        "• Especialista em Psicometria & Estatística Multivariada: Auditoria de Dados, Descritiva, Matriz Anti-Imagem, ACP e AFE (Máxima Verossimilhança + Análise Paralela de Horn).\n"
        "• Analista de Aprendizado Não-Supervisionado & Segmentação: Distância de Mahalanobis, Cluster Hierárquico de Ward, Cluster de Variáveis (1−r), K-Means e Validação Multicritério.\n"
        "• Consultor de People Analytics & Estratégia Corporativa: Tradução Gerencial para os 5 Personagens, Plano de 45 Dias para o Board e Defesa no Tribunal do Modelo.\n"
        "• Engenheiro Full-Stack de IA & Decision Support: Desenvolvimento do Aplicativo Web Adaptativo com Upload Dinâmico de Bases (.CSV/.XLSX)."
    )

    # =========================================================================
    # SUMÁRIO EXECUTIVO E CONVOCAÇÃO DA EQUIPE
    # =========================================================================
    add_heading_styled(doc, "1. Sumário Executivo e Diagnóstico do Dilema TechNova", level=1)
    doc.add_paragraph(
        "Em fevereiro de 2026, após uma retração no mercado SaaS B2B e um layoff abrupto de 25% do quadro (120 pessoas), "
        "a TechNova viu sua nota no Glassdoor cair de 4,6 para 3,1 e perdeu três engenheiros Staff estratégicos. "
        "Diante da pressão dos investidores e do prazo de 45 dias até a reunião do Board, instalou-se uma polarização executiva:"
    )

    add_styled_table(
        doc,
        ["Personagem", "Cargo / Squad", "Modalidade", "Tese / Posição no Dilema", "Necessidade Analítica Atendida no Estudo e no App"],
        [
            ["Felipe Drummond", "CEO (Co-fundador)", "Híbrido/Executivo", "Conciliador sob pressão do Board; precisa decidir entre RTO e plano de liderança em 45 dias.", "Veredito baseado em R² (68,37%), simulador de ROI de R$ 4 milhões e proteção de 40% do ARR."],
            ["Caio Ventura", "CTO (Co-fundador)", "100% Presencial", "Atribui queda ao trabalho remoto; exige Return to Office (RTO) obrigatório em 60 dias.", "Teste empírico de modalidade (ANOVA p=0,988) e identificação de onde infraestrutura (F1) realmente importa."],
            ["Juliana Braga", "VP de People (RH)", "Híbrido", "Defende que o problema é liderança, reconhecimento e burnout; propõe R$ 4M em desenvolvimento de líderes.", "Comprovação de que Liderança (Beta=0,532) e Equilíbrio (Beta=0,469) dominam a produtividade."],
            ["Lucas Ferreira", "Tech Lead — Squad Alpha", "100% Remoto (Florianópolis)", "Líder anti-RTO; entrega o dobro da média; alerta para perda de 70% dos Squads Alpha e Beta (40% do ARR).", "Auditoria de performance do Squad Alpha (1º lugar: Y=183,75) e comprovação da eficácia remota."],
            ["Priya Sharma", "Engineering Manager — Squad Theta", "Híbrido", "Melhor avaliação 360; foca em 1-on-1 semanal, segurança psicológica, reconhecimento e respeito a horários.", "Modelagem do Cluster 3 (Alta Performance: Y=192,92) como playbook replicável para todos os líderes."]
        ]
    )

    add_callout(
        doc,
        "VEREDITO EXECUTIVO BASEADO EM EVIDÊNCIAS (RESUMO PARA O BOARD)",
        "1. O RTO obrigatório de Caio Ventura deve ser REJEITADO: A produtividade média não difere entre Presencial (172,36), Remoto (172,96) e Híbrido (173,15) — ANOVA F = 0,0122, p = 0,9879 — e a distribuição dos clusters independe da modalidade (Qui-Quadrado χ² = 5,02, p = 0,2852). Forçar o RTO não gerará ganho estatístico de produtividade e provocará a evasão anunciada de 70% dos Squads Alpha e Beta (40% da receita recorrente).\n"
        "2. Juliana Braga e Priya Sharma têm razão substantiva na amostra global: O modelo de Regressão Linear Múltipla explica 68,37% da variação da produtividade (F = 78,35, p < 0,0001) e comprova que o Fator 2 — Liderança e Cultura (Beta = 0,5315, +13,44 pts por DP) e o Fator 4 — Equilíbrio Vida-Trabalho (Beta = 0,4688, +11,85 pts por DP) são os dois maiores motores da produtividade.\n"
        "3. Razão Parcial e Localizada de Caio Ventura (Fator 1 — Ambiente e Ferramentas): O Fator 1 é o 3º preditor global (Beta = 0,3858, +9,75 pts por DP) e, na Regressão Segmentada, torna-se o preditor nº 1 dentro do Cluster 1 (Beta = 0,4231) e um gargalo severo no Cluster 2 (média Likert de apenas 4,91 em ferramentas/ergonomia). A solução ótima é converter o RTO em investimento cirúrgico em hardware, ergonomia e redução de ruído operacional (tanto no home office quanto nos hubs presenciais opcionais)."
    )

    # =========================================================================
    # ETAPA 1 — ESTATÍSTICA DESCRITIVA E AUDITORIA (PARTE III)
    # =========================================================================
    doc.add_page_break()
    add_heading_styled(doc, "2. Etapa 1 — Estatística Descritiva e Auditoria de Dados (Parte III)", level=1)

    add_heading_styled(doc, "2.1 Auditoria Técnica da Base de Dados (150 Colaboradores)", level=2)
    doc.add_paragraph(
        "Seguindo o protocolo de rigor metodológico da Apostila de Análise Fatorial (Cap. 03 e Cap. 11), a equipe realizou a auditoria "
        "completa da matriz de dados antes de qualquer modelagem multivariada:"
    )
    doc.add_paragraph(
        "• Integridade e Completude: Foram confirmados exatamente N = 150 registros válidos, com 0 valores ausentes (missing = 0) e 0 duplicações de ID.\n"
        "• Variáveis de Percepção (V1 a V15): Todas respeitam estritamente a escala Likert de 1 a 10, codificadas positivamente (maior valor = percepção mais favorável), dispensando inversão de escala.\n"
        "• Achado de Auditoria na Variável Dependente (Y — Índice de Produtividade): Embora o dicionário textual mencione nominalmente 'escala 0-100', "
        "os valores reais coletados na tabela da Parte II variam de 114,0 a 239,0 (amplitude de 125 pontos, média = 172,853 e desvio-padrão = 25,285). "
        "Em conformidade com as boas práticas psicométricas e econométricas, preservamos os valores originais observados (114–239) para não alterar as variâncias e covariâncias reais do estudo, "
        "apresentando adicionalmente a conversão normalizada na escala 0–100 (Y_Norm100 = (Y − 114) / 125 × 100) para facilitar a comunicação executiva."
    )

    add_heading_styled(doc, "2.2 Medidas de Tendência Central, Dispersão e Normalidade (V1–V15 e Y)", level=2)
    desc_rows_tbl = []
    for r in res['etapa1_descritiva']['tabela_descritiva']:
        desc_rows_tbl.append([
            r['variavel'],
            r['descricao'],
            r['dimensao_teorica'],
            f"{r['media']:.2f}",
            f"{r['mediana']:.1f}",
            f"{r['moda']:.1f}",
            f"{r['dp']:.2f}",
            f"{r['variancia']:.2f}",
            f"{r['cv_pct']:.1f}%",
            f"{int(r['min'])}–{int(r['max'])}",
            f"{r['assimetria']:.2f}",
            f"{r['curtose']:.2f}"
        ])
    add_styled_table(
        doc,
        ["Var", "Descrição do Indicador", "Dimensão", "Média", "Med.", "Moda", "DP", "Var.", "CV%", "Mín-Máx", "Assim.", "Curt."],
        desc_rows_tbl
    )

    doc.add_paragraph(
        "Interpretação das Medidas Descritivas e Dispersão:\n"
        "1. Variáveis mais críticas (menores médias): O bloco de Crescimento e Aprendizado apresenta as menores médias da TechNova: "
        "V11 (Mentoria: média = 5,53, máx = 9,0), V9 (Treinamento: 5,97) e V10 (Plano de Carreira: 5,99), seguido de perto por V5 (Suporte do gestor: 5,90) e V6 (Autonomia: 5,97). "
        "Em contrapartida, o bloco de Ambiente Físico exibe as maiores médias globais: V4 (Ergonomia: 6,88) e V1 (Espaço: 6,63).\n"
        "2. Variáveis mais discriminantes (maior dispersão / CV%): A maior heterogeneidade de percepção ocorre em V5 (Suporte do gestor: DP = 2,50, CV = 42,42%), "
        "V7 (Reconhecimento: DP = 2,32, CV = 38,27%), V12 (Justiça na carga: DP = 2,35, CV = 38,13%) e V6 (Autonomia: DP = 2,27, CV = 38,05%). "
        "Isso antecipa que Liderança e Equilíbrio Vida-Trabalho são os grandes divisores de águas entre as equipes da TechNova.\n"
        "3. Normalidade das Distribuições: Todas as variáveis V1–V15 e Y apresentam coeficientes de assimetria próximos de zero (entre −0,26 e +0,43) e curtose moderada (entre −0,94 e −0,15), "
        "dentro da faixa de tolerância |γ| < 1,0 para análises multivariadas. Para a variável dependente Y, o teste de Kolmogorov-Smirnov não rejeita a normalidade (D = 0,0892, p = 0,1728 > 0,05), "
        "fornecendo excelente suporte para a modelagem de Regressão Linear Múltipla na Etapa 4."
    )

    add_figure(doc, 'fig01_histogramas_likert_y.png', 'Figura 1 — Histogramas com curva normal ajustada para as 15 variáveis Likert (V1–V15) e Índice de Produtividade (Y).')

    add_heading_styled(doc, "2.3 Tabelas de Frequência e Produtividade por Variáveis Categóricas", level=2)
    cat_rows = []
    for ccol_name in ['Modalidade', 'Senioridade', 'Squad']:
        c_info = res['etapa1_descritiva']['categoricas'][ccol_name]
        for item in c_info['table']:
            cat_rows.append([
                ccol_name,
                item[ccol_name],
                item['freq'],
                f"{item['pct']:.2f}%",
                f"{item['y_media']:.2f}",
                f"{item['y_dp']:.2f}",
                f"{item['y_mediana']:.1f}",
                f"F = {c_info['anova_y_f']:.3f} (p = {c_info['anova_y_p']:.3f})"
            ])
    add_styled_table(
        doc,
        ["Variável", "Categoria", "Freq. (n)", "Perc. (%)", "Média Y", "DP Y", "Mediana Y", "ANOVA de Y na Variável"],
        cat_rows
    )

    doc.add_paragraph(
        "Descoberta Preliminar Decisiva sobre Modalidade, Senioridade e Squads:\n"
        "• Modalidade de Trabalho: A amostra distribui-se de forma equilibrada entre Híbrido (36,67%, n=55, Y médio = 173,15), "
        "Remoto (34,00%, n=51, Y médio = 172,96) e Presencial (29,33%, n=44, Y médio = 172,36). A ANOVA One-Way demonstra F = 0,0122 com p = 0,9879: "
        "não há absolutamente nenhuma diferença estatística de produtividade entre quem trabalha presencialmente, híbrido ou 100% remoto.\n"
        "• Senioridade: A distribuição é uniforme entre Sênior (26,67%), Staff (26,00%), Júnior (25,33%) e Pleno (22,00%), também sem diferença significativa em Y (F = 0,0914, p = 0,9647).\n"
        "• Squads: O Squad Alpha (liderado informalmente por Lucas Ferreira) apresenta a maior produtividade média da empresa (Y = 183,75), seguido por Squad Eta (179,92) e Squad Epsilon (179,38), "
        "enquanto Squad Delta (163,54) e Squad Gamma (166,73) exibem as menores médias."
    )

    add_figure(doc, 'fig02_frequencias_categoricas.png', 'Figura 2 — Distribuição de frequências e produtividade média (Y) por Modalidade, Senioridade e Squad.')

    add_heading_styled(doc, "2.4 Matriz de Correlação de Pearson: Blocos Latentes e Preditores de Y", level=2)
    doc.add_paragraph(
        "A inspeção da matriz de correlação de Pearson (16 × 16) revela dois achados fundamentais que justificam as Etapas 2 e 4:\n"
        "1. Formação nítida de 4 blocos intra-correlacionados (r entre 0,56 e 0,76 dentro dos blocos e próximo de 0 entre blocos distintos):\n"
        "   • Bloco Ambiente (V1–V4): correlações fortes entre V2–V4 (r = 0,663), V3–V4 (r = 0,661), V1–V4 (r = 0,658), V1–V3 (r = 0,592) e V1–V2 (r = 0,588).\n"
        "   • Bloco Liderança (V5–V8): correlações intensas entre V6–V8 (r = 0,710), V5–V8 (r = 0,707), V7–V8 (r = 0,701), V5–V7 (r = 0,698) e V6–V7 (r = 0,662).\n"
        "   • Bloco Crescimento (V9–V11): correlações elevadas entre V9–V11 (r = 0,701), V9–V10 (r = 0,583) e V10–V11 (r = 0,572).\n"
        "   • Bloco Equilíbrio (V12–V15): a maior correlação bivariada da base ocorre entre V13–V15 (r = 0,757), seguida por V12–V15 (r = 0,702), V12–V13 (r = 0,664), V13–V14 (r = 0,660) e V14–V15 (r = 0,653).\n"
        "2. Correlações Diretas com a Produtividade (Y): Os itens com maior associação linear positiva com Y pertencem aos blocos de Liderança e Equilíbrio:"
    )

    corr_y_rows = [
        [i + 1, c['variavel'], c['descricao'], c['dimensao'], f"{c['r']:.4f}", f"{c['p_valor']:.2e}" if c['p_valor'] < 0.001 else f"{c['p_valor']:.4f}"]
        for i, c in enumerate(res['etapa1_descritiva']['correlacoes_com_y'])
    ]
    add_styled_table(
        doc,
        ["Rank", "Variável", "Descrição do Item", "Dimensão Esperada", "Correlação com Y (r)", "Valor-p (Bicaudal)"],
        corr_y_rows
    )

    add_figure(doc, 'fig03_matriz_correlacao.png', 'Figura 3 — Mapa de calor da Matriz de Correlação de Pearson (V1 a V15 e Índice de Produtividade Y).')

    # =========================================================================
    # ETAPA 2 — ANÁLISE FATORIAL (PARTE IV)
    # =========================================================================
    doc.add_page_break()
    add_heading_styled(doc, "3. Etapa 2 — Análise Fatorial: Redução de Dimensionalidade e Construtos Latentes (Parte IV)", level=1)

    add_heading_styled(doc, "3.1 Verificação da Adequação dos Dados (KMO, Bartlett e Matriz Anti-Imagem)", level=2)
    ef = res['etapa2_fatorial']
    add_styled_table(
        doc,
        ["Teste / Diagnóstico de Adequação", "Valor Calculado", "Critério de Referência", "Interpretação Estatística e Metodológica"],
        [
            ["Medida Kaiser-Meyer-Olkin (KMO Global)", f"{ef['kmo_global']:.4f}", "> 0,70 (Bom) | > 0,80 (Ótimo)", "Adequação muito boa; correlações parciais são baixas frente às simples."],
            ["Teste de Esfericidade de Bartlett (χ²)", f"χ²(105) = {ef['bartlett_chi2']:.2f}", "p < 0,05", f"p = {ef['bartlett_p']:.2e} (< 0,0001). Rejeita-se H₀ (matriz identidade)."],
            ["Determinante da Matriz de Correlação |R|", f"{ef['det_matriz_correlacao']:.6f}", "> 0,00001", "Ausência de singularidade ou multicolinearidade extrema."],
            ["MSA Individual (Diagonal Anti-Imagem)", "0,6158 a 0,8580", "Todos MSA > 0,50", "Todos os 15 itens superam 0,61; nenhuma variável precisa ser excluída."]
        ]
    )

    add_heading_styled(doc, "3.2 Extração (ACP vs AFE), Critério de Kaiser, Scree Plot e Análise Paralela de Horn", level=2)
    doc.add_paragraph(
        "Conforme solicitado no roteiro da Parte IV (item 4.2), realizamos a extração por Componentes Principais (ACP) com rotação ortogonal Varimax "
        "e complementamos o diagnóstico com a Análise Paralela de Horn (500 simulações, semente 42) e com a Análise Fatorial Exploratória por Máxima Verossimilhança (AFE-ML), "
        "seguindo o padrão de excelência da Apostila de Análise Fatorial."
    )

    eig_rows = [
        [
            e['componente'],
            f"{e['autovalor']:.4f}",
            f"{e['var_pct']:.2f}%",
            f"{e['var_acum_pct']:.2f}%",
            f"{e['pa_p95']:.4f}",
            "SIM (Retido)" if e['retido_kaiser'] else "Não"
        ]
        for e in ef['autovalores_tabela']
    ]
    add_styled_table(
        doc,
        ["Comp.", "Autovalor Inicial (λ)", "% Variância (ACP)", "% Variância Acumulada", "Limiar Análise Paralela (P95)", "Decisão (Kaiser λ>1 e Horn)"],
        eig_rows
    )

    doc.add_paragraph(
        "Justificativa da Retenção de 4 Fatores:\n"
        "• Critério de Kaiser (λ > 1,00): Exatamente 4 componentes possuem autovalores superiores a 1 (λ₁ = 3,5392; λ₂ = 2,9372; λ₃ = 2,5821; λ₄ = 2,1740), "
        "enquanto o 5º componente sofre queda brusca para λ₅ = 0,5442.\n"
        "• Análise Paralela de Horn (500 matrizes aleatórias, P95): Os 4 primeiros autovalores observados superam folgadamente os respectivos percentis 95 simulados "
        "(3,539 vs 1,713; 2,937 vs 1,539; 2,582 vs 1,421; 2,174 vs 1,329), ao passo que o 5º fica muito abaixo (0,544 vs 1,240).\n"
        "• Variância Explicada: Os 4 fatores explicam 74,88% da variância total dos 15 itens na ACP (e 65,55% da variância comum na parametrização AFE por Máxima Verossimilhança)."
    )

    add_figure(doc, 'fig04_scree_analise_paralela.png', 'Figura 4 — Scree Plot com Critério de Kaiser (λ = 1,0) e Análise Paralela de Horn (500 simulações, P95).')

    add_heading_styled(doc, "3.3 Matriz Rotacionada (Varimax), Comunalidades, MSA e Comparativo AFE-ML", level=2)
    load_rows = []
    for c in ef['cargas_comunalidades']:
        load_rows.append([
            c['variavel'],
            c['descricao'],
            f"{c['F1_Ambiente']:.3f}",
            f"{c['F2_Lideranca']:.3f}",
            f"{c['F3_Crescimento']:.3f}",
            f"{c['F4_Equilibrio']:.3f}",
            f"{c['comunalidade_acp']:.3f}",
            f"{c['carga_afe_ml_principal']:.3f}",
            f"{c['msa_anti_imagem']:.3f}",
            c['fator_dominante']
        ])
    add_styled_table(
        doc,
        ["Var", "Indicador", "F1 Amb.", "F2 Lid.", "F3 Cresc.", "F4 Equil.", "h² (ACP)", "Carga AFE-ML", "MSA", "Fator Dominante"],
        load_rows
    )

    add_figure(doc, 'fig05_cargas_fatoriais_varimax.png', 'Figura 5 — Matriz de Cargas Fatoriais após Rotação Varimax e Comunalidades Estimadas (h²).')

    add_heading_styled(doc, "3.4 Interpretação Teórica, Confiabilidade (Alfa de Cronbach) e Salvamento dos Escores", level=2)
    f_res_rows = [
        [
            f['codigo'],
            f['nome'],
            f"{f['ss_loadings_rot']:.3f}",
            f"{f['var_rot_pct']:.2f}%",
            f"{f['alfa_cronbach']:.4f}",
            f"{f['media_itens_original']:.2f} (DP={f['dp_itens_original']:.2f})"
        ]
        for f in ef['fatores_resumo']
    ]
    add_styled_table(
        doc,
        ["Código", "Nome do Fator (Construto Latente)", "Soma Quadrados Rot.", "% Variância Rot.", "Alfa de Cronbach (α)", "Média Likert Original"],
        f_res_rows
    )

    doc.add_paragraph(
        "Interpretação Substantiva dos 4 Fatores no Contexto TechNova:\n"
        "• Fator 1 — Ambiente de Trabalho (V1 a V4 | 19,28% da variância | α = 0,8670): Reúne ergonomia do posto (V4, carga = 0,882), gestão de ruído/interrupções (V3 = 0,831), "
        "ferramentas de hardware/software (V2 = 0,831) e qualidade do espaço físico (V1 = 0,831). Representa a infraestrutura material e ergonômica de trabalho (seja no escritório ou no home office).\n"
        "• Fator 2 — Liderança e Cultura (V5 a V8 | 20,40% da variância | α = 0,8927): Maior fator em variância rotacionada e confiabilidade. Agrupa segurança psicológica para errar e inovar (V8 = 0,891), "
        "reconhecimento por entregas (V7 = 0,877), suporte/acessibilidade do gestor direto (V5 = 0,868) e autonomia nas decisões técnicas (V6 = 0,844). Traduz exatamente a tese de Juliana Braga e o modelo de gestão de Priya Sharma.\n"
        "• Fator 3 — Crescimento e Aprendizado (V9 a V11 | 15,03% da variância | α = 0,8269): Sintetiza qualidade da mentoria (V11 = 0,882), oportunidades de treinamento (V9 = 0,879) "
        "e clareza do plano de carreira/promoção (V10 = 0,824). Reflete a evolução profissional e retenção de longo prazo.\n"
        "• Fator 4 — Equilíbrio Vida-Trabalho (V12 a V15 | 20,17% da variância | α = 0,8879): Agrega satisfação com benefícios (V15 = 0,902), flexibilidade de horários (V13 = 0,895), "
        "justiça na distribuição da carga (V12 = 0,841) e prevenção efetiva ao burnout (V14 = 0,813). Mede a sustentabilidade humana do ritmo de trabalho pós-layoff.\n"
        "• Salvamento dos Escores Fatoriais (Item 4.4): Os 4 escores fatoriais ortogonais padronizados (média = 0, DP = 1, correlação inter-fatorial = 0,000) foram salvos nas colunas "
        "F1_Ambiente, F2_Lideranca, F3_Crescimento e F4_Equilibrio do arquivo technova_150_enriched.csv para alimentar o Cluster e a Regressão."
    )

    # =========================================================================
    # ETAPA 3 — ANÁLISE DE CLUSTER (PARTE V)
    # =========================================================================
    doc.add_page_break()
    add_heading_styled(doc, "4. Etapa 3 — Análise de Cluster: Segmentação de Perfis de Colaboradores (Parte V)", level=1)
    ec = res['etapa3_cluster']

    add_heading_styled(doc, "4.1 Preparação dos Dados e Diagnóstico de Outliers Multivariados (Mahalanobis)", level=2)
    doc.add_paragraph(
        f"Utilizando os 4 escores fatoriais ortogonais (F1 a F4) como variáveis de agrupamento, eliminamos a multicolinearidade e garantimos ponderação equânime em escala padronizada (Z-score). "
        f"A verificação de outliers multivariados pela Distância de Mahalanobis (D² com 4 graus de liberdade) revelou valor máximo observado D²_máx = {ec['mahalanobis_max_d2']:.4f} (p = 0,0579), "
        f"inferior ao valor crítico χ²(4; 0,99) = 13,277 e χ²(4; 0,999) = 18,467. Portanto, não existem outliers multivariados aberrantes, mantendo-se integralmente os N = 150 colaboradores."
    )

    add_heading_styled(doc, "4.2 Método Hierárquico de Ward, Coeficientes de Aglomeração e Validação Multicritério de K", level=2)
    ward_rows = [
        [
            w['etapa'],
            w['numero_clusters_antes_salto'],
            f"{w['cluster_1']} & {w['cluster_2']}",
            f"{w['distancia_fusao_ward']:.4f}",
            f"{w['coeficiente_aglomeracao_wss']:.2f}",
            f"+{w['salto_absoluto_proximo']:.2f}" if w['salto_absoluto_proximo'] > 0 else "—",
            f"+{w['salto_relativo_pct']:.2f}%" if w['salto_relativo_pct'] > 0 else "—"
        ]
        for w in ec['agrupamento_ward_ultimas_10_etapas']
    ]
    add_styled_table(
        doc,
        ["Etapa", "Nº Clusters (K)", "Clusters Unidos", "Distância Fusão", "Coef. Aglomeração (WSS)", "Salto Absoluto", "Salto Relativo (%)"],
        ward_rows
    )

    k_rows = [
        [
            m['k'],
            f"{m['wcss_inercia']:.2f}",
            f"{m['silhueta']:.4f}",
            f"{m['calinski_harabasz']:.2f}",
            f"{m['davies_bouldin']:.4f}",
            f"{m['gap_statistic']:.4f} (±{m['gap_sk']:.3f})",
            str(m['tamanhos'])
        ]
        for m in ec['metricas_escolha_k']
    ]
    add_styled_table(
        doc,
        ["K", "WCSS (Inércia)", "Silhueta Média", "Calinski-Harabasz", "Davies-Bouldin", "Estatística Gap (±s_k)", "Tamanhos dos Grupos"],
        k_rows
    )

    doc.add_paragraph(
        "Justificativa da Escolha de K = 3 Clusters:\n"
        "1. Salto no Coeficiente de Aglomeração de Ward: Na tabela de aglomeração, o maior salto percentual relativo ocorre exatamente na Etapa 147 "
        "(passagem de K = 3 para K = 2 clusters), onde o coeficiente WSS salta +17,91% (de 431,99 para 509,38), indicando que fundir além de 3 grupos une perfis heterogêneos.\n"
        "2. Critérios Complementares (Cotovelo, Silhueta, Gap e Utilidade Gerencial): A curva WCSS apresenta inflexão clara em K = 3 (cai de 483,28 para 398,68) com tamanhos perfeitamente balanceados "
        "(50 colaboradores por cluster = 33,33% cada). Embora K = 4 apresente ligeiro incremento marginal na silhueta (0,2169 vs 0,2013), a regra da Estatística Gap "
        "(Gap(3) = 0,3420 ≥ Gap(4) − s₄ = 0,3519 − 0,0475 = 0,3044) e a parcimônia gerencial confirmam K = 3 como a solução ótima e altamente acionável."
    )

    add_figure(doc, 'fig06_dendrogramas_ward_variaveis.png', 'Figura 6 — (Esquerda) Dendrograma de Cluster de Variáveis (1−r) confirmando os 4 blocos; (Direita) Dendrograma Hierárquico de Casos pelo Método de Ward.')
    add_figure(doc, 'fig07_metricas_escolha_k.png', 'Figura 7 — Validação Multicritério para Escolha de K: Cotovelo (WCSS), Silhueta, Calinski-Harabasz e Estatística Gap.')

    add_heading_styled(doc, "4.3 Resultados do K-Means (K = 3), Centróides, ANOVA e Perfis Gerenciais", level=2)
    c_prof_rows = []
    for p in ec['perfis_k3']:
        cf = p['centroides_fatores']
        mb = p['medias_blocos_likert']
        c_prof_rows.append([
            f"Cluster {p['cluster_id']}",
            p['rotulo_curto'],
            f"{p['n']} ({p['pct']:.1f}%)",
            f"{cf['F1_Ambiente']:+.3f} (M={mb['Ambiente_V1_V4']:.2f})",
            f"{cf['F2_Lideranca']:+.3f} (M={mb['Lideranca_V5_V8']:.2f})",
            f"{cf['F3_Crescimento']:+.3f} (M={mb['Crescimento_V9_V11']:.2f})",
            f"{cf['F4_Equilibrio']:+.3f} (M={mb['Equilibrio_V12_V15']:.2f})",
            f"{p['y_media']:.2f} (DP={p['y_dp']:.2f})"
        ])
    add_styled_table(
        doc,
        ["Cluster", "Rótulo Gerencial", "Tamanho", "F1 Ambiente (Z / Likert)", "F2 Liderança (Z / Likert)", "F3 Crescimento (Z / Likert)", "F4 Equilíbrio (Z / Likert)", "Produtividade Y"],
        c_prof_rows
    )

    doc.add_paragraph(
        "Tabela ANOVA do K-Means e Poder Discriminante dos Fatores:\n"
        "• Fator 4 — Equilíbrio Vida-Trabalho: F(2, 147) = 93,3188, p = 6,87 × 10⁻²⁷ (1º fator mais diferenciador entre os clusters — separa o Cluster 3 dos Clusters 1 e 2).\n"
        "• Fator 1 — Ambiente de Trabalho: F(2, 147) = 58,5652, p = 1,97 × 10⁻¹⁹ (2º fator mais diferenciador — separa o Cluster 2, com infraestrutura precária, dos Clusters 1 e 3).\n"
        "• Fator 2 — Liderança e Cultura: F(2, 147) = 32,1299, p = 2,65 × 10⁻¹² (3º fator diferenciador — isola o Cluster 1, que sofre grave crise de liderança).\n"
        "• Fator 3 — Crescimento e Aprendizado: F(2, 147) = 1,2927, p = 0,2776 (não diferencia significativamente os 3 clusters; é uma dor transversal em toda a TechNova, com média próxima de 5,8)."
    )

    add_figure(doc, 'fig08_perfis_clusters_centroides.png', 'Figura 8 — Centróides Finais dos 3 Clusters nos Escores Fatoriais e Mapa de Dispersão dos Colaboradores (F2 vs F4).')

    add_heading_styled(doc, "4.4 Validação Cruzada (Crosstab e Qui-Quadrado) com Modalidade, Senioridade e Squad", level=2)
    ct_mod = ec['crosstabs_qui_quadrado']['Modalidade']
    ct_sen = ec['crosstabs_qui_quadrado']['Senioridade']
    ct_sq = ec['crosstabs_qui_quadrado']['Squad']
    add_styled_table(
        doc,
        ["Cruzamento (Crosstab)", "Cluster 1 (n=50)", "Cluster 2 (n=50)", "Cluster 3 (n=50)", "Estatística Qui-Quadrado (χ²)", "Conclusão Estatística"],
        [
            [
                "Modalidade: Presencial / Híbrido / Remoto",
                "Pres: 18 (36%) | Híb: 14 (28%) | Rem: 18 (36%)",
                "Pres: 14 (28%) | Híb: 23 (46%) | Rem: 13 (26%)",
                "Pres: 12 (24%) | Híb: 18 (36%) | Rem: 20 (40%)",
                f"χ²(4) = {ct_mod['chi2']:.4f}, p = {ct_mod['p_valor']:.4f}",
                "Independente (p > 0,05). 40% do Cluster de Alta Performance é 100% Remoto!"
            ],
            [
                "Senioridade: Júnior / Pleno / Sênior / Staff",
                "Jr: 8 | Pl: 12 | Sr: 14 | Staff: 16",
                "Jr: 17 | Pl: 9 | Sr: 14 | Staff: 10",
                "Jr: 13 | Pl: 12 | Sr: 12 | Staff: 13",
                f"χ²(6) = {ct_sen['chi2']:.4f}, p = {ct_sen['p_valor']:.4f}",
                "Independente (p > 0,05). Atenção: 41% dos Staffs caíram no Cluster 1 (crise de liderança)."
            ],
            [
                "Squads (10 Squads de Produto)",
                "Maior concentração: Iota (8), Kappa (8), Gamma (7), Zeta (7)",
                "Maior concentração: Beta (8), Iota (8), Delta (7)",
                "Maior concentração: Iota (8), Eta (7), Epsilon (6), Kappa (6), Alpha (5)",
                f"χ²(18) = {ct_sq['chi2']:.4f}, p = {ct_sq['p_valor']:.4f}",
                "Distribuído entre squads; Alpha (41,7% em C3) e Eta (53,8% em C3) lideram."
            ]
        ]
    )

    # =========================================================================
    # ETAPA 4 — REGRESSÃO LINEAR MÚLTIPLA (PARTE VI)
    # =========================================================================
    doc.add_page_break()
    add_heading_styled(doc, "5. Etapa 4 — Regressão Linear Múltipla: Determinantes da Produtividade Y (Parte VI)", level=1)
    er = res['etapa4_regressao']

    add_heading_styled(doc, "5.1 Verificação Rigorosa dos 5 Pressupostos Econométricos", level=2)
    pr = er['pressupostos']
    add_styled_table(
        doc,
        ["Pressuposto da Regressão", "Teste / Métrica Utilizada", "Resultado Calculado", "Critério de Aceitação", "Status"],
        [
            ["1. Linearidade", "Correlações parciais e gráficos de dispersão Y vs F1..F4", "Relações lineares positivas em todos os 4 fatores", "Tendência linear sem curvatura sistemática", "ATENDIDO"],
            ["2. Normalidade dos Resíduos", "Shapiro-Wilk (W) e Kolmogorov-Smirnov (D)", f"Shapiro W = {pr['normalidade_shapiro_w']:.4f} (p = {pr['normalidade_shapiro_p']:.4f}) | KS D = {pr['normalidade_ks_d']:.4f} (p = {pr['normalidade_ks_p']:.4f})", "p > 0,05 (Não rejeita H₀ de normalidade)", "ATENDIDO"],
            ["3. Homocedasticidade", "Teste de Breusch-Pagan (LM e F) e Resíduos vs Ŷ", f"LM = {pr['homocedasticidade_breusch_pagan_lm']:.4f} (p = {pr['homocedasticidade_breusch_pagan_p']:.4f}) | F = {pr['homocedasticidade_bp_f']:.4f} (p = {pr['homocedasticidade_bp_f_p']:.4f})", "p > 0,05 (Variância constante dos erros)", "ATENDIDO"],
            ["4. Independência dos Resíduos", "Estatística de Durbin-Watson (DW)", f"DW = {pr['durbin_watson']:.4f}", "Próximo de 2,0 (faixa aceitável 1,5 a 2,5)", "ATENDIDO"],
            ["5. Ausência de Multicolinearidade", "Variance Inflation Factor (VIF) dos Fatores Varimax", f"VIF = {pr['vif_maximo']:.4f} para todos os 4 fatores", "VIF < 5,0 (VIF = 1,00 indica ortogonalidade exata)", "ATENDIDO"],
            ["Diagnóstico de Outliers Residuais", "Resíduos Padronizados |z| > 3,0 e Distância de Cook", f"0 casos com |z| > 3,0 | Cook's D máx = {pr['cooks_distance_max']:.4f}", "Nenhum caso > |3| e Cook's D < 1,0", "ATENDIDO"]
        ]
    )

    add_heading_styled(doc, "5.2 Estimação do Modelo OLS, Ajuste Global (R² e ANOVA F) e Coeficientes (Beta)", level=2)
    doc.add_paragraph(
        f"Equação Estimada do Modelo de Regressão Linear Múltipla:\n"
        f"Ŷ = 172,8533 + 9,7548·(F1_Ambiente) + 13,4383·(F2_Liderança) + 4,5643·(F3_Crescimento) + 11,8538·(F4_Equilíbrio)\n\n"
        f"• Coeficiente de Correlação Múltipla (R): {er['r']:.4f}\n"
        f"• Coeficiente de Determinação (R²): {er['r2']:.4f} (68,37% da variação total do Índice de Produtividade é explicada conjuntamente pelos 4 fatores latentes!)\n"
        f"• R² Ajustado: {er['r2_ajustado']:.4f} (67,50%) | Erro Padrão da Estimativa: {er['erro_padrao_estimativa']:.4f} pontos\n"
        f"• Teste F Global (ANOVA da Regressão): F(4, 145) = {er['f_anova']:.3f}, p = {er['p_anova']:.2e} (< 0,0001). Rejeita-se H₀ com altíssima significância."
    )

    coef_rows = [
        [
            c['rotulo'],
            f"{c['b_nao_padronizado']:+.4f}",
            f"{c['erro_padrao']:.4f}",
            f"{c['beta_padronizado']:+.4f}" if c['termo'] != 'const' else "—",
            f"{c['t_stat']:.3f}",
            f"{c['p_valor']:.2e}" if c['p_valor'] < 0.001 else f"{c['p_valor']:.4f}",
            f"[{c['ic95_inf']:.2f} ; {c['ic95_sup']:.2f}]",
            f"{c['vif']:.3f}",
            f"+{c['b_nao_padronizado']:.2f} pts (+{c['impacto_1dp_escala_0_100']:.2f} pts norm.)" if c['termo'] != 'const' else "—"
        ]
        for c in er['coeficientes']
    ]
    add_styled_table(
        doc,
        ["Variável / Fator", "Coef. B (βᵢ)", "Erro Padrão", "Beta Padronizado", "Estatística t", "Valor-p", "IC 95% para B", "VIF", "Retorno de +1 DP em Y"],
        coef_rows
    )

    doc.add_paragraph(
        "Interpretação Gerencial dos Coeficientes (Respondendo à Questão Central do Board):\n"
        "1. 1º Lugar — Fator 2: Liderança e Cultura (Beta = 0,5315 | B = +13,44 pontos | t = 11,38, p = 7,72 × 10⁻²²): É a dimensão de maior impacto sobre a produtividade na TechNova. "
        "Seu efeito padronizado é 37,8% superior ao do Ambiente de Trabalho (0,5315 vs 0,3858). Elevar a qualidade da liderança, autonomia, reconhecimento e segurança psicológica em 1 desvio-padrão "
        "aumenta a produtividade média em +13,44 pontos na escala original (ou +10,75 pontos na escala normalizada 0–100).\n"
        "2. 2º Lugar — Fator 4: Equilíbrio Vida-Trabalho (Beta = 0,4688 | B = +11,85 pontos | t = 10,04, p = 2,50 × 10⁻¹⁸): Segundo maior preditor da performance. "
        "Combater o burnout (V14), garantir flexibilidade (V13) e distribuir a carga com justiça (V12) gera +11,85 pontos de produtividade por desvio-padrão (+9,48 pontos normalizados).\n"
        "3. 3º Lugar — Fator 1: Ambiente de Trabalho (Beta = 0,3858 | B = +9,75 pontos | t = 8,26, p = 8,32 × 10⁻¹⁴): O argumento de Caio Ventura tem relevância estatística (é o 3º fator), "
        "mas está longe de ser o principal motor da empresa e refere-se à ergonomia, ferramentas e controle de ruído — condições perfeitamente supríveis via subsídio de home office e hubs híbridos.\n"
        "4. 4º Lugar — Fator 3: Crescimento e Aprendizado (Beta = 0,1805 | B = +4,56 pontos | t = 3,86, p = 0,00017): Embora estatisticamente significativo (todos os 4 fatores têm p < 0,001), "
        "possui o menor impacto imediato sobre o output técnico de curto prazo (+4,56 pontos por DP), atuando mais como fator de retenção e alavanca para times que já atingiram maturidade (Cluster 3)."
    )

    add_figure(doc, 'fig09_pressupostos_regressao.png', 'Figura 9 — Diagnóstico Visual dos Pressupostos da Regressão (Normalidade, Q-Q Plot, Homocedasticidade) e Ranking de Betas.')
    add_figure(doc, 'fig10_dispersao_fatores_y.png', 'Figura 10 — Gráficos de Dispersão com Reta de Regressão e Intervalo de Confiança (95%) de Y contra F1, F2, F3 e F4.')

    # =========================================================================
    # ETAPA 5 — INTEGRAÇÃO DAS ANÁLISES (PARTE VII)
    # =========================================================================
    doc.add_page_break()
    add_heading_styled(doc, "6. Etapa 5 — Integração das Análises: Cluster × Regressão × Estratégia (Parte VII)", level=1)
    ei = res['etapa5_integracao']

    add_heading_styled(doc, "6.1 Comparação de Produtividade (Y) entre Clusters (ANOVA e Tukey HSD)", level=2)
    y_anova = next(a for a in ec['anova_tukey_clusters'] if a['variavel'] == 'Y')
    doc.add_paragraph(
        f"A ANOVA One-Way do Índice de Produtividade (Y) entre os 3 clusters confirma diferenças altamente significativas: "
        f"F(2, 147) = {y_anova['f_stat']:.4f}, p = {y_anova['p_valor']:.2e} (< 0,0001).\n"
        f"• Cluster 1 (Déficit de Liderança & Burnout, n=50): Média Y = 161,80 (DP = 20,06 | Média Norm. = 38,24/100).\n"
        f"• Cluster 2 (Limitados por Ambiente & Carga, n=50): Média Y = 163,84 (DP = 19,12 | Média Norm. = 39,87/100).\n"
        f"• Cluster 3 (Engajados de Alta Performance, n=50): Média Y = 192,92 (DP = 23,62 | Média Norm. = 63,14/100).\n\n"
        f"Teste Post-Hoc de Tukey HSD (α = 0,05):\n"
        f"• Cluster 3 vs Cluster 1: Diferença = +31,12 pontos (p_adj < 0,0001 — altamente significativo).\n"
        f"• Cluster 3 vs Cluster 2: Diferença = +29,08 pontos (p_adj < 0,0001 — altamente significativo).\n"
        f"• Cluster 2 vs Cluster 1: Diferença = +2,04 pontos (p_adj = 0,8784 — não significativo: ambos sofrem com baixo Equilíbrio F4 ≈ −0,53, o que trava sua produtividade em ~162–164!).\n"
        f"Coerência Interna Total: O Cluster 3, que reúne simultaneamente escores positivos nos três fatores de maior Beta na regressão (F2 Liderança = +0,34, F4 Equilíbrio = +1,05 e F1 Ambiente = +0,21), "
        f"é exatamente o segmento que atinge a maior produtividade média (192,92), validando de forma cruzada a Análise Fatorial, o K-Means e a Regressão Múltipla."
    )

    add_figure(doc, 'fig11_integracao_y_clusters_modalidade.png', 'Figura 11 — Comparação do Índice de Produtividade (Y) entre os 3 Clusters (p < 0,0001) e entre as 3 Modalidades de Trabalho (p = 0,9879).')

    add_heading_styled(doc, "6.2 Regressão Segmentada por Cluster e por Modalidade (Aprofundamento Parte 7.2)", level=2)
    seg_rows = []
    for k_c in ['Cluster_1', 'Cluster_2', 'Cluster_3']:
        mc = ei['regressao_por_cluster'][k_c]
        cf = mc['coeficientes']
        seg_rows.append([
            mc['rotulo'],
            mc['n'],
            f"{mc['r2']*100:.2f}% ({mc['r2_ajustado']*100:.1f}%)",
            f"B={cf['F1_Ambiente']['b']:+.2f} | Beta={cf['F1_Ambiente']['beta']:+.3f} (p={cf['F1_Ambiente']['p']:.3f})",
            f"B={cf['F2_Lideranca']['b']:+.2f} | Beta={cf['F2_Lideranca']['beta']:+.3f} (p={cf['F2_Lideranca']['p']:.3f})",
            f"B={cf['F3_Crescimento']['b']:+.2f} | Beta={cf['F3_Crescimento']['beta']:+.3f} (p={cf['F3_Crescimento']['p']:.3f})",
            f"B={cf['F4_Equilibrio']['b']:+.2f} | Beta={cf['F4_Equilibrio']['beta']:+.3f} (p={cf['F4_Equilibrio']['p']:.3f})"
        ])
    add_styled_table(
        doc,
        ["Segmento (Cluster)", "n", "R² (R² Ajust.)", "F1: Ambiente", "F2: Liderança", "F3: Crescimento", "F4: Equilíbrio"],
        seg_rows
    )

    doc.add_paragraph(
        "Descobertas Estratégicas da Regressão Segmentada:\n"
        "1. No Cluster 1 (Déficit de Liderança & Burnout, R² = 48,85%): Como a liderança está uniformemente degradada neste grupo (F2 = −0,78), "
        "a variação residual de produtividade é liderada pelo Fator 1 — Ambiente/Ferramentas (Beta = 0,4231, p = 0,0008), seguido por F2 Liderança (Beta = 0,3712, p = 0,0050) e F4 Equilíbrio (Beta = 0,3032, p = 0,0113). "
        "Isso explica a percepção empírica de Caio Ventura: quando a liderança falha, o colaborador apoia-se puramente na infraestrutura e ferramentas para entregar.\n"
        "2. No Cluster 2 (Limitados por Ambiente & Carga, R² = 44,59%): A produtividade é movida por F2 Liderança (Beta = 0,5201, p = 0,0002) e F4 Equilíbrio (Beta = 0,4415, p = 0,0009). "
        "Como o centróide de Ambiente deste grupo é extremamente negativo (F1 = −0,896, média Likert = 4,91), elevar seu F1 e F4 até a média da empresa destravará quase +25 pontos de produtividade.\n"
        "3. No Cluster 3 (Engajados de Alta Performance, R² = 68,06%): O modelo tem o maior poder explicativo e F2 Liderança atinge Beta = 0,6246 (B = +16,39, p < 0,0001). "
        "Mais importante: o Fator 3 — Crescimento e Aprendizado é altamente significativo APENAS no Cluster 3 (Beta = 0,2421, p = 0,0070), enquanto nos Clusters 1 e 2 tem p > 0,05! "
        "Pela Hierarquia de Necessidades Organizacionais, treinamento e plano de carreira (F3) só aceleram a produtividade quando Liderança (F2), Equilíbrio (F4) e Ferramentas (F1) já estão saudáveis."
    )

    add_figure(doc, 'fig12_regressao_segmentada_clusters.png', 'Figura 12 — Comparação dos Coeficientes Padronizados (Beta) entre o Modelo Global e as Regressões Segmentadas por Cluster.')

    add_heading_styled(doc, "6.3 Tabela-Síntese Estratégica e Plano de Ação de 45 Dias (Alocação de R$ 4 Milhões)", level=2)
    add_styled_table(
        doc,
        ["Cluster / Tamanho", "Perfil Dominante (Centróides)", "Média Y Atual -> Meta", "Fatores Prioritários", "Ações Concretas (Plano de 45 Dias)", "Orçamento & KPI de Sucesso"],
        [
            [
                "Cluster 1 (n=50 | 33,3%)\nAtenção: Inclui 16 Staffs (41% dos Staffs da empresa!)",
                "Ambiente Alto (+0,69)\nLiderança Crítica (−0,78)\nEquilíbrio Baixo (−0,52)",
                "161,80 -> 182,00\n(+20,2 pts)",
                "1º F2 Liderança\n2º F4 Equilíbrio",
                "• Intervenção imediata de RH e coaching executivo nos gestores de Iota, Kappa, Gamma e Zeta.\n• Implantar rituais de Priya Sharma: 1-on-1 semanal, autonomia técnica e bloqueio de mensagens após 19h.\n• Retenção blindada dos 16 engenheiros Staff deste grupo.",
                "R$ 1,80 Milhão (45%)\nKPI: Elevar V5–V8 de 4,5 para ≥7,0 e zerar turnover de Staffs em 90 dias."
            ],
            [
                "Cluster 2 (n=50 | 33,3%)\nConcentrado em Híbrido (46%) e Squads Beta/Iota/Delta",
                "Ambiente Precário (−0,90)\nLiderança Boa (+0,44)\nEquilíbrio Baixo (−0,53)",
                "163,84 -> 184,50\n(+20,7 pts)",
                "1º F1 Ambiente\n2º F4 Equilíbrio",
                "• Kit Upgrade imediato de Hardware, Monitores 4K, Cadeira Ergonômica e subsídio de link/co-working (corrigindo V1–V4 = 4,91).\n• Redistribuição de carga de sprints (V12) e política anti-burnout (V14).",
                "R$ 1,40 Milhão (35%)\nKPI: Elevar V1–V4 para ≥7,2 e V12–V15 para ≥7,0 em 60 dias."
            ],
            [
                "Cluster 3 (n=50 | 33,3%)\n40% Remoto / 36% Híbrido\nBenchmark de Produtividade",
                "Equilíbrio Excelente (+1,05)\nLiderança Forte (+0,34)\nAmbiente Bom (+0,21)",
                "192,92 -> 202,00\n(+9,1 pts)",
                "1º F3 Crescimento\n2º Manter F2 e F4",
                "• Preservar 100% da flexibilidade remota/híbrida (cancelar RTO obrigatório).\n• Destravar Fator 3 (significativo neste grupo: Beta=0,242): programa estruturado de Mentoria (V11) e Trilha de Carreira (V10).\n• Transformar líderes em mentores do Cluster 1.",
                "R$ 0,80 Milhão (20%)\nKPI: Elevar V9–V11 de 5,72 para ≥7,8 e manter retenção >97%."
            ]
        ]
    )

    # =========================================================================
    # PARTE VIII — QUESTIONÁRIO INTERPRETATIVO (12 QUESTÕES COMPLETAS)
    # =========================================================================
    doc.add_page_break()
    add_heading_styled(doc, "7. Parte VIII — Respostas Fundamentadas ao Questionário Interpretativo (12 Questões)", level=1)

    q_and_a = [
        (
            "Questão 1. Os dados são adequados para análise fatorial? Interprete KMO e Bartlett. A matriz de correlação sugere que as variáveis V1-V4 (ambiente) realmente se agrupam de forma distinta das variáveis V5-V8 (liderança)?",
            "SIM, os dados são altamente adequados para a aplicação da Análise Fatorial. O índice KMO global atingiu 0,7814 (classificado como bom/ótimo, muito acima do piso de 0,70), "
            "demonstrando que as correlações parciais entre os itens são pequenas em comparação às correlações simples. O Teste de Esfericidade de Bartlett resultou em χ²(105) = 1.190,09 com p = 2,86 × 10⁻¹⁸³ (< 0,0001), "
            "rejeitando categoricamente a hipótese nula de que a matriz de correlação populacional seja uma matriz identidade. Adicionalmente, na Matriz Anti-Imagem, todos os 15 indicadores possuem MSA individual superior a 0,61 (variando de 0,6158 em V11 a 0,8580 em V14). "
            "A matriz de correlação confirma que V1–V4 (Ambiente) e V5–V8 (Liderança) formam blocos completamente distintos e independentes: dentro de V1–V4 as correlações variam de 0,561 a 0,663, "
            "e dentro de V5–V8 variam de 0,599 a 0,710, enquanto as correlações cruzadas entre os itens de Ambiente e os itens de Liderança são próximas de zero (variando entre −0,091 e +0,134)."
        ),
        (
            "Questão 2. Quantos fatores foram extraídos e qual a variância explicada? Nomeie cada fator. O fator de Liderança e Cultura captura a essência do argumento de Juliana Braga?",
            "Foram extraídos exatamente 4 fatores, decisão convergente pelo Critério de Kaiser (quatro autovalores > 1: λ₁ = 3,5392; λ₂ = 2,9372; λ₃ = 2,5821; λ₄ = 2,1740; com o 5º caindo para 0,5442), "
            "pelo Scree Plot e pela Análise Paralela de Horn (500 simulações). Os 4 fatores explicam 74,88% da variância total das 15 variáveis na ACP (e 65,55% da variância comum na AFE por Máxima Verossimilhança). "
            "Após a rotação Varimax, os fatores foram nomeados: (1) Fator 1 — Ambiente de Trabalho (V1–V4: 19,28% da variância rotacionada, α = 0,8670); "
            "(2) Fator 2 — Liderança e Cultura (V5–V8: 20,40% da variância, α = 0,8927); (3) Fator 3 — Crescimento e Aprendizado (V9–V11: 15,03% da variância, α = 0,8269); e "
            "(4) Fator 4 — Equilíbrio Vida-Trabalho (V12–V15: 20,17% da variância, α = 0,8879). "
            "Sim, o Fator 2 (Liderança e Cultura) captura com precisão cirúrgica o argumento de Juliana Braga: suas cargas fatoriais elevadas em Segurança Psicológica (V8 = 0,891), Reconhecimento (V7 = 0,877), "
            "Suporte do Gestor (V5 = 0,868) e Autonomia (V6 = 0,844) materializam estatisticamente a tese de que a qualidade da gestão de pessoas é um construto latente coeso e determinante."
        ),
        (
            "Questão 3. Qual fator tem maior correlação com Y (Produtividade)? Esse resultado surpreenderia Caio Ventura ou confirmaria a posição dele?",
            "O fator com maior correlação linear com o Índice de Produtividade (Y) é o Fator 2 — Liderança e Cultura (r = 0,5315, p = 7,72 × 10⁻²²), seguido pelo Fator 4 — Equilíbrio Vida-Trabalho (r = 0,4688, p = 2,50 × 10⁻¹⁸). "
            "O Fator 1 — Ambiente de Trabalho ocupa apenas a 3ª posição (r = 0,3858, p = 8,32 × 10⁻¹⁴), e o Fator 3 — Crescimento e Aprendizado ocupa a 4ª posição (r = 0,1805, p = 0,00017). "
            "Esse resultado surpreenderia e refutaria a tese principal do CTO Caio Ventura, que atribuía a queda de produtividade à ausência física no escritório e colocava o ambiente físico como motor primário da performance. "
            "Os dados demonstram que Liderança e Cultura (r = 0,5315) e Prevenção ao Burnout/Equilíbrio (r = 0,4688) têm poder explicativo substancialmente superior ao Ambiente (r = 0,3858)."
        ),
        (
            "Questão 4. Quantos clusters foram identificados? Descreva o perfil de cada grupo. Existe um cluster que se assemelha ao squad de Priya Sharma (alta produtividade, boa liderança)?",
            "Foram identificados K = 3 clusters (confirmados pelo maior salto relativo de +17,91% no coeficiente de aglomeração de Ward, pelo método do cotovelo e pela Estatística Gap), "
            "dividindo os 150 colaboradores em três grupos de 50 pessoas (33,33% cada):\n"
            "• Cluster 1 — Déficit de Liderança & Burnout (n = 50, Y médio = 161,80): Possui ótimo ambiente físico e ferramentas (F1 = +0,690, média Likert = 7,74), mas sofre grave déficit de Liderança (F2 = −0,775, Likert = 4,51) "
            "e baixo Equilíbrio Vida-Trabalho (F4 = −0,522, Likert = 5,38). Apesar da excelente infraestrutura física, tem a pior produtividade da empresa.\n"
            "• Cluster 2 — Limitados por Ambiente & Carga (n = 50, Y médio = 163,84): Avalia positivamente a Liderança (F2 = +0,438, Likert = 6,91), mas apresenta forte precariedade em Ambiente/Ferramentas (F1 = −0,896, Likert = 4,91) "
            "e baixo Equilíbrio/Sobrecarga (F4 = −0,532, Likert = 5,25), o que restringe sua produtividade.\n"
            "• Cluster 3 — Engajados de Alta Performance (n = 50, Y médio = 192,92): Sim, o Cluster 3 espelha fielmente o modelo gerencial de Priya Sharma (e a alta entrega de Lucas Ferreira): "
            "combina altíssimo Equilíbrio Vida-Trabalho e prevenção ao burnout (F4 = +1,054, Likert = 8,43), Liderança e Segurança Psicológica elevadas (F2 = +0,337, Likert = 6,87) e boas ferramentas (F1 = +0,206, Likert = 7,08), "
            "entregando uma produtividade média quase 30 pontos superior aos demais grupos."
        ),
        (
            "Questão 5. Os clusters estão associados à Modalidade (Presencial/Híbrido/Remoto) e à Senioridade? O teste Qui-Quadrado sustenta ou refuta a tese de Caio de que remotos são menos produtivos?",
            "NÃO há associação estatisticamente significativa entre os clusters e a Modalidade de trabalho (χ² = 5,0203, gl = 4, p = 0,2852 > 0,05) nem entre os clusters e a Senioridade (χ² = 5,3406, gl = 6, p = 0,5009 > 0,05). "
            "O teste Qui-Quadrado (aliado à ANOVA de Y por modalidade: F = 0,0122, p = 0,9879) REFUTA cabalmente a tese de Caio Ventura. "
            "Mais ainda: a tabulação cruzada revela que, dentro do Cluster 3 (Alta Performance, Y = 192,92), 40,0% dos colaboradores trabalham 100% Remoto (20 pessoas) e 36,0% em regime Híbrido (18 pessoas), "
            "contra apenas 24,0% no regime Presencial (12 pessoas). Por outro lado, 40,9% dos trabalhadores Presenciais (18 de 44) estão no Cluster 1 (baixa produtividade), provando que estar fisicamente no escritório não protege contra liderança ruim."
        ),
        (
            "Questão 6. O modelo de regressão é significativo? Qual o R² e quais fatores são preditores significativos de Y? O Ambiente de Trabalho (tese do CTO) é mais ou menos importante que Liderança e Cultura (tese da VP de People)?",
            "SIM, o modelo de Regressão Linear Múltipla é globalmente significativo com F(4, 145) = 78,348 e p = 2,91 × 10⁻³⁵ (< 0,0001). "
            "O coeficiente de determinação é R² = 0,6837 (R² ajustado = 0,6750), indicando que os quatro fatores latentes explicam 68,37% de toda a variância da produtividade individual na TechNova. "
            "Todos os quatro fatores são estatisticamente significativos a 1% (p < 0,001): F2 Liderança e Cultura (B = +13,44, t = 11,38, p = 7,72 × 10⁻²²), F4 Equilíbrio Vida-Trabalho (B = +11,85, t = 10,04, p = 2,50 × 10⁻¹⁸), "
            "F1 Ambiente de Trabalho (B = +9,75, t = 8,26, p = 8,32 × 10⁻¹⁴) e F3 Crescimento e Aprendizado (B = +4,56, t = 3,86, p = 0,00017). "
            "O Ambiente de Trabalho (Beta = 0,3858) é substancialmente MENOS importante que Liderança e Cultura (Beta = 0,5315) e também menos importante que Equilíbrio Vida-Trabalho (Beta = 0,4688), validando a tese da VP de People Juliana Braga."
        ),
        (
            "Questão 7. Qual fator tem o maior coeficiente padronizado (Beta)? Se Felipe Drummond pudesse investir em apenas uma dimensão, qual deveria ser — e por quê esse resultado importa para a decisão sobre o RTO?",
            "O maior coeficiente padronizado pertence ao Fator 2 — Liderança e Cultura (Beta = 0,5315). Se o CEO Felipe Drummond pudesse investir em apenas uma dimensão, deveria investir prioritariamente em Liderança e Cultura (programa de desenvolvimento de líderes, segurança psicológica, autonomia e reconhecimento). "
            "Esse resultado é decisivo contra o RTO obrigatório porque mostra que a alavanca nº 1 de produtividade da TechNova é relacional e gerencial (como os líderes conduzem seus squads), e não geográfica. "
            "Impor o RTO destruiria a confiança e a autonomia (reduzindo F2 e F4) e provocaria a perda imediata de até 70% dos talentos dos Squads Alpha e Beta (40% da receita recorrente), agravando o problema em vez de resolvê-lo."
        ),
        (
            "Questão 8. Os pressupostos da regressão foram atendidos? Discuta normalidade dos resíduos, homocedasticidade e Durbin-Watson. A ortogonalidade dos escores fatoriais eliminou a multicolinearidade?",
            "SIM, todos os pressupostos clássicos do modelo linear gaussiano foram rigorosamente atendidos:\n"
            "• Normalidade dos resíduos: Confirmada pelos testes de Shapiro-Wilk (W = 0,9854, p = 0,1143 > 0,05) e Kolmogorov-Smirnov (D = 0,0540, p = 0,7542 > 0,05), bem como pelo alinhamento no gráfico Q-Q Plot.\n"
            "• Homocedasticidade: Confirmada pelo teste de Breusch-Pagan (LM = 1,4532, p = 0,8349 > 0,05; estatística F = 0,3546, p = 0,8405) e pela dispersão aleatória sem formato de funil no gráfico de resíduos padronizados vs valores preditos.\n"
            "• Independência dos resíduos: A estatística de Durbin-Watson foi DW = 2,3381, situando-se dentro do intervalo de independência (1,5 a 2,5) em torno de 2,0.\n"
            "• Ausência de Multicolinearidade: Sim, a extração fatorial com rotação ortogonal Varimax gerou escores fatoriais com correlação zero entre si, resultando em VIF = 1,0000 para F1, F2, F3 e F4 — eliminando por completo qualquer inflação de variância."
        ),
        (
            "Questão 9. Compare as médias de Y entre os clusters. O cluster com melhor percepção de liderança tem a maior produtividade? A ANOVA confirma diferenças significativas entre os perfis?",
            "A ANOVA One-Way confirma diferenças altamente significativas de produtividade entre os clusters: F(2, 147) = 33,893, p = 8,70 × 10⁻¹³ (< 0,0001). "
            "O Cluster 3 apresenta média Y = 192,92, superando em +31,12 pontos o Cluster 1 (Y = 161,80, Tukey p < 0,0001) e em +29,08 pontos o Cluster 2 (Y = 163,84, Tukey p < 0,0001). "
            "Uma leitura conjunta sutil e fundamental emerge dos dados: tanto o Cluster 2 (F2 = +0,438, Likert = 6,91) quanto o Cluster 3 (F2 = +0,337, Likert = 6,87) possuem boa percepção de liderança (sem diferença significativa entre si em F2 no teste de Tukey, p = 0,819). "
            "Por que então o Cluster 3 produz 192,92 e o Cluster 2 produz apenas 163,84? Porque o Cluster 3 combina boa Liderança (F2 = +0,34) com excelente Equilíbrio Vida-Trabalho (F4 = +1,05) e bom Ambiente/Ferramentas (F1 = +0,21), "
            "enquanto o Cluster 2 tem sua boa liderança neutralizada por ferramentas precárias (F1 = −0,90) e sobrecarga/burnout (F4 = −0,53). Já o Cluster 1, com péssima liderança (F2 = −0,78), amarga a pior produtividade (161,80) mesmo tendo o melhor ambiente físico (+0,69)."
        ),
        (
            "Questão 10. Executando a regressão separadamente por cluster, os coeficientes mudam? Existem perfis de colaboradores para os quais o ambiente físico importa mais que a liderança — o que daria razão parcial a Caio?",
            "SIM! A Regressão Segmentada por Cluster revela mudanças estruturais nos coeficientes que enriquecem o diagnóstico:\n"
            "• No Cluster 1 (Déficit de Liderança & Burnout, R² = 48,85%): O Fator 1 — Ambiente de Trabalho apresenta o maior coeficiente padronizado (Beta = 0,4231, B = +12,66, p = 0,0008), "
            "superando F2 Liderança (Beta = 0,3712, B = +10,03, p = 0,0050) e F4 Equilíbrio (Beta = 0,3032, p = 0,0113). Isso confere razão parcial e contextual a Caio Ventura: para os colaboradores do Cluster 1 (e também para aqueles do Cluster 2 que sofrem com F1 = −0,90), "
            "a qualidade das ferramentas, ergonomia e ausência de interrupções tem impacto crítico na entrega diária.\n"
            "• No Cluster 2 (Limitados por Ambiente & Carga, R² = 44,59%): Dominam F2 Liderança (Beta = 0,5201, p = 0,0002) e F4 Equilíbrio (Beta = 0,4415, p = 0,0009).\n"
            "• No Cluster 3 (Alta Performance, R² = 68,06%): F2 Liderança é hegemônico (Beta = 0,6246, B = +16,39, p < 0,0001) e o Fator 3 — Crescimento e Aprendizado torna-se altamente significativo (Beta = 0,2421, p = 0,0070), "
            "mostrando que mentoria e carreira impulsionam a performance de quem já possui liderança, equilíbrio e ferramentas adequadas."
        ),
        (
            "Questão 11. Se a empresa pudesse melhorar apenas um fator em 1 desvio padrão, qual geraria o maior incremento no índice de produtividade? Calcule o impacto estimado em pontos na escala 0-100.",
            "Melhorar o Fator 2 — Liderança e Cultura em +1 desvio-padrão geraria o maior incremento isolado no Índice de Produtividade:\n"
            "• Na escala empírica observada na base (114 a 239 pontos, amplitude = 125 pontos): o ganho direto é igual ao coeficiente não-padronizado β₂ = +13,4383 pontos (elevando a média da empresa de 172,85 para 186,29 pontos, IC 95%: [+11,10 ; +15,77]).\n"
            "• Na escala normalizada de 0 a 100 pontos (onde cada 1 ponto bruto equivale a 100 / 125 = 0,80 ponto normalizado, ou tomando o ganho sobre o desvio-padrão de Y): "
            "o incremento estimado é de +10,75 pontos percentuais na amplitude 0–100 (ou +7,78% de aumento direto sobre a média atual de 172,85, correspondendo a 0,5315 desvios-padrão de Y). "
            "Em segundo lugar ficaria o Fator 4 — Equilíbrio Vida-Trabalho (+11,85 pontos brutos ou +9,48 pontos na escala 0–100), e em terceiro o Fator 1 — Ambiente (+9,75 pontos brutos ou +7,80 pontos na escala 0–100)."
        ),
        (
            "Questão 12. Elabore a recomendação final para Felipe apresentar ao board em 45 dias: o RTO deve ser implementado, mantido opcional ou abandonado? Justifique com base nos quatro fatores, nos clusters e nos coeficientes de regressão. Proponha um plano de ação diferenciado por perfil de colaborador, com orçamento e impacto projetado em produtividade. Quem tinha mais razão — Caio, Juliana ou Priya?",
            "RECOMENDAÇÃO FINAL AO BOARD (PLANO 'TECHNOVA FLEX & LEAD 45 DIAS'):\n"
            "1. Decisão sobre o RTO: O RTO obrigatório deve ser ABANDONADO imediatamente e substituído por um modelo 'Flexível Orientado a Resultados e Hubs Opcionais'. "
            "A evidência estatística é irrefutável: (a) a modalidade não altera a produtividade (ANOVA F = 0,012, p = 0,988); (b) 40% do Cluster 3 de Alta Performance é 100% remoto; "
            "(c) forçar o RTO colocaria em risco imediato 40% do ARR (Squads Alpha e Beta, onde Alpha é o squad nº 1 em produtividade com Y = 183,75).\n"
            "2. Quem tinha mais razão? Priya Sharma e Juliana Braga tinham mais razão estrutural, enquanto Caio Ventura tinha uma razão parcial mas mal diagnosticada. "
            "Juliana acertou que Liderança (Beta = 0,5315) e Burnout/Equilíbrio (Beta = 0,4688) são os motores dominantes da produtividade. Priya Sharma provou na prática como integrar Liderança (F2) e Equilíbrio (F4) em regime híbrido/flexível. "
            "Caio Ventura percebeu corretamente que o Fator 1 — Ambiente e Ferramentas importa (Beta = 0,3858, sendo crítico para o Cluster 1 e gargalo do Cluster 2), mas errou ao confundir 'qualidade de ferramentas e ergonomia' com 'presença física obrigatória no escritório'.\n"
            "3. Plano de Ação Diferenciado com Orçamento de R$ 4,0 Milhões e Impacto Projetado:\n"
            "   • Frente 1 — Choque de Liderança e Retenção de Staffs no Cluster 1 (R$ 1,80M | 50 colaboradores): Capacitação intensiva dos líderes no protocolo Priya Sharma (1-on-1 semanal, segurança psicológica V8, reconhecimento V7 e desconexão pós-19h). "
            "Meta: elevar F2 em +1,2 DP e F4 em +0,8 DP no Cluster 1 -> Ganho projetado de +25,6 pontos em Y neste grupo (de 161,8 para ~187,4).\n"
            "   • Frente 2 — Upgrade de Infraestrutura/Ergonomia e Rebalanceamento de Carga no Cluster 2 (R$ 1,40M | 50 colaboradores): Voucher de R$ 15 mil/pessoa para setup ergonômico, hardware de ponta e co-working opcional (atacando F1 = −0,90) + revisão de capacidade das sprints (atacando F4 = −0,53). "
            "Meta: elevar F1 em +1,3 DP e F4 em +0,8 DP no Cluster 2 -> Ganho projetado de +22,2 pontos em Y neste grupo (de 163,8 para ~186,0).\n"
            "   • Frente 3 — Aceleração de Carreira e Mentoria no Cluster 3 (R$ 0,80M | 50 colaboradores): Estruturar programa de Mentoria Técnica (V11) e Plano de Carreira (V10), aproveitando que F3 tem Beta = 0,242 significativo neste cluster. "
            "Meta: elevar F3 em +1,0 DP e F2 em +0,3 DP -> Ganho projetado de +8,6 pontos em Y (de 192,9 para ~201,5).\n"
            "   • Impacto Global Projetado para o Board: Elevação da produtividade média global da TechNova de 172,85 para ~191,6 pontos (+18,8 pontos brutos ou +15,0 pontos na escala 0–100, um salto de +10,9% em output produtivo em 90 dias), com retenção dos Squads Alpha e Beta e ROI estimado superior a 8x sobre os R$ 4 milhões investidos."
        )
    ]

    for q_title, q_ans in q_and_a:
        p_q = doc.add_paragraph()
        r_q = p_q.add_run(q_title)
        r_q.bold = True
        r_q.font.size = Pt(10.5)
        r_q.font.color.rgb = RGBColor(15, 23, 42)

        p_a = doc.add_paragraph(q_ans)
        for r in p_a.runs:
            r.font.size = Pt(9.5)
            r.font.color.rgb = RGBColor(30, 41, 59)

    # =========================================================================
    # PARTE IX — TRIBUNAL DO MODELO E APLICATIVO ADAPTATIVO COM IA
    # =========================================================================
    doc.add_page_break()
    add_heading_styled(doc, "8. Parte IX — Defesa no Tribunal do Modelo e Aplicativo Web Adaptativo", level=1)
    doc.add_paragraph(
        "Para atender ao Desafio Obrigatório de Aplicação com IA Generativa (Item 9.2) e blindar a equipe no Tribunal do Modelo (Item 9.1), "
        "desenvolvemos a plataforma interativa 'TechNova Analytics & Decision Suite', estruturada com dois pilares:"
    )
    doc.add_paragraph(
        "1. Motor Estatístico 100% Adaptativo com Upload de Dados (.CSV / .XLSX): Sempre que o analista ou gestor fizer upload de uma nova base de dados "
        "(com qualquer número de colaboradores ou variáveis Likert), o aplicativo detecta automaticamente o esquema de colunas, recalcula em tempo real a Estatística Descritiva, "
        "o KMO, o Teste de Bartlett, a Matriz Anti-Imagem, os Autovalores, a Rotação Varimax, os Escores Fatoriais, o Agrupamento K-Means com Silhueta/WCSS, a ANOVA, o Teste Qui-Quadrado e a Regressão Linear Múltipla (OLS e Segmentada por Cluster).\n"
        "2. Hub de Decisão Personalizado para os 5 Personagens do Caso:\n"
        "   • Painel Felipe Drummond (CEO): Simulador Executivo What-If para o Board (alocação de orçamento, choque em DP nos 4 fatores, projeção de Y e risco de ARR).\n"
        "   • Painel Caio Ventura (CTO): Diagnóstico de Infraestrutura (F1), comparativo empírico Presencial vs Híbrido vs Remoto e Regressão Segmentada por Cluster.\n"
        "   • Painel Juliana Braga (VP de People): Radar de Liderança (F2), Carreira (F3) e Prevenção ao Burnout (F4), com priorização cirúrgica dos 50 colaboradores do Cluster 1 e 50 do Cluster 2.\n"
        "   • Painel Lucas Ferreira (Tech Lead — Squad Alpha): Benchmark de performance dos Squads Alpha e Beta (40% do ARR), produtividade remota e autonomia técnica.\n"
        "   • Painel Priya Sharma (EM — Squad Theta): Playbook de Gestão 360 e Classificador Preditivo Individual (onde o gestor insere as 15 notas V1–V15 de qualquer colaborador e o sistema calcula seus 4 escores fatoriais, identifica seu Cluster, prevê seu Y e prescreve ações de 1-on-1)."
    )

    out_docx_path = os.path.join(BASE_DIR, 'Estudo_de_Caso_TechNova_Completo.docx')
    doc.save(out_docx_path)
    print(f"DOCX_GENERATED_OK: {out_docx_path}")


if __name__ == '__main__':
    main()
