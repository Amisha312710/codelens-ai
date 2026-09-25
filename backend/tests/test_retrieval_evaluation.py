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


def run_evaluation(repo_url: str = "https://github.com/kennethreitz/samplemod"):
    """
    Executes independent evaluation of SemanticRetriever and HybridRetriever.
    Measures Recall@3, Recall@5, HitRate@3, HitRate@5 across all 5 evaluation questions.
    """
    print("=" * 80)
    print("CODELENS AI — RETRIEVAL EVALUATION HARNESS")
    print(f"Target Repository: {repo_url}")
    print("=" * 80)

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

    # 2. Instantiate retrievers directly
    # Semantic baseline runs SemanticRetriever directly
    semantic_retriever = SemanticRetriever(chunks=chunks)
    # Hybrid retriever runs HybridRetriever directly
    hybrid_retriever = HybridRetriever(chunks=chunks, graph=graph, files=py_files)

    table_rows = []
    debug_details = []

    # Aggregators
    sem_r3_list, sem_r5_list = [], []
    sem_h3_list, sem_h5_list = [], []
    hyb_r3_list, hyb_r5_list = [], []
    hyb_h3_list, hyb_h5_list = [], []

    for item in EVALUATION_DATA:
        qid = item["id"]
        qtext = item["question"]
        expected = item["expected"]

        # Run semantic retrieval directly
        sem_res_3 = semantic_retriever.retrieve(query=qtext, top_k=3)
        sem_res_5 = semantic_retriever.retrieve(query=qtext, top_k=5)

        # Run hybrid retrieval directly
        hyb_res_3 = hybrid_retriever.retrieve(query=qtext, top_k=3, max_structural_expansion=3)
        hyb_res_5 = hybrid_retriever.retrieve(query=qtext, top_k=5, max_structural_expansion=5)

        # Compute Semantic metrics
        sem_r3, sem_h3, sem_m3, sem_miss3 = evaluate_candidates(sem_res_3, expected, k=3)
        sem_r5, sem_h5, sem_m5, sem_miss5 = evaluate_candidates(sem_res_5, expected, k=5)

        # Compute Hybrid metrics
        hyb_r3, hyb_h3, hyb_m3, hyb_miss3 = evaluate_candidates(hyb_res_3, expected, k=3)
        hyb_r5, hyb_h5, hyb_m5, hyb_miss5 = evaluate_candidates(hyb_res_5, expected, k=5)

        # Track aggregates
        sem_r3_list.append(sem_r3)
        sem_r5_list.append(sem_r5)
        sem_h3_list.append(sem_h3)
        sem_h5_list.append(sem_h5)

        hyb_r3_list.append(hyb_r3)
        hyb_r5_list.append(hyb_r5)
        hyb_h3_list.append(hyb_h3)
        hyb_h5_list.append(hyb_h5)

        # Format rows for comparison table
        table_rows.append({
            "qid": qid,
            "method": "Semantic",
            "r3": sem_r3,
            "r5": sem_r5,
            "h3": sem_h3,
            "h5": sem_h5,
        })
        table_rows.append({
            "qid": qid,
            "method": "Hybrid",
            "r3": hyb_r3,
            "r5": hyb_r5,
            "h3": hyb_h3,
            "h5": hyb_h5,
        })

        # Store debug info for top-5
        debug_details.append({
            "qid": qid,
            "question": qtext,
            "expected": [f"{e[0]}::{e[1]}" for e in expected],
            "sem_top5": [f"{c['file_path']}::{c['symbol_name']}" for c in sem_res_5[:5]],
            "hyb_top5": [f"{c['file_path']}::{c['symbol_name']} ({','.join(c.get('retrieval_sources', []))})" for c in hyb_res_5[:5]],
            "hyb_all": [f"{i+1}. {c['file_path']}::{c['symbol_name']} [{c.get('symbol_type', '')}] ({','.join(c.get('retrieval_sources', []))})" for i, c in enumerate(hyb_res_5)],
            "sem_matched": sem_m5,
            "sem_missed": sem_miss5,
            "hyb_matched": hyb_m5,
            "hyb_missed": hyb_miss5,
        })

    # Print comparison table
    print("\n" + "=" * 80)
    print("COMPARISON RESULTS TABLE")
    print("=" * 80)
    header = f"{'Question':<10} | {'Method':<10} | {'Recall@3':<10} | {'Recall@5':<10} | {'HitRate@3':<10} | {'HitRate@5':<10}"
    print(header)
    print("-" * len(header))
    for row in table_rows:
        print(f"{row['qid']:<10} | {row['method']:<10} | {row['r3']:<10.2f} | {row['r5']:<10.2f} | {int(row['h3']):<10} | {int(row['h5']):<10}")

    # Print aggregate averages
    n = len(EVALUATION_DATA)
    sem_avg_r3 = sum(sem_r3_list) / n
    sem_avg_r5 = sum(sem_r5_list) / n
    sem_avg_h3 = sum(sem_h3_list) / n
    sem_avg_h5 = sum(sem_h5_list) / n

    hyb_avg_r3 = sum(hyb_r3_list) / n
    hyb_avg_r5 = sum(hyb_r5_list) / n
    hyb_avg_h3 = sum(hyb_h3_list) / n
    hyb_avg_h5 = sum(hyb_h5_list) / n

    print("\n" + "=" * 80)
    print("AGGREGATE AVERAGES")
    print("=" * 80)
    print(f"Semantic Average Recall@3:  {sem_avg_r3:.4f}")
    print(f"Semantic Average Recall@5:  {sem_avg_r5:.4f}")
    print(f"Semantic Average HitRate@3: {sem_avg_h3:.4f}")
    print(f"Semantic Average HitRate@5: {sem_avg_h5:.4f}")
    print()
    print(f"Hybrid Average Recall@3:    {hyb_avg_r3:.4f}")
    print(f"Hybrid Average Recall@5:    {hyb_avg_r5:.4f}")
    print(f"Hybrid Average HitRate@3:   {hyb_avg_h3:.4f}")
    print(f"Hybrid Average HitRate@5:   {hyb_avg_h5:.4f}")

    # Print detailed debug output
    print("\n" + "=" * 80)
    print("DETAILED PER-QUESTION DEBUG OUTPUT")
    print("=" * 80)
    for dbg in debug_details:
        print(f"\nQuestion: {dbg['qid']} - \"{dbg['question']}\"")
        print("Expected Evidence:")
        for exp in dbg["expected"]:
            print(f"  - {exp}")
        print("Semantic top 5:")
        for s in dbg["sem_top5"]:
            print(f"  - {s}")
        print("Hybrid top 5:")
        for h in dbg["hyb_top5"]:
            print(f"  - {h}")
        print("All Hybrid candidates returned:")
        for h in dbg["hyb_all"]:
            print(f"  {h}")
        print(f"Semantic matched: {dbg['sem_matched']}")
        print(f"Semantic missed:  {dbg['sem_missed']}")
        print(f"Hybrid matched:   {dbg['hyb_matched']}")
        print(f"Hybrid missed:    {dbg['hyb_missed']}")

    print("\n" + "=" * 80)
    print("EVALUATION RUN COMPLETE")
    print("=" * 80)

    return {
        "semantic": {
            "avg_recall_3": sem_avg_r3,
            "avg_recall_5": sem_avg_r5,
            "avg_hit_rate_3": sem_avg_h3,
            "avg_hit_rate_5": sem_avg_h5,
        },
        "hybrid": {
            "avg_recall_3": hyb_avg_r3,
            "avg_recall_5": hyb_avg_r5,
            "avg_hit_rate_3": hyb_avg_h3,
            "avg_hit_rate_5": hyb_avg_h5,
        },
    }


if __name__ == "__main__":
    run_evaluation()
