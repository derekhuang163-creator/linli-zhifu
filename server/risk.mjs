const HIGH_RISK = ["医疗","打针","输液","护理病人","伤口","换药","儿童独处","孩子独自在家","煤气","燃气","高压电","电箱","开锁","配钥匙","危险品","搬炸药"];

export function applyRiskRules(text, aiResult) {
  const hit = HIGH_RISK.find((keyword) => text.includes(keyword));
  if (hit) return {...aiResult, riskLevel:"L4", needsHumanReview:true, riskReason:"命中平台高风险关键词："+hit};
  if (aiResult.riskLevel === "L3" || aiResult.riskLevel === "L4") return {...aiResult, needsHumanReview:true};
  return {...aiResult, riskReason:"规则检查通过"};
}

export function fallbackParse(text) {
  let category="其他生活服务";
  if (/打扫|清洁|保洁/.test(text)) category="家庭清洁";
  else if (/空调|冰箱|洗衣机|家电/.test(text)) category="家电清洗";
  else if (/搬|纸箱|家具安装|安装/.test(text)) category="搬运/安装";
  else if (/买菜|取快递|跑腿|代办/.test(text)) category="跑腿代办";
  else if (/收纳|整理/.test(text)) category="收纳整理";
  else if (/宠物|遛狗|喂猫/.test(text)) category="宠物服务";
  else if (/老人|陪伴|散步/.test(text)) category="老人生活陪伴";
  return {summary:text.slice(0,80),category,riskLevel:/老人|陪伴/.test(text)?"L2":"L1",dateText:"待确认",timeText:"待确认",durationMinutes:0,locationText:"待确认",quantity:0,preferences:"",specialNotes:[],needsHumanReview:false};
}
