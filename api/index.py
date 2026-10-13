"""Vercel Python entry point for the OSRS Character Planner API."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from flask import Flask, jsonify, request
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from server import get_quest, SKILLS

app = Flask(__name__)

@app.get('/api/quest')
def quest():
    title = request.args.get('name', '').strip()
    if not title or len(title) > 100:
        return jsonify(error='Enter a valid quest name'), 400
    try:
        return jsonify(get_quest(title))
    except Exception as exc:
        return jsonify(error='Could not retrieve quest requirements from the wiki', detail=str(exc)[:160]), 502

@app.get('/api/hiscores')
def hiscores():
    player = request.args.get('player', 'dcstorms').strip()
    if not player or len(player)>12 or not all(c.isalnum() or c in ' _-' for c in player):
        return jsonify(error='Invalid OSRS username'), 400
    try:
        endpoint='https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws?'+urlencode({'player':player})
        req=Request(endpoint,headers={'User-Agent':'OSRSCharacterPlanner/1.0 (personal educational project)','Accept':'text/plain'})
        with urlopen(req,timeout=15) as response:
            body=response.read().decode('utf-8-sig')
        lines=body.strip().splitlines()
        if len(lines)<len(SKILLS):
            raise ValueError('Unexpected Hiscores response')
        skills={}
        for name,line in zip(SKILLS,lines):
            parts=line.split(',')
            if len(parts)<3:
                raise ValueError('Unexpected skill row')
            rank,level,xp=map(int,parts[:3]); skills[name]={'rank':rank,'level':level,'xp':xp}
        return jsonify(player=player,skills=skills)
    except Exception as exc:
        return jsonify(error='Unable to retrieve Hiscores. Check the username, Jagex availability, or try again later.', detail=str(exc)[:180]), 502


@app.get('/api/ge')
def ge():
    try:
        base='https://prices.runescape.wiki/api/v1/osrs/'
        headers={'User-Agent':'OSRSCharacterPlanner/1.1 (personal project; contact via github.com/Dcstormz/osrs-character-planner)','Accept':'application/json'}
        def fetch(path):
            with urlopen(Request(base+path,headers=headers),timeout=18) as response:
                return __import__('json').load(response)
        mapping=fetch('mapping')
        prices=fetch('latest').get('data',{})
        items=[{'id':x['id'],'name':x['name'],'icon':x.get('icon','')} for x in mapping if x.get('id') is not None and x.get('name')]
        return jsonify(items=items,prices=prices)
    except Exception as exc:
        return jsonify(error='Unable to load GE prices from the OSRS Wiki',detail=str(exc)[:150]),502
