function getAdminToken() { return sessionStorage.getItem("linliAdminToken") || ""; }
async function api(url) {
  const headers = { Accept: "application/json" };
  const token = getAdminToken();
  if (token) headers.Authorization = "Bearer " + token;
  const response = await fetch(url, { headers, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "请求失败：" + response.status);
  return data;
}
function textNode(tag, text, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = String(text == null ? "" : text);
  return node;
}
function replaceChildrenByText(target, rows) {
  target.replaceChildren(...rows);
}
async function loadAll() {
  const notice = document.querySelector(".notice");
  try {
    const [overview, providerData, orderData] = await Promise.all([
      api("/api/admin/overview"),
      api("/api/admin/providers"),
      api("/api/admin/orders")
    ]);
    const labels = {
      users: "用户数", providers: "服务者数", approvedProviders: "已审核服务者",
      pendingProviders: "待审核服务者", orders: "订单数",
      completedOrders: "已验收订单", disputedOrders: "售后中订单"
    };
    replaceChildrenByText(document.getElementById("stats"),
      Object.entries(overview.counts || {}).map(([key, value]) => {
        const card = textNode("div", "", "stat");
        card.appendChild(textNode("div", labels[key] || key));
        card.appendChild(textNode("div", Number(value) || 0, "n"));
        return card;
      }));
    replaceChildrenByText(document.getElementById("providers"),
      (providerData.providers || []).map(item =>
        textNode("div", (item.name || "未命名服务者") + " · " +
          (item.status || "未知状态") + " · 信用 " + (Number(item.credit) || 0), "item")));
    replaceChildrenByText(document.getElementById("orders"),
      (orderData.orders || []).map(item =>
        textNode("div", (item.id || "无订单号") + " · " +
          (item.status || "未知状态") + " · " + (item.rawText || "无需求描述"), "item")));
    notice.textContent = "后台数据已更新。";
  } catch (error) {
    console.error("admin dashboard load failed:", error);
    notice.textContent = error.message || "后台数据加载失败，请检查后端服务并刷新。";
  }
}
document.getElementById("adminToken").value = getAdminToken();
document.getElementById("saveToken").addEventListener("click", () => {
  const token = document.getElementById("adminToken").value.trim();
  if (!token) { document.querySelector(".notice").textContent = "请先输入管理员 Token。"; return; }
  sessionStorage.setItem("linliAdminToken", token);
  loadAll();
});
document.getElementById("clearToken").addEventListener("click", () => {
  sessionStorage.removeItem("linliAdminToken");
  document.getElementById("adminToken").value = "";
  document.querySelector(".notice").textContent = "已清除当前会话 Token。";
  document.getElementById("stats").replaceChildren();
  document.getElementById("providers").replaceChildren();
  document.getElementById("orders").replaceChildren();
});
window.loadAll = loadAll;
if (getAdminToken()) loadAll();