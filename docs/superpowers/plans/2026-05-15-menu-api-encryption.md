# Menu API Encryption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encrypt the `/api/menu` JSON response on the server (AES-GCM-256) and decrypt it in the browser before rendering, to obstruct passive network/third-party-script snooping.

**Architecture:** Isomorphic pure crypto helper (`lib/crypto.ts`, Web Crypto API, no deps) used by both server and client. A server-only key module (`lib/serverKey.ts`) resolves a singleton 256-bit key from `MENU_ENC_KEY` env or a boot-generated fallback. `GET /api/key` returns the base64 key; `GET /api/menu` returns `{ iv, ciphertext }`. The menu page fetches the key, then the encrypted menu, decrypts in one React Query `queryFn`. Both route handlers are `force-dynamic` so Next.js 16 never prerenders a static key/ciphertext.

**Tech Stack:** Next.js 16.2.6 (App Router route handlers), React 19, @tanstack/react-query 5, Web Crypto API (native), Vitest (new devDependency, unit tests).

**Spec:** `docs/superpowers/specs/2026-05-15-menu-api-encryption-design.md`

**Next.js 16 note:** Route Handler doc (`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`): GET handlers are not cached by default, but with Cache Components a GET can be prerendered at build time unless it uses runtime/non-deterministic data. We add `export const dynamic = 'force-dynamic'` to both handlers to guarantee request-time execution (fresh IV every request, no statically baked key).

---

### Task 1: Vitest setup + `lib/crypto.ts` isomorphic crypto helper (TDD)

**Files:**
- Modify: `package.json` (add `vitest` devDependency + `test` script)
- Create: `lib/crypto.ts`
- Test: `lib/crypto.test.ts`

- [ ] **Step 1: Install Vitest**

Run:
```bash
npm install -D vitest
```
Expected: `vitest` appears under `devDependencies` in `package.json`, `package-lock.json` updated, exit code 0.

- [ ] **Step 2: Add the `test` script**

In `package.json`, inside `"scripts"`, add the `test` entry (keep existing scripts):

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run"
  },
```

- [ ] **Step 3: Write the failing test**

Create `lib/crypto.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  generateKeyBase64,
  importKey,
  encryptJson,
  decryptJson,
} from "./crypto";

describe("crypto helpers", () => {
  it("round-trips JSON through encrypt/decrypt", async () => {
    const keyB64 = await generateKeyBase64();
    const key = await importKey(keyB64);
    const data = [{ id: 1, name: "Espresso", available: true }];

    const payload = await encryptJson(data, key);

    expect(typeof payload.iv).toBe("string");
    expect(typeof payload.ciphertext).toBe("string");
    expect(payload.ciphertext).not.toContain("Espresso");

    const decrypted = await decryptJson<typeof data>(payload, key);
    expect(decrypted).toEqual(data);
  });

  it("rejects when ciphertext is tampered", async () => {
    const key = await importKey(await generateKeyBase64());
    const payload = await encryptJson({ a: 1 }, key);

    // Flip the first base64 char of the ciphertext.
    const firstChar = payload.ciphertext[0];
    const swapped = firstChar === "A" ? "B" : "A";
    const tampered = { ...payload, ciphertext: swapped + payload.ciphertext.slice(1) };

    await expect(decryptJson(tampered, key)).rejects.toBeTruthy();
  });

  it("rejects a wrong-length raw key", async () => {
    // 16 bytes of base64 ("AAAA..." => zero bytes), AES-GCM import expects 16/24/32; use 10 bytes to force failure.
    const badKeyB64 = btoa(String.fromCharCode(...new Uint8Array(10)));
    await expect(importKey(badKeyB64)).rejects.toBeTruthy();
  });

  it("generates a 32-byte (256-bit) base64 key", async () => {
    const keyB64 = await generateKeyBase64();
    const raw = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
    expect(raw.length).toBe(32);
  });
});
```

- [ ] **Step 4: Run the test, verify it fails**

Run:
```bash
npm test
```
Expected: FAIL — module `./crypto` not found / exports undefined.

- [ ] **Step 5: Implement `lib/crypto.ts`**

Create `lib/crypto.ts`:

```ts
// Isomorphic AES-GCM-256 helpers. No imports: relies on the Web Crypto
// API and base64 globals, available in browsers and Node.js 20+.
//
// This is OBFUSCATION, not security: the key is delivered to the browser
// (see docs/superpowers/specs/2026-05-15-menu-api-encryption-design.md).

export type EncryptedPayload = {
  iv: string; // base64, 12 bytes
  ciphertext: string; // base64
};

const ALGO = "AES-GCM";
const IV_BYTES = 12;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function generateKeyBase64(): Promise<string> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64(raw);
}

export async function importKey(keyBase64: string): Promise<CryptoKey> {
  const raw = base64ToBytes(keyBase64);
  return crypto.subtle.importKey("raw", raw, { name: ALGO }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptJson(
  data: unknown,
  key: CryptoKey,
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    plaintext,
  );
  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(cipherBuf)),
  };
}

export async function decryptJson<T>(
  payload: EncryptedPayload,
  key: CryptoKey,
): Promise<T> {
  const iv = base64ToBytes(payload.iv);
  const cipher = base64ToBytes(payload.ciphertext);
  const plainBuf = await crypto.subtle.decrypt(
    { name: ALGO, iv },
    key,
    cipher,
  );
  const json = new TextDecoder().decode(plainBuf);
  return JSON.parse(json) as T;
}
```

- [ ] **Step 6: Run the test, verify it passes**

Run:
```bash
npm test
```
Expected: PASS — all 4 tests in `lib/crypto.test.ts` green.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json lib/crypto.ts lib/crypto.test.ts
git commit -m "feat(crypto): isomorphic AES-GCM-256 helpers + vitest setup"
```

---

### Task 2: `lib/serverKey.ts` server-only key singleton

**Files:**
- Create: `lib/serverKey.ts`
- Test: `lib/serverKey.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/serverKey.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("getServerKeyBase64", () => {
  const ORIGINAL = process.env.MENU_ENC_KEY;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.MENU_ENC_KEY;
    else process.env.MENU_ENC_KEY = ORIGINAL;
  });

  it("returns MENU_ENC_KEY when set", async () => {
    process.env.MENU_ENC_KEY = "test-key-from-env";
    const { getServerKeyBase64 } = await import("./serverKey");
    expect(getServerKeyBase64()).toBe("test-key-from-env");
  });

  it("returns a stable generated 32-byte key when env unset", async () => {
    delete process.env.MENU_ENC_KEY;
    const { getServerKeyBase64 } = await import("./serverKey");
    const a = getServerKeyBase64();
    const b = getServerKeyBase64();
    expect(a).toBe(b); // singleton, stable within process
    const raw = Uint8Array.from(atob(a), (c) => c.charCodeAt(0));
    expect(raw.length).toBe(32);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run:
```bash
npm test -- lib/serverKey.test.ts
```
Expected: FAIL — module `./serverKey` not found.

- [ ] **Step 3: Implement `lib/serverKey.ts`**

Create `lib/serverKey.ts`:

```ts
// Server-only: resolves the AES key once per process. NEVER import this
// from a Client Component — it must not reach the browser bundle.

let cached: string | null = null;

function resolve(): string {
  const fromEnv = process.env.MENU_ENC_KEY;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }
  // Synchronous 32-byte (256-bit) generation so the singleton is set
  // without a Promise. Matches lib/crypto's AES-GCM-256 key size.
  const raw = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (let i = 0; i < raw.length; i++) binary += String.fromCharCode(raw[i]);
  const generated = btoa(binary);
  console.warn(
    "[serverKey] MENU_ENC_KEY not set — generated an ephemeral key for this process. " +
      "Set MENU_ENC_KEY (base64, 32 bytes) for stable behavior.",
  );
  return generated;
}

export function getServerKeyBase64(): string {
  if (cached === null) {
    cached = resolve();
  }
  return cached;
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run:
```bash
npm test -- lib/serverKey.test.ts
```
Expected: PASS — both tests green.

- [ ] **Step 5: Run the full suite (regression check)**

Run:
```bash
npm test
```
Expected: PASS — all tests in `lib/crypto.test.ts` and `lib/serverKey.test.ts` green.

- [ ] **Step 6: Commit**

```bash
git add lib/serverKey.ts lib/serverKey.test.ts
git commit -m "feat(crypto): server-only AES key singleton"
```

---

### Task 3: `GET /api/key` route handler

**Files:**
- Create: `app/api/key/route.ts`

- [ ] **Step 1: Implement the route handler**

Create `app/api/key/route.ts`:

```ts
import { getServerKeyBase64 } from "@/lib/serverKey";

// force-dynamic: Next.js 16 may prerender GET handlers at build time with
// Cache Components; we must run at request time so the key is never baked
// into a static response.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ key: getServerKeyBase64() });
}
```

> If the `@/` path alias is not configured in `tsconfig.json`, use a relative import instead: `import { getServerKeyBase64 } from "../../../lib/serverKey";`. Verify by checking `tsconfig.json` `compilerOptions.paths` for `"@/*"`.

- [ ] **Step 2: Verify the dev server compiles and the endpoint responds**

Run (in one shell):
```bash
npm run dev
```
In another shell, once the server is ready:
```bash
curl -s http://localhost:3000/api/key
```
Expected: JSON `{"key":"<base64 string>"}`. The base64 decodes to 32 bytes:
```bash
curl -s http://localhost:3000/api/key | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const k=JSON.parse(s).key;console.log(Buffer.from(k,'base64').length)})"
```
Expected output: `32`

Stop the dev server (Ctrl+C) after verifying.

- [ ] **Step 3: Commit**

```bash
git add app/api/key/route.ts
git commit -m "feat(api): GET /api/key returns base64 AES key"
```

---

### Task 4: Encrypt `GET /api/menu`

**Files:**
- Modify: `app/api/menu/route.ts` (full rewrite — currently returns plaintext array)

- [ ] **Step 1: Rewrite the menu route to encrypt its response**

Replace the entire contents of `app/api/menu/route.ts` with:

```ts
import { encryptJson, importKey } from "@/lib/crypto";
import { getServerKeyBase64 } from "@/lib/serverKey";

// force-dynamic: ensure request-time execution so a fresh IV is generated
// per request and no ciphertext is statically prerendered (Next.js 16).
export const dynamic = "force-dynamic";

const MENU = [
  { id: 1, name: "Espresso", nameTh: "เอสเพรสโซ่", category: "hot", price: 55, description: "Single shot, intense and full-bodied.", available: true },
  { id: 2, name: "Americano", nameTh: "อเมริกาโน่", category: "hot", price: 60, description: "Espresso diluted with hot water.", available: true },
  { id: 3, name: "Cappuccino", nameTh: "คาปูชิโน่", category: "hot", price: 70, description: "Equal parts espresso, steamed milk, and foam.", available: true },
  { id: 4, name: "Caffe Latte", nameTh: "ลาเต้", category: "hot", price: 70, description: "Espresso with steamed milk and a thin layer of foam.", available: true },
  { id: 5, name: "Iced Americano", nameTh: "อเมริกาโน่เย็น", category: "iced", price: 65, description: "Chilled espresso over ice and cold water.", available: true },
  { id: 6, name: "Iced Latte", nameTh: "ลาเต้เย็น", category: "iced", price: 75, description: "Espresso and cold milk over ice.", available: true },
  { id: 7, name: "Mocha Frappe", nameTh: "มอคค่าปั่น", category: "blended", price: 90, description: "Blended espresso, chocolate, milk, and ice.", available: false },
  { id: 8, name: "Thai Coffee", nameTh: "กาแฟโบราณ", category: "iced", price: 50, description: "Traditional Thai-style sweetened iced coffee.", available: true },
];

export async function GET() {
  // mock latency, preserved from the original handler
  await new Promise((resolve) => setTimeout(resolve, 500));

  const key = await importKey(getServerKeyBase64());
  const payload = await encryptJson(MENU, key);
  return Response.json(payload);
}
```

- [ ] **Step 2: Verify the endpoint returns ciphertext (not plaintext)**

Run:
```bash
npm run dev
```
Then:
```bash
curl -s http://localhost:3000/api/menu
```
Expected: JSON `{"iv":"<base64>","ciphertext":"<base64>"}`. It must NOT contain `Espresso` or `เอสเพรสโซ่`. Verify:
```bash
curl -s http://localhost:3000/api/menu | grep -c Espresso
```
Expected output: `0`

- [ ] **Step 3: Verify two requests produce different IVs (force-dynamic working)**

Run:
```bash
A=$(curl -s http://localhost:3000/api/menu | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).iv))")
B=$(curl -s http://localhost:3000/api/menu | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).iv))")
[ "$A" != "$B" ] && echo "IVs differ: OK" || echo "IVs SAME: FAIL"
```
Expected output: `IVs differ: OK`

Stop the dev server after verifying.

- [ ] **Step 4: Commit**

```bash
git add app/api/menu/route.ts
git commit -m "feat(api): encrypt GET /api/menu response (AES-GCM)"
```

---

### Task 5: Decrypt on the menu page

**Files:**
- Modify: `app/menu/page.tsx` (change `queryFn` only; `MenuItem` type and render JSX unchanged)

- [ ] **Step 1: Update the `queryFn` to fetch key then decrypt menu**

Replace the entire contents of `app/menu/page.tsx` with:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import React from "react";
import { decryptJson, importKey, type EncryptedPayload } from "@/lib/crypto";

type MenuItem = {
  id: number;
  name: string;
  nameTh: string;
  category: string;
  price: number;
  description: string;
  available: boolean;
};

async function fetchDecryptedMenu(): Promise<MenuItem[]> {
  const keyRes = await fetch("/api/key");
  if (!keyRes.ok) {
    throw new Error("Failed to fetch decryption key");
  }
  const { key: keyB64 } = (await keyRes.json()) as { key: string };
  const key = await importKey(keyB64);

  const menuRes = await fetch("/api/menu");
  if (!menuRes.ok) {
    throw new Error("Network response was not ok");
  }
  const payload = (await menuRes.json()) as EncryptedPayload;
  return decryptJson<MenuItem[]>(payload, key);
}

const MenuPage = () => {
  const { data, isLoading, error } = useQuery<MenuItem[]>({
    queryKey: ["menu"],
    queryFn: fetchDecryptedMenu,
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    // 2 cards per row
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
      {data?.map((item) => (
        <div key={item.id} className="border p-4 rounded mb-2">
          <h2 className="text-xl font-bold">
            {item.name} ({item.nameTh})
          </h2>
          <p>Category: {item.category}</p>
          <p>Price: {item.price} THB</p>
          <p>{item.description}</p>
          <p>Available: {item.available ? "Yes" : "No"}</p>
        </div>
      ))}
    </div>
  );
};

export default MenuPage;
```

> Same `@/` alias caveat as Task 3 — if no `@/*` path in `tsconfig.json`, use `../../lib/crypto`.

- [ ] **Step 2: Verify the page renders decrypted data in a browser**

Run:
```bash
npm run dev
```
Open `http://localhost:3000/menu` in a browser.
Expected:
- Page shows all 8 menu cards (Espresso … Thai Coffee) exactly as before.
- DevTools → Network → `/api/menu` response body shows `{ iv, ciphertext }` only — no plaintext menu names.
- No console errors.

- [ ] **Step 3: Run the full test suite (final regression)**

Run:
```bash
npm test
```
Expected: PASS — all crypto/serverKey tests green.

- [ ] **Step 4: Type-check the project build**

Run:
```bash
npm run build
```
Expected: build succeeds, no TypeScript errors. (Confirms `@/` alias / imports resolve and route handlers type-check under Next.js 16.)

Stop the dev server after verifying.

- [ ] **Step 5: Commit**

```bash
git add app/menu/page.tsx
git commit -m "feat(menu): decrypt /api/menu response on the client"
```

---

## Verification Summary

After all tasks:
- `npm test` → all unit tests pass (round-trip, tamper rejection, key length, server-key singleton).
- `curl /api/menu` → `{ iv, ciphertext }`, no plaintext, different IV each request.
- `curl /api/key` → `{ key }` decoding to 32 bytes.
- `http://localhost:3000/menu` → renders all 8 items; network tab shows only ciphertext.
- `npm run build` → succeeds.

## Notes / Follow-ups (out of scope, not implemented)

- Setting `MENU_ENC_KEY` in deployment env (currently boot-generated fallback with a console warning). Document in README when deploying.
- This is obfuscation, not confidentiality — a script that runs the page's own decrypt path can still read plaintext (see spec Non-Goals).
