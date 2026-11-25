// Proves the "check the database error" lint rule fires on the mistakes it's for, and stays
// quiet on the patterns the app actually uses.
const { describe, expect, it } = require("@jest/globals");
const { Linter } = require("eslint");
const supabaseErrors = require("../supabase-errors");

const linter = new Linter({ configType: "flat" });
const config = [
  {
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    rules: { "no-restricted-syntax": ["error", ...supabaseErrors] },
  },
];

// Number of rule hits in a snippet (wrapped in an async function so `await` is valid).
const hits = (code) =>
  linter.verify(`async function f() {\n${code}\n}`, config).filter((m) => m.ruleId === "no-restricted-syntax").length;

describe("supabase-errors lint rule", () => {
  it("flags destructuring only data from a query", () => {
    expect(hits(`const { data } = await supabase.from("profiles").select("id");`)).toBe(1);
  });

  it("flags destructuring only data from an rpc", () => {
    expect(hits(`const { data: id } = await supabase.rpc("my_request_id");`)).toBe(1);
  });

  it("flags a query whose result is thrown away", () => {
    expect(hits(`await supabase.from("joiners").delete().eq("member", id);`)).toBe(1);
  });

  it("flags it inside the offline ternary too", () => {
    expect(hits(`const { data } = (await isOffline()) ? { data: null } : await supabase.rpc("x");`)).toBe(1);
  });

  it("allows destructuring error (renamed or not)", () => {
    expect(hits(`const { data, error } = await supabase.from("rooms").select("*");`)).toBe(0);
    expect(hits(`const { error: insertError } = await supabase.from("profiles").insert(row);`)).toBe(0);
    expect(hits(`const { error } = (await isOffline()) ? { error: E } : await supabase.rpc("x");`)).toBe(0);
  });

  it("allows keeping the whole result", () => {
    expect(hits(`const roomsResult = await supabase.from("rooms").select("*");`)).toBe(0);
  });

  it("leaves supabase.auth calls alone", () => {
    expect(hits(`const { data } = await supabase.auth.getSession();`)).toBe(0);
    expect(hits(`await supabase.auth.signOut({ scope: "local" });`)).toBe(0);
  });

  it("doesn't count an `error` key nested inside data", () => {
    expect(hits(`const { data: { error } } = await supabase.rpc("x");`)).toBe(1);
  });
});
