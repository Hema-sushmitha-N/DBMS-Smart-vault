from pathlib import Path
import json,math,heapq,html,re,textwrap
work=Path(__file__).resolve().parents[1]/"report"/"diagram_sources"
spec=json.loads((work/"spec.json").read_text())
class Canvas:
 def __init__(self,w,h):
  self.w=w; self.h=h; self.ops=[]
 def line(self,points,width=2,color="#333333"):
  self.ops.append(("line",points,width,color))
 def rect(self,x,y,w,h,fill="#e9e9e9",stroke="#333333",width=2):
  self.ops.append(("rect",x,y,w,h,fill,stroke,width))
 def ellipse(self,x,y,rx,ry):
  self.ops.append(("ellipse",x,y,rx,ry))
 def polygon(self,points,fill="#f0f0f0"):
  self.ops.append(("polygon",points,fill))
 def text(self,x,y,t,size=20,bold=False,anchor="middle",underline=False):
  assert all(ord(c)<128 for c in t),t
  self.ops.append(("text",x,y,t,size,bold,anchor,underline))
 def svg(self):
  out=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}"><rect width="100%" height="100%" fill="white"/>']
  for op in self.ops:
   typ=op[0]
   if typ=="line":
    _,pts,w,col=op;out.append(f'<polyline points="{" ".join(f"{x},{y}" for x,y in pts)}" fill="none" stroke="{col}" stroke-width="{w}" stroke-linejoin="round"/>')
   elif typ=="rect":
    _,x,y,w,h,f,s,sw=op;out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{f}" stroke="{s}" stroke-width="{sw}"/>')
   elif typ=="ellipse":
    _,x,y,rx,ry=op;out.append(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="white" stroke="#333" stroke-width="1.8"/>')
   elif typ=="polygon":
    _,pts,f=op;out.append(f'<polygon points="{" ".join(f"{x},{y}" for x,y in pts)}" fill="{f}" stroke="#333" stroke-width="2"/>')
   else:
    _,x,y,t,s,b,a,u=op;out.append(f'<text x="{x}" y="{y}" font-family="Arial,sans-serif" font-size="{s}" font-weight="{"bold" if b else "normal"}" text-anchor="{a}" text-decoration="{"underline" if u else "none"}">{html.escape(t)}</text>')
  return "".join(out)+"</svg>"
 def pdf(self,path,pagew,pageh):
  scale=min(pagew/self.w,pageh/self.h)
  ox=(pagew-self.w*scale)/2; oy=(pageh-self.h*scale)/2
  cmds=[f"q {scale:.8f} 0 0 {-scale:.8f} {ox:.5f} {pageh-oy:.5f} cm","1 J 1 j"]
  def rgb(col,fill=False):
   vals=[int(col[i:i+2],16)/255 for i in (1,3,5)]
   return " ".join(f"{v:.4f}" for v in vals)+(" rg" if fill else " RG")
  def pathcmd(pts,close=False):
   return f"{pts[0][0]:.3f} {pts[0][1]:.3f} m "+" ".join(f"{x:.3f} {y:.3f} l" for x,y in pts[1:])+(" h" if close else "")
  for op in self.ops:
   typ=op[0]
   if typ=="line":
    _,pts,w,col=op;cmds.extend([rgb(col),f"{w} w",pathcmd(pts),"S"])
   elif typ=="rect":
    _,x,y,w,h,f,s,sw=op;cmds.extend([rgb(f,True),rgb(s),f"{sw} w",f"{x} {y} {w} {h} re B"])
   elif typ=="ellipse":
    _,x,y,rx,ry=op;k=.5522847498
    cmds.extend(["1 1 1 rg","0.2 0.2 0.2 RG","1.8 w",
     f"{x+rx:.3f} {y:.3f} m {x+rx:.3f} {y+k*ry:.3f} {x+k*rx:.3f} {y+ry:.3f} {x:.3f} {y+ry:.3f} c "
     f"{x-k*rx:.3f} {y+ry:.3f} {x-rx:.3f} {y+k*ry:.3f} {x-rx:.3f} {y:.3f} c "
     f"{x-rx:.3f} {y-k*ry:.3f} {x-k*rx:.3f} {y-ry:.3f} {x:.3f} {y-ry:.3f} c "
     f"{x+k*rx:.3f} {y-ry:.3f} {x+rx:.3f} {y-k*ry:.3f} {x+rx:.3f} {y:.3f} c B"])
   elif typ=="polygon":
    _,pts,f=op;cmds.extend([rgb(f,True),"0.2 0.2 0.2 RG","2 w",pathcmd(pts,True),"B"])
   else:
    _,x,y,t,s,b,a,u=op
    # Helvetica approximate advance, sufficient for these fixed-width cells.
    widths=dict(zip("abcdefghijklmnopqrstuvwxyz",[556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500]))
    widths.update(zip("ABCDEFGHIJKLMNOPQRSTUVWXYZ",[667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611]))
    if b:
     widths.update(zip("abcdefghijklmnopqrstuvwxyz",[556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500]))
     widths.update(zip("ABCDEFGHIJKLMNOPQRSTUVWXYZ",[722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611]))
    widths.update({" ":278,"_":556,"-":333,".":278,",":278,":":278,";":278,"(":333,")":333,"/":278,"|":260,"%":889,">":584,"=":584})
    advance=sum(widths.get(ch,556) for ch in t)*s/1000
    xx=x-advance/2 if a=="middle" else x-advance if a=="end" else x
    safe=t.replace("\\","\\\\").replace("(","\\(").replace(")","\\)")
    cmds.extend(["0.08 0.08 0.08 rg",f"BT /{'F2' if b else 'F1'} {s} Tf 1 0 0 -1 {xx:.3f} {y:.3f} Tm ({safe}) Tj ET"])
    if u:cmds.extend(["0.1 0.1 0.1 RG",f"{max(1,s/18):.2f} w",f"{xx:.3f} {y+3:.3f} m {xx+advance:.3f} {y+3:.3f} l S"])
  cmds.append("Q")
  stream=("\n".join(cmds)+"\n").encode("ascii")
  objects=[
   b"<< /Type /Catalog /Pages 2 0 R >>",
   b"<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
   f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {pagew:.4f} {pageh:.4f}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>".encode(),
   b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
   b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
   f"<< /Length {len(stream)} >>\nstream\n".encode()+stream+b"endstream"
  ]
  data=bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");offsets=[0]
  for i,obj in enumerate(objects,1):
   offsets.append(len(data));data.extend(f"{i} 0 obj\n".encode()+obj+b"\nendobj\n")
  xref=len(data);data.extend(f"xref\n0 {len(objects)+1}\n0000000000 65535 f \n".encode())
  for off in offsets[1:]:data.extend(f"{off:010d} 00000 n \n".encode())
  data.extend(f"trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
  path.write_bytes(data)
  assert len(re.findall(rb"/Type\s*/Page\b",data))==1

pos={"categories":(550,500),"products":(1650,500),"inventory":(2750,500),"warehouses":(3850,500),
"suppliers":(550,1500),"purchase_order_items":(1650,1500),"stock_movements":(2750,1500),"low_stock_alerts":(3850,1500),
"app_users":(550,2500),"purchase_orders":(1650,2500),"anomaly_logs":(2750,2500)}
W,H=4400,3100;STEP=10;NX=W//STEP+1;NY=H//STEP+1
blocked=set()
for name,(x,y) in pos.items():
 for gx in range((x-365)//STEP,(x+365)//STEP+1):
  for gy in range((y-330)//STEP,(y+330)//STEP+1):
   xx=gx*STEP;yy=gy*STEP
   if abs(yy-y)>40 or (abs(xx-x)<=185 and abs(yy-y)<=55):
    blocked.add((gx,gy))
used={};ports={n:{-1:[],1:[]} for n in pos};diamonds=[]
def inside_diamond_box(x,y):
 return any(abs(x-a)<125 and abs(y-b)<65 for a,b in diamonds)
def search(start,goal):
 sx,sy=start;tx,ty=goal
 initial=(sx,sy,2);dist={initial:0};prev={}
 heap=[((abs(sx-tx)+abs(sy-ty))*10,0,initial)]
 while heap:
  _,cost,cur=heapq.heappop(heap)
  if cost!=dist.get(cur):continue
  x,y,d=cur
  if (x,y)==goal:
   out=[]
   while cur!=initial:out.append((cur[0]*STEP,cur[1]*STEP));cur=prev[cur]
   out.append((sx*STEP,sy*STEP));return cost,list(reversed(out))
  for dx,dy,nd in [(1,0,0),(-1,0,0),(0,1,1),(0,-1,1)]:
   xx=x+dx;yy=y+dy
   if not (3<=xx<NX-3 and 14<=yy<NY-15):continue
   if (xx,yy) in blocked or inside_diamond_box(xx*STEP,yy*STEP):continue
   mask=used.get((xx,yy),0)
   penalty=260 if mask&(1<<nd) else 65 if mask else 0
   nc=cost+10+(25 if d!=nd and d!=2 else 0)+penalty
   nxt=(xx,yy,nd)
   if nc<dist.get(nxt,10**20):
    dist[nxt]=nc;prev[nxt]=cur
    h=(abs(xx-tx)+abs(yy-ty))*10
    heapq.heappush(heap,(nc+h,nc,nxt))
 return None
def simplify(points):
 out=[points[0]]
 for i in range(1,len(points)-1):
  a=out[-1];b=points[i];c=points[i+1]
  if (a[0]==b[0]==c[0]) or (a[1]==b[1]==c[1]):continue
  out.append(b)
 out.append(points[-1]);return out
def node_angles(n):
 a={1:[-90],2:[-135,-45],3:[-150,-90,-30],4:[-155,-125,-55,-25],5:[-155,-125,-90,-55,-25]}
 b={1:[90],2:[45,135],3:[30,90,150],4:[25,55,125,155]}
 return a[math.ceil(n/2)]+b.get(n//2,[])
attr_boxes=[]
for n,(x,y) in pos.items():
 for col,deg in zip(spec["cols"][n],node_angles(len(spec["cols"][n]))):
  rad=math.radians(deg);attr_boxes.append((x+220*math.cos(rad),y+280*math.sin(rad),124,28,n,col))
def room(x,y):
 if x<160 or x>W-160 or y<160 or y>H-160:return False
 for a,b in diamonds:
  if abs(x-a)<270 and abs(y-b)<135:return False
 for a,b in pos.values():
  if abs(x-a)<290 and abs(y-b)<105:return False
 for a,b,rx,ry,_,_ in attr_boxes:
  # Bounding-box exclusion deliberately stricter than ellipse intersection.
  if abs(x-a)<rx+125 and abs(y-b)<ry+65:return False
 return True
refs=[];seen=set()
for r in spec["refs"]:
 if r[0]!=r[2] and r[4] not in seen:refs.append(r);seen.add(r[4])
refs.sort(key=lambda r:abs(pos[r[0]][0]-pos[r[2]][0])+abs(pos[r[0]][1]-pos[r[2]][1]))
routes=[]
for child,col,parent,key,label,total in refs:
 options=[]
 for side1 in (-1,1):
  dy1=next((v for v in (0,-20,20) if v not in ports[child][side1]),None)
  if dy1 is None:continue
  for side2 in (-1,1):
   dy2=next((v for v in (0,-20,20) if v not in ports[parent][side2]),None)
   if dy2 is None:continue
   x,y=pos[child];a,b=pos[parent]
   start=((x+side1*210)//STEP,(y+dy1)//STEP);goal=((a+side2*210)//STEP,(b+dy2)//STEP)
   result=search(start,goal)
   if result: options.append((result[0],side1,side2,dy1,dy2,result[1]))
 if not options:raise RuntimeError("No route for "+label)
 _,s1,s2,d1,d2,pts=min(options,key=lambda t:t[0])
 x,y=pos[child];a,b=pos[parent]
 full=simplify([(x+s1*175,y+d1)]+pts+[(a+s2*175,b+d2)])
 # Prefer the middle of a long segment with room for the relationship diamond.
 candidates=[]
 length=sum(abs(v[0]-u[0])+abs(v[1]-u[1]) for u,v in zip(full,full[1:]))
 passed=0
 for u,v in zip(full,full[1:]):
  segment=abs(v[0]-u[0])+abs(v[1]-u[1])
  for f in (.5,.35,.65,.2,.8):
   cx=round((u[0]+(v[0]-u[0])*f)/10)*10;cy=round((u[1]+(v[1]-u[1])*f)/10)*10
   clearance=125 if u[1]==v[1] else 65
   if segment*min(f,1-f)<clearance:continue
   if room(cx,cy):candidates.append((abs(passed+segment*f-length/2),cx,cy))
  passed+=segment
 if not candidates:raise RuntimeError("No clear relationship diamond for "+label)
 _,cx,cy=min(candidates)
 diamonds.append((cx,cy))
 routes.append({"child":child,"parent":parent,"label":label,"total":total,"s1":s1,"s2":s2,"d1":d1,"d2":d2,"points":full,"diamond":(cx,cy)})
 ports[child][s1].append(d1);ports[parent][s2].append(d2)
 for i,(xx,yy) in enumerate(pts):
  if i==0:continue
  prevp=pts[i-1];direction=0 if prevp[1]==yy else 1
  used[(xx//STEP,yy//STEP)]=used.get((xx//STEP,yy//STEP),0)|(1<<direction)
 print("Routed",label,flush=True)
er=Canvas(W,H)
er.text(W/2,70,"SMARTVAULT - ENTITY RELATIONSHIP DIAGRAM",43,True)
er.text(W/2,115,"Chen notation | All 11 entities and their attributes on one page",24)
for r in routes:
 er.line(r["points"],10,"#ffffff");er.line(r["points"],2.2)
 if r["total"]:
  x,y=r["points"][0];nx,ny=r["points"][1]
  length=min(abs(nx-x),90)
  er.line([(x,y+6),(x+r["s1"]*length,y+6)],2.2)
for r in routes:
 cx,cy=r["diamond"];er.polygon([(cx-110,cy),(cx,cy-50),(cx+110,cy),(cx,cy+50)])
 er.text(cx,cy+6,r["label"],18)
for n,(x,y) in pos.items():
 entries=[a for a in attr_boxes if a[4]==n]
 for ax,ay,rx,ry,_,col in entries:er.line([(x,y),(ax,ay)],1.7)
 for ax,ay,rx,ry,_,col in entries:
  er.ellipse(ax,ay,rx,ry);er.text(ax,ay+6,col,19,underline=col in spec["pk"][n])
 er.rect(x-175,y-45,350,90)
 er.text(x,y+8,n.upper(),23,True)
for r in routes:
 for n,side,dy,card in [(r["child"],r["s1"],r["d1"],"1" if r["label"] in ("ALERT_FOR","FLAGGED_BY") else "N"),(r["parent"],r["s2"],r["d2"],"1")]:
  x,y=pos[n];xx=x+side*225;yy=y+dy+(30 if dy>0 else -14)
  er.rect(xx-14,yy-21,28,27,"#ffffff","#ffffff",0);er.text(xx,yy,card,23,True)
# Optional category parent: one recursive relationship with two entity roles.
er.line([(375,480),(240,480),(240,170),(110,170),(110,300)],2.2)
er.line([(375,520),(110,520),(110,300)],2.2)
er.polygon([(30,300),(110,255),(190,300),(110,345)])
er.text(110,306,"PARENT_OF",18)
er.text(340,466,"N",23,True)
er.text(340,550,"1",23,True)
er.text(W/2,2940,"Rectangle: entity | Oval: attribute | Diamond: relationship | Underline: primary key | 1/N: maximum cardinality",25)
er.text(W/2,2980,"Double line: total participation. Single line: partial participation. Crossing lines do not indicate a relationship junction.",23)
er.text(W/2,3020,"INVENTORY and PURCHASE_ORDER_ITEMS use composite keys. ALERT_FOR references the complete inventory key.",23)
er.text(W/2,3060,"SOURCE and DESTINATION are optional warehouse roles, with requirements determined by movement type.",23)
(work/"ER_Diagram.svg").write_text(er.svg(),encoding="utf-8")
er.pdf(work/"SmartVault_ER_Diagram.pdf",2383.94,1683.78)

# Single-page slide-style relational schema.
sw,sh=2600,2470;rel=Canvas(sw,sh)
rel.text(sw/2,65,"SMARTVAULT - RELATIONAL DATABASE SCHEMA",43,True)
rel.text(sw/2,115,"Underlined attributes form primary keys. Arrows point from foreign keys to the referenced keys.",25)
order=["categories","suppliers","warehouses","app_users","products","inventory","purchase_orders","purchase_order_items","stock_movements","low_stock_alerts","anomaly_logs"]
boxes={}
for i,n in enumerate(order):
 x=570;y=240+i*190;cells={}
 for col in spec["cols"][n]:
  width=max(145,len(col)*11.5+30);cells[col]=(x,width);x+=width
 if x>sw-40:raise RuntimeError("Schema row too wide: "+n+str(x))
 boxes[n]=(y,cells)
row_lanes={}
for i,(ch,col,pa,key,label,total) in enumerate(spec["refs"]):
 sy,sc=boxes[ch];ty,tc=boxes[pa];sx=sc[col][0]+sc[col][1]/2;tx=tc[key][0]+tc[key][1]/2
 so=row_lanes.get(ch,0);row_lanes[ch]=so+1
 to=row_lanes.get(pa,0);row_lanes[pa]=to+1
 lane=38+i*30
 pts=[(sx,sy+48),(sx,sy+67+so*12),(lane,sy+67+so*12),(lane,ty+67+to*12),(tx,ty+67+to*12),(tx,ty+48)]
 rel.line(pts,1.7)
 rel.polygon([(tx-6,ty+60),(tx+6,ty+60),(tx,ty+48)],"#333333")
for n in order:
 y,cells=boxes[n];rel.text(570,y-24,n.upper(),30,True,"start")
 for col,(x,width) in cells.items():
  rel.rect(x,y,width,48,"#e6e6e6","#333333",1.6)
  rel.text(x+width/2,y+31,col,22,underline=col in spec["pk"][n])
rel.text(sw/2,2340,"Composite keys: INVENTORY(product_id, warehouse_id); PURCHASE_ORDER_ITEMS(order_id, product_id).",24)
rel.text(sw/2,2380,"LOW_STOCK_ALERTS(product_id, warehouse_id) is ONE composite foreign key to INVENTORY, and the pair is UNIQUE.",23)
rel.text(sw/2,2420,"ANOMALY_LOGS.movement_id is UNIQUE. Other uniqueness and validation constraints are defined in 01_schema.sql.",22)
(work/"Relational_Schema.svg").write_text(rel.svg(),encoding="utf-8")
rel.pdf(work/"SmartVault_Relational_Schema.pdf",1683.78,1190.55)


print("Updated single-page ER and relational schema for authentication and recursive categories.")
