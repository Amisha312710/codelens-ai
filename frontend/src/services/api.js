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
 * Placeholder for fetching repository file source content
 * @param {string} repoId - Repository identifier
 * @param {string} filePath - Path to file within repository
 */
export async function getFile(repoId, filePath) {
  throw new Error(`getFile not implemented yet. Backend integration will occur in Milestone 3+. File: ${filePath}`);
}

/**
 * Placeholder for tracing execution flows
 * @param {string} repoId - Repository identifier
 * @param {string} entryPoint - Endpoint or function identifier
 */
export async function traceFlow(repoId, entryPoint) {
  throw new Error(`traceFlow not implemented yet. Backend integration will occur in Milestone 5+. Entry: ${entryPoint}`);
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
  analyzeRepository,
  getRepository,
  askQuestion,
  getFile,
  traceFlow,
  generateWalkthrough,
};
