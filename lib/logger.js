const SEARCH_DEBUG_ENABLED = process.env.SEARCH_DEBUG === 'true';

export function logSearchDebug(...args) {
  if (SEARCH_DEBUG_ENABLED) {
    console.info(...args);
  }
}
