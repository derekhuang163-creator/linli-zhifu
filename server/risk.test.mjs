import test from "node:test";
import assert from "node:assert/strict";
import { applyRiskRules, fallbackParse } from "./risk.mjs";

test("high-risk requests are always marked L4 and require human review", () => {
  const result = applyRiskRules("请帮我给老人打针", {
    category: "老人生活陪伴",
    riskLevel: "L1",
    needsHumanReview: false
  });
  assert.equal(result.riskLevel, "L4");
  assert.equal(result.needsHumanReview, true);
  assert.match(result.riskReason, /打针/);
});

test("AI L3/L4 risk level cannot bypass human review", () => {
  for (const riskLevel of ["L3", "L4"]) {
    const result = applyRiskRules("需要专业处理", {
      riskLevel,
      needsHumanReview: false
    });
    assert.equal(result.needsHumanReview, true);
  }
});

test("ordinary household cleaning can use fallback parsing", () => {
  const result = applyRiskRules("明天下午来家里打扫卫生", fallbackParse("明天下午来家里打扫卫生"));
  assert.equal(result.category, "家庭清洁");
  assert.equal(result.riskLevel, "L1");
  assert.equal(result.needsHumanReview, false);
});

test("elderly companionship is classified as L2", () => {
  const result = fallbackParse("下午陪老人散步聊天");
  assert.equal(result.category, "老人生活陪伴");
  assert.equal(result.riskLevel, "L2");
});
