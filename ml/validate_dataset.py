import argparse,json
from pathlib import Path
TOOLS={"open_app":{"packageName"},"read_screen":set(),"inspect_screen":set(),"click":{"text","contentDescription","resourceId"},"type_text":{"text","targetText","targetResourceId"},"scroll":{"direction"},"back":set()}
def validate(path):
 errors=[]; count=0
 for n,line in enumerate(Path(path).read_text(encoding="utf-8").splitlines(),1):
  if not line.strip(): continue
  count+=1
  try:
   row=json.loads(line); assistant=json.loads(row["messages"][-1]["content"]); action=assistant.get("action")
   if action=="final":
    if not isinstance(assistant.get("text"),str): raise ValueError("final.text must be a string")
   elif action=="tool_call":
    if assistant.get("tool") not in TOOLS: raise ValueError(f"unknown tool: {assistant.get('tool')}")
    if not isinstance(assistant.get("arguments"),dict): raise ValueError("arguments must be an object")
   else: raise ValueError("action must be tool_call or final")
  except Exception as e: errors.append(f"line {n}: {e}")
 print(f"records={count} valid={count-len(errors)} invalid={len(errors)}")
 for e in errors[:50]: print(e)
 return 1 if errors else 0
if __name__=="__main__":
 p=argparse.ArgumentParser(); p.add_argument("dataset"); a=p.parse_args(); raise SystemExit(validate(a.dataset))
