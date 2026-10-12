#!/usr/bin/env python3
"""Export observation structs as a JSON Schema for non-Go router producers."""
import json
from pathlib import Path
import re

root=Path(__file__).resolve().parent.parent
source=(root/'internal/model/model.go').read_text()
definitions={}
def field_type(value):
    if value.startswith('*'):
        return {'anyOf':[field_type(value[1:]),{'type':'null'}]}
    if value.startswith('[]'):
        return {'type':'array','items':field_type(value[2:])}
    if value=='string':return {'type':'string'}
    if value=='bool':return {'type':'boolean'}
    if value in {'int','uint16','uint32','uint64'}:return {'type':'integer'}
    if value=='float64':return {'type':'number'}
    if value=='time.Time':return {'type':'string','format':'date-time'}
    if value in {'json.RawMessage','map[string]any'}:return {'type':'object'}
    return {'$ref':'#/$defs/'+value}
required={'Batch':['version','source_id','boot_id','sequence','sampling_rate','records'],'Record':['id','kind','observed_at','data'],'Device':['id'],'Flow':['id','source_ip','destination_ip','started_at','last_seen','verdict','sampling_rate'],'Policy':['id','counters_scope'],'Event':['id','time'],'DNS':['id']}
for name,body in re.findall(r'type (\w+) struct \{(.*?)\n\}',source,re.S):
    fields={tag:field_type(kind) for _,kind,tag in re.findall(r'\s+(\w+)\s+(\S+)\s+`json:"([^",]+)[^"]*"`',body)}
    definitions[name]={'type':'object','properties':fields,'required':required.get(name,[])}
identifier={'type':'string','pattern':'^[A-Za-z0-9._:-]{1,128}$'}
for name,definition in definitions.items():
    for key in ['id','source_id','boot_id']:
        if key in definition['properties']:definition['properties'][key]=identifier
    if 'sampling_rate' in definition['properties']:definition['properties']['sampling_rate']={'type':'number','exclusiveMinimum':0,'maximum':1}
definitions['Batch']['additionalProperties']=False
definitions['Batch']['properties'].update(version={'const':1},sequence={'type':'integer','minimum':1,'maximum':4611686018427387904},cursor={'type':'string','maxLength':2048},coverage={'type':'string','maxLength':1024},records={'type':'array','maxItems':256,'items':{'$ref':'#/$defs/Record'}})
definitions['Record']['additionalProperties']=False
definitions['Record']['properties']['kind']={'enum':['device','flow','policy','dns','event','network']}
definitions['Record']['allOf']=[{'if':{'properties':{'kind':{'const':kind}}},'then':{'properties':{'data':{'$ref':'#/$defs/'+name}}}} for kind,name in {'device':'Device','flow':'Flow','policy':'Policy','dns':'DNS','event':'Event','network':'Network'}.items()]
definitions['Flow']['properties']['verdict']={'enum':['allowed','blocked','unknown']}
definitions['Policy']['properties']['counters_scope']={'enum':['shared','device','unknown']}
schema={'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:router-console:ingestion:v1','title':'Router Console observation batch v1','$ref':'#/$defs/Batch','$defs':definitions,'description':'Transport bounds, UID authorization, clock tolerance, shared-counter evidence and monotonic sequences are additionally enforced by the application.'}
out=root/'schemas/ingestion-v1.json';out.parent.mkdir(exist_ok=True);out.write_text(json.dumps(schema,indent=2)+'\n')
