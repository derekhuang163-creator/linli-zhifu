const { API_BASE_URL } = require("../../config.js");

const STATUS_TEXT = {
  PENDING_CONFIRMATION: "待确认",
  WAITING_PROVIDER: "等待服务者接单",
  ACCEPTED: "服务者已接单",
  ARRIVED: "服务者已到达",
  IN_SERVICE: "服务进行中",
  COMPLETED: "服务已完成",
  USER_ACCEPTED: "用户已确认完成",
  CANCELLED: "已取消",
  DISPUTED: "售后处理中"
};

function statusText(status) {
  return STATUS_TEXT[status] || status || "状态待更新";
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = n => String(n).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" +
    pad(date.getDate()) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
}

Page({
  data: {
    provider: { id: "p1", name: "李师傅", credit: 972, completedOrders: 326, status: "approved" },
    orders: [],
    loading: false,
    errorText: ""
  },

  onShow() {
    this.load();
  },

  load() {
    if (!API_BASE_URL) {
      const order = getApp().globalData.currentOrder;
      const belongsToProvider = order && (!order.provider || !order.provider.id || order.provider.id === this.data.provider.id);
      const orders = belongsToProvider ? [{
        id: order.id,
        rawText: (order.request && order.request.rawText) || order.rawText || "未填写服务需求",
        status: order.status || "WAITING_PROVIDER",
        statusText: statusText(order.status),
        createdAt: order.createdAt || "",
        createdAtText: formatTime(order.createdAt)
      }] : [];
      this.setData({ orders, loading: false, errorText: "" });
      return;
    }

    const id = this.data.provider.id;
    this.setData({ loading: true, errorText: "" });
    wx.request({
      url: API_BASE_URL + "/api/providers/" + encodeURIComponent(id) + "/orders",
      timeout: 10000,
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          this.setData({
            provider: res.data.provider || this.data.provider,
            orders: (res.data.orders || []).map(order => ({
              ...order,
              statusText: statusText(order.status),
              createdAtText: formatTime(order.createdAt)
            })),
            errorText: ""
          });
        } else {
          this.setData({ errorText: "订单加载失败，请稍后刷新。" });
        }
      },
      fail: (err) => {
        console.error("provider orders load failed:", err);
        this.setData({ errorText: "网络连接失败，请检查后端服务。" });
      },
      complete: () => this.setData({ loading: false })
    });
  },

  accept(e) {
    const orderId = e.currentTarget.dataset.id;
    if (!orderId || this.data.loading) return;

    if (!API_BASE_URL) {
      const app = getApp();
      const current = app.globalData.currentOrder;
      if (!current || current.id !== orderId) {
        wx.showToast({ title: "找不到这笔订单，请刷新", icon: "none" });
        return;
      }
      if (current.status !== "WAITING_PROVIDER") {
        wx.showToast({ title: "该订单当前不能接单", icon: "none" });
        return;
      }

      const now = new Date().toISOString();
      const history = Array.isArray(current.history) ? current.history.slice() : [];
      history.push({
        id: "demo-" + Date.now(),
        from: current.status,
        to: "ACCEPTED",
        actorType: "provider",
        actorId: this.data.provider.id,
        createdAt: now
      });
      app.globalData.currentOrder = {
        ...current,
        status: "ACCEPTED",
        updatedAt: now,
        history
      };
      wx.showToast({ title: "接单成功", icon: "success" });
      this.load();
      return;
    }

    this.setData({ loading: true });
    wx.request({
      url: API_BASE_URL + "/api/providers/" + encodeURIComponent(this.data.provider.id) + "/orders/" + encodeURIComponent(orderId) + "/accept",
      method: "POST",
      timeout: 10000,
      header: { "content-type": "application/json" },
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.order) {
          wx.showToast({ title: "接单成功", icon: "success" });
          this.load();
        } else {
          wx.showToast({ title: (res.data && res.data.error) || "接单失败", icon: "none" });
        }
      },
      fail: (err) => {
        console.error("accept order failed:", err);
        wx.showToast({ title: "网络连接失败", icon: "none" });
      },
      complete: () => this.setData({ loading: false })
    });
  },

  demoRefresh() {
    this.load();
  }
});