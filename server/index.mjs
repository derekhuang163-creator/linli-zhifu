import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import {
  applyRiskRules,
  fallbackParse
} from "./risk.mjs";
import {
  createUser,
  registerProvider,
  listProviders,
  getProvider,
  createOrder,
  getOrder,
  getOrderHistory,
  transitionOrder,
  readDb,
  writeDb
} from "./store.mjs";

const app = express();
const port = Number(process.env.PORT || 3000);
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;
const currentDir = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json({ limit: "64kb" }));
app.use("/admin", express.static(path.join(currentDir, "admin")));

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    category: {
      type: "string",
      enum: ["家庭清洁", "家电清洗", "搬运/安装", "跑腿代办", "收纳整理", "宠物服务", "老人生活陪伴", "其他生活服务"]
    },
    riskLevel: { type: "string", enum: ["L1", "L2", "L3", "L4"] },
    dateText: { type: "string" },
    timeText: { type: "string" },
    durationMinutes: { type: "integer" },
    locationText: { type: "string" },
    quantity: { type: "integer" },
    preferences: { type: "string" },
    specialNotes: { type: "array", items: { type: "string" } },
    needsHumanReview: { type: "boolean" }
  },
  required: [
    "summary", "category", "riskLevel", "dateText", "timeText",
    "durationMinutes", "locationText", "quantity", "preferences",
    "specialNotes", "needsHumanReview"
  ]
};

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "linli-zhifu-server",
    aiEnabled: Boolean(openai),
    time: new Date().toISOString()
  });
});

// Development-only identity endpoint. Replace with WeChat login before production.
app.post("/api/auth/dev-login", (req, res) => {
  const name = String(req.body?.name || "体验用户").slice(0, 40);
  const phone = String(req.body?.phone || "").slice(0, 30);
  res.json({ ok: true, user: createUser({ name, phone }) });
});

app.post("/api/providers/register", (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 40);
  if (!name) return res.status(400).json({ error: "服务者姓名不能为空" });
  const provider = registerProvider({
    name,
    phone: String(req.body?.phone || "").slice(0, 30),
    skills: Array.isArray(req.body?.skills) ? req.body.skills.slice(0, 20) : [],
    serviceRadiusKm: req.body?.serviceRadiusKm,
    priceFrom: req.body?.priceFrom
  });
  res.status(201).json({ ok: true, provider });
});

app.get("/api/providers", (req, res) => {
  const category = String(req.query.category || "");
  const providers = listProviders().filter(provider =>
    !category || provider.skills.some(skill => category.includes(skill) || skill.includes(category))
  );
  res.json({ ok: true, providers: providers.length ? providers : listProviders() });
});

app.get("/api/providers/:id/orders", (req, res) => {
  const provider = getProvider(req.params.id);
  if (!provider) return res.status(404).json({ error: "服务者不存在" });
  const db = readDb();
  const orders = db.orders
    .filter(order => order.providerId === provider.id)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json({ ok: true, provider, orders });
});

app.post("/api/providers/:id/orders/:orderId/accept", (req, res) => {
  const provider = getProvider(req.params.id);
  const order = getOrder(req.params.orderId);
  if (!provider || !order) return res.status(404).json({ error: "服务者或订单不存在" });
  if (provider.status !== "approved") return res.status(403).json({ error: "服务者尚未通过审核" });
  if (order.providerId !== provider.id) return res.status(403).json({ error: "无权操作此订单" });
  try {
    const updated = transitionOrder(order.id, "ACCEPTED", {
      actorType: "provider",
      actorId: provider.id
    });
    res.json({
      ok: true,
      order: { ...updated, provider },
      history: getOrderHistory(updated.id)
    });
  } catch (error) {
    res.status(409).json({ error: error.message || "接单失败" });
  }
});

app.post("/api/providers/:id/orders/:orderId/status", (req, res) => {
  const provider = getProvider(req.params.id);
  const order = getOrder(req.params.orderId);
  const nextStatus = String(req.body?.status || "");
  const providerTransitions = ["ARRIVED", "IN_SERVICE", "COMPLETED"];
  if (!provider || !order) return res.status(404).json({ error: "服务者或订单不存在" });
  if (provider.status !== "approved") return res.status(403).json({ error: "服务者尚未通过审核" });
  if (order.providerId !== provider.id) return res.status(403).json({ error: "无权操作此订单" });
  if (!providerTransitions.includes(nextStatus)) {
    return res.status(400).json({ error: "服务者只能更新到达、开始服务或完成服务状态" });
  }
  try {
    const updated = transitionOrder(order.id, nextStatus, {
      actorType: "provider",
      actorId: provider.id
    });
    res.json({
      ok: true,
      order: { ...updated, provider },
      history: getOrderHistory(updated.id)
    });
  } catch (error) {
    res.status(409).json({ error: error.message || "订单状态更新失败" });
  }
});

app.post("/api/parse-request", async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) return res.status(400).json({ error: "text 不能为空" });
  if (text.length > 500) return res.status(400).json({ error: "需求描述不能超过500字" });

  try {
    let parsed;
    if (!openai) {
      parsed = fallbackParse(text);
    } else {
      const response = await openai.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-6-luna",
        store: false,
        instructions: "你是邻里智服的需求理解助手。只做需求结构化，不做最终安全决策。L1普通低风险；L2老人、宠物或较复杂上门服务；L3需要专业资质；L4禁止或必须人工审核。未知信息填写待确认或0，不要编造。",
        input: text,
        text: { format: { type: "json_schema", name: "linli_service_request", strict: true, schema } }
      });
      parsed = JSON.parse(response.output_text);
    }
    res.json({ ok: true, source: openai ? "ai" : "demo", result: applyRiskRules(text, parsed) });
  } catch (error) {
    console.error("request parsing failed:", error);
    res.status(502).json({
      error: "AI需求解析暂时失败",
      fallback: applyRiskRules(text, fallbackParse(text))
    });
  }
});

app.post("/api/match", (req, res) => {
  const request = req.body?.request || {};
  if (request.needsHumanReview || ["L3", "L4"].includes(request.riskLevel)) {
    return res.json({ ok: true, humanReviewRequired: true, providers: [] });
  }
  const category = String(request.category || "");
  const providers = listProviders().filter(provider =>
    provider.skills.some(skill => category.includes(skill) || skill.includes(category))
  );
  res.json({ ok: true, humanReviewRequired: false, providers: providers.length ? providers : listProviders() });
});

app.post("/api/orders", (req, res) => {
  const { userId, providerId, rawText, request, amount } = req.body || {};
  if (!userId || !providerId || typeof rawText !== "string" || !rawText.trim() || !request) {
    return res.status(400).json({ error: "缺少订单必要字段" });
  }
  if (rawText.length > 500) return res.status(400).json({ error: "需求描述不能超过500字" });
  const provider = getProvider(providerId);
  if (!provider || provider.status !== "approved") return res.status(400).json({ error: "服务者不可用" });
  if (request.needsHumanReview || ["L3", "L4"].includes(request.riskLevel)) {
    return res.status(400).json({ error: "该需求需要人工确认，不能自动下单" });
  }
  const safeAmount = Number(amount);
  if (!Number.isFinite(safeAmount) || safeAmount < 0 || safeAmount > 100000) {
    return res.status(400).json({ error: "订单金额不合法" });
  }
  try {
    const created = createOrder({ userId, providerId, rawText: rawText.trim(), request, amount: safeAmount });
    const order = transitionOrder(created.id, "WAITING_PROVIDER", { actorType: "platform", actorId: "system" });
    return res.status(201).json({ ok: true, order: { ...order, provider }, history: getOrderHistory(order.id) });
  } catch (error) {
    return res.status(400).json({ error: error.message || "订单创建失败" });
  }
});

app.get("/api/orders/:id", (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "订单不存在" });
  res.json({
    ok: true,
    order: { ...order, provider: getProvider(order.providerId) },
    history: getOrderHistory(order.id)
  });
});

// This generic endpoint is for the development demo only. Production must enforce user/provider sessions.
app.post("/api/orders/:id/status", (req, res) => {
  try {
    const order = getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: "订单不存在" });
    const actorType = String(req.body?.actorType || "");
    const nextStatus = String(req.body?.status || "");
    if (actorType !== "demo" && actorType !== "user") {
      return res.status(403).json({ error: "请通过对应的用户或服务者操作入口更新状态" });
    }
    if (actorType === "demo" && process.env.NODE_ENV === "production") {
      return res.status(403).json({ error: "生产环境已禁用演示状态接口" });
    }
    if (actorType === "user" && !["USER_ACCEPTED", "CANCELLED", "DISPUTED"].includes(nextStatus)) {
      return res.status(403).json({ error: "用户不能执行该订单状态变更" });
    }
    const updated = transitionOrder(order.id, nextStatus, {
      actorType,
      actorId: req.body?.actorId || null
    });
    res.json({
      ok: true,
      order: { ...updated, provider: getProvider(updated.providerId) },
      history: getOrderHistory(updated.id)
    });
  } catch (error) {
    res.status(409).json({ error: error.message || "订单状态更新失败" });
  }
});

app.get("/api/admin/overview", (_req, res) => {
  const db = readDb();
  res.json({
    ok: true,
    counts: {
      users: db.users.length,
      providers: db.providers.length,
      approvedProviders: db.providers.filter(provider => provider.status === "approved").length,
      pendingProviders: db.providers.filter(provider => provider.status === "pending").length,
      orders: db.orders.length,
      completedOrders: db.orders.filter(order => order.status === "USER_ACCEPTED").length,
      disputedOrders: db.orders.filter(order => order.status === "DISPUTED").length
    }
  });
});

app.get("/api/admin/providers", (_req, res) => {
  res.json({ ok: true, providers: readDb().providers });
});

app.get("/api/admin/orders", (req, res) => {
  const status = String(req.query.status || "");
  const orders = readDb().orders
    .filter(order => !status || order.status === status)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json({ ok: true, orders });
});

// Development-only admin endpoint; do not expose publicly before admin authentication is added.
app.post("/api/admin/providers/:id/approve", (req, res) => {
  const db = readDb();
  const provider = db.providers.find(item => item.id === req.params.id);
  if (!provider) return res.status(404).json({ error: "服务者不存在" });
  provider.status = "approved";
  provider.approvedAt = new Date().toISOString();
  writeDb(db);
  res.json({ ok: true, provider });
});

app.listen(port, () => {
  console.log("Linli Zhifu server listening on port " + port);
});
