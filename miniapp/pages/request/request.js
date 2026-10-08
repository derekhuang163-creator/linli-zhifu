const { API_BASE_URL } = require("../../config.js");

Page({
  data:{text:"",type:"",canSubmit:false,loading:false},
  onLoad(options){if(options.type)this.setData({type:decodeURIComponent(options.type)})},
  onInput(e){const text=e.detail.value||"";this.setData({text,canSubmit:text.trim().length>0})},
  useExample(e){const text=e.currentTarget.dataset.value||"";this.setData({text,canSubmit:true})},
  analyze(){
    if(!this.data.canSubmit||this.data.loading)return;
    const text=this.data.text.trim(), app=getApp();
    this.setData({loading:true});
    const saveAndGo=(result,source)=>{
      app.globalData.requestDraft={rawText:text,category:result.category||this.data.type||"待AI识别",parsed:result,source};
      this.setData({loading:false});
      wx.navigateTo({url:"/pages/match/match"});
    };
    if(!API_BASE_URL){
      saveAndGo({summary:text.slice(0,80),category:this.data.type||"待AI识别",riskLevel:"L1",dateText:"待确认",timeText:"待确认",durationMinutes:0,locationText:"待确认",quantity:0,preferences:"",specialNotes:[],needsHumanReview:false},"miniapp-demo");
      return;
    }
    wx.request({
      url:API_BASE_URL+"/api/parse-request",method:"POST",
      header:{"content-type":"application/json"},data:{text},
      success:(res)=>{
        if(res.statusCode===200&&res.data?.result)saveAndGo(res.data.result,res.data.source||"ai");
        else{wx.showToast({title:"需求解析失败",icon:"none"});this.setData({loading:false})}
      },
      fail:()=>{wx.showToast({title:"网络连接失败",icon:"none"});this.setData({loading:false})}
    });
  }
})
