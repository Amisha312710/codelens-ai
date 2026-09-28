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


class TestCoreLogicReconstruction(unittest.TestCase):
    def setUp(self):
        self.service = CoreLogicService()

    def test_backend_chain(self):
        """1. Python backend-only chain: Route -> service -> external call with verified lines."""
        app_code = """from fastapi import FastAPI
from services.processor import process_query

app = FastAPI()

@app.post("/api/query")
def handle_query(query: str):
    return process_query(query)
"""
        proc_code = """import openai

def process_query(q: str):
    response = openai.chat.completions.create(model="gpt-4", messages=[{"role": "user", "content": q}])
    return response.choices[0].message.content
"""
        files = [
            {"relative_path": "main.py", "source_content": app_code, "language": "Python"},
            {"relative_path": "services/processor.py", "source_content": proc_code, "language": "Python"},
        ]

        story, reason, status = self.service.reconstruct_project_story(
            repo_url="https://github.com/synthetic/backend-chain",
            repo_data={"repository_name": "backend-chain", "files": files},
            overview={"core_purpose": "Synthetic backend query processor"},
        )

        self.assertIsNotNone(story, f"Expected story to be generated, got reason: {reason}")
        self.assertIsNone(reason)
        self.assertGreaterEqual(len(story["stages"]), 3)

        # Confirm stage ordering
        stage_types = [s["stage_type"] for s in story["stages"]]
        self.assertEqual(stage_types[0], "ingress")
        self.assertIn("external_call", stage_types)
        self.assertEqual(stage_types[-1], "output")

        # Confirm evidence lines exist
        for st in story["stages"]:
            ev = st["evidence"]
            self.assertIsNotNone(ev["file_path"])
            self.assertIsNotNone(ev["start_line"])
            self.assertIsNotNone(ev["end_line"])
            self.assertGreaterEqual(ev["end_line"], ev["start_line"])

    def test_cross_boundary_fullstack_chain(self):
        """2. Fullstack chain: React UI event + fetch -> FastAPI route -> service -> external call."""
        react_code = """import React, { useState } from 'react';

export function StudyView() {
  const [data, setData] = useState(null);

  const handleAsk = async (prompt) => {
    const res = await fetch('/api/study/ask', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
    const json = await res.json();
    setData(json);
  };

  return <button onClick={handleAsk}>Ask Question</button>;
}
"""
        route_code = """from fastapi import FastAPI
from services.ai_service import generate_study_notes

app = FastAPI()

@app.post("/api/study/ask")
def ask_study_ai(prompt: str):
    return generate_study_notes(prompt)
"""
        service_code = """import openai

def generate_study_notes(prompt: str):
    res = openai.chat.completions.create(model="gpt-4o", messages=[{"role": "user", "content": prompt}])
    return res
"""
        files = [
            {"relative_path": "frontend/src/StudyView.jsx", "source_content": react_code, "language": "JavaScript"},
            {"relative_path": "backend/app/main.py", "source_content": route_code, "language": "Python"},
            {"relative_path": "backend/app/services/ai_service.py", "source_content": service_code, "language": "Python"},
        ]

        story, reason, status = self.service.reconstruct_project_story(
            repo_url="https://github.com/synthetic/study-fullstack",
            repo_data={"repository_name": "study-fullstack", "files": files},
            overview={"core_purpose": "Full-stack AI study companion"},
        )

        self.assertIsNotNone(story, f"Expected full-stack story, got reason: {reason}")
        self.assertEqual(story["archetype"], "fullstack_application")
        self.assertGreaterEqual(len(story["stages"]), 3)

        # Check provenance from both frontend and backend files
        file_paths = [s["evidence"]["file_path"] for s in story["stages"]]
        has_fe = any("StudyView.jsx" in fp for fp in file_paths)
        has_be = any("main.py" in fp or "ai_service.py" in fp for fp in file_paths)
        self.assertTrue(has_fe, "Fullstack story must trace frontend files")
        self.assertTrue(has_be, "Fullstack story must trace backend files")

    def test_readme_only_null(self):
        """3. README-only repo with buzzwords ('AI-powered') but no code evidence -> null."""
        readme = """# SuperAI
An AI-powered, revolutionary next-gen RAG system using LangChain, FAISS, and GPT-4.
"""
        empty_py = """# Configuration options
PORT = 8080
"""
        files = [
            {"relative_path": "README.md", "source_content": readme, "language": "Markdown"},
            {"relative_path": "config.py", "source_content": empty_py, "language": "Python"},
        ]

        story, reason, status = self.service.reconstruct_project_story(
            repo_url="https://github.com/synthetic/readme-only",
            repo_data={"repository_name": "readme-only", "files": files},
            overview={"core_purpose": "AI-powered RAG assistant with FAISS"},
        )

        self.assertIsNone(story)
        self.assertEqual(status, "Core workflow could not be reliably reconstructed from this repository.")
        self.assertIn(reason, ("no_facts", "no_entrypoint", "no_links", "insufficient_stages"))

    def test_name_only_traps(self):
        """4. Functions called search() or files called model.py with no real vector/ML wiring do NOT create fake stages."""
        code = """def search(query):
    # Pure string utility function, no vector index or external search
    items = ["apple", "banana"]
    return [i for i in items if query in i]

def main():
    return search("a")
"""
        files = [
            {"relative_path": "model.py", "source_content": code, "language": "Python"},
        ]

        story, reason, status = self.service.reconstruct_project_story(
            repo_url="https://github.com/synthetic/name-trap",
            repo_data={"repository_name": "name-trap", "files": files},
            overview={"core_purpose": "String helper utility"},
        )

        # Must not fabricate a RAG pipeline or neural inference archetype
        if story is not None:
            self.assertNotEqual(story["archetype"], "rag_pipeline")
            for st in story["stages"]:
                self.assertNotIn("VECTOR", st.get("role_badge", ""))
                self.assertNotIn("LLM", st.get("role_badge", ""))

    def test_ambiguous_url_drop(self):
        """5. Ambiguous frontend API calls matching multiple disparate routes are dropped rather than guessed."""
        react_code = """export function View() {
  const run = () => fetch('/item');
  return <button onClick={run}>Click</button>;
}
"""
        app_code = """from fastapi import FastAPI
app = FastAPI()

@app.get("/item")
def get_item_a(): pass

@app.get("/item")
def get_item_b(): pass
"""
        files = [
            {"relative_path": "frontend/App.jsx", "source_content": react_code, "language": "JavaScript"},
            {"relative_path": "main.py", "source_content": app_code, "language": "Python"},
        ]

        facts = self.service._extract_python_facts(files) + self.service._extract_js_facts(files)
        links = self.service._resolve_links(facts, files)

        # Ambiguous /item matching multiple route targets must be dropped
        api_to_route_links = [l for l in links if l["type"] == "api_to_route"]
        self.assertEqual(len(api_to_route_links), 0, "Ambiguous match must be dropped")

    def test_gate_boundary(self):
        """6. Gate boundary: <3 stages or <2 links fails; >=3 stages with >=2 links passes."""
        # Case A: 2 stages, 1 link -> FAILS gate
        stages_short = [
            {"title": "S1", "stage_type": "ingress", "evidence": {"file_path": "a.py", "start_line": 1, "end_line": 5}},
            {"title": "S2", "stage_type": "output", "evidence": {"file_path": "a.py", "start_line": 6, "end_line": 10}},
        ]
        links_single = [{"source": "s1", "target": "s2"}]
        passed, reason = self.service.is_sufficient_for_project_story(stages_short, links_single)
        self.assertFalse(passed)
        self.assertEqual(reason, "insufficient_stages")

        # Case B: 3 stages, 1 link -> FAILS gate
        stages_three = [
            {"title": "S1", "stage_type": "ingress", "evidence": {"file_path": "a.py", "start_line": 1, "end_line": 5}},
            {"title": "S2", "stage_type": "processing", "evidence": {"file_path": "b.py", "start_line": 1, "end_line": 5}},
            {"title": "S3", "stage_type": "output", "evidence": {"file_path": "c.py", "start_line": 1, "end_line": 5}},
        ]
        passed, reason = self.service.is_sufficient_for_project_story(stages_three, links_single)
        self.assertFalse(passed)
        self.assertEqual(reason, "no_links")

        # Case C: 3 stages, 2 links -> PASSES gate
        links_two = [{"source": "s1", "target": "s2"}, {"source": "s2", "target": "s3"}]
        passed, reason = self.service.is_sufficient_for_project_story(stages_three, links_two)
        self.assertTrue(passed)
        self.assertIsNone(reason)

    def test_evidence_line_ranges_exist(self):
        """7. Confirms every returned evidence range exists within actual source file line bounds."""
        app_code = """from fastapi import FastAPI
app = FastAPI()

@app.post("/run")
def run():
    return execute()

def execute():
    return "done"
"""
        files = [{"relative_path": "main.py", "source_content": app_code, "language": "Python"}]
        line_count = len(app_code.splitlines())

        facts = self.service._extract_python_facts(files)
        for fact in facts:
            self.assertGreaterEqual(fact["start_line"], 1)
            self.assertLessEqual(fact["end_line"], line_count)

    def test_cache_never_returns_repo_a_for_repo_b(self):
        """8. Normalization and cache keying ensures querying Repo B never returns Repo A's story."""
        code_a = """from fastapi import FastAPI
app = FastAPI()
@app.get('/a')
def get_a(): return process_a()
def process_a(): return helper_a()
def helper_a(): return 'a'
"""
        code_b = """from fastapi import FastAPI
app = FastAPI()
@app.get('/b')
def get_b(): return process_b()
def process_b(): return helper_b()
def helper_b(): return 'b'
"""
        files_a = [
            {"relative_path": "main.py", "source_content": code_a, "language": "Python"}
        ]
        files_b = [
            {"relative_path": "main.py", "source_content": code_b, "language": "Python"}
        ]

        # Populate cache for Repo A
        story_a, _, _ = self.service.reconstruct_project_story(
            repo_url="https://github.com/org/repo-a.git",
            repo_data={"repository_name": "repo-a", "files": files_a},
        )

        # Query Repo B
        story_b, _, _ = self.service.reconstruct_project_story(
            repo_url="https://github.com/org/repo-b",
            repo_data={"repository_name": "repo-b", "files": files_b},
        )

        self.assertIsNotNone(story_a)
        self.assertIsNotNone(story_b)
        self.assertNotEqual(story_a["repo_url"], story_b["repo_url"])
        self.assertEqual(story_a["repo_url"], "https://github.com/org/repo-a")
        self.assertEqual(story_b["repo_url"], "https://github.com/org/repo-b")


if __name__ == "__main__":
    unittest.main()
