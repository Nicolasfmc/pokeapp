import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  isCrossSiteMutation,
  safeRedirectPath,
} from "@/server/security";
import { readJsonObject } from "@/server/http-body";

function req(method: string, headers: Record<string, string>, host = "sleevebuild.vercel.app") {
  const h = new Headers(headers);
  return { method, headers: h, nextUrl: { host } };
}

describe("Content-Security-Policy", () => {
  it("only allows scripts with the nonce in production", () => {
    const csp = buildContentSecurityPolicy("abc123", false);
    const scriptSrc = csp.split("; ").find((d) => d.startsWith("script-src"));
    expect(scriptSrc).toContain("'nonce-abc123'");
    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
});

describe("CSRF guard", () => {
  it("lets safe methods through", () => {
    expect(isCrossSiteMutation(req("GET", { origin: "https://evil.example" }))).toBe(false);
  });

  it("blocks mutations from another origin", () => {
    expect(isCrossSiteMutation(req("POST", { origin: "https://evil.example" }))).toBe(true);
    expect(isCrossSiteMutation(req("DELETE", { "sec-fetch-site": "cross-site" }))).toBe(true);
    expect(isCrossSiteMutation(req("POST", { origin: "null" }))).toBe(true);
  });

  it("allows same-origin mutations and non-browser clients", () => {
    expect(
      isCrossSiteMutation(
        req("POST", { origin: "https://sleevebuild.vercel.app", "sec-fetch-site": "same-origin" }),
      ),
    ).toBe(false);
    expect(isCrossSiteMutation(req("PATCH", {}))).toBe(false);
  });
});

describe("safeRedirectPath", () => {
  it("keeps same-site paths", () => {
    expect(safeRedirectPath("/decks/abc?x=1")).toBe("/decks/abc?x=1");
  });

  it("falls back for anything that could leave the site", () => {
    for (const bad of [
      "//evil.example",
      "/\\evil.example",
      "https://evil.example",
      "javascript:alert(1)",
      "/\u0000x",
      null,
      "",
    ]) {
      expect(safeRedirectPath(bad)).toBe("/");
    }
  });
});

describe("readJsonObject", () => {
  const post = (body: string, headers: Record<string, string> = {}) =>
    new Request("http://localhost/api/x", { method: "POST", body, headers });

  it("accepts JSON objects", async () => {
    expect(await readJsonObject(post('{"a":1}'))).toEqual({ ok: true, value: { a: 1 } });
  });

  it("rejects non-objects and invalid JSON", async () => {
    for (const body of ["null", "[]", '"x"', "{bad"]) {
      expect((await readJsonObject(post(body))).ok).toBe(false);
    }
  });

  it("rejects bodies over the size limit", async () => {
    const result = await readJsonObject(post(`{"a":"${"x".repeat(200)}"}`), 100);
    expect(result).toMatchObject({ ok: false, status: 413 });
  });
});
