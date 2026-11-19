import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { stagingMediaDir } from "./mediaDir.ts";

test("screenshots use STAGING_E2E_MEDIA and otherwise stay in e2e/output/media", () => {
  const fallback = stagingMediaDir(undefined);
  assert.equal(
    fallback.endsWith(`${path.sep}e2e${path.sep}output${path.sep}media`),
    true,
  );
  assert.equal(fallback.includes(`${path.sep}cursor${path.sep}stores${path.sep}`), false);
  assert.equal(stagingMediaDir("   "), fallback);
  assert.equal(stagingMediaDir("  /tmp/shots  "), "/tmp/shots");
});
