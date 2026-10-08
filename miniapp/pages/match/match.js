const {API_BASE_URL}=require("../../config.js");

Page({
  data:{draft:{parsed:{}},providers:[],loading:false},
  onLoad(){
    const app=getApp();
    const draft=app.globalData.requestDraft||{rawText:"请描述你的需求",category:"待AI识别",parsed:{riskLevel:"L1",dateText:"待确认",timeText:"待确认",durationMinutes:0,locationText:"待确认",quantity:0,needsHumanReview:false}};
    this.setData({draft});
    if(API_BASE_URL&&!draft.parsed?.needsHumanReview)this.loadProviders(draft.parsed);
    else if(!API_BASE_URL&&!draft.parsed?.needsHumanReview)this.setData({providers:[
      {id:"p1",name:"李师傅",distance:"0.8km",completedOrders:326,credit:972,skills:["家电清洗","家庭维修"],priceFrom:80},
      {id:"p2",name:"王阿姨",distance:"1.2km",completedOrders:214,credit:965,skills:["家庭清洁","收纳整理"],priceFrom:60},
      {id:"p3",name:"陈师傅",distance:"1.6km",completedOrders:188,credit:958,skills:["搬运/安装","家具安装"],priceFrom:70}
    ]});
  },
  loadProviders(request){
    this.setData({loading:true});
    wx.request({url:API_BASE_URL+"/api/match",method:"POST",header:{"content-type":"application/json"},data:{request},
      success:res=>this.setData({providers:res.data?.providers||[],loading:false}),
      fail:()=>{wx.showToast({title:"匹配服务失败",icon:"none"});this.setData({loading:false});}
    });
  },
  createOrder(){
    if(!this.data.providers.length||this.data.loading)return;
    const provider=this.data.providers[0],app=getApp();
    if(!API_BASE_URL){
      const order={id:"LZ"+Date.now().toString().slice(-8),status:"待确认",provider,request:this.data.draft};
      app.globalData.currentOrder=order;wx.navigateTo({url:"/pages/order/order"});return;
    }
    wx.showLoading({title:"创建订单"});
    wx.request({url:API_BASE_URL+"/api/auth/dev-login",method:"POST",header:{"content-type":"application/json"},data:{name:"体验用户"},
      success:login=>{
        const userId=login.data?.user?.id;
        if(!userId)return this.failOrder("登录失败");
        wx.request({url:API_BASE_URL+"/api/orders",method:"POST",header:{"content-type":"application/json"},
          data:{userId,providerId:provider.id,rawText:this.data.draft.rawText,request:this.data.draft.parsed,amount:provider.priceFrom},
          success:res=>{wx.hideLoading();if(res.statusCode===201&&res.data?.order){app.globalData.currentOrder=res.data.order;wx.navigateTo({url:"/pages/order/order"});}else this.failOrder(res.data?.error);},
          fail:()=>this.failOrder("网络连接失败")
        });
      },fail:()=>this.failOrder("登录失败")
    });
  },
  failOrder(message){wx.hideLoading();wx.showToast({title:message||"订单创建失败",icon:"none"});}
});