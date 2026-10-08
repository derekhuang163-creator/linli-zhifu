const { API_BASE_URL } = require("../../config.js");

Page({
  data: {
    order: {
      id: "",
      status: "PENDING_CONFIRMATION",
      statusText: "待确认",
      provider: {
        name: "待匹配",
        credit: 0,
        priceFrom: 0
      },
      request: {
        rawText: ""
      }
    },
    history: [],
    loading: false,
    pageReady: false
  },

  onLoad() {
    this.loadCurrentOrder();
  },

  onShow() {
    this.loadCurrentOrder();
  },

  loadCurrentOrder() {
    const app = getApp();
    const savedOrder = app.globalData.currentOrder;

    if (!savedOrder) {
      this.setData({
        pageReady: true,
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
          }
        },
        history: []
      });
      return;
    }

    const provider = savedOrder.provider || {};
    const request = savedOrder.request || {};

    const order = {
      id: savedOrder.id || "",
      status: savedOrder.status || "PENDING_CONFIRMATION",
      statusText: savedOrder.statusText || savedOrder.status || "待确认",
      provider: {
        name: provider.name || "待确认",
        credit: provider.credit || 0,
        priceFrom: provider.priceFrom || provider.price || 0
      },
      request: {
        rawText: request.rawText || "未填写服务需求"
      },
      amount: savedOrder.amount || 0,
      createdAt: savedOrder.createdAt || "",
      updatedAt: savedOrder.updatedAt || ""
    };

    this.setData({
      order: order,
      pageReady: true,
      history: []
    });

    if (API_BASE_URL && order.id) {
      this.refresh(order.id);
    }
  },

  refresh(id) {
    wx.request({
      url: API_BASE_URL + "/api/orders/" + id,
      method: "GET",
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.order) {
          getApp().globalData.currentOrder = res.data.order;
          this.setData({
            order: res.data.order,
            history: res.data.history || []
          });
        }
      },
      fail: (err) => {
        console.error("load order failed", err);
      }
    });
  },

  nextStatus() {
    const currentStatus = this.data.order.status;

    const map = {
      PENDING_CONFIRMATION: "WAITING_PROVIDER",
      WAITING_PROVIDER: "ACCEPTED",
      ACCEPTED: "ARRIVED",
      ARRIVED: "IN_SERVICE",
      IN_SERVICE: "COMPLETED",
      COMPLETED: "USER_ACCEPTED"
    };

    const next = map[currentStatus];
    if (!next) {
      return;
    }

    this.setData({
      loading: true
    });

    if (!API_BASE_URL) {
      const now = new Date().toISOString();
      const current = this.data.order;
      const order = {
        id: current.id,
        status: next,
        statusText: next,
        provider: current.provider,
        request: current.request,
        amount: current.amount || 0,
        createdAt: current.createdAt || now,
        updatedAt: now
      };

      const history = this.data.history.concat([{
        id: "demo-" + Date.now(),
        from: currentStatus,
        to: next,
        actorType: "demo",
        actorId: "demo-user",
        createdAt: now
      }]);

      getApp().globalData.currentOrder = order;

      this.setData({
        order: order,
        history: history,
        loading: false
      });
      return;
    }

    wx.request({
      url: API_BASE_URL + "/api/orders/" + current.id + "/status",
      method: "POST",
      header: {
        "content-type": "application/json"
      },
      data: {
        status: next,
        actorType: "demo",
        actorId: "demo-user"
      },
      success: (res) => {
        this.setData({
          loading: false
        });

        if (res.statusCode === 200 && res.data && res.data.order) {
          getApp().globalData.currentOrder = res.data.order;
          this.setData({
            order: res.data.order,
            history: res.data.history || []
          });
        } else {
          wx.showToast({
            title: (res.data && res.data.error) || "状态更新失败",
            icon: "none"
          });
        }
      },
      fail: () => {
        this.setData({
          loading: false
        });
        wx.showToast({
          title: "网络连接失败",
          icon: "none"
        });
      }
    });
  },

  backHome() {
    wx.reLaunch({
      url: "/pages/index/index"
    });
  }
});
