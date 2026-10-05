# Brick Lab parts survey (2026-10-05). Not part of the app; kept so the ranking in survey.md can be re-run.
# Run in an empty folder after downloading Rebrickable's dumps (sets, inventories, inventory_parts, parts,
# part_categories, themes) from https://cdn.rebrickable.com/media/downloads/<name>.csv.gz and gunzipping them:
#   python survey.py 60     -> prints the top 60, writes ranked.csv
# Counts sets (>= 50 pieces, 2019-2025, City / Creator 3-in-1 / Creator Expert+Icons / Friends) containing each part,
# skipping spares, printed/patterned parts and categories Brick Lab can't use (Technic, minifig, stickers, ...).
import csv, re, collections, sys
rd=lambda f: list(csv.DictReader(open(f,encoding='utf-8')))
themes={r['id']:r for r in rd('themes.csv')}
def root(t):
    path=[]
    while t: path.append(t); t=themes[t]['parent_id']
    return path
FAM={'52':'City','672':'Creator 3-in-1','673':'Icons','721':'Icons','494':'Friends'}
def fam(t):
    for x in root(t):
        if x in FAM: return FAM[x]
sets={}
for r in rd('sets.csv'):
    y=int(r['year']); f=fam(r['theme_id'])
    if f and 2019<=y<=2025 and int(r['num_parts'])>=50: sets[r['set_num']]=(f,r['name'],y)
inv={}
for r in rd('inventories.csv'):
    if r['set_num'] in sets:
        if r['set_num'] not in inv or int(r['version'])<int(inv[r['set_num']][1]): inv[r['set_num']]=(r['id'],r['version'])
inv2set={v[0]:k for k,v in inv.items()}
parts={r['part_num']:r for r in rd('parts.csv')}
cats={r['id']:r['name'] for r in rd('part_categories.csv')}
KEEP={'3','5','6','7','9','11','14','15','16','18','19','20','21','23','24','29','32','33','34','35','36','37','38','47','49','67','76','1'}
nsets=collections.defaultdict(set); qty=collections.Counter(); fams=collections.defaultdict(collections.Counter)
with open('inventory_parts.csv',encoding='utf-8') as fh:
    for r in csv.DictReader(fh):
        s=inv2set.get(r['inventory_id'])
        if not s or r['is_spare']=='True': continue
        p=r['part_num']
        if re.search(r'(pr|pat|px)\d',p) or p not in parts: continue
        if parts[p]['part_cat_id'] not in KEEP: continue
        if s not in nsets[p]: fams[p][sets[s][0]]+=1
        nsets[p].add(s); qty[p]+=int(r['quantity'])
fc=collections.Counter(f for f,_,_ in sets.values())
print('sets surveyed',len(sets),dict(fc), 'with inventory',len(inv))
w=csv.writer(open('ranked.csv','w',newline='',encoding='utf-8'))
w.writerow(['rank','part_num','name','category','sets','share','qty','by_family'])
rows=sorted(nsets,key=lambda p:(-len(nsets[p]),-qty[p]))
for i,p in enumerate(rows,1):
    w.writerow([i,p,parts[p]['name'],cats[parts[p]['part_cat_id']],len(nsets[p]),f"{len(nsets[p])/len(inv):.0%}",qty[p],' '.join(f'{k}:{v}' for k,v in fams[p].items())])
for i,p in enumerate(rows[:int(sys.argv[1])],1):
    print(i,p,'|',parts[p]['name'][:60],'|',cats[parts[p]['part_cat_id']],'|',len(nsets[p]),f"{len(nsets[p])/len(inv):.0%}")
