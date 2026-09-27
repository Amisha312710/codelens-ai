"""
CodeLens AI - RAG Generation Module
Provides grounded codebase Q&A using LLM provider abstraction,
context validation, grounding instructions, and predictable source citation parsing.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
import os
import re


class LLMProvider(ABC):
    """
    Abstract base class defining the provider contract for codebase Q&A generation.
    Enables pluggable model providers and deterministic test mocks.
    """

    @abstractmethod
    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """
        Generates grounded text completion given user prompt and system instructions.
        """
        pass


class OpenAIProvider(LLMProvider):
    """
    OpenAI LLM provider implementation using the official OpenAI Python SDK.
    Relies on OPENAI_API_KEY and OPENAI_MODEL environment variables or explicit parameters.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.0,
    ):
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        self.model = model or os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
        self.temperature = temperature

    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not configured.")

        try:
            from openai import OpenAI
        except ImportError:
            raise RuntimeError(
                "The openai package is required for OpenAIProvider. Install it via pip install openai."
            )

        client = OpenAI(api_key=self.api_key)

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=self.temperature,
        )
        return response.choices[0].message.content or ""


# Grounding system prompt with strict adherence instructions
GROUNDING_SYSTEM_PROMPT = """You are an expert AI code assistant analyzing a software repository.
Answer the user's question using ONLY the provided repository evidence.

Strict instructions:
1. Grounding: Answer ONLY from the supplied repository evidence. Do NOT invent files, functions, classes, dependencies, or behavior.
2. Insufficient Evidence: If the supplied evidence is insufficient to answer the question, explicitly state: "The available repository evidence is insufficient to answer this question."
3. Distinguish Observation vs. Inference: Distinguish directly observed code behavior from inference.
4. Citations: Cite claims using the supplied file path and line ranges in the format: [Source: <file_path>:<start_line>-<end_line>].
5. Do NOT cite sources that were not supplied."""


def validate_context(evidence: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Lightweight context validation step before LLM generation:
    - Removes duplicate evidence items based on (file_path, start_line, end_line)
    - Ensures source_code is non-empty
    - Ensures file_path, start_line, and end_line metadata are present
    - Preserves the ranker's ordering
    - Does not invent or reconstruct missing source
    """
    if not evidence:
        return []

    validated: List[Dict[str, Any]] = []
    seen_spans = set()

    for item in evidence:
        code = item.get("source_code")
        fp = item.get("file_path")
        start = item.get("start_line")
        end = item.get("end_line")

        # Validate required metadata and non-empty content
        if not code or not str(code).strip():
            continue
        if not fp or start is None or end is None:
            continue

        span_key = (fp, start, end)
        if span_key in seen_spans:
            continue
        seen_spans.add(span_key)

        validated.append(item)

    return validated


def format_evidence_prompt(evidence: List[Dict[str, Any]]) -> str:
    """
    Formats retrieved evidence items into explicit, clearly delineated evidence blocks.
    Example format:
    Evidence 1
    File: sample/core.py
    Symbol: hmm
    Type: FUNCTION
    Lines: 9-12
    Retrieval sources: semantic, structural

    <exact source code>
    """
    blocks = []
    for idx, item in enumerate(evidence, start=1):
        fp = item.get("file_path", "")
        sym = item.get("symbol_name", "")
        stype = item.get("symbol_type", "")
        start = item.get("start_line", "")
        end = item.get("end_line", "")
        sources = ", ".join(item.get("retrieval_sources", []))
        code = (item.get("source_code") or "").strip()

        block = (
            f"Evidence {idx}\n"
            f"File: {fp}\n"
            f"Symbol: {sym}\n"
            f"Type: {stype}\n"
            f"Lines: {start}-{end}\n"
            f"Retrieval sources: {sources}\n\n"
            f"{code}"
        )
        blocks.append(block)
    return "\n\n".join(blocks)


def extract_citations(text: str) -> List[str]:
    """
    Parses inline citations from generated text.
    Looks for patterns like: [Source: sample/core.py:9-12]
    Returns unique list of citation targets in order of appearance.
    Note: Parses citations only without claiming citation verification.
    """
    if not text:
        return []

    # Match [Source: <path>:<start>-<end>] or [Source: <path>]
    matches = re.findall(r"\[Source:\s*([^\]]+)\]", text)
    citations: List[str] = []
    seen = set()
    for m in matches:
        clean = m.strip()
        if clean and clean not in seen:
            seen.add(clean)
            citations.append(clean)
    return citations
