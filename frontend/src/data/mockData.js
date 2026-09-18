/**
 * CodeLens AI - Mock Data
 * Minimal placeholder repository and feature data matching Stitch design reference.
 */

export const mockRepository = {
  name: 'fastapi/fastapi',
  branch: 'main',
  revision: '4a8df2c',
  version: 'v0.110.0',
  description: 'FastAPI framework, high performance, easy to learn, fast to code, ready for production',
  filesCount: 14,
  functionsCount: 63,
  dependenciesCount: 7,
};

export const mockAnalysis = {
  status: 'Analyzing repository',
  progress: 68,
  currentTask: 'Parsing AST and dependency graph',
  steps: [
    { id: 'repo', label: 'Reading repo', status: 'completed' },
    { id: 'structure', label: 'Structure', status: 'completed' },
    { id: 'deps', label: 'Mapping deps', status: 'active' },
    { id: 'ai', label: 'AI search', status: 'pending' },
  ],
};

export const mockArchitectureNodes = [
  { id: 'api', label: 'API', path: 'fastapi/applications', type: 'entry' },
  { id: 'routing', label: 'Routing', path: 'fastapi/routing', type: 'router' },
  { id: 'security', label: 'Security & Auth', path: 'fastapi/security', type: 'security', selected: true },
  { id: 'services', label: 'Services', path: 'fastapi/services', type: 'service' },
  { id: 'dependencies', label: 'Dependencies', path: 'fastapi/dependencies', type: 'dep' },
  { id: 'models', label: 'Models', path: 'fastapi/models', type: 'data' },
  { id: 'utils', label: 'Utils', path: 'fastapi/utils', type: 'utility' },
  { id: 'database', label: 'Database', path: 'fastapi/database', type: 'db' },
];

export const mockAISuggestions = [
  'How does authentication work?',
  'Where is the database connection created?',
  'What happens when a request enters the API?',
  'Which modules depend on routing?',
];

export const mockFlow = {
  endpoint: 'POST /login',
  sourceFile: 'auth/service.py',
  lineRange: 'L42-58',
  steps: [
    { id: 'entry', badge: 'ENTRY', name: 'POST /login', loc: 'routing.py L104-120' },
    { id: 'handler', badge: 'HANDLER', name: 'login()', loc: 'auth.py L42-58' },
    { id: 'logic', badge: 'AUTH LOGIC', name: 'authenticate_user()', loc: 'auth/service.py L42-58', selected: true },
    { id: 'audit', badge: 'CRYPTO AUDIT', name: 'verify_password()', loc: 'security.py L86-101' },
  ],
};

export const mockWalkthroughScenes = [
  { id: 1, name: 'System Architecture Overview', description: 'High-level top-down diagram of FastAPI core structure' },
  { id: 2, name: 'Request Lifecycle & Routing', description: 'Trace incoming HTTP packet through Starlette routing pipeline' },
  { id: 3, name: 'Authentication & Token Verification', description: 'OAuth2 password bearer dependency injection flow' },
  { id: 4, name: 'Database Persistence Layer', description: 'Connection pooling and asynchronous session execution' },
];
