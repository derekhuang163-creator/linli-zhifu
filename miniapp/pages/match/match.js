const { API_BASE_URL } = require("../../config.js");

const DEMO_PROVIDERS = [
  {
    id: "p1",
    name: "李师傅",
    distance: "0.8km",
    completedOrders: 326,
    credit: 972,
    skillsText: "家电清洗 · 家庭维修",
    priceFrom: 80
  },
  {
    id: "p2",
    name: "王阿姨",
    distance: "1.2km",
    completedOrders: 214,
    credit: 965,
    skillsText: "家庭清洁 · 收纳整理",
    priceFrom: 60
  },
  {
    id: "p3",
    name: "陈师傅",
    distance: "1.6km",
    completedOrders: 188,
    credit: 958,
    skillsText: "搬运/安装 · 家具安装",
    priceFrom: 70
  }
];

Page({
  data: {
    draft: {
      rawText: "",
      category: "待AI识别",
      source: "miniapp-demo",
      parsed: {
        riskLevel: "L1",
        dateText: "待确认",
        timeText: "待确认",
        durationMinutes: 0,
        locationText: "待确认",
        quantity: 0,
        needsHumanReview: false
      }
    },
    providers: [],
    loading: false,
    pageReady: false,
    errorText: ""
  },

  onLoad() {
    const app = getApp();
    const savedDraft = app.globalData.requestDraft;

    const draft = savedDraft || this.data.draft;
    const parsed = draft.parsed || this.data.draft.parsed;
    const needsHumanReview = Boolean(parsed.needsHumanReview);

    this.setData({
      draft: draft,
      pageReady: true,
      errorText: ""
    });

    if (needsHumanReview) {
      return;
    }

    if (!API_BASE_URL) {
      this.setData({
        providers: DEMO_PROVIDERS,
        loading: false
      });
      return;
    }

    this.loadProviders(parsed);
  },

  loadProviders(request) {
    this.setData({
      loading: true,
      errorText: "",
      providers: []
    });

    wx.request({
      url: API_BASE_URL + "/api/match",
      method: "POST",
      header: {
        "content-type": "application/json"
      },
      data: {
        request: request
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data && Array.isArray(res.data.providers)) {
          this.setData({
            providers: res.data.providers,
            loading: false
          });
          return;
        }

        this.setData({
          providers: [],
          loading: false,
          errorText: "匹配接口没有返回服务者，请检查后端服务。"
        });
      },
      fail: (err) => {
        console.error("match request failed", err);
        this.setData({
          providers: [],
          loading: false,
          errorText: "连接匹配服务失败，请检查后端地址和网络配置。"
        });
      }
    });
  },

  createOrder() {
    if (this.data.loading || !this.data.providers.length) {
      return;
    }

    const provider = this.data.providers[0];
    const app = getApp();

    if (!API_BASE_URL) {
      const now = new Date().toISOString();
      const order = {
        id: "LZ" + Date.now().toString().slice(-8),
        status: "PENDING_CONFIRMATION",
        statusText: "待确认",
        provider: provider,
        request: this.data.draft,
        amount: Number(provider.priceFrom || provider.price || 0),
        createdAt: now,
        updatedAt: now
      };

      app.globalData.currentOrder = order;

      wx.navigateTo({
        url: "/pages/order/order",
        fail: (err) => {
          console.error("navigate to order failed", err);
          wx.showToast({
            title: "订单页面打开失败",
            icon: "none"
          });
        }
      });
      return;
    }

    wx.showLoading({
      title: "创建订单"
    });

    wx.request({
      url: API_BASE_URL + "/api/auth/dev-login",
      method: "POST",
      header: {
        "content-type": "application/json"
      },
      data: {
        name: "体验用户"
      },
      success: (login) => {
        const userId = login.data && login.data.user && login.data.user.id;

        if (!userId) {
          this.failOrder("登录失败");
          return;
        }

        wx.request({
          url: API_BASE_URL + "/api/orders",
          method: "POST",
          header: {
            "content-type": "application/json"
          },
          data: {
            userId: userId,
            providerId: provider.id,
            rawText: this.data.draft.rawText,
            request: this.data.draft.parsed,
            amount: provider.priceFrom || provider.price || 0
          },
          success: (res) => {
            wx.hideLoading();

            if (res.statusCode === 201 && res.data && res.data.order) {
              app.globalData.currentOrder = res.data.order;
              wx.navigateTo({
                url: "/pages/order/order",
                fail: (err) => {
                  console.error("navigate to order failed", err);
                  wx.showToast({
                    title: "订单页面打开失败",
                    icon: "none"
                  });
                }
              });
              return;
            }

            this.failOrder((res.data && res.data.error) || "订单创建失败");
          },
          fail: () => {
            this.failOrder("网络连接失败");
          }
        });
      },
      fail: () => {
        this.failOrder("登录失败");
      }
    });
  },

  failOrder(message) {
    wx.hideLoading();
    wx.showToast({
      title: message || "订单创建失败",
      icon: "none"
    });
  }
});
