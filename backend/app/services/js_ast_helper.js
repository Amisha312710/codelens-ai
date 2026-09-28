/**
 * JavaScript / TypeScript AST Extraction Helper
 * Self-contained helper for CodeLens backend core-logic reconstruction.
 * Uses local backend @babel/parser to extract components, event handlers,
 * network calls (fetch/axios), and entrypoints.
 */

const fs = require('fs');
const path = require('path');

let parser;
try {
  // Prefer local backend node_modules
  const localParserPath = path.join(__dirname, '..', '..', 'node_modules', '@babel', 'parser');
  parser = require(localParserPath);
} catch (e) {
  try {
    parser = require('@babel/parser');
  } catch (err) {
    console.error(JSON.stringify({ error: 'unparseable_language', detail: 'Parser module not found' }));
    process.exit(1);
  }
}

function parseCode(sourceCode, filePath) {
  try {
    return parser.parse(sourceCode, {
      sourceType: 'module',
      plugins: [
        'jsx',
        'typescript',
        'asyncGenerators',
        'classProperties',
        'dynamicImport',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'objectRestSpread',
      ],
    });
  } catch (err) {
    return null;
  }
}

function extractJsFacts(sourceCode, filePath) {
  const ast = parseCode(sourceCode, filePath);
  if (!ast) {
    return { error: 'unparseable_language', components: [], event_handlers: [], api_calls: [], entrypoints: [] };
  }

  const components = [];
  const event_handlers = [];
  const api_calls = [];
  const entrypoints = [];
  const imports = [];

  function hasJsx(node) {
    let found = false;
    function walk(n) {
      if (!n || found) return;
      if (n.type && (n.type.startsWith('JSX') || n.type === 'JSXElement' || n.type === 'JSXFragment')) {
        found = true;
        return;
      }
      for (const key of Object.keys(n)) {
        if (key === 'loc' || key === 'range') continue;
        const val = n[key];
        if (Array.isArray(val)) {
          for (const item of val) {
            if (item && typeof item === 'object') walk(item);
          }
        } else if (val && typeof val === 'object') {
          walk(val);
        }
      }
    }
    walk(node);
    return found;
  }

  function getCallPath(node) {
    if (!node) return '';
    if (node.type === 'Identifier') return node.name;
    if (node.type === 'MemberExpression') {
      const obj = getCallPath(node.object);
      const prop = node.property.name || '';
      return obj ? `${obj}.${prop}` : prop;
    }
    return '';
  }

  function extractString(node) {
    if (!node) return null;
    if (node.type === 'StringLiteral' || node.type === 'Literal') return node.value;
    if (node.type === 'TemplateLiteral') {
      if (node.quasis && node.quasis.length > 0) {
        return node.quasis[0].value.raw;
      }
    }
    return null;
  }

  function traverse(node, currentScope = null) {
    if (!node || typeof node !== 'object') return;

    // 1. Imports
    if (node.type === 'ImportDeclaration') {
      const src = node.source ? node.source.value : '';
      for (const spec of node.specifiers || []) {
        imports.push({
          source: src,
          name: spec.local ? spec.local.name : '',
          start_line: node.loc ? node.loc.start.line : 1,
          end_line: node.loc ? node.loc.end.line : 1,
        });
      }
    }

    // 2. React Components & Functions
    let fnName = null;
    let fnNode = null;
    if (node.type === 'FunctionDeclaration') {
      fnName = node.id ? node.id.name : null;
      fnNode = node;
    } else if (node.type === 'VariableDeclarator' && node.init && (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression')) {
      fnName = node.id ? node.id.name : null;
      fnNode = node.init;
    }

    if (fnName && fnNode) {
      const isComponent = hasJsx(fnNode);
      if (isComponent) {
        components.push({
          name: fnName,
          start_line: fnNode.loc ? fnNode.loc.start.line : 1,
          end_line: fnNode.loc ? fnNode.loc.end.line : 1,
        });
      }
      currentScope = fnName;
    }

    // 3. JSX Event Handlers (<button onClick={handleSubmit}> or onChange={...})
    if (node.type === 'JSXAttribute' && node.name && typeof node.name.name === 'string') {
      const attrName = node.name.name;
      if (/^on[A-Z]/.test(attrName) && node.value && node.value.type === 'JSXExpressionContainer') {
        const expr = node.value.expression;
        let handlerName = null;
        if (expr.type === 'Identifier') {
          handlerName = expr.name;
        } else if (expr.type === 'MemberExpression') {
          handlerName = getCallPath(expr);
        } else if (expr.type === 'ArrowFunctionExpression' || expr.type === 'FunctionExpression') {
          handlerName = 'inline_handler';
        }

        if (handlerName) {
          event_handlers.push({
            event: attrName,
            handler: handlerName,
            component: currentScope || 'Component',
            start_line: node.loc ? node.loc.start.line : 1,
            end_line: node.loc ? node.loc.end.line : 1,
          });
        }
      }
    }

    // 4. API Calls: fetch(...) or axios.get/post(...)
    if (node.type === 'CallExpression') {
      const callPath = getCallPath(node.callee);
      const isFetch = callPath === 'fetch' || callPath.endsWith('.fetch');
      const isAxios = callPath.startsWith('axios') || callPath.includes('.axios') || ['api.get', 'api.post', 'client.get', 'client.post'].includes(callPath);

      if (isFetch || isAxios) {
        let endpoint = null;
        let method = 'GET';

        if (isFetch) {
          const arg0 = node.arguments[0];
          endpoint = extractString(arg0);
          const arg1 = node.arguments[1];
          if (arg1 && arg1.type === 'ObjectExpression') {
            for (const prop of arg1.properties || []) {
              if (prop.key && (prop.key.name === 'method' || prop.key.value === 'method')) {
                const methVal = extractString(prop.value);
                if (methVal) method = methVal.toUpperCase();
              }
            }
          }
        } else if (isAxios) {
          if (callPath.endsWith('.post')) method = 'POST';
          else if (callPath.endsWith('.put')) method = 'PUT';
          else if (callPath.endsWith('.delete')) method = 'DELETE';
          else if (callPath.endsWith('.patch')) method = 'PATCH';
          else method = 'GET';

          const arg0 = node.arguments[0];
          endpoint = extractString(arg0);
        }

        if (endpoint) {
          api_calls.push({
            caller: currentScope || 'global',
            endpoint: endpoint,
            method: method,
            client: isFetch ? 'fetch' : 'axios',
            start_line: node.loc ? node.loc.start.line : 1,
            end_line: node.loc ? node.loc.end.line : 1,
          });
        }
      }

      // 5. Entrypoints: createRoot or ReactDOM.render
      if (callPath.includes('createRoot') || callPath.includes('ReactDOM.render')) {
        entrypoints.push({
          type: 'frontend_root',
          symbol: callPath,
          start_line: node.loc ? node.loc.start.line : 1,
          end_line: node.loc ? node.loc.end.line : 1,
        });
      }
    }

    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'range') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object') traverse(item, currentScope);
        }
      } else if (child && typeof child === 'object') {
        traverse(child, currentScope);
      }
    }
  }

  traverse(ast);

  return {
    components,
    event_handlers,
    api_calls,
    entrypoints,
    imports,
  };
}

// CLI Execution Interface
if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error(JSON.stringify({ error: 'no_input_file' }));
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = extractJsFacts(content, filePath);
    console.log(JSON.stringify(result));
  } catch (err) {
    console.error(JSON.stringify({ error: 'unparseable_language', detail: err.message }));
    process.exit(1);
  }
}

module.exports = { extractJsFacts };
