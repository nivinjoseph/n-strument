import "../src/index.js";
import assert from "node:assert";
import test, { describe } from "node:test";


await describe("dummy", async () =>
{
    await test("dummy", () =>
    {
        assert.ok(true);
    });
});