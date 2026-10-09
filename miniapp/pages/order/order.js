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
  DISPUTED: "售后处理中",
  NO_ORDER: "暂无订单"
};

function getStatusText(status) {
  return STATUS_TEXT[status] || status || "待确认";
}

function formatTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" +
    pad(d.getMonth() + 1) + "-" +
    pad(d.getDate()) + " " +
    pad(d.getHours()) + ":" +
    pad(d.getMinutes());
}

function normalizeHistory(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    ...item,
    id: item.id || ("history-" + index),
    statusText: getStatusText(item.to || item.status),
    timeText: formatTime(item.createdAt)
  }));
}

function normalizeOrder(savedOrder) {
  const source = savedOrder || {};
  const provider = source.provider || {};
  const request = source.request || {};

  return {
    id: source.id || "",
    status: source.status || "PENDING_CONFIRMATION",
    statusText: getStatusText(source.status),
    provider: {
      name: provider.name || "待确认",
      credit: Number(provider.credit || 0),
      priceFrom: Number(provider.priceFrom || provider.price || 0)
    },
    request: {
      rawText: request.rawText || source.rawText || "未填写服务需求"
    },
    amount: Number(source.amount || 0),
    createdAt: source.createdAt || "",
    updatedAt: source.updatedAt || ""
  };
}

Page({
  data: {
    order: {
      id: "",
      status: "NO_ORDER",
      statusText: "暂无订单",
      provider: {
        name: "暂无服务者",
        credit: 0,
        priceFrom: 0
      },
      request: {
        rawText: ""
      },
      amount: 0,
      createdAt: "",
      updatedAt: ""
    },
    history: [],
    loading: false,
    pageReady: false,
    errorText: ""
  },

  onLoad() {
    this.loadCurrentOrder();
  },

  onShow() {
    // Refresh from shared app state when returning from the provider workspace.
    if (this.data.pageReady) {
      this.syncFromAppState();
    } else {
      this.loadCurrentOrder();
    }
  },

  syncFromAppState() {
    const savedOrder = getApp().globalData.currentOrder;
    if (!savedOrder) return;
    const order = normalizeOrder(savedOrder);
    this.setData({
      order,
      history: normalizeHistory(savedOrder.history || this.data.history),
      errorText: ""
    });
    if (API_BASE_URL && order.id) this.refresh(order.id);
  },

  loadCurrentOrder() {
    const app = getApp();
    const savedOrder = app.globalData.currentOrder;

    if (!savedOrder) {
      this.setData({
        pageReady: true,
        errorText: "",
        order: {
          id: "",
          status: "NO_ORDER",
          statusText: "暂无订单",
          provider: {
            name: "暂无服务者",
            credit: 0,
            priceFrom: 0
          },
          request: {
            rawText: "当前没有可显示的订单"
          },
          amount: 0,
          createdAt: "",
          updatedAt: ""
        },
        history: []
      });
      return;
    }

    const order = normalizeOrder(savedOrder);

    this.setData({
      order,
      pageReady: true,
      errorText: "",
      history: normalizeHistory(savedOrder.history || [])
    });

    if (API_BASE_URL && order.id) {
      this.refresh(order.id);
    }
  },

  refresh(id) {
    wx.request({
      url: API_BASE_URL + "/api/orders/" + encodeURIComponent(id),
      method: "GET",
      timeout: 10000,
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.order) {
          const order = normalizeOrder(res.data.order);
          const history = normalizeHistory(res.data.history);

          getApp().globalData.currentOrder = { ...res.data.order, history };

          this.setData({
            order,
            history,
            errorText: ""
          });
          return;
        }

        console.error("load order failed:", res.statusCode, res.data);
        this.setData({
          errorText: "订单详情暂时无法更新，当前仍显示本地订单信息。"
        });
      },
      fail: (err) => {
        console.error("load order request failed:", err);
        this.setData({
          errorText: "订单网络更新失败，当前仍显示本地订单信息。"
        });
      }
    });
  },

  nextStatus() {
    const currentStatus = this.data.order.status;

    const nextMap = {
      PENDING_CONFIRMATION: "WAITING_PROVIDER",
      COMPLETED: "USER_ACCEPTED"
    };

    const next = nextMap[currentStatus];
    if (!next || this.data.loading) return;

    this.setData({ loading: true });

    if (!API_BASE_URL) {
      const now = new Date().toISOString();
      const current = this.data.order;
      const order = {
        id: current.id || ("LZ" + Date.now().toString().slice(-8)),
        status: next,
        statusText: getStatusText(next),
        provider: current.provider,
        request: current.request,
        amount: current.amount || 0,
        createdAt: current.createdAt || now,
        updatedAt: now
      };

      const history = normalizeHistory((Array.isArray(current.history) ? current.history : this.data.history).concat([{
        id: "demo-" + Date.now(),
        from: currentStatus,
        to: next,
        actorType: "demo",
        actorId: "demo-user",
        createdAt: now
      }]));
      order.history = history;

      getApp().globalData.currentOrder = order;

      this.setData({
        order,
        history,
        loading: false,
        errorText: ""
      });
      return;
    }

    const orderId = this.data.order.id;

    wx.request({
      url: API_BASE_URL + "/api/orders/" + encodeURIComponent(orderId) + "/status",
      method: "POST",
      timeout: 10000,
      header: {
        "content-type": "application/json"
      },
      data: {
        status: next,
        actorType: "demo",
        actorId: "demo-user"
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.order) {
          const order = normalizeOrder(res.data.order);
          const history = normalizeHistory(res.data.history);

          getApp().globalData.currentOrder = { ...res.data.order, history };

          this.setData({
            order,
            history,
            loading: false,
            errorText: ""
          });
          return;
        }

        this.setData({ loading: false });
        wx.showToast({
          title: (res.data && res.data.error) || "状态更新失败",
          icon: "none"
        });
      },
      fail: (err) => {
        console.error("update order status failed:", err);
        this.setData({ loading: false });
        wx.showToast({
          title: "网络连接失败",
          icon: "none"
        });
      }
    });
  },

  openProviderWorkspace() {
    wx.navigateTo({
      url: "/pages/provider/provider",
      fail: (err) => {
        console.error("open provider workspace failed:", err);
        wx.showToast({ title: "服务者工作台打开失败", icon: "none" });
      }
    });
  },

  backHome() {
    wx.reLaunch({
      url: "/pages/index/index"
    });
  }
});
