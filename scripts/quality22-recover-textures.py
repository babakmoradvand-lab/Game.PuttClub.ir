"""Recover only exactly named source assets from the official Poly Haven API.
A same-name catalog match is not proof of byte identity to the author's missing file.
No fuzzy asset replacement. Verify catalog MD5 and retain SHA-256 provenance.
"""
from pathlib import Path
import json,re,urllib.request,urllib.error,hashlib,concurrent.futures
ROOT=Path('.cache/quality22/recovered-textures');ROOT.mkdir(parents=True,exist_ok=True)
AUDIT=Path('audit/quality22/recovery');AUDIT.mkdir(parents=True,exist_ok=True)
UA='PuttClub-original-source-recovery/1.0'
names=Path('audit/quality22/missing-textures.txt').read_text().splitlines()
pattern=re.compile(r'^(.*)_(arm|diff|Diffuse|Rough|rough|nor_gl)_1k\.jpg$')
parsed=[]
for name in names:
 m=pattern.fullmatch(name);assert m,name
 parsed.append((name,m.group(1),m.group(2)))
assets=sorted({a for _,a,_ in parsed})
def get(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':UA}),timeout=45)as r:return r.read()
def index(asset):
 url='https://api.polyhaven.com/files/'+asset
 try:
  b=get(url);data=json.loads(b);(AUDIT/(asset+'.json')).write_bytes(b)
  return asset,{'status':'catalog-found','url':url,'data':data}
 except Exception as e:return asset,{'status':'catalog-unavailable','url':url,'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=3)as pool:indices=dict(pool.map(index,assets))
keys={'Diffuse':['Diffuse','diff'],'diff':['Diffuse','diff'],'Rough':['Rough','rough'],'rough':['Rough','rough'],'nor_gl':['nor_gl'],'arm':['arm']}
def recover(item):
 name,asset,channel=item;base={'filename':name,'assetId':asset,'catalogURL':indices[asset]['url'],'originalMissingFileHashKnown':False,'byteIdentityToAuthorFile':'not provable from supplied package'}
 idx=indices[asset]
 if idx['status']!='catalog-found':return {**base,'status':'unresolved','reason':idx['error']}
 # Some model APIs nest their texture maps under a named mesh or an export format.
 candidates=[]
 def walk(d,path=()):
  if not isinstance(d,dict):return
  for k,v in d.items():
   if k in keys[channel] and isinstance(v,dict):
    info=v.get('1k',{}).get('jpg')
    if isinstance(info,dict)and 'url'in info:candidates.append((path+(k,'1k','jpg'),info))
   if isinstance(v,dict):walk(v,path+(k,))
 walk(idx['data'])
 # Never select a texture belonging to another named asset.
 candidates=[(p,x)for p,x in candidates if asset+'_'in x['url'].split('/')[-1]]
 unique={x['url']:(p,x)for p,x in candidates}
 if len(unique)!=1:return {**base,'status':'unresolved','reason':'Expected exactly one same-name 1K JPG channel match','candidates':list(unique)}
 path,info=next(iter(unique.values()))
 try:
  b=get(info['url']);md5=hashlib.md5(b).hexdigest()
  if info.get('md5')and info['md5']!=md5:raise ValueError('catalog MD5 mismatch')
  if info.get('size')and info['size']!=len(b):raise ValueError('catalog size mismatch')
  if b[:2]!=b'\xff\xd8':raise ValueError('not a JPEG')
  target=ROOT/name;target.write_bytes(b)
  return {**base,'status':'recovered-same-asset-catalog-verified','sourceURL':info['url'],'catalogPath':list(path),'size':len(b),'md5':md5,'sha256':hashlib.sha256(b).hexdigest(),'license':'Poly Haven CC0','cachePath':str(target)}
 except Exception as e:return {**base,'status':'unresolved','sourceURL':info['url'],'reason':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=3)as pool:results=list(pool.map(recover,parsed))
report={'scope':'Exact same asset ID and channel from official catalog only; not a claim that the original missing author files had these byte hashes','assets':[{k:v for k,v in indices[a].items()if k!='data'}|{'assetId':a}for a in assets],'requested':len(results),'recovered':sum(r['status'].startswith('recovered')for r in results),'files':results}
(AUDIT/'results.json').write_text(json.dumps(report,indent=2))
print('Recovered',report['recovered'],'/',report['requested'],flush=True)
for r in results:
 if r['status']=='unresolved':print(r['filename'],r['reason'],flush=True)
