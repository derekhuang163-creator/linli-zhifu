Page({
  data:{draft:{parsed:{}},providers:[]},
  onLoad(){
    const app=getApp();
    const draft=app.globalData.requestDraft||{rawText:"请描述你的需求",category:"待AI识别",parsed:{riskLevel:"L1",dateText:"待确认",timeText:"待确认",durationMinutes:0,locationText:"待确认",quantity:0,needsHumanReview:false}};
    const providers=draft.parsed?.needsHumanReview?[]:[
      {id:1,name:"李师傅",distance:"0.8km",orders:326,credit:972,skill:"家电清洗 / 家庭维修",price:80},
      {id:2,name:"王阿姨",distance:"1.2km",orders:214,credit:965,skill:"家庭清洁 / 收纳整理",price:60},
      {id:3,name:"陈师傅",distance:"1.6km",orders:188,credit:958,skill:"搬运 / 家具安装",price:70}
    ];
    this.setData({draft,providers});
  },
  createOrder(){
    if(!this.data.providers.length)return;
    const app=getApp();
    const order={id:"LZ"+Date.now().toString().slice(-8),status:"待确认",provider:this.data.providers[0],request:this.data.draft};
    app.globalData.currentOrder=order;
    wx.navigateTo({url:"/pages/order/order"});
  }
})