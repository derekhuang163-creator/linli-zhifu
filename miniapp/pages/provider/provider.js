const {API_BASE_URL}=require("../../config.js");
Page({
  data:{provider:{id:"p1",name:"李师傅",credit:972,completedOrders:326,status:"approved"},orders:[],loading:false},
  onShow(){this.load();},
  load(){
    if(!API_BASE_URL)return;
    const id=this.data.provider.id;this.setData({loading:true});
    wx.request({url:API_BASE_URL+"/api/providers/"+id+"/orders",success:res=>{if(res.statusCode===200)this.setData({provider:res.data.provider,orders:res.data.orders||[]});},complete:()=>this.setData({loading:false})});
  },
  accept(e){
    const id=e.currentTarget.dataset.id;
    wx.request({url:API_BASE_URL+"/api/providers/"+this.data.provider.id+"/orders/"+id+"/accept",method:"POST",success:res=>{if(res.statusCode===200)this.load();else wx.showToast({title:res.data?.error||"接单失败",icon:"none"});}});
  },
  demoRefresh(){this.load();}
});