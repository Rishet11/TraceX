// ---------------------------------------------------------------------------
// Structured API logger — consistent JSON logging across all API routes
// ---------------------------------------------------------------------------
// All logs are single-line JSON for easy ingestion by Vercel Log Drains,
// Datadog, or any JSON-based log aggregator.
// ---------------------------------------------------------------------------

/**
 * Log a structured API request event.
 *
 * @param {'info' | 'warn' | 'error'} level
 * @param {Record<string, unknown>} fields
 */
export function logApi(level, fields) {
  const entry = {
    ...fields,
    at: new Date().toISOString(),
  };
  const line = JSON.stringify(entry);

  switch (level) {
    case 'warn':
      console.warn(line);
      break;
    case 'error':
      console.error(line);
      break;
    default:
      console.info(line);
  }
}

/**
 * Wrap an API route handler with structured request/response logging.
 * Automatically logs timing, status, and errors.
 *
 * @param {string} routeName  — e.g. 'search', 'tweet', 'analyze'
 * @param {(payload: unknown) => Promise<{ status: number, body: unknown }>} handler
 * @returns {(request: Request) => Promise<Response>}
 */
export function withApiLogging(routeName, handler) {
  return async (request) => {
    const start = Date.now();
    let payload;

    try {
      payload = await request.json();
    } catch {
      logApi('warn', { event: `${routeName}_request`, error: 'invalid_json' });
      const { NextResponse } = await import('next/server');
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
      const result = await handler(payload);
      const durationMs = Date.now() - start;

      logApi('info', {
        event: `${routeName}_request`,
        status: result.status,
        durationMs,
        ...extractMeta(routeName, payload, result.body),
      });

      // Warn on server errors or total failures.
      if (result.status >= 500) {
        logApi('warn', {
          event: `${routeName}_alert`,
          severity: 'high',
          status: result.status,
          durationMs,
          reason: result.body?.meta?.reason || result.body?.error || 'server_error',
        });
      }

      const { NextResponse } = await import('next/server');
      return NextResponse.json(result.body, { status: result.status });
    } catch (error) {
      const durationMs = Date.now() - start;
      logApi('error', {
        event: `${routeName}_error`,
        severity: 'critical',
        durationMs,
        error: error.message,
      });
      const { NextResponse } = await import('next/server');
      return NextResponse.json(
        { error: 'Internal Server Error', details: error.message },
        { status: 500 }
      );
    }
  };
}

// Extract route-specific metadata for the log entry.
function extractMeta(routeName, payload, body) {
  switch (routeName) {
    case 'search':
      return {
        queryLength: String(payload?.query || '').length,
        queryInputType: payload?.queryInputType || 'text',
        resultsCount: Array.isArray(body?.results) ? body.results.length : 0,
        sources: body?.meta?.sources || null,
        timingMs: body?.meta?.timingMs || null,
        reason: body?.meta?.reason || null,
      };
    case 'tweet':
      return {
        tweetUrl: payload?.url ? '***' : null, // redact URL but confirm presence
        unavailable: body?.unavailable || false,
        reason: body?.reason || null,
      };
    case 'analyze':
      return {
        originalLength: String(payload?.original || '').length,
        candidateLength: String(payload?.candidate || '').length,
        verdict: body?.verdict || null,
        score: body?.score ?? null,
      };
    default:
      return {};
  }
}
