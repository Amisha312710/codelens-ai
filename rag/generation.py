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

        try:
            response = client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            print(
                f"[OpenAIProvider Error] Class: {type(e).__name__} | "
                f"Model: {self.model} | "
                f"Detail: {str(e)}",
                flush=True,
            )
            raise


class GroqProvider(LLMProvider):
    """
    Groq LLM provider implementation using the official Groq Python SDK.
    Relies on GROQ_API_KEY and GROQ_MODEL environment variables or explicit parameters.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.0,
    ):
        self.api_key = api_key or os.environ.get("GROQ_API_KEY")
        self.model = model or os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
        self.temperature = temperature

    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        if not self.api_key:
            raise ValueError("GROQ_API_KEY environment variable is not configured.")

        try:
            from groq import Groq
        except ImportError:
            raise RuntimeError(
                "The groq package is required for GroqProvider. Install it via pip install groq."
            )

        client = Groq(api_key=self.api_key)

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        try:
            response = client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            # Safe local development diagnostic logging without secrets
            print(
                f"[GroqProvider Error] Class: {type(e).__name__} | "
                f"Model: {self.model} | "
                f"Detail: {str(e)}",
                flush=True,
            )
            raise


# Grounding system prompt with strict adherence instructions
GROUNDING_SYSTEM_PROMPT = """You are an expert AI code assistant analyzing a software repository.
Answer the user's question using ONLY the provided repository evidence.

Strict instructions:
1. Grounding: Answer ONLY from the supplied repository evidence. Do NOT invent files, functions, classes, dependencies, or behavior.
2. Insufficient Evidence: If the supplied evidence is insufficient to answer the question, explicitly state: "I couldn't find enough evidence in this repository to answer that confidently."
3. Distinguish Observation vs. Inference: Distinguish directly observed code behavior from inference.
4. Citations: Cite claims using the supplied file path and line ranges in the format: [Source: <file_path>:<start_line>-<end_line>].
5. Do NOT cite sources that were not supplied."""

VALID_EXPLANATION_MODES = {"beginner", "developer", "interview"}

MODE_INSTRUCTIONS = {
    "beginner": """EXPLANATION MODE: BEGINNER
- Explain concepts in simple, everyday language.
- Use intuitive real-world analogies where helpful (e.g. comparing FAISS to a smart librarian, an auth route to a security checkpoint, or a module to a toolkit). Connect analogies back to the actual repository code.
- Human-First Structure:
  1. What is happening?
  2. Why does this matter?
  3. How does the code implement it?
- Ground every factual statement in the supplied repository evidence with inline citations.""",

    "developer": """EXPLANATION MODE: DEVELOPER
- Use precise technical terminology.
- Clearly explain functions, classes, data flow, dependencies, algorithms, and implementation decisions using exact repository evidence.
- Human-First Structure:
  1. What is happening?
  2. Why does this matter?
  3. How does the code implement it?
- Ground every factual statement in the supplied repository evidence with inline citations.""",

    "interview": """EXPLANATION MODE: INTERVIEW
- Structure the response so a candidate can explain this codebase in a technical interview:
  1. What problem this solves
  2. How it works
  3. Important components & data flow
  4. Why this approach is used
  5. Relevant implementation & code evidence
  6. Possible trade-offs (only when supported by evidence or clearly marked as general reasoning)
- Ground every factual statement in the supplied repository evidence with inline citations."""
}


def build_system_prompt(explanation_mode: str = "beginner") -> str:
    """
    Constructs the system prompt combining grounding instructions, human-first progression,
    strict evidence separation, and the requested explanation mode.
    """
    mode_key = (explanation_mode or "beginner").lower().strip()
    mode_text = MODE_INSTRUCTIONS.get(mode_key, MODE_INSTRUCTIONS["beginner"])

    return f"""You are an expert AI code assistant analyzing a software repository.
Answer the user's question using ONLY the provided repository evidence.

Strict instructions:
1. Grounding: Answer ONLY from the supplied repository evidence. Do NOT invent files, functions, classes, dependencies, or behavior.
2. Insufficient Evidence: If the supplied evidence is insufficient to answer the question, explicitly state: "I couldn't find enough evidence in this repository to answer that confidently."
3. Distinguish Observation vs. Inference: Distinguish directly observed code behavior from inference.
4. Citations: Cite claims using the supplied file path and line ranges in the format: [Source: <file_path>:<start_line>-<end_line>].
5. Do NOT cite sources that were not supplied.
6. Strict Evidence Separation: Recent conversation history is provided ONLY to resolve references in follow-up questions (such as pronouns or prior topics). Conversation history is NOT repository evidence and must never be cited as source code. The Supplied Repository Evidence is the ONLY authority for codebase claims.

{mode_text}"""


def format_conversation_history(conversation: Optional[List[Dict[str, str]]], max_messages: int = 6) -> str:
    """
    Formats bounded recent conversation turns for context in follow-up queries.
    Defensively caps history to the last `max_messages` (default 6).
    """
    if not conversation:
        return ""

    bounded = conversation[-max_messages:]
    lines = [
        "--- RECENT CONVERSATION CONTEXT (For reference only; NOT repository evidence) ---"
    ]
    for msg in bounded:
        role = (msg.get("role") or "user").capitalize()
        content = (msg.get("content") or "").strip()
        lines.append(f"{role}: {content}")
    lines.append("-------------------------------------------------------------------------")
    return "\n".join(lines)


def build_contextual_query(question: str, conversation: Optional[List[Dict[str, str]]] = None) -> str:
    """
    Deterministically creates a lightweight contextual search query combining the current question
    with immediately relevant recent conversation context without calling a secondary LLM.
    """
    clean_q = (question or "").strip()
    if not conversation:
        return clean_q

    # Find the most recent user turn before this question
    last_user_turn = None
    for msg in reversed(conversation):
        if (msg.get("role") or "").lower() == "user":
            content = (msg.get("content") or "").strip()
            if content and content != clean_q:
                last_user_turn = content
                break

    if last_user_turn:
        return f"{last_user_turn} {clean_q}"
    return clean_q


def generate_followup_suggestions(question: str, evidence: List[Dict[str, Any]]) -> List[str]:
    """
    Deterministically generates 2-3 concise follow-up suggestions from retrieved evidence
    and the user query without making an LLM call.
    """
    suggestions: List[str] = []
    seen: set = set()

    clean_q = (question or "").lower()

    def add_suggestion(s: str):
        s_clean = s.strip()
        if s_clean and s_clean not in seen and s_clean.lower() not in clean_q:
            seen.add(s_clean)
            suggestions.append(s_clean)

    # Inspect functions and classes in retrieved evidence
    functions = []
    classes = []
    for item in evidence or []:
        sym = item.get("symbol_name") or ""
        fp = item.get("file_path") or ""
        stype = (item.get("symbol_type") or "").upper()

        if sym and sym != fp:
            if stype in ("FUNCTION", "METHOD") and sym not in functions:
                functions.append(sym)
            elif stype == "CLASS" and sym not in classes:
                classes.append(sym)

    # 1. Function-specific suggestions
    for fn in functions[:2]:
        add_suggestion(f"Where is {fn}() called?")
        add_suggestion(f"What does {fn}() return?")

    # 2. Class-specific suggestions
    for cls in classes[:1]:
        add_suggestion(f"What is {cls} responsible for?")

    # 3. Flow and architectural suggestions
    general_pool = [
        "Why is this approach used?",
        "What happens next in this flow?",
        "What happens if this step fails?",
        "Where is this tested in the codebase?",
    ]
    for gen in general_pool:
        if len(suggestions) >= 3:
            break
        add_suggestion(gen)

    return suggestions[:3]


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

    matches = re.findall(r"\[Source:\s*([^\]]+)\]", text)
    citations: List[str] = []
    seen = set()
    for m in matches:
        clean = m.strip("`'\" \t\r\n")
        if clean and clean not in seen:
            seen.add(clean)
            citations.append(clean)
    return citations
