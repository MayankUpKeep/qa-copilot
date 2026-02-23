import fs from "fs";
import path from "path";

const DEFAULT_WEB_APP_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx"];
const DEFAULT_CORE_EXTENSIONS = [".js", ".ts"];

/**
 * Recursively get all files under dir matching extensions. Skips node_modules, .git, build, dist.
 */
function listSourceFiles(dir, extensions, baseDir = dir) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  const result = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(baseDir, full);
    if (e.name === "node_modules" || e.name === ".git" || e.name === "build" || e.name === "dist" || e.name === ".next") continue;
    if (e.isDirectory()) {
      result.push(...listSourceFiles(full, extensions, baseDir));
    } else if (extensions.some((ext) => e.name.endsWith(ext))) {
      result.push(full);
    }
  }
  return result;
}

/**
 * Extract route paths from React app source.
 * Supports: createBrowserRouter([{ path: "/" }]), <Route path="/x" />, path: "/foo", path: 'bar'
 */
function extractRoutesFromContent(content, filePath) {
  const routes = new Set();
  // path: "/something" or path: '/something' or path: "something" (relative)
  const pathLiteral = /path:\s*["']([^"']+)["']/g;
  let m;
  while ((m = pathLiteral.exec(content)) !== null) {
    const p = m[1].trim();
    if (p && p !== "*") routes.add(p.startsWith("/") ? p : "/" + p);
  }
  // <Route path="/something" /> or <Route path='/something' />
  const routeElement = /<Route\s+[^>]*path=["']([^"']+)["']/g;
  while ((m = routeElement.exec(content)) !== null) {
    const p = m[1].trim();
    if (p && p !== "*") routes.add(p.startsWith("/") ? p : "/" + p);
  }
  return Array.from(routes);
}

/**
 * Extract API endpoint paths from frontend code (fetch, axios, api.get, etc.).
 * Returns normalized paths like /api/users, /v1/orgs.
 */
function extractApiCallsFromContent(content) {
  const endpoints = new Set();
  // fetch("/api/...") or fetch(`/api/...`) or fetch(base + "/api/...")
  const fetchCall = /fetch\s*\(\s*["'`]([^"'`]+)["'`]|fetch\s*\(\s*[^)]*\/["'`]([^"'`]*\/[^"'`]+)["'`]/g;
  let m;
  while ((m = fetchCall.exec(content)) !== null) {
    const p = (m[1] || m[2] || "").replace(/\$\{[^}]+\}/g, "").trim();
    if (p && (p.startsWith("/") || p.includes("/api") || p.includes("/v"))) {
      const pathPart = p.startsWith("http") ? new URL(p).pathname : p.split("?")[0];
      if (pathPart) endpoints.add(pathPart);
    }
  }
  // axios.get("/api/..."), api.get("/api/..."), request("GET", "/api/...")
  const methodCall = /\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/gi;
  while ((m = methodCall.exec(content)) !== null) {
    const p = (m[2] || "").split("?")[0].trim();
    if (p && (p.startsWith("/") || p.includes("api") || p.includes("/v"))) endpoints.add(p.startsWith("/") ? p : "/" + p);
  }
  // "/api/..." or '/api/...' as standalone string (common in constants)
  const urlLiteral = /["'](\/(?:api|v\d+)[^"'`]*)["'`]/g;
  while ((m = urlLiteral.exec(content)) !== null) {
    const p = (m[1] || "").split("?")[0].trim();
    if (p) endpoints.add(p);
  }
  return Array.from(endpoints);
}

/**
 * Scan React web-app directory for routes and API usage.
 * @param {string} rootPath - Absolute path to web-app repo
 * @returns {{ routes: string[], endpoints: string[], routeToEndpoints: Record<string, string[] } | null }}
 */
function scanWebApp(rootPath) {
  const resolved = path.resolve(rootPath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    return { routes: [], endpoints: [], routeToEndpoints: null, error: "Web app path does not exist or is not a directory." };
  }
  const files = listSourceFiles(resolved, DEFAULT_WEB_APP_EXTENSIONS);
  const allRoutes = new Set();
  const allEndpoints = new Set();
  const routeToEndpoints = {}; // path -> list of endpoints (best-effort by file)

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const routes = extractRoutesFromContent(content, file);
    const endpoints = extractApiCallsFromContent(content);
    routes.forEach((r) => allRoutes.add(r));
    endpoints.forEach((e) => allEndpoints.add(e));
    if (routes.length && endpoints.length) {
      routes.forEach((r) => {
        if (!routeToEndpoints[r]) routeToEndpoints[r] = [];
        endpoints.forEach((e) => {
          if (!routeToEndpoints[r].includes(e)) routeToEndpoints[r].push(e);
        });
      });
    }
  }

  return {
    routes: Array.from(allRoutes).sort(),
    endpoints: Array.from(allEndpoints).sort(),
    routeToEndpoints: Object.keys(routeToEndpoints).length ? routeToEndpoints : null,
  };
}

/**
 * Extract HTTP endpoints from backend source (Express, Fastify, or path-like strings).
 */
function extractEndpointsFromContent(content) {
  const endpoints = new Set();
  // Express: app.get("/api/..."), router.post('/api/...'), this.get('/api/...')
  const expressRoute = /(?:app|router|this)\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/g;
  let m;
  while ((m = expressRoute.exec(content)) !== null) {
    const method = (m[1] || "").toUpperCase();
    const p = (m[2] || "").split("?")[0].trim();
    if (p) endpoints.add(`${method} ${p.startsWith("/") ? p : "/" + p}`);
  }
  // Fastify: fastify.get("/api/...")
  const fastifyRoute = /fastify\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/g;
  while ((m = fastifyRoute.exec(content)) !== null) {
    const method = (m[1] || "").toUpperCase();
    const p = (m[2] || "").split("?")[0].trim();
    if (p) endpoints.add(`${method} ${p.startsWith("/") ? p : "/" + p}`);
  }
  // NestJS-style: @Get(), @Post('path'), @Controller('prefix')
  const nestMethod = /@(Get|Post|Put|Patch|Delete)\s*\(\s*["'`]?([^"'`)]*)["'`]?\s*\)/g;
  while ((m = nestMethod.exec(content)) !== null) {
    const method = (m[1] || "").toUpperCase();
    const p = (m[2] || "").trim() || "/";
    endpoints.add(`${method} ${p.startsWith("/") ? p : "/" + p}`);
  }
  const nestController = /@Controller\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
  const controllerPaths = [];
  while ((m = nestController.exec(content)) !== null) controllerPaths.push((m[1] || "").trim());
  if (controllerPaths.length) {
    nestMethod.lastIndex = 0;
    while ((m = nestMethod.exec(content)) !== null) {
      const method = (m[1] || "").toUpperCase();
      const subPath = (m[2] || "").trim() || "";
      const fullPath = controllerPaths[controllerPaths.length - 1] + (subPath.startsWith("/") ? subPath : "/" + subPath);
      endpoints.add(`${method} ${fullPath}`);
    }
  }
  return Array.from(endpoints);
}

/**
 * Parse OpenAPI paths if present.
 */
function parseOpenApiPaths(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const endpoints = new Set();
  let obj;
  try {
    obj = JSON.parse(content);
  } catch {
    return [];
  }
  const paths = obj.paths || {};
  for (const [route, methods] of Object.entries(paths)) {
    if (typeof methods !== "object") continue;
    for (const method of Object.keys(methods)) {
      if (["get", "post", "put", "patch", "delete"].includes(method.toLowerCase())) {
        endpoints.add(`${method.toUpperCase()} ${route}`);
      }
    }
  }
  return Array.from(endpoints);
}

/**
 * Scan core-service directory for API endpoints and optional module names.
 * @param {string} rootPath - Absolute path to core-service repo
 * @returns {{ endpoints: string[], modules: string[], error?: string }}
 */
function scanCoreService(rootPath) {
  const resolved = path.resolve(rootPath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    return { endpoints: [], modules: [], error: "Core-service path does not exist or is not a directory." };
  }
  const allEndpoints = new Set();
  const modules = new Set();

  const openApiPaths = ["openapi.json", "swagger.json", "openapi.yaml"];
  for (const name of openApiPaths) {
    const jsonPath = path.join(resolved, name);
    if (fs.existsSync(jsonPath) && name.endsWith(".json")) {
      parseOpenApiPaths(jsonPath).forEach((e) => allEndpoints.add(e));
    }
  }

  const files = listSourceFiles(resolved, DEFAULT_CORE_EXTENSIONS);
  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    extractEndpointsFromContent(content).forEach((e) => allEndpoints.add(e));
    const rel = path.relative(resolved, file);
    const dir = path.dirname(rel);
    if (dir && dir !== "." && !dir.includes("node_modules")) {
      const topDir = dir.split(path.sep)[0];
      if (topDir && !/^\d/.test(topDir)) modules.add(topDir);
    }
  }

  return {
    endpoints: Array.from(allEndpoints).sort(),
    modules: Array.from(modules).sort(),
  };
}

/**
 * Build app context from web-app and core-service paths (env or explicit).
 * @param {{ webAppPath?: string | null, coreServicePath?: string | null }} options
 * @returns App context for regression prompt
 */
function getAppContext(options = {}) {
  const webAppPath = options.webAppPath || process.env.WEB_APP_PATH || null;
  const coreServicePath = options.coreServicePath || process.env.CORE_SERVICE_PATH || null;

  const web = webAppPath ? scanWebApp(webAppPath) : { routes: [], endpoints: [], routeToEndpoints: null };
  const core = coreServicePath ? scanCoreService(coreServicePath) : { endpoints: [], modules: [] };

  const routes = web.routes || [];
  const webEndpoints = web.endpoints || [];
  const coreEndpoints = core.endpoints || [];
  const modules = core.modules || [];
  const routeToEndpoints = web.routeToEndpoints || null;

  return {
    webAppPath: webAppPath || undefined,
    coreServicePath: coreServicePath || undefined,
    routes,
    webEndpoints,
    coreEndpoints,
    modules,
    routeToEndpoints,
    errors: [web.error, core.error].filter(Boolean),
  };
}

/**
 * Format app context into a string block for the regression prompt.
 */
function formatAppContextForPrompt(appContext) {
  if (!appContext || (!appContext.routes?.length && !appContext.coreEndpoints?.length && !appContext.webEndpoints?.length)) {
    return "";
  }
  const lines = ["\n--- Application map (use this to ground regression areas; only suggest areas that appear below) ---\n"];
  if (appContext.routes?.length) {
    lines.push("Frontend routes (pages/screens):");
    lines.push(appContext.routes.map((r) => `- ${r}`).join("\n"));
    lines.push("");
  }
  if (appContext.webEndpoints?.length) {
    lines.push("API calls from frontend:");
    lines.push(appContext.webEndpoints.slice(0, 80).map((e) => `- ${e}`).join("\n"));
    if (appContext.webEndpoints.length > 80) lines.push(`... and ${appContext.webEndpoints.length - 80} more`);
    lines.push("");
  }
  if (appContext.coreEndpoints?.length) {
    lines.push("Backend endpoints (core-service):");
    lines.push(appContext.coreEndpoints.slice(0, 100).map((e) => `- ${e}`).join("\n"));
    if (appContext.coreEndpoints.length > 100) lines.push(`... and ${appContext.coreEndpoints.length - 100} more`);
    lines.push("");
  }
  if (appContext.modules?.length) {
    lines.push("Backend modules/areas:");
    lines.push(appContext.modules.map((m) => `- ${m}`).join("\n"));
  }
  lines.push("\n--- End of application map ---\n");
  return lines.join("\n");
}

export {
  scanWebApp,
  scanCoreService,
  getAppContext,
  formatAppContextForPrompt,
  listSourceFiles,
};
