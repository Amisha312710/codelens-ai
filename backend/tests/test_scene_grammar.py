import os
import sys
from pathlib import Path
import unittest

_REPO_ROOT = Path(__file__).resolve().parents[2]
_BACKEND_DIR = _REPO_ROOT / "backend"
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from app.services.core_logic_service import CoreLogicService


class TestSceneGrammarAndGroundedStory(unittest.TestCase):
    def setUp(self):
        self.service = CoreLogicService()

    def test_single_function_repo_null(self):
        """1. Single-function repo honestly fails Sufficiency Gate with exact null message and reason."""
        code = """def single_helper():
    return 42
"""
        files = [{"relative_path": "helper.py", "source_content": code, "language": "Python"}]
        story, reason, msg = self.service.reconstruct_project_story(
            repo_url="https://github.com/synthetic/single-func",
            repo_data={"repository_name": "single-func", "files": files},
        )
        self.assertIsNone(story)
        self.assertEqual(msg, "Core workflow could not be reliably reconstructed from this repository.")
        self.assertEqual(reason, "insufficient_stages")

    def test_distinct_symbols_enforced(self):
        """2. One symbol cannot create multiple stages. Duplicate symbols in a chain are rejected."""
        # Synthesize 3 stages with the same symbol 'send'
        stages_duplicate = [
            {"title": "Send Ingress", "stage_type": "ingress", "evidence": {"symbol": "send", "file_path": "App.jsx", "start_line": 1, "end_line": 10}},
            {"title": "Send Network Dispatch", "stage_type": "processing", "evidence": {"symbol": "send", "file_path": "App.jsx", "start_line": 11, "end_line": 20}},
            {"title": "Send Egress", "stage_type": "output", "evidence": {"symbol": "send", "file_path": "App.jsx", "start_line": 21, "end_line": 30}},
        ]
        links = [{"source": "s1", "target": "s2"}, {"source": "s2", "target": "s3"}]
        passed, reason = self.service.is_sufficient_for_project_story(stages_duplicate, links)
        self.assertFalse(passed, "Gate must reject duplicate symbols")
        self.assertEqual(reason, "duplicate_symbols_in_chain")

    def test_cross_boundary_fetch_to_route_and_downstream(self):
        """3. React fetch('http://localhost:8000/chat') connects to POST /chat and traces downstream calls."""
        react_code = """import React from 'react';
export function ChatView() {
  const send = async () => {
    await fetch('http://localhost:8000/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'hello' }),
    });
  };
  return <button onClick={send}>Send</button>;
}
"""
        backend_chat_code = """from fastapi import FastAPI, APIRouter
from services.search import vector_search
from services.llm import generate_response

router = APIRouter()

@router.post("/chat")
def chat(payload: dict):
    query = payload.get("message")
    clean = normalize_query(query)
    docs = vector_search(clean)
    answer = generate_response(docs)
    return {"answer": answer}

def normalize_query(q: str):
    return q.strip().lower()
"""
        search_code = """def vector_search(query: str):
    return ["chunk 1", "chunk 2"]
"""
        llm_code = """import openai
def generate_response(context: list):
    res = openai.chat.completions.create(model="gpt-4o", messages=[{"role": "user", "content": str(context)}])
    return res.choices[0].message.content
"""
        files = [
            {"relative_path": "frontend/src/ChatView.jsx", "source_content": react_code, "language": "JavaScript"},
            {"relative_path": "backend/api/chat.py", "source_content": backend_chat_code, "language": "Python"},
            {"relative_path": "backend/services/search.py", "source_content": search_code, "language": "Python"},
            {"relative_path": "backend/services/llm.py", "source_content": llm_code, "language": "Python"},
        ]

        story, reason, msg = self.service.reconstruct_project_story(
            repo_url="https://github.com/synthetic/rag-cross-boundary",
            repo_data={"repository_name": "rag-cross-boundary", "files": files},
        )

        self.assertIsNotNone(story, f"Expected story, got: {reason}")
        self.assertIsNone(reason)
        stages = story["stages"]

        # Ensure all stages have distinct symbols
        symbols = [s["evidence"]["symbol"] for s in stages]
        self.assertEqual(len(symbols), len(set(symbols)), "Every stage symbol must be unique")

        # Check frontend ingress and backend processing
        self.assertIn("send", symbols)
        self.assertIn("chat", symbols)

        # Check provenance chips format: symbol · file:start-end
        for st in stages:
            self.assertIn("provenance_chip", st)
            self.assertIn(" · ", st["provenance_chip"])
            self.assertIn(":", st["provenance_chip"])

    def test_boilerplate_readme_discarded(self):
        """4. Boilerplate Vite README template is discarded and not used as project summary."""
        vite_readme = """# React + Vite
This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.
Currently, two official plugins are available:
- @vitejs/plugin-react
"""
        app_code = """from fastapi import FastAPI
from service import do_work

app = FastAPI()

@app.post("/run")
def run_app():
    return do_work()
"""
        service_code = """def do_work():
    return helper()

def helper():
    return "done"
"""
        files = [
            {"relative_path": "README.md", "source_content": vite_readme, "language": "Markdown"},
            {"relative_path": "main.py", "source_content": app_code, "language": "Python"},
            {"relative_path": "service.py", "source_content": service_code, "language": "Python"},
        ]

        story, reason, msg = self.service.reconstruct_project_story(
            repo_url="https://github.com/synthetic/vite-boilerplate",
            repo_data={"repository_name": "vite-boilerplate", "files": files},
            overview={"core_purpose": vite_readme},
        )

        self.assertIsNotNone(story)
        self.assertNotIn("minimal setup to get React working in Vite", story["project_summary"])
        self.assertNotIn("HMR and some ESLint rules", story["project_summary"])
        self.assertTrue(len(story["project_summary"]) > 10)

    def test_evidence_dossier_and_proven_chain(self):
        """5. Reconstructed story must include evidence dossier with source code snippets and proven chain."""
        app_code = """from fastapi import FastAPI
from logic import calculate

app = FastAPI()

@app.post("/compute")
def compute(x: int):
    return calculate(x)
"""
        logic_code = """def calculate(val: int):
    return transform(val)

def transform(v: int):
    return v * 2
"""
        files = [
            {"relative_path": "app.py", "source_content": app_code, "language": "Python"},
            {"relative_path": "logic.py", "source_content": logic_code, "language": "Python"},
        ]

        story, reason, msg = self.service.reconstruct_project_story(
            repo_url="https://github.com/synthetic/dossier-test",
            repo_data={"repository_name": "dossier-test", "files": files},
        )

        self.assertIsNotNone(story)
        self.assertIn("dossier", story)
        self.assertIn("proven_chain", story)
        self.assertEqual(len(story["dossier"]), len(story["stages"]))
        self.assertEqual(len(story["proven_chain"]), len(story["stages"]))

        for item in story["dossier"]:
            self.assertTrue(item["id"].startswith("E"))
            self.assertIsNotNone(item["source_snippet"])
            self.assertGreater(len(item["source_snippet"]), 0)


if __name__ == "__main__":
    unittest.main()
