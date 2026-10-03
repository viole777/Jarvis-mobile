import argparse
from transformers import AutoTokenizer,AutoModelForCausalLM
def main():
 p=argparse.ArgumentParser(); p.add_argument("--model",required=True); p.add_argument("--prompt",required=True); a=p.parse_args()
 tok=AutoTokenizer.from_pretrained(a.model); model=AutoModelForCausalLM.from_pretrained(a.model,device_map="auto",torch_dtype="auto")
 prompt=tok.apply_chat_template([{"role":"user","content":a.prompt}],tokenize=False,add_generation_prompt=True)
 inputs=tok(prompt,return_tensors="pt").to(model.device)
 out=model.generate(**inputs,max_new_tokens=128,do_sample=False)
 print(tok.decode(out[0][inputs["input_ids"].shape[-1]:],skip_special_tokens=True))
if __name__=="__main__": main()
