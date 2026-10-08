const { API_BASE_URL } = require("../../config.js");

function localDemoParse(text, forcedType="") {
  let category = forcedType || "其他生活服务";
  if (/空调|冰箱|洗衣机|家电/.test(text)) category = "家电清洗";
  else if (/打扫|清洁|保洁/.test(text)) category = "家庭清洁";
  else if (/搬|纸箱|家具安装|安装/.test(text)) category = "搬运/安装";
  else if (/买菜|取快递|跑腿|代办/.test(text)) category = "跑腿代办";
  else if (/收纳|整理/.test(text)) category = "收纳整理";
  else if (/宠物|遛狗|喂猫/.test(text)) category = "宠物服务";
  else if (/老人|陪伴|散步/.test(text)) category = "老人生活陪伴";

  const highRisk = ["医疗","打针","输液","护理病人","伤口","换药","儿童独处","孩子独自在家","煤气","燃气","高压电","电箱","开锁","配钥匙","危险品","炸药"];
  const hit = highRisk.find(keyword => text.includes(keyword));
  const quantityMatch = text.match(/(?:两|二)台|([0-9]+)台/);
  const quantity = quantityMatch ? (quantityMatch[1] ? Number(quantityMatch[1]) : 2) : 0;

  return {
    summary:text.slice(0,80),
    category,
    riskLevel:hit ? "L4" : (/老人|陪伴/.test(text) ? "L2" : "L1"),
    dateText:/明天/.test(text) ? "明天" : "待确认",
    timeText:/下午/.test(text) ? "下午" : (/上午/.test(text) ? "上午" : "待确认"),
    durationMinutes:0,
    locationText:"待确认",
    quantity,
    preferences:/离我近|附近/.test(text) ? "优先附近服务者" : "",
    specialNotes:[],
    needsHumanReview:Boolean(hit),
    riskReason:hit ? "命中平台高风险关键词："+hit : "演示规则检查通过"
  };
}

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
      saveAndGo(localDemoParse(text,this.data.type),"miniapp-demo");
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
