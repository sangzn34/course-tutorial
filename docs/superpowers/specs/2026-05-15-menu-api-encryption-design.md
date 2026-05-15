# Menu API Encryption — Design

**Date:** 2026-05-15
**Status:** Approved (design), pending spec review

## Goal

Encrypt the `/api/menu` JSON response on the server and decrypt it in the
browser before rendering. Purpose: raise the bar against third-party /
injected / analytics scripts that passively read network responses. Real
users see data normally.

## Explicit Non-Goals / Threat Model

- **Not real confidentiality.** The decryption key is delivered to the
  browser, so any script that runs the app's own decrypt code (or extracts
  the key) can read the plaintext. This is obfuscation, not security.
- Stops: passive network/response sniffing by tools and naive third-party
  scripts.
- Does NOT stop: a script that replays the key fetch + decrypt logic, a
  user with devtools, MITM with control of the page.
- No auth, no per-user keys, no E2E. Out of scope.

## Key Strategy

Key delivered via a **separate endpoint** (`GET /api/key`). Client fetches
the key at runtime, then fetches and decrypts `/api/menu`. Marginally
better than a key baked into the JS bundle; still extractable. Chosen for
low effort per the stated threat model.

## Crypto Stack

**Web Crypto API (`crypto.subtle`) on both server and client.**
AES-GCM, 256-bit key, 96-bit (12-byte) random IV per response.

- Zero new dependencies (native in Node 20+ and all target browsers).
- Authenticated encryption (GCM tag) — tampering causes decrypt to throw.
- Same API surface server and client → one shared helper module.

Rejected: `crypto-js` (extra dep, bigger bundle, weaker defaults);
`node:crypto` server + Web Crypto client (two APIs to keep in sync).

## Components

### 1. `lib/crypto.ts` (shared)

Pure helpers, no Next.js coupling:

- `importKey(base64: string): Promise<CryptoKey>` — import a raw 32-byte
  base64 key for AES-GCM encrypt+decrypt usage.
- `encryptJson(data: unknown, key: CryptoKey): Promise<{ iv: string; ciphertext: string }>`
  — `JSON.stringify` → UTF-8 bytes → AES-GCM encrypt with fresh random IV
  → base64 both fields.
- `decryptJson<T>(payload: { iv: string; ciphertext: string }, key: CryptoKey): Promise<T>`
  — reverse; throws on auth-tag failure or bad JSON.
- `generateKeyBase64(): Promise<string>` — 32 random bytes → base64 (used
  for boot-time fallback key).

### 2. `app/api/key/route.ts`

- `GET` → `{ key: string }` where `key` is base64 of the 256-bit key.
- Key source: `process.env.MENU_ENC_KEY` if set (base64). If unset,
  generate one **once at module load** and reuse for the process lifetime
  (dev convenience; logged as a warning).

### 3. `app/api/menu/route.ts` (modified)

- Keep the existing menu array as the source data.
- Resolve the same key as `/api/key`.
- `GET` → `encryptJson(menuArray, key)` → return
  `{ iv, ciphertext }` as JSON, status 200.

### 4. `app/menu/page.tsx` (modified)

- React Query, single `useQuery` with `queryKey: ["menu"]`; `queryFn`
  does both steps sequentially:
  1. `fetch('/api/key')` → `{ key }` → `importKey`.
  2. `fetch('/api/menu')` → `{ iv, ciphertext }` →
     `decryptJson<MenuItem[]>`, return decrypted array.
- Render path and `MenuItem` type unchanged.
- Decrypt or fetch failure → thrown error → existing error UI. No
  plaintext fallback.

## Wire Formats

```
GET /api/key   → 200 { "key": "<base64, 32 bytes>" }
GET /api/menu  → 200 { "iv": "<base64, 12 bytes>", "ciphertext": "<base64>" }
```

## Error Handling

| Failure | Behavior |
|---|---|
| `/api/key` non-200 / network | React Query error → existing error UI |
| `/api/menu` non-200 / network | React Query error → existing error UI |
| Decrypt auth-tag failure | `decryptJson` throws → error UI |
| Malformed JSON post-decrypt | `decryptJson` throws → error UI |
| `MENU_ENC_KEY` unset | Boot-time generated key + console warning |

No silent fallback to plaintext anywhere.

## Testing

- Unit: `encryptJson` → `decryptJson` round-trip returns deep-equal input.
- Unit: tampering `iv` or `ciphertext` (flip a byte) → `decryptJson`
  rejects.
- Unit: `importKey` with wrong-length key → rejects.
- (No test runner installed yet; plan phase decides runner or defers
  tests with a noted follow-up.)

## Scope

- In scope: `lib/crypto.ts`, `app/api/key/route.ts`,
  `app/api/menu/route.ts`, `app/menu/page.tsx`.
- Out of scope: `/api/login` and all other routes; auth; per-user keys.

## Next.js 16 Caveat

`AGENTS.md` warns this Next.js version has breaking changes vs training
data. Before writing route handlers, read the relevant guide under
`node_modules/next/dist/docs/` (route handlers / Response conventions) and
heed deprecation notices. Do not assume App Router route-handler signatures
from memory.
