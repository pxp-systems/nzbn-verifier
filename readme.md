# NZBN Support Verifier (MVP)

In-memory contact-centre verifier dashboard for troubleshooting mDoc presentation issues.

## Is there a webpage?

Yes.

- **Agent dashboard:** `http://localhost:3000/`
- **Holder page pattern:** `http://localhost:3000/session/{sessionId}`

The holder URL is generated when a session is created and returned as `holderLink` in the API response.

## Quick start

```bash
npm install
npm run dev
```

## Verifier providers

- Default provider is `mock`.
- Set `VERIFIER_PROVIDER=waltid` to use Walt.id-backed verifier session/result calls.

Environment variables:

```bash
VERIFIER_PROVIDER=mock # or waltid
WALTID_BASE_URL=http://localhost:7003
WALTID_CREATE_SESSION_PATH=/openid4vc/verify
WALTID_RESULT_PATH_TEMPLATE=/openid4vc/session/{id}
WALTID_REQUEST_CREDENTIALS_JSON=[{"format":"jwt_vc_json","type":"OpenBadgeCredential"}]
WALTID_API_KEY=
```

Note: some Walt.id deployments do not expose a `/health` route. Use the verifier endpoints above for connectivity checks.

### Run Walt.id locally (dev)

Use your existing Walt.id verifier API setup and ensure it is reachable at `WALTID_BASE_URL`.

Minimal smoke flow from this app:

1. Create a verifier session:

```bash
curl -s -X POST http://localhost:3000/api/dev/verifier/session \
  -H 'content-type: application/json' \
  -d '{"sessionId":"dev-session-1","fullName":"Alex Taylor","nzbn":"9429041138090"}'
```

2. Later, fetch result + normalized app view:

```bash
curl -s http://localhost:3000/api/dev/verifier/result/<requestId>
```

The response includes raw provider status and the app's normalized verification model.

Then open:

- `http://localhost:3000/`

## How to use the MVP

1. Open the agent dashboard (`/`).
2. Enter contact method/value and click **Start session**.
3. Click **Send holder link**.
4. Open the generated holder link (`/session/{sessionId}`) in another tab/browser.
5. On holder page, choose a mock scenario and click **Present credential**.
6. Agent dashboard updates live via SSE and shows 3 panes:
   - Credential / verification result
   - NZBN context
   - Companies context

## Important constraints

- In-memory only (no DB, no persistence, no caching)
- Mock integrations for verifier/NZBN/Companies/messaging
- Session TTL auto-expiry (default 15 minutes)
- Basic create-session rate limiting
- No VC payload logging

## If `npm run dev` fails with `EADDRINUSE` (port 3000 in use)

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
kill <PID>
npm run dev
```

Alternative (temporary different port):

```bash
PORT=3001 npm run dev
```
