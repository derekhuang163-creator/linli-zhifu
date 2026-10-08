import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import {applyRiskRules,fallbackParse} from "./risk.mjs";
import {createUser,registerProvider,listProviders,getProvider,createOrder,getOrder,getOrderHistory,transitionOrder,readDb} from "./store.mjs";

const app=express(),port=Number(process.env.PORT||3000);
const openai=process.env.OPENAI_API_KEY?new OpenAI({apiKey:process.env.OPENAI_API_KEY}):null;
app.use(cors());app.use(express.json({limit:"64kb"}));
app.get("/health",(_req,res)=>res.json({ok:true,service:"linli-zhifu-server",aiEnabled:Boolean(openai),time:new Date().toISOString()}));
const schema={type:"object",additionalProperties:false,properties:{summary:{type:"string"},category:{type:"string",enum:["家庭清洁","家电清洗","搬运/安装","跑腿代办","收纳整理","宠物服务","老人生活陪伴","其他生活服务"]},riskLevel:{type:"string",enum:["L1","L2","L3","L4"]},dateText:{type:"string"},timeText:{type:"string"},durationMinutes:{type:"integer"},locationText:{type:"string"},quantity:{type:"integer"},preferences:{type:"string"},specialNotes:{type:"array",items:{type:"string"}},needsHumanReview:{type:"boolean"}},required:["summary","category","riskLevel","dateText","timeText","durationMinutes","locationText","quantity","preferences","specialNotes","needsHumanReview"]};

app.post("/api/auth/dev-login",(req,res)=>res.json({ok:true,user:createUser({name:req.body?.name||"体验用户",phone:req.body?.phone||""})}));
app.post("/api/providers/register",(req,res)=>{const name=String(req.body?.name||"").trim();if(!name)return res.status(400).json({error:"服务者姓名不能为空"});res.status(201).json({ok:true,provider:registerProvider({name,phone:req.body?.phone,skills:req.body?.skills,serviceRadiusKm:req.body?.serviceRadiusKm,priceFrom:req.body?.priceFrom})});});
app.get("/api/providers",(req,res)=>{const c=String(req.query.category||"");const ps=listProviders().filter(p=>!c||p.skills.some(s=>c.includes(s)||s.includes(c)));res.json({ok:true,providers:ps.length?ps:listProviders()});});

app.post("/api/parse-request",async(req,res)=>{const text=typeof req.body?.text==="string"?req.body.text.trim():"";if(!text)return res.status(400).json({error:"text 不能为空"});try{let parsed;if(!openai)parsed=fallbackParse(text);else{const r=await openai.responses.create({model:process.env.OPENAI_MODEL||"gpt-6-luna",store:false,instructions:"你是邻里智服的需求理解助手。只做需求结构化，不做最终安全决策。L1普通低风险；L2老人、宠物或较复杂上门服务；L3需要专业资质；L4禁止或必须人工审核。未知信息填写待确认或0，不要编造。",input:text,text:{format:{type:"json_schema",name:"linli_service_request",strict:true,schema}}});parsed=JSON.parse(r.output_text);}res.json({ok:true,source:openai?"ai":"demo",result:applyRiskRules(text,parsed)});}catch(e){console.error(e);res.status(502).json({error:"AI需求解析暂时失败",fallback:applyRiskRules(text,fallbackParse(text))});}});

app.post("/api/match",(req,res)=>{const r=req.body?.request||{};if(r.needsHumanReview||["L3","L4"].includes(r.riskLevel))return res.json({ok:true,humanReviewRequired:true,providers:[]});const c=String(r.category||"");const ps=listProviders().filter(p=>p.skills.some(s=>c.includes(s)||s.includes(c)));res.json({ok:true,humanReviewRequired:false,providers:ps.length?ps:listProviders()});});
app.post("/api/orders",(req,res)=>{const {userId,providerId,rawText,request,amount}=req.body||{};if(!userId||!providerId||!rawText||!request)return res.status(400).json({error:"缺少订单必要字段"});const p=getProvider(providerId);if(!p||p.status!=="approved")return res.status(400).json({error:"服务者不可用"});if(request.needsHumanReview||["L3","L4"].includes(request.riskLevel))return res.status(400).json({error:"该需求需要人工确认，不能自动下单"});const o=createOrder({userId,providerId,rawText,request,amount});res.status(201).json({ok:true,order:transitionOrder(o.id,"WAITING_PROVIDER",{actorType:"platform",actorId:"system"})});});
app.get("/api/orders/:id",(req,res)=>{const o=getOrder(req.params.id);if(!o)return res.status(404).json({error:"订单不存在"});res.json({ok:true,order:o,history:getOrderHistory(o.id)});});
app.post("/api/orders/:id/status",(req,res)=>{try{const o=transitionOrder(req.params.id,req.body?.status,{actorType:req.body?.actorType,actorId:req.body?.actorId});if(!o)return res.status(404).json({error:"订单不存在"});res.json({ok:true,order:o,history:getOrderHistory(o.id)});}catch(e){res.status(409).json({error:e.message});}});
app.get("/api/admin/overview",(_req,res)=>{const db=readDb();res.json({ok:true,counts:{users:db.users.length,providers:db.providers.length,approvedProviders:db.providers.filter(p=>p.status==="approved").length,orders:db.orders.length,completedOrders:db.orders.filter(o=>o.status==="USER_ACCEPTED").length,disputedOrders:db.orders.filter(o=>o.status==="DISPUTED").length}});});
app.listen(port,()=>console.log("Linli Zhifu server listening on http://localhost:"+port));