from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.parse import urlparse, parse_qs, urlencode
from pathlib import Path
import json
import re
from html.parser import HTMLParser
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent
SKILLS = ['Overall','Attack','Defence','Strength','Hitpoints','Ranged','Prayer','Magic','Cooking','Woodcutting','Fletching','Fishing','Firemaking','Crafting','Smithing','Mining','Herblore','Agility','Thieving','Slayer','Farming','Runecraft','Hunter','Construction','Sailing']
SKILL_NAMES = [s for s in SKILLS if s != 'Overall']
SKILL_PATTERN = '|'.join(sorted(map(re.escape, SKILL_NAMES), key=len, reverse=True))
WIKI_API = 'https://oldschool.runescape.wiki/api.php'

def wiki_api(params):
    url = WIKI_API + '?' + urlencode({'format':'json', **params})
    req = Request(url, headers={
        'User-Agent':'OSRSCharacterPlanner/3.1 (personal educational project; quest requirements)',
        'Accept':'application/json'})
    with urlopen(req, timeout=20) as response:
        result = json.load(response)
    if 'error' in result:
        raise ValueError(result['error'].get('info','Wiki request failed'))
    return result

class PlainText(HTMLParser):
    def __init__(self):
        super().__init__(); self.words=[]; self.skip=0
    def handle_starttag(self,tag,attrs):
        if tag in ('style','script'): self.skip+=1
        if tag in ('li','tr','p','br','td','th'): self.words.append(' ')
        if tag=='img' and not self.skip:
            alt=dict(attrs).get('alt','')
            self.words.append(' '+alt+' ')
    def handle_endtag(self,tag):
        if tag in ('style','script') and self.skip:self.skip-=1
    def handle_data(self,data):
        if not self.skip:self.words.append(data)

def skill_levels(text):
    found={}
    patterns=[
        rf'(?<!\d)(\d{{1,2}})\s*(?:\[\[[^\]]+\]\]\s*)?({SKILL_PATTERN})\b',
        rf'\b({SKILL_PATTERN})\s*(?:\|\s*|level\s*)(\d{{1,2}})\b',
    ]
    for index,pat in enumerate(patterns):
        for m in re.finditer(pat,text,re.I):
            level=int(m.group(1 if index==0 else 2)); raw=m.group(2 if index==0 else 1)
            skill=next((x for x in SKILL_NAMES if x.casefold()==raw.casefold()),None)
            if skill and 1<=level<=99:found[skill]=max(level,found.get(skill,0))
    return found

def get_quest(title):
    # The Wiki's Questreq template is specifically designed to supply quest skill
    # requirements. Expanding it avoids depending on headings in quest page HTML.
    page=wiki_api({'action':'query','titles':title,'redirects':'1','prop':'info'})
    entries=list(page['query']['pages'].values())
    if not entries or 'missing' in entries[0]:raise ValueError('Quest not found on the OSRS Wiki')
    canonical=entries[0]['title']
    template='{{Questreq|'+canonical+'|skills}}'
    data=wiki_api({'action':'parse','title':canonical,'text':template,'contentmodel':'wikitext','prop':'text'})
    parser=PlainText();parser.feed(data['parse']['text']['*'])
    requirements=skill_levels(' '.join(parser.words))
    source='OSRS Wiki Questreq template'
    if not requirements:
        # Fallback: read quest-details wikitext, where skill requirements are
        # commonly expressed as {{SCP|Skill|Level}} templates.
        data=wiki_api({'action':'parse','page':canonical,'prop':'wikitext'})
        wiki=data['parse']['wikitext']['*']
        matches=re.findall(r'\{\{\s*(?:SCP|Skillreq|Skill req)\s*\|\s*('+SKILL_PATTERN+r')\s*\|\s*(\d{1,2})',wiki,re.I)
        for raw,level in matches:
            skill=next((x for x in SKILL_NAMES if x.casefold()==raw.casefold()),None)
            if skill:requirements[skill]=max(int(level),requirements.get(skill,0))
        source='OSRS Wiki quest page wikitext'
    if not requirements:
        raise ValueError('Wiki did not return readable skill requirements for this quest; nothing was imported')
    return {'title':canonical,'skills':requirements,
            'wiki':'https://oldschool.runescape.wiki/w/'+quote(canonical.replace(' ','_')),
            'note':'Skill requirements from '+source+'. Verify quest prerequisites, boosts, and special conditions on the wiki.'}

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT),**kwargs)
    def do_GET(self):
        url=urlparse(self.path)
        if url.path == '/api/quest':
            title=parse_qs(url.query).get('name',[''])[0].strip()
            if not title or len(title)>100:return self.send_json({'error':'Enter a valid quest name'},400)
            try:return self.send_json(get_quest(title))
            except Exception as exc:return self.send_json({'error':'Could not retrieve quest requirements from the wiki','detail':str(exc)[:160]},502)
        if url.path != '/api/hiscores': return super().do_GET()
        player=parse_qs(url.query).get('player',['dcstorms'])[0].strip()
        if not player or len(player)>12 or not all(c.isalnum() or c in ' _-' for c in player): return self.send_json({'error':'Invalid OSRS username'},400)
        endpoint='https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws?'+urlencode({'player':player})
        try:
            req=Request(endpoint,headers={'User-Agent':'OSRSCharacterPlanner/1.0 (personal educational project)','Accept':'text/plain'})
            with urlopen(req,timeout=15) as response: body=response.read().decode('utf-8-sig')
            lines=body.strip().splitlines()
            if len(lines)<len(SKILLS): raise ValueError('Unexpected Hiscores response')
            skills={}
            for name,line in zip(SKILLS,lines):
                parts=line.split(',')
                if len(parts)<3: raise ValueError('Unexpected skill row')
                rank,level,xp=map(int,parts[:3]);skills[name]={'rank':rank,'level':level,'xp':xp}
            self.send_json({'player':player,'skills':skills})
        except Exception as exc:
            self.send_json({'error':'Unable to retrieve Hiscores. Check the username, Jagex availability, or try again later.','detail':str(exc)[:180]},502)
    def send_json(self,obj,status=200):
        body=json.dumps(obj).encode();self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
if __name__=='__main__':
    print('Open http://localhost:8000 in your browser')
    ThreadingHTTPServer(('127.0.0.1',8000),Handler).serve_forever()
