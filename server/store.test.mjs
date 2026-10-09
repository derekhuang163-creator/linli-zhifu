import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "linli-zhifu-test-"));
process.env.DATA_DIR = tempDir;
const store = await import("./store.mjs?test=" + Date.now());

test("order lifecycle persists each allowed transition and history event", () => {
  const user = store.createUser({ name: "测试用户" });
  const provider = store.getProvider("p1");
  assert.ok(provider, "seed provider p1 should exist");

  const created = store.createOrder({
    userId: user.id,
    providerId: provider.id,
    rawText: "测试家庭清洁",
    request: { category: "家庭清洁", riskLevel: "L1", needsHumanReview: false },
    amount: 60
  });

  assert.equal(created.status, "PENDING_CONFIRMATION");
  assert.equal(store.transitionOrder(created.id, "WAITING_PROVIDER", { actorType: "platform" }).status, "WAITING_PROVIDER");
  assert.equal(store.transitionOrder(created.id, "ACCEPTED", { actorType: "provider", actorId: provider.id }).status, "ACCEPTED");
  assert.equal(store.transitionOrder(created.id, "ARRIVED", { actorType: "provider", actorId: provider.id }).status, "ARRIVED");
  assert.equal(store.transitionOrder(created.id, "IN_SERVICE", { actorType: "provider", actorId: provider.id }).status, "IN_SERVICE");
  assert.equal(store.transitionOrder(created.id, "COMPLETED", { actorType: "provider", actorId: provider.id }).status, "COMPLETED");
  assert.equal(store.transitionOrder(created.id, "USER_ACCEPTED", { actorType: "user", actorId: user.id }).status, "USER_ACCEPTED");

  const history = store.getOrderHistory(created.id);
  assert.equal(history.length, 7);
  assert.equal(history.at(-1).to, "USER_ACCEPTED");
  assert.equal(store.getOrder(created.id).status, "USER_ACCEPTED");
});

test("order lifecycle rejects illegal status jumps", () => {
  const user = store.createUser({ name: "状态校验用户" });
  const order = store.createOrder({
    userId: user.id,
    providerId: "p1",
    rawText: "测试订单",
    request: { category: "家庭清洁", riskLevel: "L1", needsHumanReview: false },
    amount: 60
  });

  assert.throws(
    () => store.transitionOrder(order.id, "COMPLETED", { actorType: "provider", actorId: "p1" }),
    /不允许从/
  );
  assert.equal(store.getOrder(order.id).status, "PENDING_CONFIRMATION");
});

test("test data is isolated in a temporary directory", () => {
  assert.ok(fs.existsSync(path.join(tempDir, "linli.json")));
  fs.rmSync(tempDir, { recursive: true, force: true });
});
test("order creation rejects unknown user references", () => {
  assert.throws(() => store.createOrder({
    userId: "missing-user",
    providerId: "p1",
    rawText: "测试需求",
    request: { category: "家庭清洁", riskLevel: "L1", needsHumanReview: false },
    amount: 60
  }), /用户不存在/);
});

test("production provider listing never exposes seeded demo providers", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    assert.deepEqual(store.listProviders(), []);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
