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
 * Fetches the evidence-grounded Visual Walkthrough from the backend API
 * @param {string} repoUrl - Public GitHub repository URL
 * @returns {Promise<{repository_url: string, project_title: string, project_summary: string, overview_flow: Array<string>, walkthroughs: Array}>}
 */
export async function getWalkthrough(repoUrl, options = {}) {
  const response = await fetch(`${API_BASE_URL}/walkthroughs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: repoUrl }),
    signal: options.signal,
  });

  if (!response.ok) {
    let errorDetail = `Walkthrough request failed with status ${response.status}`;
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
 * Explores a repository to find feature implementations and assess change impact.
 * Connects to POST /api/analysis/explore.
 * @param {string} repoUrl - Public GitHub repository URL
 * @param {string} query - Natural language search query or symbol/file name
 * @param {string} [selectedNodeId] - Optional node id for direct impact computation
 * @returns {Promise<{repository_url: string, query: string, found_in: object, selected_impact: object, compact_subgraph: object}>}
 */
export async function exploreCodebase(repoUrl, query, selectedNodeId = null) {
  const response = await fetch(`${API_BASE_URL}/analysis/explore`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: repoUrl,
      query,
      selected_node_id: selectedNodeId,
    }),
  });

  if (!response.ok) {
    let errorDetail = `Explore request failed with status ${response.status}`;
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

export const ACTIVE_REPO_STORAGE_KEY = 'codelens_active_repo';

/**
 * Retrieve the active repository URL from localStorage.
 * @returns {string} Trimmed repository URL or empty string
 */
export function getActiveRepoUrl() {
  try {
    return (localStorage.getItem(ACTIVE_REPO_STORAGE_KEY) || '').trim();
  } catch (_) {
    return '';
  }
}

/**
 * Persist the active repository URL to localStorage and notify mounted components.
 * @param {string} url - Repository URL
 * @returns {string} Normalized repository URL
 */
export function setActiveRepoUrl(url) {
  const clean = (url || '').trim();
  try {
    if (clean) {
      localStorage.setItem(ACTIVE_REPO_STORAGE_KEY, clean);
    } else {
      localStorage.removeItem(ACTIVE_REPO_STORAGE_KEY);
    }
  } catch (_) {
    // Ignore storage quota / privacy mode exceptions
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('codelens-repo-change', { detail: { repoUrl: clean } })
    );
  }

  return clean;
}

/**
 * Clear the active repository from persistent storage.
 */
export function clearActiveRepoUrl() {
  return setActiveRepoUrl('');
}

/**
 * Resolves the active repository URL for a page using a single source of truth:
 * 1. Explicit location state (e.g. location.state?.repoUrl)
 * 2. URL query param (e.g. ?repo=...)
 * 3. localStorage (fallback and persistent source)
 *
 * If explicit input is found in the route or URL, localStorage is synchronized.
 *
 * @param {object} [location] - React Router location object
 * @returns {string} Active repository URL
 */
export function resolveRepoUrl(location) {
  let explicit = '';
  if (location?.state?.repoUrl && typeof location.state.repoUrl === 'string') {
    explicit = location.state.repoUrl.trim();
  } else if (location?.state?.graphData?.repository_url && typeof location.state.graphData.repository_url === 'string') {
    explicit = location.state.graphData.repository_url.trim();
  } else if (typeof location?.search === 'string' && location.search) {
    try {
      const param = new URLSearchParams(location.search).get('repo');
      if (param) explicit = param.trim();
    } catch (_) {}
  }

  if (explicit) {
    // Synchronize to localStorage if different from current stored value
    const current = getActiveRepoUrl();
    if (explicit !== current) {
      setActiveRepoUrl(explicit);
    }
    return explicit;
  }

  return getActiveRepoUrl();
}

/**
 * Backward-compatible alias for getWalkthrough
 */
export async function generateWalkthrough(repoUrl) {
  return getWalkthrough(repoUrl);
}

export default {
  API_BASE_URL,
  ACTIVE_REPO_STORAGE_KEY,
  getActiveRepoUrl,
  setActiveRepoUrl,
  clearActiveRepoUrl,
  resolveRepoUrl,
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
  getWalkthrough,
  generateWalkthrough,
  exploreCodebase,
};


