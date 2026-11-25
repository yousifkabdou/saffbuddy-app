// Lint rule: a database call's result must not have its `error` thrown away.
//
// Supabase doesn't throw when a query fails: it returns { data: null, error }. Code that only
// reads `data` silently treats a failure (offline, RLS refusal, bad column) as "no rows". That
// caused the profile-check bug, where offline users were sent to the setup screen.
//
// Covers supabase.from(...) and supabase.rpc(...) (the database). supabase.auth calls aren't
// covered: getSession reads the login saved on the phone, and the one ignored signOut is
// deliberate (see profile.tsx).
//
// Built from no-restricted-syntax selectors (AST patterns), so no plugin is needed.
// A result kept whole (`const result = await supabase.from(...)`) is allowed: the code can still
// read result.error, which a lint rule can't follow.

const DB_CALL = "MemberExpression[object.name='supabase'][property.name=/^(from|rpc)$/]";

const MESSAGE =
  "Check the error from this database call: destructure `error` and handle it. " +
  "Supabase returns failures as { error } instead of throwing.";

module.exports = [
  {
    // const { data } = await supabase.from(...)...   (no `error` in the braces)
    // The braces (ObjectPattern) are the subject, so `:has(> Property)` only looks at their own
    // keys, not keys nested inside them. (esquery doesn't support a multi-step `:has(> A > B)`.)
    selector: `VariableDeclarator:has(${DB_CALL}) > ObjectPattern:not(:has(> Property[key.name='error']))`,
    message: MESSAGE,
  },
  {
    // await supabase.from(...).delete()...;   (result not kept at all)
    selector: `ExpressionStatement > AwaitExpression:has(${DB_CALL})`,
    message: MESSAGE,
  },
];
