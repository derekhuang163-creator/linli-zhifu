const {API_BASE_URL}=require("../../config.js");

Page({
  data:{order:{},history:[],loading:false},
  onShow(){const app=getApp();const order=app.globalData.currentOrder||{};this.setData({order});if(API_BASE_URL&&order.id)this.refresh(order.id);},
  refresh(id){
    wx.request({url:API_BASE_URL+"/api/orders/"+id,success:res=>{if(res.statusCode===200)this.setData({order:res.data.order,history:res.data.history||[]});}});
  },
  nextStatus(){
    const map={PENDING_CONFIRMATION:"WAITING_PROVIDER",WAITING_PROVIDER:"ACCEPTED",ACCEPTED:"ARRIVED",ARRIVED:"IN_SERVICE",IN_SERVICE:"COMPLETED",COMPLETED:"USER_ACCEPTED"};
    const next=map[this.data.order.status];
    if(!next)return;
    this.setData({loading:true});
    if(!API_BASE_URL){
      const now=new Date().toISOString();
      const current=this.data.order;
      const history=this.data.history.concat([{id:"demo-"+Date.now(),from:current.status,to:next,actorType:"demo",actorId:"demo-user",createdAt:now}]);
      const order={...current,status:next,updatedAt:now};
      getApp().globalData.currentOrder=order;
      this.setData({order,history,loading:false});
      return;
    }
    wx.request({url:API_BASE_URL+"/api/orders/"+this.data.order.id+"/status",method:"POST",header:{"content-type":"application/json"},data:{status:next,actorType:"demo",actorId:"demo-user"},
      success:res=>{this.setData({loading:false});if(res.statusCode===200){getApp().globalData.currentOrder=res.data.order;this.setData({order:res.data.order,history:res.data.history||[]});}else wx.showToast({title:res.data?.error||"状态更新失败",icon:"none"});},
      fail:()=>{this.setData({loading:false});wx.showToast({title:"网络连接失败",icon:"none"});}
    );
  },
  backHome(){wx.reLaunch({url:"/pages/index/index"});}
});