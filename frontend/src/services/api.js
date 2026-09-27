/**
 * CodeLens AI - API Service Skeleton
 * 
 * Establishes the boundary between the frontend application and backend API.
 * Configurable via environment variable VITE_API_BASE_URL.
 * Future integration will connect to actual backend endpoints.
 */

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

/**
 * Fetches the real architecture graph from the backend API
 * @param {string} repoUrl - Public GitHub repository URL
 * @returns {Promise<object>} Architecture graph data with nodes and edges
 */
export async function getArchitectureGraph(repoUrl) {
  const response = await fetch(`${API_BASE_URL}/analysis/graph`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: repoUrl }),
  });

  if (!response.ok) {
    let errorDetail = `Analysis request failed with status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson.detail) {
        errorDetail = errorJson.detail;
      }
    } catch (_) {
      // Ignore JSON parse errors
    }
    throw new Error(errorDetail);
  }

  return await response.json();
}

/**
 * Fetches the human-first project overview from the backend API
 * @param {string} repoUrl - Public GitHub repository URL
 * @returns {Promise<object>} Project overview data
 */
export async function getProjectOverview(repoUrl) {
  const response = await fetch(`${API_BASE_URL}/analysis/overview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: repoUrl }),
  });

  if (!response.ok) {
    let errorDetail = `Project overview request failed with status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson.detail) {
        errorDetail = errorJson.detail;
      }
    } catch (_) {
      // Ignore JSON parse errors
    }
    throw new Error(errorDetail);
  }

  return await response.json();
}

/**
 * Placeholder for repository analysis trigger
 * @param {string} repoUrl - Repository GitHub URL or identifier
 */
export async function analyzeRepository(repoUrl) {
  return getArchitectureGraph(repoUrl);
}

/**
 * Placeholder for retrieving repository analysis metadata
 * @param {string} repoId - Repository identifier
 */
export async function getRepository(repoId) {
  throw new Error(`getRepository not implemented yet. Backend integration will occur in Milestone 2+. Repo: ${repoId}`);
}

/**
 * Placeholder for submitting codebase questions to AI
 * @param {string} repoId - Repository identifier
 * @param {string} question - Developer question
 */
export async function askQuestion(repoId, question) {
  throw new Error(`askQuestion not implemented yet. Backend integration will occur in Milestone 4+. Query: "${question}"`);
}

/**
 * Asks a grounded architectural question about a repository codebase.
 * Connects to POST /api/search/ask using the backend AskRequest schema.
 * @param {string} repoUrl - Public GitHub repository URL
 * @param {string} question - Developer question
 * @param {number} [topK=5] - Maximum evidence items to retrieve
 * @param {string} [explanationMode='beginner'] - Explanation mode ('beginner', 'developer', 'interview')
 * @param {Array<{role: string, content: string}>} [conversation=[]] - Recent conversation history
 * @returns {Promise<{question: string, answer: string, citations: string[], evidence_used: object[], explanation_mode: string, suggested_followups: string[]}>}
 */
export async function askRepository(
  repoUrl,
  question,
  topK = 5,
  explanationMode = 'beginner',
  conversation = []
) {
  const boundedConversation = (conversation || [])
    .slice(-6)
    .map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

  const response = await fetch(`${API_BASE_URL}/search/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: repoUrl,
      question,
      top_k: topK,
      explanation_mode: explanationMode,
      conversation: boundedConversation,
    }),
  });

  if (!response.ok) {
    let errorDetail = `Ask request failed with status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson.detail) {
        errorDetail = errorJson.detail;
      }
    } catch (_) {
      // Ignore JSON parse errors
    }
    throw new Error(errorDetail);
  }

  return await response.json();
}

/**
 * Safely retrieves source code for a specific repository file
 * @param {string} repoUrl - Public GitHub repository URL
 * @param {string} filePath - Relative file path within repository
 * @param {number} [startLine] - Optional start line for highlighting
 * @param {number} [endLine] - Optional end line for highlighting
 * @returns {Promise<{file_path: string, language: string, source_code: string, start_line?: number, end_line?: number}>}
 */
export async function getSourceCode(repoUrl, filePath, startLine, endLine) {
  const response = await fetch(`${API_BASE_URL}/analysis/source`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: repoUrl,
      file_path: filePath,
      start_line: startLine,
      end_line: endLine,
    }),
  });

  if (!response.ok) {
    let errorDetail = `Source retrieval failed with status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson.detail) {
        errorDetail = errorJson.detail;
      }
    } catch (_) {
      // Ignore JSON parse errors
    }
    throw new Error(errorDetail);
  }

  return await response.json();
}

/**
 * Repository file source content retriever
 * @param {string} repoId - Repository identifier or URL
 * @param {string} filePath - Path to file within repository
 */
export async function getFile(repoId, filePath) {
  return getSourceCode(repoId, filePath);
}

/**
 * Traces the static function call flow starting from a root function up to maxDepth (1-3).
 * @param {string} repoUrl - Public GitHub repository URL
 * @param {string} rootFunction - Root function name or identifier
 * @param {number} [maxDepth=3] - Call depth to trace (strictly 1–3, default 3)
 * @returns {Promise<{repository_url: string, root_function: string, nodes: Array, edges: Array, total_nodes: number, total_edges: number}>}
 */
export async function traceFlow(repoUrl, rootFunction, maxDepth = 3) {
  const depth = Math.min(Math.max(1, parseInt(maxDepth, 10) || 3), 3);
  const response = await fetch(`${API_BASE_URL}/flows`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: repoUrl,
      root_function: rootFunction,
      max_depth: depth,
    }),
  });

  if (!response.ok) {
    let errorDetail = `Flow tracing failed with status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson.detail) {
        errorDetail = errorJson.detail;
      }
    } catch (_) {
      // Ignore JSON parse errors
    }
    throw new Error(errorDetail);
  }

  return await response.json();
}

/**
 * Retrieves the list of functions in the repository for the Code Flow selector
 * @param {string} repoUrl - Public GitHub repository URL
 * @returns {Promise<{repository_url: string, functions: Array}>}
 */
export async function getFlowFunctions(repoUrl) {
  const response = await fetch(`${API_BASE_URL}/flows/functions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: repoUrl }),
  });

  if (!response.ok) {
    let errorDetail = `Failed to list functions with status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson.detail) {
        errorDetail = errorJson.detail;
      }
    } catch (_) {
      // Ignore JSON parse errors
    }
    throw new Error(errorDetail);
  }

  return await response.json();
}

/**
 * Placeholder for generating developer video/scene walkthroughs
 * @param {string} repoId - Repository identifier
 * @param {object} options - Walkthrough generation configuration options
 */
export async function generateWalkthrough(repoId, options = {}) {
  throw new Error('generateWalkthrough not implemented yet. Backend integration will occur in Milestone 6+.');
}

export default {
  API_BASE_URL,
  getArchitectureGraph,
  getProjectOverview,
  getSourceCode,
  analyzeRepository,
  getRepository,
  askQuestion,
  askRepository,
  getFile,
  traceFlow,
  getFlowFunctions,
  generateWalkthrough,
};
