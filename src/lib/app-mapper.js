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
 * Expand regex-style route params into clean readable routes.
 * e.g. "/providers/:display(list|network)" → ["/providers/list", "/providers/network"]
 * e.g. "/:entity(vendors|customers)/:display(list)" → ["/vendors/list", "/customers/list"]
 * e.g. "/providers/:providerId/:currentTab" → ["/providers/:providerId/:currentTab"]
 */
function expandRoute(route) {
  const paramWithOptions = /:(\w+)\(([^)]+)\)/g;
  if (!paramWithOptions.test(route)) return [route];

  paramWithOptions.lastIndex = 0;
  let segments = [route];
  let match;
  while ((match = paramWithOptions.exec(route)) !== null) {
    const fullMatch = match[0];
    const options = match[2].split("|").map((o) => o.trim());
    const expanded = [];
    for (const seg of segments) {
      for (const opt of options) {
        expanded.push(seg.replace(fullMatch, opt));
      }
    }
    segments = expanded;
  }
  return segments;
}

/**
 * Simplify named route params for readability.
 * e.g. "/providers/:providerId/:currentTab" → "/providers/{providerId}/{currentTab}"
 */
function cleanRouteParams(route) {
  return route.replace(/:([a-zA-Z_]\w*)/g, "{$1}");
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
  // Route constants: Only match UPPER_CASE keys (ROUTE_NAME: '/path') to avoid
  // false positives from generic object properties like description: '/description'
  const routeConst = /[A-Z][A-Z_0-9]+\w*:\s*["'](\/[a-z0-9/:_-]+)["']/g;
  while ((m = routeConst.exec(content)) !== null) {
    const p = m[1].trim();
    if (p && p !== "/" && !p.includes("api")) routes.add(p);
  }

  const expanded = new Set();
  for (const r of routes) {
    for (const er of expandRoute(r)) {
      expanded.add(cleanRouteParams(er));
    }
  }
  return Array.from(expanded);
}

const KNOWN_SUB_PATHS = new Set([
  "add", "edit", "view", "new", "create", "delete", "list", "map", "end",
  "start", "details", "description", "history", "record", "schedule",
  "general", "options", "configuration", "categories", "fields", "internal",
  "socket", "floorplans", "gateways", "sensors", "adjustments", "statuses",
  "timers", "custom-fields", "asset-status", "public-settings", "signup",
  "marketing-ehs", "request-portal", "request-portal-v2",
]);

/**
 * Filter out false-positive routes that aren't real app pages.
 */
function isValidAppRoute(route) {
  if (!route || route === "/") return false;
  if (/\.\w{2,5}$/.test(route)) return false;
  if (/\s/.test(route)) return false;
  if (/^\/\d/.test(route)) return false;
  if (route.includes("__webpack")) return false;
  const segments = route.replace(/^\//, "").split("/").filter(Boolean);
  if (segments.length === 0) return false;
  const first = segments[0];
  if (/[a-z][A-Z]/.test(first)) return false;
  if (/^[A-Z]/.test(first)) return false;
  if (segments.length === 1 && KNOWN_SUB_PATHS.has(first)) return false;
  return true;
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
  let files = listSourceFiles(resolved, DEFAULT_WEB_APP_EXTENSIONS);
  // Also scan sibling "shared" directory for route constants and shared types
  const sharedDir = path.join(resolved, "..", "shared");
  if (fs.existsSync(sharedDir) && fs.statSync(sharedDir).isDirectory()) {
    files = files.concat(listSourceFiles(sharedDir, DEFAULT_WEB_APP_EXTENSIONS));
  }
  const allRoutes = new Set();
  const allEndpoints = new Set();
  const routeToEndpoints = {}; // path -> list of endpoints (best-effort by file)

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const routes = extractRoutesFromContent(content, file).filter(isValidAppRoute);
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
  // tRPC: procedureName: someProcedure.input(...).query/mutation(...)
  // Only matches when "Procedure" is in the builder name to avoid false positives in non-tRPC code
  const trpcProcedure = /(\w+)\s*:\s*\w+Procedure\s*(?:\.input\([^)]*\))?\s*\.(query|mutation)\s*\(/g;
  while ((m = trpcProcedure.exec(content)) !== null) {
    endpoints.add(`TRPC.${m[2].toUpperCase()} ${m[1]}`);
  }
  // tRPC chained across lines: name: xProcedure\n  .input(...)\n  .query/mutation(
  const trpcChained = /(\w+)\s*:\s*\w+Procedure[^;]{0,500}?\.(query|mutation)\s*\(/gs;
  while ((m = trpcChained.exec(content)) !== null) {
    const key = `TRPC.${m[2].toUpperCase()} ${m[1]}`;
    if (!endpoints.has(key)) endpoints.add(key);
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

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let _cachedAppContext = null;
let _cacheTimestamp = 0;
let _cacheKey = "";

function buildCacheKey(options) {
  const w = options.webAppPath || process.env.WEB_APP_PATH || "";
  const c = options.coreServicePath || process.env.CORE_SERVICE_PATH || "";
  const a = process.env.ADDITIONAL_SERVICES || "";
  return `${w}|${c}|${a}`;
}

/**
 * Build app context from web-app and core-service paths (env or explicit).
 * Results are cached in-memory for CACHE_TTL_MS to avoid repeated filesystem scans.
 * @param {{ webAppPath?: string | null, coreServicePath?: string | null, bustCache?: boolean }} options
 * @returns App context for regression prompt
 */
function getAppContext(options = {}) {
  const key = buildCacheKey(options);
  const now = Date.now();

  if (!options.bustCache && _cachedAppContext && key === _cacheKey && now - _cacheTimestamp < CACHE_TTL_MS) {
    return _cachedAppContext;
  }

  const webAppPath = options.webAppPath || process.env.WEB_APP_PATH || null;
  const coreServicePath = options.coreServicePath || process.env.CORE_SERVICE_PATH || null;

  const web = webAppPath ? scanWebApp(webAppPath) : { routes: [], endpoints: [], routeToEndpoints: null };
  const core = coreServicePath ? scanCoreService(coreServicePath) : { endpoints: [], modules: [] };

  const routes = web.routes || [];
  const webEndpoints = web.endpoints || [];
  const coreEndpoints = core.endpoints || [];
  const modules = core.modules || [];
  const routeToEndpoints = web.routeToEndpoints || null;

  // Scan additional services defined via ADDITIONAL_SERVICES env (comma-separated name:path pairs)
  // e.g. ADDITIONAL_SERVICES=vendor-management:/home/user/repos/vendor-management
  const additionalServices = [];
  const additionalRaw = process.env.ADDITIONAL_SERVICES || "";
  if (additionalRaw.trim()) {
    for (const entry of additionalRaw.split(",")) {
      const [name, ...pathParts] = entry.trim().split(":");
      const svcPath = pathParts.join(":");
      if (!name || !svcPath) continue;

      const clientDir = path.join(svcPath, "client");
      const svcWeb = fs.existsSync(clientDir) ? scanWebApp(clientDir) : null;
      const svcBack = scanCoreService(svcPath);

      additionalServices.push({
        name: name.trim(),
        path: svcPath.trim(),
        routes: svcWeb?.routes || [],
        webEndpoints: svcWeb?.endpoints || [],
        coreEndpoints: svcBack.endpoints || [],
        modules: svcBack.modules || [],
        error: [svcWeb?.error, svcBack.error].filter(Boolean).join("; ") || undefined,
      });
    }
  }

  const result = {
    webAppPath: webAppPath || undefined,
    coreServicePath: coreServicePath || undefined,
    routes,
    webEndpoints,
    coreEndpoints,
    modules,
    routeToEndpoints,
    additionalServices,
    errors: [web.error, core.error, ...additionalServices.map((s) => s.error)].filter(Boolean),
  };

  _cachedAppContext = result;
  _cacheTimestamp = now;
  _cacheKey = key;

  return result;
}

/**
 * Group items by their first N path segments and return compact lines.
 * e.g. ["/work-orders", "/work-orders/{id}", "/work-orders/{id}/edit"]
 *    → "work-orders: /, /{id}, /{id}/edit"
 */
function groupByPrefix(items, { isEndpoint = false } = {}) {
  const groups = {};
  for (const item of items) {
    let pathPart = item;
    let method = "";
    if (isEndpoint) {
      const spaceIdx = item.indexOf(" ");
      if (spaceIdx > 0) {
        method = item.slice(0, spaceIdx) + " ";
        pathPart = item.slice(spaceIdx + 1);
      }
    }
    const segments = pathPart.replace(/^\//, "").split("/");
    const prefix = segments[0] || "/";
    const rest = segments.length > 1 ? "/" + segments.slice(1).join("/") : "/";
    const key = isEndpoint ? prefix : prefix;
    if (!groups[key]) groups[key] = [];
    groups[key].push(method + rest);
  }

  const lines = [];
  const sorted = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  for (const [prefix, paths] of sorted) {
    const unique = [...new Set(paths)];
    if (unique.length <= 4) {
      lines.push(`- /${prefix}: ${unique.join(", ")}`);
    } else {
      lines.push(`- /${prefix}: ${unique.slice(0, 4).join(", ")} (+${unique.length - 4} more)`);
    }
  }
  return lines;
}

/**
 * Format app context into a compact string block for the regression prompt.
 */
function formatAppContextForPrompt(appContext) {
  if (!appContext || (!appContext.routes?.length && !appContext.coreEndpoints?.length && !appContext.webEndpoints?.length && !appContext.additionalServices?.length)) {
    return "";
  }
  const lines = ["\n--- Application map (use this to ground regression areas; only suggest areas that appear below) ---\n"];
  if (appContext.routes?.length) {
    lines.push(`Frontend routes (${appContext.routes.length} total):`);
    lines.push(...groupByPrefix(appContext.routes));
    lines.push("");
  }
  if (appContext.coreEndpoints?.length) {
    lines.push(`Backend endpoints (${appContext.coreEndpoints.length} total):`);
    lines.push(...groupByPrefix(appContext.coreEndpoints, { isEndpoint: true }));
    lines.push("");
  }
  if (appContext.modules?.length) {
    lines.push("Backend modules: " + appContext.modules.join(", "));
    lines.push("");
  }

  for (const svc of appContext.additionalServices || []) {
    const hasData = svc.routes?.length || svc.coreEndpoints?.length || svc.modules?.length;
    if (!hasData) continue;

    lines.push(`\n=== ${svc.name} ===\n`);
    if (svc.routes?.length) {
      lines.push(`${svc.name} routes (${svc.routes.length} total):`);
      lines.push(...groupByPrefix(svc.routes));
      lines.push("");
    }
    if (svc.coreEndpoints?.length) {
      lines.push(`${svc.name} endpoints (${svc.coreEndpoints.length} total):`);
      lines.push(...groupByPrefix(svc.coreEndpoints, { isEndpoint: true }));
      lines.push("");
    }
    if (svc.modules?.length) {
      lines.push(`${svc.name} modules: ${svc.modules.join(", ")}`);
      lines.push("");
    }
  }

  lines.push("--- End of application map ---\n");
  return lines.join("\n");
}

export {
  scanWebApp,
  scanCoreService,
  getAppContext,
  formatAppContextForPrompt,
  listSourceFiles,
};
