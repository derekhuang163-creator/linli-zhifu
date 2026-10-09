import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const dataDir=path.resolve(process.env.DATA_DIR||"./data");
const dataFile=path.join(dataDir,"linli.json");

const seedProviders=[
  {id:"p1",name:"李师傅",phone:"13800000001",skills:["家电清洗","家庭维修"],serviceRadiusKm:5,credit:972,completedOrders:326,status:"approved",priceFrom:80},
  {id:"p2",name:"王阿姨",phone:"13800000002",skills:["家庭清洁","收纳整理"],serviceRadiusKm:4,credit:965,completedOrders:214,status:"approved",priceFrom:60},
  {id:"p3",name:"陈师傅",phone:"13800000003",skills:["搬运/安装","家具安装"],serviceRadiusKm:6,credit:958,completedOrders:188,status:"approved",priceFrom:70}
];

const empty=()=>({users:[],providers:seedProviders,orders:[],orderStatusHistory:[],creditEvents:[]});

function ensure(){
  fs.mkdirSync(dataDir,{recursive:true});
  if(!fs.existsSync(dataFile)) fs.writeFileSync(dataFile,JSON.stringify(empty(),null,2));
}
function load(){ensure();return JSON.parse(fs.readFileSync(dataFile,"utf8"));}
function save(db){ensure();const tmp=dataFile+".tmp";fs.writeFileSync(tmp,JSON.stringify(db,null,2));fs.renameSync(tmp,dataFile);}
export function now(){return new Date().toISOString();}
export function id(prefix){return prefix+"_"+randomUUID().replaceAll("-","").slice(0,16);}
export function readDb(){return load();}
export function writeDb(db){save(db);return db;}
export function findById(list,value){return list.find(x=>x.id===value)||null;}
export function upsert(list,item){const i=list.findIndex(x=>x.id===item.id);if(i>=0)list[i]=item;else list.push(item);return item;}
export function createUser({name="体验用户",phone=""}={}){const db=load();const user={id:id("u"),name,phone,createdAt:now()};db.users.push(user);save(db);return user;}
export function getProvider(idValue){return findById(load().providers,idValue);}
export function listProviders(){return load().providers.filter(p=>p.status==="approved");}
export function createOrder(input){
  const db=load();
  if (!findById(db.users, input.userId)) throw new Error("用户不存在");
  const provider = findById(db.providers, input.providerId);
  if (!provider || provider.status !== "approved") throw new Error("服务者不可用");
  const createdAt = now();
  const order={id:id("LZ"),userId:input.userId,providerId:input.providerId,rawText:input.rawText,request:input.request,amount:Number(input.amount||0),status:"PENDING_CONFIRMATION",createdAt,updatedAt:createdAt};
  db.orders.push(order);
  db.orderStatusHistory.push({id:id("osh"),orderId:order.id,from:null,to:order.status,actorType:"user",actorId:order.userId,createdAt:order.createdAt});
  save(db);return order;
}
export function getOrder(orderId){return findById(load().orders,orderId);}
export function transitionOrder(orderId,to,{actorType="system",actorId=null}={}){
  const db=load();const order=findById(db.orders,orderId);if(!order) return null;
  const allowed={
    PENDING_CONFIRMATION:["WAITING_PROVIDER","CANCELLED"],
    WAITING_PROVIDER:["ACCEPTED","CANCELLED"],
    ACCEPTED:["ARRIVED","CANCELLED"],
    ARRIVED:["IN_SERVICE","CANCELLED"],
    IN_SERVICE:["COMPLETED","DISPUTED"],
    COMPLETED:["USER_ACCEPTED","DISPUTED"],
    USER_ACCEPTED:[],
    CANCELLED:[],
    DISPUTED:[]
  };
  if(!allowed[order.status]?.includes(to)) throw new Error("不允许从 "+order.status+" 变更为 "+to);
  const from=order.status;order.status=to;order.updatedAt=now();
  db.orderStatusHistory.push({id:id("osh"),orderId,from,to,actorType,actorId,createdAt:order.updatedAt});
  if(to==="USER_ACCEPTED"&&order.providerId){
    const provider=findById(db.providers,order.providerId);
    if(provider){provider.completedOrders+=1;provider.credit=Math.min(1000,provider.credit+2);db.creditEvents.push({id:id("ce"),providerId:provider.id,orderId,delta:2,reason:"订单完成并获用户验收",createdAt:order.updatedAt});}
  }
  save(db);return order;
}
export function getOrderHistory(orderId){return load().orderStatusHistory.filter(x=>x.orderId===orderId);}
export function registerProvider(input){
  const db=load();const provider={id:id("p"),name:input.name,phone:input.phone||"",skills:Array.isArray(input.skills)?input.skills:[],serviceRadiusKm:Number(input.serviceRadiusKm||5),credit:700,completedOrders:0,status:"pending",priceFrom:Number(input.priceFrom||0),createdAt:now()};
  db.providers.push(provider);save(db);return provider;
}
