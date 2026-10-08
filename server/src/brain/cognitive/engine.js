import { createCognitiveState, mergeCognitiveState } from "./state.js";

function level(value){return value==="high"?.85:value==="medium"?.55:.2;}
function textFeatures(text){
  const s=String(text||"").toLowerCase();
  return {
    absence:/\b(sumiu|ausente|não apareceu|nao apareceu|desapareceu|não respondeu|nao respondeu|silêncio|silencio)\b/.test(s),
    normal:/\b(normal|habitual|rotina|costuma)\b/.test(s),
    uncertainty:/\b(não sei|nao sei|desconhecido|sem explicação|sem explicacao|incerto|nenhuma explicação|nenhuma explicacao)\b/.test(s),
    danger:/\b(perigo|urgente|emergência|emergencia|ameaça|ameaca|risco)\b/.test(s),
    returnEvent:/\bvoltou|retornou|apareceu novamente|respondeu\b/.test(s),
    user:/\b(luiz|usuário|usuario)\b/.test(s)
  };
}
function hypothesis(statement,confidence,evidenceFor,evidenceAgainst=[]){return {statement,confidence,evidenceFor,evidenceAgainst};}

export class CognitiveEngine {
  async evaluate({previousState,observations=[],context={}}){
    const state=createCognitiveState(previousState||{});
    const recent=observations.slice(-20);
    const combined=recent.map(o=>o.content).join(" ");
    const f=textFeatures(combined);
    const previousConcern=level(state.concern);
    const previousUncertainty=level(state.uncertainty);
    const hasPattern=recent.length>=2;
    const concern=Math.min(1,Math.max(.05,previousConcern+(f.absence?.25:0)+(f.danger?.35:0)-(f.returnEvent?.35:0)));
    const uncertainty=Math.min(1,Math.max(.05,previousUncertainty*.45+(f.uncertainty?.35:0)+(hasPattern?.08:0)));
    const curiosity=Math.min(1,.25+(f.uncertainty?.35:0)+(f.absence?.2:0)+(hasPattern?.15:0));
    const confidence=Math.max(.1,1-uncertainty);
    const hypotheses=[];
    if(f.absence){
      hypotheses.push(hypothesis("Mudança de rotina ou indisponibilidade temporária",hasPattern?"medium":"low",["houve ausência em relação ao padrão"],["não há evidência suficiente sobre a causa"]));
      hypotheses.push(hypothesis("Existe uma causa ainda desconhecida",f.uncertainty?"high":"medium",["a explicação não está disponível"],["não há evidência direta de uma causa específica"]));
    } else {
      hypotheses.push(hypothesis("A situação observada é compatível com a informação disponível",confidence>0.7?"high":"medium",["a observação não indica uma anomalia forte"]));
    }
    if(f.returnEvent) hypotheses.push(hypothesis("A ausência anterior foi resolvida", "high",["o usuário voltou ou respondeu"]));
    let recommendedAction="observe";
    if(f.danger) recommendedAction="investigate";
    else if(f.returnEvent) recommendedAction="respond";
    else if(f.absence&&uncertainty>.45) recommendedAction="investigate";
    else if(f.absence) recommendedAction="wait";
    const summary=f.absence
      ? "Foi detectada uma mudança em relação à presença ou rotina esperada do usuário."
      : "A situação atual não apresenta uma anomalia forte nas observações recebidas.";
    return mergeCognitiveState(state,{
      situationSummary:summary,
      beliefs:recent.slice(-8).map(o=>String(o.content)),
      hypotheses,
      goals:["entender a situação","reduzir incerteza","agir proporcionalmente"],
      attention:f.absence?["padrão de presença do usuário","novas evidências","explicações alternativas"]:["novas observações"],
      uncertainty:uncertainty>.7?"high":uncertainty>.35?"medium":"low",
      concern:concern>.7?"high":concern>.35?"medium":"low",
      curiosity:curiosity>.7?"high":curiosity>.35?"medium":"low",
      confidence:confidence>.7?"high":confidence>.35?"medium":"low",
      urgency:f.danger||concern>.75?"high":concern>.4?"medium":"low",
      recommendedAction,
      reason:f.returnEvent?"A nova evidência reduz a preocupação anterior.":f.absence?"A ausência aumentou a prioridade de entender o que aconteceu, mas ainda não justifica concluir que há perigo.":"Não há evidência suficiente para elevar a prioridade.",
      lastObservationAt:new Date().toISOString(),
      meta:{engine:"jarvis-independent-bootstrap",context}
    });
  }
}
