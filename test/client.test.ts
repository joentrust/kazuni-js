import { describe, expect, it } from "vitest";
import { Kazuni } from "../src/index";

describe("Kazuni constructor", () => {
  it("accepts a bare api key string", () => {
    const kazuni = new Kazuni("cl_test_key");
    expect(kazuni.send).toBeDefined();
  });

  it("accepts an options object", () => {
    const kazuni = new Kazuni({ apiKey: "cl_test_key", baseUrl: "https://example.com" });
    expect(kazuni.send).toBeDefined();
  });

  it("throws when apiKey is missing", () => {
    expect(() => new Kazuni({ apiKey: "" })).toThrow(/apiKey is required/);
  });
});
