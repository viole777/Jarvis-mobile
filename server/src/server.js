import http from "node:http";
import { Orchestrator } from "./brain/orchestrator.js";
import { MemoryManager } from "./brain/memory.js";
import { IndependentCognitiveEngine, CognitiveStateStore, SelfModelStore } from "./brain/cognitive/index.js";
import { deriveSelfModel } from "./brain/cognitive/self-model.js";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const AUTH_TOKEN = process.env.JARVIS_AUTH_TOKEN || "";

function json(res,status,body){
  const data=JSON.stringify(body);
  res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":process.env.JARVIS_CORS_ORIGIN||"*","Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Content-Length":Buffer.byteLength(data)});
  res.end(data);
}
function authorized(req){return !AUTH_TOKEN || req.headers.authorization===`Bearer ${AUTH_TOKEN}`;}
async function readBody(req){let body="";for await(const chunk of req)body+=chunk;if(body.length>2000000)throw new Error("Request body too large");return JSON.parse(body||"{}");}

const cognitiveStateStore=new CognitiveStateStore();
const selfModelStore=new SelfModelStore();
const cognitive=new IndependentCognitiveEngine();

async function handleCognitiveObserve(req,res){
  if(!authorized(req))return json(res,401,{error:"Unauthorized"});
  const body=await readBody(req);
  const subjectId=String(body.subjectId||"default");
  const observation=String(body.observation||body.event||"").trim();
  if(!observation)return json(res,400,{error:"observation is required"});
  const previousState=cognitiveStateStore.get(subjectId);
  const previousSelf=selfModelStore.get(subjectId);
  const evaluation=cognitive.evaluate({previousState,observations:[{type:String(body.type||"lab_observation"),content:observation,timestamp:new Date().toISOString()}],context:{subjectId,mode:"cognitive-lab",objective:String(body.objective||"understand the current situation"),selfModel:previousSelf}});
  cognitiveStateStore.set(subjectId,evaluation);
  const nextSelf=selfModelStore.set(subjectId,deriveSelfModel(evaluation,previousSelf));
  selfModelStore.recordAction(subjectId,evaluation.recommendedAction);
  return json(res,200,{ok:true,observation,cognitiveState:evaluation,selfModel:nextSelf});
}
function handleCognitiveState(req,res,url){
  if(!authorized(req))return json(res,401,{error:"Unauthorized"});
  const subjectId=String(url.searchParams.get("subjectId")||"default");
  return json(res,200,{ok:true,cognitiveState:cognitiveStateStore.get(subjectId),selfModel:selfModelStore.get(subjectId)});
}
async function handleCognitiveReset(req,res){
  if(!authorized(req))return json(res,401,{error:"Unauthorized"});
  const body=await readBody(req);const subjectId=String(body.subjectId||"default");
  cognitiveStateStore.clear(subjectId);selfModelStore.clear(subjectId);
  return json(res,200,{ok:true,subjectId});
}
const server=http.createServer(async(req,res)=>{
  try{
    if(req.method==="OPTIONS")return json(res,204,{});
    const url=new URL(req.url,"http://localhost");
    if(req.method==="GET"&&url.pathname==="/")return json(res,200,{ok:true,name:"Jarvis Beta",status:"online",cognitiveLab:true,voice:false});
    if(req.method==="GET"&&url.pathname==="/health")return json(res,200,{ok:true,service:"jarvis-server",cognitiveLab:true});
    if(req.method==="GET"&&url.pathname==="/v1/cognitive/state")return handleCognitiveState(req,res,url);
    if(req.method==="POST"&&url.pathname==="/v1/cognitive/observe")return await handleCognitiveObserve(req,res);
    if(req.method==="POST"&&url.pathname==="/v1/cognitive/reset")return await handleCognitiveReset(req,res);
    return json(res,404,{error:"Not found"});
  }catch(error){return json(res,500,{error:error instanceof Error?error.message:"Internal server error"});}
});
server.listen(PORT,HOST,()=>console.log(`Jarvis server listening on http://${HOST}:${PORT}`));
