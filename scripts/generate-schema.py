#!/usr/bin/env python3
"""Export observation structs as a JSON Schema for non-Go router producers."""
import json
from pathlib import Path
import re

root=Path(__file__).resolve().parent.parent
source=(root/'internal/model/model.go').read_text()+'\n'+(root/'internal/model/snapshot.go').read_text()
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
definitions['Record']['properties']['kind']={'enum':['device','flow','policy','dns','event','network','rule','application','appliance']}
definitions['Record']['allOf']=[{'if':{'properties':{'kind':{'const':kind}}},'then':{'properties':{'data':{'$ref':'#/$defs/'+name}}}} for kind,name in {'device':'Device','flow':'Flow','policy':'Policy','dns':'DNS','event':'Event','network':'Network','rule':'Policy','application':'Application','appliance':'Appliance'}.items()]
definitions['Flow']['properties']['verdict']={'enum':['allowed','blocked','unknown']}
definitions['Policy']['properties']['counters_scope']={'enum':['shared','device','unknown']}
schema={'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:router-console:ingestion:v1','title':'Router Console observation batch v1','$ref':'#/$defs/Batch','$defs':definitions,'description':'Transport bounds, UID authorization, clock tolerance, shared-counter evidence and monotonic sequences are additionally enforced by the application.'}
out=root/'schemas/ingestion-v1.json';out.parent.mkdir(exist_ok=True);out.write_text(json.dumps(schema,indent=2)+'\n')

# Embedded metadata is expanded explicitly for language-neutral producers.
for name in ['SnapshotChunk','SnapshotCommit']:
    definitions[name]['properties']={**definitions['SnapshotIdentity']['properties'],**definitions[name]['properties']}
    definitions[name]['required']=list(definitions[name]['properties'])
    definitions[name]['additionalProperties']=False
    definitions[name]['properties']['version']={'const':2}
    definitions[name]['properties']['scope']={'enum':['devices','policies','appliance','network']}
    definitions[name]['properties']['sequence']={'type':'integer','minimum':1,'maximum':4611686018427387904}
definitions['SnapshotChunk']['properties']['records']={'type':'array','maxItems':256,'items':{'$ref':'#/$defs/Record'}}
definitions['SnapshotChunk']['properties']['index']={'type':'integer','minimum':0,'maximum':65535}
definitions['SnapshotCommit']['properties']['digest']={'type':'string','pattern':'^[0-9a-f]{64}$'}
definitions['SnapshotCommit']['properties']['complete']={'const':True}
definitions['SnapshotCommit']['properties']['chunks']={'type':'integer','minimum':1,'maximum':65536}
definitions['SnapshotCommit']['properties']['records']={'type':'integer','minimum':0,'maximum':65536}
for name in ['Application','Appliance','SourceStatus']:
    definitions[name]['required']=[field for field in definitions[name]['properties'] if field!='expires_at']
definitions['Application']['properties']['lifecycle']={'enum':['active','expired_pending_removal','confirmed_removed','unknown']}
definitions['SourceStatus']['additionalProperties']=False
definitions['SourceStatus']['properties']['version']={'const':2}
definitions['SourceStatus']['properties']['status']={'enum':['current','missing','failed','partial','unsupported']}
for name,suffix in [('SnapshotChunk','snapshot-chunk'),('SnapshotCommit','snapshot-commit'),('SourceStatus','source-status')]:
    doc={'$schema':schema['$schema'],'$id':'urn:router-console:ingestion:v2:'+suffix,'$ref':'#/$defs/'+name,'$defs':definitions}
    (root/'schemas'/('ingestion-v2-'+suffix+'.json')).write_text(json.dumps(doc,indent=2)+'\n')
