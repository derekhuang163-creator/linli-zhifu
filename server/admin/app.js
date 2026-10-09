async function api(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
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
    notice.textContent = "开发版：暂未接入管理员登录，请勿直接暴露到公网。数据已更新。";
  } catch (error) {
    console.error("admin dashboard load failed:", error);
    notice.textContent = "后台数据加载失败，请检查后端服务并刷新。";
  }
}
window.loadAll = loadAll;
loadAll();