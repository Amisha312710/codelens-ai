import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

# Ensure backend and repo root are on sys.path
_REPO_ROOT = Path(__file__).resolve().parents[2]
_BACKEND_DIR = _REPO_ROOT / "backend"
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from app.services.repository_service import RepositoryService
from app.services.analysis_service import AnalysisService
from rag.chunking import create_code_chunks
from rag.retrieval import SemanticRetriever, HybridRetriever
from rag.reranking import CrossEncoderReranker
from rag.evidence_ranking import CodeEvidenceRanker

# Evaluation dataset for samplemod
EVALUATION_DATA = [
    {
        "id": "Q1",
        "question": "What functions are related to getting an answer?",
        "expected": [
            ("sample/helpers.py", "get_answer"),
            ("sample/core.py", "hmm"),
        ],
    },
    {
        "id": "Q2",
        "question": "What does hmm() depend on?",
        "expected": [
            ("sample/helpers.py", "get_answer"),
            ("sample/core.py", "get_hmm"),
        ],
    },
    {
        "id": "Q3",
        "question": "Where is the answer generated?",
        "expected": [
            ("sample/helpers.py", "get_answer"),
        ],
    },
    {
        "id": "Q4",
        "question": "What calls get_answer()?",
        "expected": [
            ("sample/core.py", "hmm"),
        ],
    },
    {
        "id": "Q5",
        "question": "How does the sample module work?",
        "expected": [
            ("sample/core.py", "get_hmm"),
            ("sample/core.py", "hmm"),
            ("sample/helpers.py", "get_answer"),
        ],
    },
]


def is_match(candidate: Dict[str, Any], expected_item: Tuple[str, str]) -> bool:
    """
    Matches candidate against expected (file_path, symbol_name).
    Matching uses repository-relative file_path + symbol_name.
    Does not use similarity scores or retrieval_sources to decide correctness.
    """
    exp_file, exp_symbol = expected_item
    cand_file = candidate.get("file_path", "")
    cand_symbol = candidate.get("symbol_name", "")

    if cand_file == exp_file:
        if cand_symbol == exp_symbol:
            return True
        # Handle class method prefix e.g. Class.method -> method
        if cand_symbol.endswith(f".{exp_symbol}"):
            return True
    return False


def evaluate_candidates(
    retrieved: List[Dict[str, Any]],
    expected: List[Tuple[str, str]],
    k: int,
) -> Tuple[float, float, List[str], List[str]]:
    """
    Calculates Recall@K and HitRate@K for a retrieved candidate list.
    """
    top_k_candidates = retrieved[:k]
    matched: List[str] = []
    missed: List[str] = []

    for exp in expected:
        exp_label = f"{exp[0]}::{exp[1]}"
        found = any(is_match(cand, exp) for cand in top_k_candidates)
        if found:
            matched.append(exp_label)
        else:
            missed.append(exp_label)

    recall = len(matched) / len(expected) if expected else 0.0
    hit_rate = 1.0 if len(matched) > 0 else 0.0
    return recall, hit_rate, matched, missed


def compute_mrr(retrieved: List[Dict[str, Any]], expected: List[Tuple[str, str]]) -> float:
    """
    Calculates Mean Reciprocal Rank (MRR): 1 / rank of first relevant item.
    """
    for rank_idx, cand in enumerate(retrieved, start=1):
        if any(is_match(cand, exp) for exp in expected):
            return 1.0 / rank_idx
    return 0.0


def compute_redundancy_ratio(retrieved: List[Dict[str, Any]], k: int) -> float:
    """
    Calculates the proportion of top-K slots consumed by duplicate physical code spans.
    Redundancy = (K - unique_spans) / K.
    """
    top_k = retrieved[:k]
    if not top_k:
        return 0.0
    spans = [(c.get("file_path"), c.get("start_line"), c.get("end_line")) for c in top_k]
    unique_count = len(set(spans))
    return (len(top_k) - unique_count) / len(top_k)


def run_evaluation(repo_url: str = "https://github.com/kennethreitz/samplemod"):
    """
    Executes independent evaluation comparing four retrieval configurations:
    1. SemanticRetriever (FAISS baseline)
    2. HybridRetriever (Semantic + Structural expansion)
    3. HybridRetriever + CrossEncoderReranker (Generic ms-marco reranking)
    4. HybridRetriever + CodeEvidenceRanker (Deterministic code-aware evidence ranker)
    Measures Recall@3, Recall@5, HitRate@3, HitRate@5, MRR, and Redundancy Ratio.
    """
    print("=" * 90)
    print("CODELENS AI — FOUR-WAY RETRIEVAL EVALUATION HARNESS")
    print(f"Target Repository: {repo_url}")
    print("=" * 90)

    # 1. Ingest repository and prepare AST analyses and code chunks
    repo_service = RepositoryService()
    repo_data = repo_service.ingest_repository(repo_url)
    py_files = [
        f for f in repo_data.get("files", [])
        if f.get("file_extension") == ".py" or f.get("language") == "Python"
    ]

    analysis_service = AnalysisService()
    ast_analyses = [
        analysis_service.analyze_python_code(
            source_code=pf["source_content"],
            file_path=pf["relative_path"],
        )
        for pf in py_files
    ]

    chunks = create_code_chunks(
        repository_url=repo_url,
        files=py_files,
        ast_analyses=ast_analyses,
    )
    graph = analysis_service.build_architecture_graph(repo_url)

    # 2. Instantiate retrievers, experimental CrossEncoder, and production CodeEvidenceRanker
    semantic_retriever = SemanticRetriever(chunks=chunks)
    hybrid_retriever = HybridRetriever(chunks=chunks, graph=graph, files=py_files)
    cross_encoder = CrossEncoderReranker()
    evidence_ranker = CodeEvidenceRanker(graph=graph)

    table_rows = []
    debug_details = []

    # Metric accumulators: [r3, r5, h3, h5, mrr, red5]
    sem_metrics = {"r3": [], "r5": [], "h3": [], "h5": [], "mrr": [], "red": []}
    hyb_metrics = {"r3": [], "r5": [], "h3": [], "h5": [], "mrr": [], "red": []}
    ce_metrics = {"r3": [], "r5": [], "h3": [], "h5": [], "mrr": [], "red": []}
    ev_metrics = {"r3": [], "r5": [], "h3": [], "h5": [], "mrr": [], "red": []}

    for item in EVALUATION_DATA:
        qid = item["id"]
        qtext = item["question"]
        expected = item["expected"]

        # Method 1: Semantic retrieval
        sem_res_3 = semantic_retriever.retrieve(query=qtext, top_k=3)
        sem_res_5 = semantic_retriever.retrieve(query=qtext, top_k=5)

        # Method 2: Hybrid retrieval (un-reranked)
        hyb_res_3 = hybrid_retriever.retrieve(query=qtext, top_k=3, max_structural_expansion=3)
        hyb_res_5 = hybrid_retriever.retrieve(query=qtext, top_k=5, max_structural_expansion=5)

        # Complete candidate pool for rerankers
        complete_hybrid_pool = hybrid_retriever.retrieve(query=qtext, top_k=5, max_structural_expansion=5)

        # Method 3: Hybrid + CrossEncoder (experimental)
        ce_pool = cross_encoder.rerank(query=qtext, candidates=complete_hybrid_pool, top_k=None)
        ce_res_3 = ce_pool[:3]
        ce_res_5 = ce_pool[:5]

        # Method 4: Hybrid + Code Evidence Ranker (production)
        ev_pool = evidence_ranker.rank(query=qtext, candidates=complete_hybrid_pool, top_k=None)
        ev_res_3 = ev_pool[:3]
        ev_res_5 = ev_pool[:5]

        # Evaluate Semantic
        s_r3, s_h3, s_m3, s_miss3 = evaluate_candidates(sem_res_3, expected, k=3)
        s_r5, s_h5, s_m5, s_miss5 = evaluate_candidates(sem_res_5, expected, k=5)
        s_mrr = compute_mrr(sem_res_5, expected)
        s_red = compute_redundancy_ratio(sem_res_5, k=5)
        sem_metrics["r3"].append(s_r3); sem_metrics["r5"].append(s_r5)
        sem_metrics["h3"].append(s_h3); sem_metrics["h5"].append(s_h5)
        sem_metrics["mrr"].append(s_mrr); sem_metrics["red"].append(s_red)

        # Evaluate Hybrid
        h_r3, h_h3, h_m3, h_miss3 = evaluate_candidates(hyb_res_3, expected, k=3)
        h_r5, h_h5, h_m5, h_miss5 = evaluate_candidates(hyb_res_5, expected, k=5)
        h_mrr = compute_mrr(hyb_res_5, expected)
        h_red = compute_redundancy_ratio(hyb_res_5, k=5)
        hyb_metrics["r3"].append(h_r3); hyb_metrics["r5"].append(h_r5)
        hyb_metrics["h3"].append(h_h3); hyb_metrics["h5"].append(h_h5)
        hyb_metrics["mrr"].append(h_mrr); hyb_metrics["red"].append(h_red)

        # Evaluate CrossEncoder
        c_r3, c_h3, c_m3, c_miss3 = evaluate_candidates(ce_res_3, expected, k=3)
        c_r5, c_h5, c_m5, c_miss5 = evaluate_candidates(ce_res_5, expected, k=5)
        c_mrr = compute_mrr(ce_pool, expected)
        c_red = compute_redundancy_ratio(ce_res_5, k=5)
        ce_metrics["r3"].append(c_r3); ce_metrics["r5"].append(c_r5)
        ce_metrics["h3"].append(c_h3); ce_metrics["h5"].append(c_h5)
        ce_metrics["mrr"].append(c_mrr); ce_metrics["red"].append(c_red)

        # Evaluate Code Evidence Ranker
        e_r3, e_h3, e_m3, e_miss3 = evaluate_candidates(ev_res_3, expected, k=3)
        e_r5, e_h5, e_m5, e_miss5 = evaluate_candidates(ev_res_5, expected, k=5)
        e_mrr = compute_mrr(ev_pool, expected)
        e_red = compute_redundancy_ratio(ev_res_5, k=5)
        ev_metrics["r3"].append(e_r3); ev_metrics["r5"].append(e_r5)
        ev_metrics["h3"].append(e_h3); ev_metrics["h5"].append(e_h5)
        ev_metrics["mrr"].append(e_mrr); ev_metrics["red"].append(e_red)

        # Table rows
        for mname, r3, r5, h3, h5, mrr, red in [
            ("Semantic", s_r3, s_r5, s_h3, s_h5, s_mrr, s_red),
            ("Hybrid", h_r3, h_r5, h_h3, h_h5, h_mrr, h_red),
            ("Hybrid+CrossEnc", c_r3, c_r5, c_h3, c_h5, c_mrr, c_red),
            ("Hybrid+Evidence", e_r3, e_r5, e_h3, e_h5, e_mrr, e_red),
        ]:
            table_rows.append({
                "qid": qid,
                "method": mname,
                "r3": r3, "r5": r5,
                "h3": h3, "h5": h5,
                "mrr": mrr, "red": red,
            })

        # Per-question rankings
        debug_details.append({
            "qid": qid,
            "question": qtext,
            "expected": [f"{e[0]}::{e[1]}" for e in expected],
            "sem_top5": [f"{c['file_path']}::{c['symbol_name']}" for c in sem_res_5[:5]],
            "hyb_top5": [f"{c['file_path']}::{c['symbol_name']} ({','.join(c.get('retrieval_sources', []))})" for c in hyb_res_5[:5]],
            "ce_top5": [f"{c['file_path']}::{c['symbol_name']} (score={c.get('reranker_score', 0):.4f})" for c in ce_res_5[:5]],
            "ev_top5": [f"{c['file_path']}::{c['symbol_name']} (score={c.get('_evidence_score', 0):.4f}, sources={','.join(c.get('retrieval_sources', []))})" for c in ev_res_5[:5]],
            "sem_matched": s_m5, "sem_missed": s_miss5,
            "hyb_matched": h_m5, "hyb_missed": h_miss5,
            "ce_matched": c_m5, "ce_missed": c_miss5,
            "ev_matched": e_m5, "ev_missed": e_miss5,
        })

    # Print comparison table
    print()
    print("=" * 90)
    print("FOUR-WAY RETRIEVAL COMPARISON TABLE")
    print("=" * 90)
    header = f"{'Question':<10} | {'Method':<16} | {'Recall@3':<10} | {'Recall@5':<10} | {'HitRate@3':<10} | {'HitRate@5':<10} | {'MRR':<8} | {'Redundancy@5':<12}"
    print(header)
    print("-" * len(header))
    for row in table_rows:
        print(f"{row['qid']:<10} | {row['method']:<16} | {row['r3']:<10.2f} | {row['r5']:<10.2f} | {int(row['h3']):<10} | {int(row['h5']):<10} | {row['mrr']:<8.4f} | {row['red']:<12.2f}")

    # Print aggregate averages
    n = len(EVALUATION_DATA)
    def calc_avgs(d):
        return {k: sum(v) / n for k, v in d.items()}

    s_avg = calc_avgs(sem_metrics)
    h_avg = calc_avgs(hyb_metrics)
    c_avg = calc_avgs(ce_metrics)
    e_avg = calc_avgs(ev_metrics)

    print()
    print("=" * 90)
    print("AGGREGATE BENCHMARK AVERAGES (FOUR CONFIGURATIONS)")
    print("=" * 90)
    summary_header = f"{'Configuration':<22} | {'Recall@3':<10} | {'Recall@5':<10} | {'HitRate@3':<10} | {'HitRate@5':<10} | {'MRR':<8} | {'Redundancy@5':<12}"
    print(summary_header)
    print("-" * len(summary_header))
    for name, avg in [
        ("1. Semantic-Only", s_avg),
        ("2. Hybrid", h_avg),
        ("3. Hybrid + CrossEncoder", c_avg),
        ("4. Hybrid + Code Evidence", e_avg),
    ]:
        print(f"{name:<22} | {avg['r3']:<10.4f} | {avg['r5']:<10.4f} | {avg['h3']:<10.4f} | {avg['h5']:<10.4f} | {avg['mrr']:<8.4f} | {avg['red']:<12.4f}")

    # Print detailed ranking comparisons
    print()
    print("=" * 90)
    print("DETAILED PER-QUESTION RANKING INSPECTION (Q1–Q5)")
    print("=" * 90)
    for dbg in debug_details:
        print(f"\n--- Question: {dbg['qid']} - \"{dbg['question']}\" ---")
        print("Expected Evidence:")
        for exp in dbg["expected"]:
            print(f"  * {exp}")
        print("1. Semantic Top-5:")
        for s in dbg["sem_top5"]:
            print(f"     - {s}")
        print("2. Hybrid Top-5:")
        for h in dbg["hyb_top5"]:
            print(f"     - {h}")
        print("3. Hybrid + CrossEncoder Top-5:")
        for c in dbg["ce_top5"]:
            print(f"     - {c}")
        print("4. Hybrid + Code Evidence Ranker Top-5:")
        for e in dbg["ev_top5"]:
            print(f"     - {e}")
        print(f"Matches:")
        print(f"  Semantic:        matched={dbg['sem_matched']} | missed={dbg['sem_missed']}")
        print(f"  Hybrid:          matched={dbg['hyb_matched']} | missed={dbg['hyb_missed']}")
        print(f"  Hybrid+CrossEnc: matched={dbg['ce_matched']} | missed={dbg['ce_missed']}")
        print(f"  Hybrid+Evidence: matched={dbg['ev_matched']} | missed={dbg['ev_missed']}")

    print("\n" + "=" * 90)
    print("EVALUATION HARNESS COMPLETE")
    print("=" * 90)

    return {
        "semantic": s_avg,
        "hybrid": h_avg,
        "cross_encoder": c_avg,
        "code_evidence": e_avg,
    }


if __name__ == "__main__":
    run_evaluation()
