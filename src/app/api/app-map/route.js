import { getAppContext } from "@/lib/app-mapper";

/**
 * GET: Return current app map from WEB_APP_PATH and CORE_SERVICE_PATH.
 * POST: Same, but accept optional body { webAppPath, coreServicePath } to override env (for one-off crawl).
 */
export async function GET() {
  try {
    const appContext = getAppContext({});
    const hasData =
      (appContext.routes?.length || 0) +
      (appContext.webEndpoints?.length || 0) +
      (appContext.coreEndpoints?.length || 0) >
      0;
    return Response.json({
      ok: true,
      hasMap: hasData,
      webAppPath: appContext.webAppPath ?? null,
      coreServicePath: appContext.coreServicePath ?? null,
      routes: appContext.routes ?? [],
      webEndpoints: appContext.webEndpoints ?? [],
      coreEndpoints: appContext.coreEndpoints ?? [],
      modules: appContext.modules ?? [],
      routeToEndpoints: appContext.routeToEndpoints ?? null,
      errors: appContext.errors ?? [],
    });
  } catch (err) {
    console.error("App map GET error:", err);
    return Response.json(
      { ok: false, error: err.message, hasMap: false, routes: [], webEndpoints: [], coreEndpoints: [], modules: [], errors: [] },
      { status: 500 }
    );
  }
}

