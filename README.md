# TraceX

TraceX is a free beta web app that helps anyone quickly check if a tweet was copied.

Paste tweet text or a tweet URL, run a search, and review likely matches with confidence scores, engagement metrics, and direct links to source posts.

## Current product mode

- Free beta (no signup required)
- No active paywall
- Public tweet sources only
- Checkout endpoint is intentionally disabled during beta

## What TraceX does

- Detects likely copied tweets across multiple public sources
- Supports both plain text and X/Twitter tweet URLs
- Excludes the original source tweet from external copy results
- Separates same-author repeated posts from external copies
- Ranks results with similarity + quality scoring
- Enriches stats (replies, reposts, likes, views, bookmarks) when available
- Supports shareable results links via encoded URL payload
- Optional AI explanation per result card using Gemini

## How search works

TraceX uses a progressive recall pipeline:

1. Normalize input text
2. Build query variants (quoted, normalized, core window, keyword fallback)
3. Search in priority order across multiple sources
4. Deduplicate and canonicalize results
5. Exclude source tweet and same-author duplicates from external copy list
6. Enrich metrics where needed
7. Return ranked results + diagnostic metadata

Primary sources and fallbacks:

- Nitter-style mirror search
- DuckDuckGo web search
- Bing RSS fallback
- Jina mirror fallback

Caching is enabled for both full search responses and source-level queries (configurable via env vars).

## Tech stack

- Next.js 16 (App Router)
- React 19
- Node.js test runner (`node --test`)
- Tailwind CSS v4 + custom design tokens
- Lucide icons
- Cheerio parsing for search sources
- Gemini API for optional AI verdicts

## Project structure

```text
app/
  api/
    analyze/route.js
    billing/checkout/route.js
    search/route.js
    tweet/route.js
  account/page.js
  contact/page.js
  page.js
  pricing/page.js
  privacy/page.js
  results/page.js
  terms/page.js
components/
  AppFooter.jsx
  AppHeader.jsx
  ResultCard.jsx
  SearchInput.jsx
lib/
  searchService.js
  searchQuery.js
  searchResults.js
  tweetFetchService.js
  tweetMetrics.js
  ranking.js
  similarity.js
  gemini.js
  analytics.js
tests/
  *.test.mjs
```

## Getting started

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

### Configure environment

```bash
cp .env.example .env.local
```

Update `.env.local` with values you need for local testing.

Minimum useful local setup:

- `GEMINI_API_KEY` only if you want AI analysis
- Search tuning vars are optional (safe defaults exist)
- Lemon Squeezy vars are optional in free beta mode

### Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Available scripts

- `npm run dev` - start local dev server
- `npm run build` - production build
- `npm run build:ci` - CI-safe build (`--webpack`)
- `npm run start` - run production server
- `npm run lint` - lint codebase
- `npm test` - run all Node tests in `tests/`

## Environment variables

### Core

- `GEMINI_API_KEY` - optional, required only for AI verdict button
- `NEXT_PUBLIC_APP_URL` - app base URL (used in flows that need absolute URLs)

### Billing (currently inactive in beta)

- `LEMONSQUEEZY_API_KEY`
- `LEMONSQUEEZY_STORE_ID`
- `LEMONSQUEEZY_PRO_MONTHLY_VARIANT_ID`
- `LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID`
- `LEMONSQUEEZY_PRO_VARIANT_ID` (backward compatibility fallback)
- `NEXT_PUBLIC_LEMONSQUEEZY_CUSTOMER_PORTAL_URL`

Note: `POST /api/billing/checkout` currently returns `503` with `BILLING_COMING_SOON`.

### Search performance tuning (all optional)

- `SEARCH_GLOBAL_TIMEOUT_MS` (default `15000`)
- `SEARCH_EARLY_STOP_THRESHOLD` (default `8`)
- `SEARCH_SOURCE_TIMEOUT_MS` (default `4500`)
- `SEARCH_SOURCE_TIMEOUT_MIN_MS` (default `1500`)
- `SEARCH_FALLBACK_PARALLEL_SOURCES` (default `2`)
- `SEARCH_METRICS_TIMEOUT_MS` (default `1800`)
- `SEARCH_METRICS_MAX_ITEMS` (default `6`)
- `SEARCH_METRICS_CONCURRENCY` (default `3`)
- `SEARCH_CACHE_TTL_MS` (default `120000`)
- `SEARCH_CACHE_MAX_ENTRIES` (default `200`)
- `SEARCH_SOURCE_CACHE_TTL_MS` (default `90000`)
- `SEARCH_SOURCE_CACHE_MAX_ENTRIES` (default `600`)
- `SEARCH_HEALTH_LOG` (`false` to disable structured health logs)

## API overview

### `POST /api/search`

Search likely copies for tweet text.

Request body:

```json
{
  "query": "tweet text to search",
  "queryInputType": "text",
  "excludeTweetId": null,
  "excludeUsername": null,
  "excludeContent": null
}
```

Success response includes:

- `results` - external likely copied tweets
- `selfDuplicates` - same-author repeated posts
- `meta` - diagnostics (variants, sources, timings, reason, cache info)

### `POST /api/tweet`

Fetch and normalize tweet content from an input URL for URL-based search mode.

### `POST /api/analyze`

Run optional AI comparison between original text and a result candidate.

### `POST /api/billing/checkout`

Disabled during free beta (`503` response).

## Testing and quality

TraceX includes unit/integration-style tests for:

- Search pipeline behavior and fallbacks
- Query variant generation
- Dedup and canonicalization
- URL tweet fetch fallback behavior
- Syndication parsing
- Billing service logic
- AI analysis service mapping
- Ranking heuristics

Run:

```bash
npm run lint
npm test
npm run build:ci
```

## Troubleshooting

### "Failed to fetch search results"

Possible causes:

- Public source outage/rate-limit
- Network issues to one or more upstream sources
- Temporary mirror instability

Actions:

- Retry after a few seconds
- Try plain text mode if URL extraction fails
- Tune timeouts/fallback settings in env vars for your deployment

### URL fetch unavailable

When `/api/tweet` cannot fetch content (deleted/protected/blocked tweet), the UI should prompt the user to paste tweet text manually.

### No copies found

A successful search can return zero external copies. This is a valid result, not an API failure.

## Deployment notes

### Recommended

- Vercel for simplest Next.js deployment
- Add all required env vars in project settings

### Pre-launch checklist

1. `npm run lint`
2. `npm test`
3. `npm run build:ci`
4. Verify home search flow:
   - text query search
   - URL query search
   - loading state
   - success with results
   - success with zero results
   - source outage error state
5. Verify shared results page (`/results?data=...`)
6. Verify legal/contact pages and nav links

## Product links

- Home: `/`
- Shared results: `/results`
- Free beta page: `/pricing`
- Account status: `/account`
- Terms: `/terms`
- Privacy: `/privacy`
- Contact: `/contact`

## Notes for contributors

- Keep API contracts stable unless intentionally versioning
- Prefer additive response fields over breaking changes
- Keep `SearchInput` and `ResultCard` props backward compatible
- Add/update tests for search behavior changes
- Use atomic commits (one logical unit per commit)

## License

No OSS license file is currently defined in this repository.
