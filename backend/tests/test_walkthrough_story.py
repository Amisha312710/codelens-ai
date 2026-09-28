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

from app.services.walkthrough_service import WalkthroughService


class TestWalkthroughStory(unittest.TestCase):
    def setUp(self):
        self.service = WalkthroughService()

    def test_pipeline_story_detection(self):
        code_main = """from fastapi import FastAPI
from services.worker import run_job

app = FastAPI()

@app.post("/execute")
def handle_execute(payload: dict):
    return run_job(payload)
"""
        code_worker = """import openai

def run_job(data: dict):
    resp = openai.chat.completions.create(model="gpt-4", messages=[{"role": "user", "content": "hi"}])
    return resp
"""
        all_files = [
            {"relative_path": "main.py", "source_content": code_main, "language": "Python"},
            {"relative_path": "services/worker.py", "source_content": code_worker, "language": "Python"},
        ]
        story = self.service.detect_project_story(
            repo_url="https://github.com/example-org/ai-service",
            repo_name="ai-service",
            func_nodes=[],
            class_nodes=[],
            file_nodes=[],
            edges=[],
            all_files=all_files,
            overview={"core_purpose": "AI worker service"},
        )
        self.assertIsNotNone(story)
        self.assertGreaterEqual(len(story["stages"]), 3)
        for stage in story["stages"]:
            self.assertIn("evidence", stage)
            self.assertTrue(stage["evidence"]["symbol"])
            self.assertTrue(stage["evidence"]["file_path"])
            self.assertGreater(stage["duration_seconds"], 0)

    def test_walkthrough_generation_scenes(self):
        code = """from fastapi import FastAPI
app = FastAPI()

@app.get("/items")
def list_items():
    return fetch_items()

def fetch_items():
    return ["item1"]
"""
        self.service.repo_service.ingest_repository = lambda url: {
            "repository_name": "items-api",
            "files": [{"relative_path": "main.py", "source_content": code, "language": "Python"}],
        }
        self.service.analysis_service.build_architecture_graph = lambda url: {"nodes": [], "edges": []}
        self.service.analysis_service.get_project_overview = lambda url: {"core_purpose": "Items API"}

        res = self.service.generate_walkthrough(repo_url="https://github.com/example-org/items-api")
        self.assertIsNotNone(res)
        self.assertEqual(res["repository_url"], "https://github.com/example-org/items-api")

    def test_unsupported_or_empty_repository(self):
        story = self.service.detect_project_story(
            repo_url="https://github.com/test-org/empty",
            repo_name="empty",
            func_nodes=[],
            class_nodes=[],
            file_nodes=[],
            edges=[],
            all_files=[{"relative_path": "empty.py", "source_content": "# empty file"}],
            overview={"core_purpose": "Empty repository"},
        )
        self.assertIsNone(story)

    def test_arbitrary_unconnected_functions_return_none(self):
        story = self.service.detect_project_story(
            repo_url="https://github.com/test-org/unconnected",
            repo_name="unconnected",
            func_nodes=[],
            class_nodes=[],
            file_nodes=[],
            edges=[],
            all_files=[{"relative_path": "standalone.py", "source_content": "def lone_fn(): pass\n"}],
            overview={"core_purpose": "Unconnected repository"},
        )
        self.assertIsNone(story)


if __name__ == "__main__":
    unittest.main()

