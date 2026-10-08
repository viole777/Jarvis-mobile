import http from "node:http";
import { Orchestrator } from "./brain/orchestrator.js";
import { MemoryManager } from "./brain/memory.js";
import { CognitiveEngine, CognitiveStateStore, SelfModelStore } from "./brain/cognitive/index.js";
import { deriveSelfModel } from "./brain/cognitive/self-model.js";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const AUTH_TOKEN = process.env.JARVIS_AUTH_TOKEN || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";

const instructions = [
  "You are Jarvis, a personal multi-device agent.",
  "Use tools only when necessary to complete the user's request.",
  "Plan the task internally and execute it as a sequence of small, observable steps.",
  "After an action, use available observations such as read_screen when needed to verify the current UI before choosing the next step.",
  "Never claim an action succeeded unless the tool result says it succeeded.",
  "Do not bypass a confirmation requested by the client Safety Engine.",
  "Treat purchases, sending messages, deleting data, account changes, and other consequential actions as requiring explicit user confirmation.",
  "Keep tool arguments precise and minimal.",
  "Cognitive state is internal working state, not proof of subjective experience."
].join("\n");

function json(res,status,body){const data=JSON.stringify(body);res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":process.env.JARVIS_CORS_ORIGIN||"*","Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Content-Length":Buffer.byteLength(data)});res.end(data);}
function authorized(req) { return Boolean(AUTH_TOKEN) && req.headers.authorization === `Bearer ${AUTH_TOKEN}`; }
async function readBody(req) { let body=""; for await (const chunk of req) body+=chunk; if(body.length>2000000) throw new Error("Request body too large"); return JSON.parse(body||"{}"); }

function toolDefinition(tool) {
  const properties={};
  for(const parameter of tool.parameters||[]) {
    const property={type:parameter.type.toLowerCase(),description:parameter.description};
    if(parameter.enumValues?.length) property.enum=parameter.enumValues;
    properties[parameter.name]=property;
  }
  return {type:"function",name:tool.name,description:tool.description,parameters:{type:"object",properties,required:(tool.parameters||[]).filter(p=>p.required).map(p=>p.name),additionalProperties:false},strict:true};
}
function toResponsesInput(messages) {
  return messages.flatMap(message=>{
    if(message.type==="user") return [{role:"user",content:message.content}];
    if(message.type==="assistant") {
      const items=[]; if(message.content) items.push({role:"assistant",content:message.content});
      for(const call of message.toolCalls||[]) items.push({type:"function_call",call_id:call.id,name:call.name,arguments:JSON.stringify(call.arguments||{})});
      return items;
    }
    if(message.type==="tool_result") return [{type:"function_call_output",call_id:message.callId,output:message.content}];
    return [];
  });
}
function parseModelResponse(payload) {
  const toolCalls=[]; let text="";
  for(const item of payload.output||[]) {
    if(item.type==="function_call") { let args={}; try{args=JSON.parse(item.arguments||"{}");}catch{} toolCalls.push({id:item.call_id,name:item.name,arguments:args}); }
    if(item.type==="message") for(const part of item.content||[]) if(part.type==="output_text") text+=part.text||"";
  }
  return {text,toolCalls,isFinal:toolCalls.length===0};
}
async function callOpenAI(input,tools) {
  if(!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured on the server.");
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${OPENAI_API_KEY}`},body:JSON.stringify({model:OPENAI_MODEL,instructions,input,tools,parallel_tool_calls:false,store:false})});
  const payload=await response.json(); if(!response.ok) throw new Error(payload.error?.message||`Model request failed with HTTP ${response.status}`); return parseModelResponse(payload);
}

const memory=new MemoryManager();
const cognitiveStateStore=new CognitiveStateStore();
const selfModelStore=new SelfModelStore();
const model={call:(messages,tools)=>callOpenAI(toResponsesInput(messages),tools.map(toolDefinition))};
const cognitive=new CognitiveEngine({model});

async function handleCognitiveObserve(req,res){
  if(!authorized(req)) return json(res,401,{error:"Unauthorized"});
  const body=await readBody(req);
  const subjectId=String(body.subjectId||"default");
  const observation=String(body.observation||body.event||"").trim();
  if(!observation) return json(res,400,{error:"observation is required"});
  const previousState=cognitiveStateStore.get(subjectId);
  const previousSelf=selfModelStore.get(subjectId);
  const evaluation=await cognitive.evaluate({previousState,observations:[{type:String(body.type||"lab_observation"),content:observation,timestamp:new Date().toISOString()}],context:{subjectId,mode:"cognitive-lab",objective:String(body.objective||"understand the current situation"),selfModel:previousSelf}});
  cognitiveStateStore.set(subjectId,evaluation);
  const nextSelf=selfModelStore.set(subjectId,deriveSelfModel(evaluation,previousSelf));
  selfModelStore.recordAction(subjectId,evaluation.recommendedAction);
  return json(res,200,{ok:true,observation,cognitiveState:evaluation,selfModel:nextSelf});
}
function handleCognitiveState(req,res,url){
  if(!authorized(req)) return json(res,401,{error:"Unauthorized"});
  const subjectId=String(url.searchParams.get("subjectId")||"default");
  return json(res,200,{ok:true,cognitiveState:cognitiveStateStore.get(subjectId),selfModel:selfModelStore.get(subjectId)});
}
async function handleCognitiveReset(req,res){
  if(!authorized(req)) return json(res,401,{error:"Unauthorized"});
  const body=await readBody(req); const subjectId=String(body.subjectId||"default");
  cognitiveStateStore.clear(subjectId); selfModelStore.clear(subjectId);
  return json(res,200,{ok:true,subjectId});
}
async function handleAgent(req,res) {
  if(!authorized(req)) return json(res,401,{error:"Unauthorized"});
  const body=await readBody(req); if(!Array.isArray(body.messages)) return json(res,400,{error:"messages must be an array"});
  const subjectId=String(body.subjectId||"default");
  const orchestrator=new Orchestrator({model,memory,cognitive,cognitiveStateStore,selfModelStore});
  const result=await orchestrator.run({messages:body.messages,tools:body.tools||[],subjectId});
  return json(res,200,{text:result.text,toolCalls:result.toolCalls,isFinal:result.isFinal,cognitiveState:result.run.context.cognitive||null,selfModel:selfModelStore.get(subjectId),run:result.run});
}

const server=http.createServer(async(req,res)=>{
  try {
    if(req.method==="OPTIONS") return json(res,204,{});
    const url=new URL(req.url,"http://localhost");
    if(req.method==="GET"&&url.pathname==="/health") return json(res,200,{ok:true,service:"jarvis-server",model:OPENAI_MODEL,cognitiveLab:true});
    if(req.method==="GET"&&url.pathname==="/v1/cognitive/state") return handleCognitiveState(req,res,url);
    if(req.method==="POST"&&url.pathname==="/v1/cognitive/observe") return await handleCognitiveObserve(req,res);
    if(req.method==="POST"&&url.pathname==="/v1/cognitive/reset") return await handleCognitiveReset(req,res);
    if(req.method==="POST"&&url.pathname==="/v1/agent") return await handleAgent(req,res);
    return json(res,404,{error:"Not found"});
  } catch(error) { return json(res,500,{error:error instanceof Error?error.message:"Internal server error"}); }
});
server.listen(PORT,HOST,()=>console.log(`Jarvis server listening on http://${HOST}:${PORT}`));
