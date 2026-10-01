import { describe, expect, it } from "vitest";
import { convert, fileName, folderName, slugOf, slugify } from "./naming";

describe("slugify", () => {
  it("lowercases, drops symbols, and joins words with underscores", () => {
    expect(slugify("Safe Browsing API (Snip)")).toBe("safe_browsing_api_snip");
    expect(slugify("Link Service 2")).toBe("link_service_2");
    expect(slugify("  Worker / Job  ")).toBe("worker_job");
  });

  it("splits camelCase and acronyms into words", () => {
    expect(slugify("createLink()")).toBe("create_link");
    expect(slugify("HTTPServer")).toBe("http_server");
  });

  it("drops accents and keeps a leading digit importable", () => {
    expect(slugify("Café Façade")).toBe("cafe_facade");
    expect(slugify("2FA Service")).toBe("_2fa_service");
  });

  it("never returns an empty slug", () => {
    expect(slugify("!!!")).toBe("node");
  });
});

describe("slugOf", () => {
  it("follows the name unless a slug was typed", () => {
    expect(slugOf({ name: "Link Resolver" })).toBe("link_resolver");
    expect(slugOf({ name: "API Gateway", slug: "gateway" })).toBe("gateway");
    expect(slugOf({ name: "API Gateway", slug: "" })).toBe("api_gateway");
  });
});

describe("conventions", () => {
  it("converts a snake slug to each style", () => {
    expect(convert("link_service", "kebab")).toBe("link-service");
    expect(convert("link_service", "pascal")).toBe("LinkService");
    expect(convert("link_service", "flat")).toBe("linkservice");
    expect(convert("link_service", "snake")).toBe("link_service");
  });

  it("names files and folders per language (DECISIONS.md table)", () => {
    expect(fileName("link_service", "python")).toBe("link_service.py");
    expect(fileName("link_service", "typescript")).toBe("link-service.ts");
    expect(fileName("link_service", "java")).toBe("LinkService.java");
    expect(fileName("link_service", "csharp")).toBe("LinkService.cs");
    expect(fileName("link_service", "sql")).toBe("link_service.sql");
    expect(folderName("link_service", "go")).toBe("linkservice");
    expect(folderName("link_service", "java")).toBe("linkservice");
    expect(folderName("link_service", "csharp")).toBe("LinkService");
    expect(folderName("link_service", "typescript")).toBe("link-service");
    expect(folderName("link_service", undefined)).toBe("link_service");
  });
});
