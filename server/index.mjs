import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { applyRiskRules, fallbackParse } from "./risk.mjs";

const app=express();
const port=Number(process.env.PORT||3000);
const openai=process.env.OPENAI_API_KEY ? new OpenAI({apiKey:process.env.OPENAI_API_KEY}) : null;
app.use(cors());
app.use(express.json({limit:"64kb"}));

app.get("/health",(_req,res)=>res.json({ok:true,service:"linli-zhifu-server",aiEnabled:Boolean(openai),time:new Date().toISOString()}));

const schema={
  type:"object", additionalProperties:false,
  properties:{
    summary:{type:"string"},
    category:{type:"string",enum:["家庭清洁","家电清洗","搬运/安装","跑腿代办","收纳整理","宠物服务","老人生活陪伴","其他生活服务"]},
    riskLevel:{type:"string",enum:["L1","L2","L3","L4"]},
    dateText:{type:"string"}, timeText:{type:"string"}, durationMinutes:{type:"integer"},
    locationText:{type:"string"}, quantity:{type:"integer"}, preferences:{type:"string"},
    specialNotes:{type:"array",items:{type:"string"}}, needsHumanReview:{type:"boolean"}
  },
  required:["summary","category","riskLevel","dateText","timeText","durationMinutes","locationText","quantity","preferences","specialNotes","needsHumanReview"]
};

app.post("/api/parse-request",async(req,res)=>{
  const text=typeof req.body?.text==="string"?req.body.text.trim():"";
  if(!text) return res.status(400).json({error:"text 不能为空"});
  if(text.length>500) return res.status(400).json({error:"需求描述不能超过500字"});
  try {
    let parsed;
    if(!openai) parsed=fallbackParse(text);
    else {
      const response=await openai.responses.create({
        model:process.env.OPENAI_MODEL||"gpt-6-luna",
        store:false,
        instructions:"你是邻里智服的需求理解助手。只负责把用户自然语言整理成结构化生活服务需求，不直接做最终安全决策。L1普通低风险；L2老人、宠物或较复杂上门服务；L3明显需要专业资质或更高风险；L4平台禁止或必须人工审核。未知日期、时间、地点、数量填写待确认或0。不要编造信息。",
        input:text,
        text:{format:{type:"json_schema",name:"linli_service_request",strict:true,schema}}
      });
      parsed=JSON.parse(response.output_text);
    }
    return res.json({ok:true,source:openai?"ai":"demo",result:applyRiskRules(text,parsed)});
  } catch(error) {
    console.error(error);
    return res.status(502).json({error:"AI需求解析暂时失败",fallback:applyRiskRules(text,fallbackParse(text))});
  }
});

app.post("/api/match",(req,res)=>{
  const request=req.body?.request||{};
  const providers=[
    {id:1,name:"李师傅",distance:"0.8km",orders:326,credit:972,skill:"家电清洗 / 家庭维修",price:80},
    {id:2,name:"王阿姨",distance:"1.2km",orders:214,credit:965,skill:"家庭清洁 / 收纳整理",price:60},
    {id:3,name:"陈师傅",distance:"1.6km",orders:188,credit:958,skill:"搬运 / 家具安装",price:70}
  ];
  const safeProviders=request.riskLevel==="L3"||request.riskLevel==="L4"?[]:providers;
  res.json({ok:true,humanReviewRequired:request.needsHumanReview===true,providers:safeProviders});
});

app.listen(port,()=>console.log("Linli Zhifu server listening on http://localhost:"+port));
