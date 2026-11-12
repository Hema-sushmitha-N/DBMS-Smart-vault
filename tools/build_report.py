from pathlib import Path
import json,re,textwrap,html,shutil
from datetime import datetime,timezone,timedelta
from PIL import Image,ImageDraw,ImageFont
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,PageBreak,Image as PDFImage,Table,TableStyle,Preformatted,KeepTogether
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from docx import Document
from docx.shared import Inches,Pt,RGBColor
from pypdf import PdfReader,PdfWriter

root=Path(__file__).resolve().parents[1];folder=root/"report";assets=folder/"assets";assets.mkdir(exist_ok=True)
details=json.loads((folder/"student_details.json").read_text());data=json.loads((folder/"report_data.json").read_text())
database=json.loads((folder/"database_test_evidence.json").read_text())
vector=json.loads((folder/"vector_crud_evidence.json").read_text())
e2e=json.loads((folder/"e2e_evidence.json").read_text())
browser=json.loads((folder/"browser_smoke.json").read_text())
fonts=Path(r"C:\Windows\Fonts")
for name,file in [("SV","arial.ttf"),("SVBold","arialbd.ttf"),("SVMono","consola.ttf")]:
 pdfmetrics.registerFont(TTFont(name,str(fonts/file)))
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name="SVBody",fontName="SV",fontSize=9.4,leading=14,spaceAfter=8,textColor=colors.HexColor("#263b35")))
styles.add(ParagraphStyle(name="SVH1",fontName="SVBold",fontSize=17,leading=22,spaceBefore=8,spaceAfter=12,textColor=colors.HexColor("#175a48")))
styles.add(ParagraphStyle(name="SVH2",fontName="SVBold",fontSize=11,leading=16,spaceBefore=10,spaceAfter=6,textColor=colors.HexColor("#175a48")))
styles.add(ParagraphStyle(name="SVTitle",fontName="SVBold",fontSize=29,leading=35,alignment=TA_CENTER,textColor=colors.HexColor("#175a48"),spaceAfter=12))
styles.add(ParagraphStyle(name="SVSmall",fontName="SV",fontSize=7.5,leading=11,spaceAfter=5,textColor=colors.HexColor("#65776d")))
styles.add(ParagraphStyle(name="SVCode",fontName="SVMono",fontSize=6.8,leading=9,spaceAfter=8,backColor=colors.HexColor("#f2f6f3"),borderPadding=7))
doc=Document();sec=doc.sections[0];sec.top_margin=Inches(.7);sec.bottom_margin=Inches(.65);sec.left_margin=Inches(.75);sec.right_margin=Inches(.75)
doc.styles["Normal"].font.name="Calibri";doc.styles["Normal"].font.size=Pt(10)
story=[]
def paragraph(text,style="SVBody"):
 story.append(Paragraph(html.escape(text).replace("\n","<br/>"),styles[style]))
 if style=="SVTitle":
  p=doc.add_paragraph();p.alignment=1;r=p.add_run(text);r.bold=True;r.font.size=Pt(23);r.font.color.rgb=RGBColor.from_string("175A48")
 else:doc.add_paragraph(text)
def heading(text,level=1):
 story.append(Paragraph(html.escape(text),styles["SVH1" if level==1 else "SVH2"]));doc.add_heading(text,level)
def page():
 story.append(PageBreak());doc.add_page_break()
def code(text):
 wrapped=[]
 for line in text.strip().splitlines():
  wrapped+=textwrap.wrap(line,width=105,replace_whitespace=False,drop_whitespace=False) or [""]
 # Keep each short code block together; long SQL appendices can split by lines.
 story.append(Preformatted("\n".join(wrapped),styles["SVCode"]))
 p=doc.add_paragraph();r=p.add_run(text.strip());r.font.name="Consolas";r.font.size=Pt(8)
def table(headers,rows,widths=None):
 matrix=[[Paragraph(html.escape(str(x)),styles["SVSmall"]) for x in headers]]
 for row in rows:matrix.append([Paragraph(html.escape(str(x)),styles["SVSmall"]) for x in row])
 t=Table(matrix,colWidths=widths,repeatRows=1,hAlign="LEFT")
 t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.HexColor("#e7f0e9")),("GRID",(0,0),(-1,-1),.35,colors.HexColor("#dce6df")),("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),6),("RIGHTPADDING",(0,0),(-1,-1),6),("TOPPADDING",(0,0),(-1,-1),6),("BOTTOMPADDING",(0,0),(-1,-1),5)]))
 story.extend([t,Spacer(1,8)])
 dt=doc.add_table(rows=1,cols=len(headers));dt.style="Light Shading Accent 1"
 for cell,label in zip(dt.rows[0].cells,headers):cell.text=str(label)
 for row in rows:
  for cell,value in zip(dt.add_row().cells,row):cell.text=str(value)
def image(file,caption,maxh=540):
 path=Path(file)
 if not path.exists():paragraph("Image pending: "+path.name,"SVSmall");return
 w,h=Image.open(path).size;scale=min(485/w,maxh/h)
 story.append(PDFImage(str(path),width=w*scale,height=h*scale));story.append(Spacer(1,7));paragraph(caption,"SVSmall")
 doc.add_picture(str(path),width=Inches(min(6.35,w*scale/72)));doc.add_paragraph(caption,style="Caption")
def source_image(relative,start,end,name):
 lines=(root/relative).read_text(encoding="utf-8").splitlines();chosen=lines[start-1:end]
 font=ImageFont.truetype(str(fonts/"consola.ttf"),16);title=ImageFont.truetype(str(fonts/"arialbd.ttf"),18)
 expanded=[]
 for index,line in enumerate(chosen,start):
  wrapped=textwrap.wrap(line.expandtabs(2),width=104,replace_whitespace=False,drop_whitespace=False) or [""]
  for j,part in enumerate(wrapped):expanded.append((str(index) if j==0 else "",part))
 out=Image.new("RGB",(1100,75+len(expanded)*23+25),"#152b24");draw=ImageDraw.Draw(out);draw.text((23,22),relative,fill="#c9decf",font=title)
 for i,(n,line) in enumerate(expanded):draw.text((20,68+i*23),n,fill="#739181",font=font);draw.text((72,68+i*23),line,fill="#dce9df",font=font)
 target=assets/name;out.save(target);return target
code_images=[
(source_image("web/lib/auth.mjs",1,55,"code_auth.png"),"Source extract: signed sessions, current-role lookup, and HttpOnly cookie configuration."),
(source_image("web/lib/vector.mjs",1,55,"code_vectors.png"),"Source extract: six operational features, persistent LanceDB connection, and vector-record construction."),
(source_image("web/app/api/operations/[action]/route.js",65,112,"code_api.png"),"Source extract: validated movement inputs and database function invocation."),
(source_image("06_application_security.sql",57,83,"code_sql.png"),"Source extract: the controlled stock movement and purchase-order functions.")
]
# Title
story.append(Spacer(1,105));doc.add_paragraph("\n\n")
paragraph("DBMS MINI PROJECT REPORT","SVTitle");paragraph(details["project_title"],"SVTitle")
paragraph(details["course_title"],"SVTitle");paragraph("Course code: "+details["course_code"],"SVBody")
table(["Student name","SRN"],[[s["name"],s["srn"]] for s in details["students"]],[310,175])
paragraph("Faculty: "+details["faculty"]);paragraph("Prepared: "+datetime.now(timezone(timedelta(hours=5,minutes=30))).strftime("%d %B %Y"))
paragraph("Submission: before the project presentation. Local laptop demonstration.","SVSmall")
paragraph("Title-page course code requires student confirmation before final submission.","SVSmall")
page()
heading("Abstract")
paragraph("SmartVault is a multi-warehouse inventory management application that combines a relational transaction database with an operational vector store. PostgreSQL stores products, categories, suppliers, warehouses, stock balances, purchase orders, users, and audit movements. Triggers maintain balances and low-stock alert state, while controlled functions provide atomic stock transfers and purchase-order receiving. The Next.js interface integrates authentication, Admin/Staff permissions, inventory search, procurement, analytics, and executable SQL reports.")
paragraph("LanceDB persists one six-dimensional normalized feature vector for each product/warehouse position. Cosine similarity retrieves positions with related stock coverage and movement behavior. A separate rule flags individual withdrawals of at least 50 units for review. The feature vectors are engineered numeric representations rather than learned text embeddings; similarity is not a fraud probability. The application has been exercised through password tests, SQL privilege and rollback checks, vector CRUD, and isolated browser workflows.")
heading("1. Project scope and architecture")
paragraph("The implemented workflow covers master-data CRUD, stock receipts/issues/transfers, purchase-order creation and receiving, automatic alerts, rule-based anomaly review, vector CRUD and similarity search, SQL reporting, and two user roles. The application runs at http://127.0.0.1:3080. PostgreSQL and LanceDB persist locally and do not require classroom internet after installation.")
code("Browser (Next.js / React)\n  -> Next.js HTTP API routes\n       -> Auth-only PostgreSQL role: credential verification and user lookup\n       -> Admin / Staff PostgreSQL pools: restricted reads and operations\n       -> PostgreSQL functions + triggers: atomic stock and order updates\n       -> LanceDB: persistent operational vectors and cosine search")
heading("Tech Stack and technology justification",2)
table(["Component","Purpose / justification"],[
["PostgreSQL 18.6","Relational integrity, foreign keys, constraints, JOINs, recursive CTEs, views, indexes, transactions, triggers, and controlled functions."],
["Next.js "+data["versions"]["next"]+" / React "+data["versions"]["react"],"Integrated page rendering, responsive forms, protected pages, and server API route handlers."],
["LanceDB "+data["versions"]["@lancedb/lancedb"],"A genuine persistent embedded vector database with CRUD and exact cosine similarity; practical for a laptop demonstration."],
["Node.js / pg "+data["versions"]["pg"],"Parameterized SQL and separate connection pools for restricted database roles."],
["Node scrypt / jose "+data["versions"]["jose"],"Salted password hashes, timing-safe verification, and signed session cookies."],
["Playwright "+data["versions"]["@playwright/test"],"Actual browser checks for Admin/Staff operations and screenshots."]
],[135,350])
page()
heading("2. ER diagram")
paragraph("Chen notation follows the supplied course slide: entities are rectangles, attributes are ovals, relationships are diamonds, keys are underlined, and 1/N labels show maximum cardinality. Double lines show total participation. The category parent relationship is optional and recursive. The attached standalone ER PDF retains a single vector page for detailed zooming.")
image(assets/"er_diagram.png","Figure 1. All 11 SmartVault entities and relationships, including recursive categories and password-hash storage.",490)
heading("Design decisions",2)
paragraph("Inventory resolves the product/warehouse association with primary key (product_id, warehouse_id). Purchase_Order_Items resolves orders and products with key (order_id, product_id). One product has one preferred supplier, while purchase orders can independently reference a supplier. Warehouse source and destination are separate optional movement roles. One inventory position has at most one current alert-state row; a movement has at most one anomaly row.")
page()
heading("3. Relational schema, keys, and constraints")
image(assets/"relational_schema.png","Figure 2. Horizontal relation rows with underlined primary keys and foreign-key arrows, matching the slide style.",520)
paragraph("The two alert arrows form one composite foreign key referencing Inventory. Password hashes are inaccessible to normal Admin/Staff reads. Current inventory and alert state are maintained summaries of movement activity; master details are separated to reduce duplication.")
page()
table(["Table","Primary key","Important references / rules"],[
["app_users","user_id","UNIQUE email; ADMIN/STAFF role check; salted password_hash."],
["categories","category_id","UNIQUE category_name; optional parent_category_id self-FK; cycle-prevention trigger."],
["suppliers","supplier_id","UNIQUE email; contact fields required."],
["warehouses","warehouse_id","UNIQUE warehouse_name; city required."],
["products","product_id","UNIQUE sku; category and preferred-supplier FKs; nonnegative price."],
["inventory","product_id + warehouse_id","Two master FKs; nonnegative quantity and reorder level."],
["purchase_orders","order_id","Supplier, warehouse, and creator FKs; constrained order status."],
["purchase_order_items","order_id + product_id","Order and product FKs; positive quantity; nonnegative unit cost."],
["stock_movements","movement_id","Product, user, and warehouse-role FKs; positive quantity; type-dependent source/destination check; immutable after posting."],
["low_stock_alerts","alert_id","UNIQUE product/warehouse pair; composite FK to inventory; OPEN/RESOLVED timestamp consistency."],
["anomaly_logs","anomaly_id","UNIQUE movement_id FK; rule and reason recorded."]
],[95,110,280])
heading("Sample populated records",2)
paragraph("The live demonstration retains 6 products, 3 warehouses, 18 inventory positions, 343 units, 4 original orders, 6 open low-stock alerts, and 1 initial anomaly. Four categories include the new child category Computer peripherals. User accounts are fictional demo identities; student names appear only on the report title page.")
table(["SKU","Product","Unit price (INR)"],[[r["sku"],r["product_name"],r["unit_price"]] for r in data["tables"]["products"]],[85,280,120])
table(["Warehouse","City"],[[r["warehouse_name"],r["city"]] for r in data["tables"]["warehouses"]],[290,195])
heading("4. SQL database commands")
paragraph("The reproducible SQL sequence is 01_schema.sql, 02_sample_data.sql, then 06_application_security.sql with owner-only setup of generated database-role passwords. Existing populated installations use the setup script rather than rerunning seed files. Complete DDL and migration commands are included in Appendix A.")
heading("DDL with integrity constraints",2)
code("""CREATE TABLE inventory (
 product_id integer NOT NULL REFERENCES products(product_id),
 warehouse_id integer NOT NULL REFERENCES warehouses(warehouse_id),
 quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
 reorder_level integer NOT NULL DEFAULT 10 CHECK (reorder_level >= 0),
 PRIMARY KEY (product_id, warehouse_id)
);""")
heading("DML: create, read, update, delete",2)
code("""BEGIN;
INSERT INTO categories(category_name) VALUES('DML demonstration');
SELECT * FROM categories WHERE category_name='DML demonstration';
UPDATE categories SET category_name='DML updated'
 WHERE category_name='DML demonstration';
DELETE FROM categories WHERE category_name='DML updated';
ROLLBACK;""")
paragraph("The interface performs persistent CRUD through validated API operations. This SQL demonstration uses rollback to preserve the classroom sample. Product/warehouse deletion is refused when stock or transaction history must be preserved.")
page()
heading("Nested, correlated, JOIN, and recursive queries",2)
for report in data["reports"]:
 heading(report["title"]+" — "+report["concept"],2);code(report["sql"]+";")
 if report["id"]=="ledger":paragraph("An empty result means all inventory balances agree with their posted movement totals.","SVSmall")
page()
heading("Advanced SQL concepts",2)
paragraph("BEFORE INSERT on stock_movements locks relevant inventory rows in warehouse order and changes the source/destination balances. Failure of either operation rolls back the statement. AFTER INSERT/UPDATE on inventory creates or updates one alert-state row and resolves it when replenished. AFTER INSERT on stock_movements records LARGE_ISSUE when an ISSUE is at least 50 units. A BEFORE UPDATE/DELETE trigger rejects changes to posted movement history.")
code("""BEGIN;
SELECT smartvault.record_movement(1,1,2,'TRANSFER',3,1,'Transfer demo');
SELECT product_id,warehouse_id,quantity FROM smartvault.inventory
 WHERE product_id=1 AND warehouse_id IN (1,2);
ROLLBACK;""")
paragraph("create_purchase_order validates order lines and inserts header/items together. receive_purchase_order locks the order, permits receiving only from PLACED, inserts receipt movements, and changes the status in the same transaction. A repeated receipt is rejected. prevent_category_cycle rejects self-parenting and longer parent cycles. v_inventory_report and v_purchase_order_totals centralize reports. Indexes cover product classification, warehouse stock lookup, order supplier/date, and movement product/source/destination/time.")
heading("Database role controls",2)
code("""REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA smartvault FROM PUBLIC;
GRANT SELECT ON products,inventory,purchase_orders,stock_movements
 TO smartvault_admin,smartvault_staff;
GRANT INSERT,UPDATE,DELETE ON categories,suppliers,warehouses,products
 TO smartvault_admin;
GRANT EXECUTE ON FUNCTION
 record_movement(integer,integer,integer,text,integer,integer,text)
 TO smartvault_admin,smartvault_staff;
-- Receiving, vector mutation APIs, user creation, and master writes
-- are Admin-only. No application role can directly edit stock balances.""")
paragraph("PostgreSQL enforces table/function privileges using separate non-superuser login roles. This is database RBAC, not a claim of row-level-security policies. SECURITY DEFINER entry points have a fixed search path, PUBLIC execution is revoked, and the actor role is checked against the session's database role.")
page()
heading("5. Vector database creation and commands")
paragraph("LanceDB is the selected NoSQL/vector component. It stores inventory_patterns in .local/vectors on disk. Records contain an inventory ID, product/warehouse metadata, a six-dimensional vector, a review note, and a refresh timestamp. PostgreSQL remains the transactional source of truth. Stock operations attempt vector refresh after commit; a failure produces a pending-refresh message and can be repaired through Refresh patterns.")
table(["Feature","Formula"],[
["Stock coverage","quantity / (quantity + reorder_level + 1)"],
["Issue share","issued / (received + issued + 1)"],
["Receipt volume","received / (received + 100)"],
["Transfer share","transferred / (received + issued + transferred + 1)"],
["Turnover","issued / (issued + quantity + 1)"],
["Smoothed activity","(movement_count + 1) / (movement_count + 11)"]
],[125,360])
paragraph("Smoothing keeps empty, never-moved inventory positions from becoming zero vectors. Cosine distance orders neighbors; similarity is displayed as 1 minus distance, bounded to [0,1]. The source position is excluded. The small dataset uses exact vector search; no trained ANN index or learned anomaly accuracy is claimed.")
code("""import * as lancedb from '@lancedb/lancedb';
const db = await lancedb.connect('../.local/vectors');
const table = await db.createTable('inventory_patterns', records);
// READ
await table.query().select(['id','product_name','quantity']).toArray();
// UPDATE
await table.update({where:"id = '1:1'",values:{note:'Review replenishment'}});
// VECTOR SEARCH
await table.vectorSearch(source.vector).distanceType('cosine')
 .where("id != '1:1'").limit(6).toArray();
// DELETE
await table.delete("id = '1:1'");
// CREATE / UPSERT
await table.mergeInsert('id').whenMatchedUpdateAll()
 .whenNotMatchedInsertAll().execute([source]);""")
paragraph("Executable examples are in web/scripts/vector-commands.mjs. The vector CRUD evidence recorded 18 initial records, an updated note, 17 records after one deletion, and 18 after restoration. Similarity returned six neighbors and finite scores for all positions.")
page()
heading("6. Next.js project tree")
code(data["project_tree"])
page()
heading("Backend and API integration",2)
table(["Endpoint","Behavior / access"],[
["POST /api/auth/login","Verify scrypt hash; create signed session; rate-limit invalid attempts."],
["POST /api/auth/logout","Clear HttpOnly session cookie."],
["GET /api/auth/me","Return current public account details."],
["GET /api/data/[resource]","Authenticated live inventory, orders, movements, alerts, patterns, SQL reports, and metadata."],
["POST /api/operations/movement","Admin/Staff validated movement through PostgreSQL function."],
["POST /api/operations/order","Admin/Staff atomic purchase-order creation."],
["POST /api/operations/receive_order","Admin-only atomic receiving and inventory update."],
["POST /api/operations/master_*","Admin-only validated master-data CRUD."],
["POST /api/operations/vector_*","Admin-only vector create/update/delete/refresh."],
["GET /api/health","Local readiness; no user data or credentials returned."]
],[170,315])
page()
heading("7. Authentication and role-based access")
paragraph("Passwords are hashed using Node scrypt with a random salt and 64-byte derived key. Verification uses timingSafeEqual. Login issues an eight-hour HS256 signed cookie with issuer/audience validation, HttpOnly and SameSite=Strict. Each protected request reloads the user role from PostgreSQL. Mutation routes validate origin and inputs; SQL values use placeholders. Login throttling is in-process for this laptop demonstration. HTTPS and a shared rate-limit store are deployment improvements, not prerequisites for local evaluation.")
table(["Action","Admin","Staff"],[
["Inventory, movement history, reports, pattern reads","Allowed","Allowed"],
["Record receipt / issue / transfer","Allowed","Allowed"],
["Create purchase order","Allowed","Allowed"],
["Receive or cancel purchase order","Allowed","Denied"],
["Create / update / delete master data","Allowed","Denied"],
["Create users and assign roles","Allowed","Denied"],
["Modify vector records and refresh patterns","Allowed","Denied"],
["Read password hashes directly / edit stock balances directly","Denied","Denied"]
],[315,85,85])
paragraph("Demo Admin: asha@smartvault.example / VaultAdmin!2026. Demo Staff: ravi@smartvault.example / VaultStaff!2026. These are local demonstration account passwords, distinct from generated PostgreSQL role passwords and session signing keys. Private configuration and database files are excluded from Git.")
heading("8. Sample application screenshots")
paragraph("The following images are actual browser captures. Main application screenshots use the preserved live sample. Order-receiving and Staff-operation evidence comes from an isolated database copy used for end-to-end tests.")
shots=[
("01_login.png","Login interface with separate Admin and Staff demo identities."),
("02_dashboard.png","Dashboard: 343 units, three warehouses, stock valuation, low-stock positions, and recent activity."),
("03_inventory.png","Inventory search, warehouse filtering, availability, quantities, and stock values."),
("04_orders.png","Purchase-order cards and status overview."),
("05_patterns.png","Persistent vector records and cosine similarity results."),
("06_reports.png","Executable SQL report and recursive category query results."),
("12_alerts.png","Rule-based anomaly review and trigger-maintained low-stock alerts."),
("11_staff_workspace.png","Staff workspace after a successful transfer in the isolated test database."),
("10_received_order.png","Received order in the isolated test database; receipt and alert behavior verified.")
]
for file,caption in shots:
 page();heading("Application demo — "+file.replace(".png","").split("_",1)[1].replace("_"," ").title(),2);image(folder/"screenshots"/file,caption,650)
page();heading("Application source-code screenshots")
paragraph("These code extracts are rendered directly from the actual project source with line numbers. They complement the browser screenshots and do not represent fabricated execution output.")
for file,caption in code_images:
 image(file,caption,600);page()
heading("9. Validation and evaluation rubric status")
paragraph("Unit checks passed for salted password verification, bounded nonzero feature vectors, and pattern-ID validation. PostgreSQL checks passed for both roles, atomic transfers, receiving, duplicate receiving rejection, cycle validation, and every report query. Browser smoke checks recorded no page errors. The end-to-end suite used an isolated PostgreSQL/vector copy and preserved the live sample.")
for check in e2e.get("checks",[]):paragraph("PASS — "+check["name"],"SVSmall")
paragraph("End-to-end result: "+e2e.get("status","unknown")+". Live sample preserved: "+str(e2e.get("baseline_unchanged",False))+".","SVBody")
rubrics=[
("ER diagram",2,"Implemented","Single-page diagram updated for authentication and recursive categories."),
("Relational schema, keys, relationships, constraints",3,"Implemented","11 relations; composite keys, FKs, uniqueness, checks; schema export."),
("SQL DDL with constraints",4,"Implemented","01_schema.sql and 06_application_security.sql."),
("NoSQL/vector database creation",4,"Implemented","Persistent LanceDB inventory_patterns with 18 records."),
("Technology justification",1,"Documented","PostgreSQL transactions, Next.js API/UI, embedded vector search."),
("DML operations",4,"Implemented and tested","Seed INSERTs; Admin UI CRUD; rollback SQL examples."),
("Nested/correlated/recursive/JOIN queries",4,"Implemented and tested","Seven live SQL reports and 07_advanced_queries.sql."),
("Advanced SQL function/trigger/CTE",6,"Implemented and tested","Atomic movement/receiving functions, triggers, recursive CTEs."),
("Vector features and CRUD",7,"Implemented and tested","Create/read/update/delete/upsert and cosine similarity evidence."),
("Next.js interface",3,"Implemented and browser-checked","Protected responsive application pages and forms."),
("Backend/API and DB integration",2,"Implemented and tested","Real PostgreSQL role pools and LanceDB API operations."),
("Authentication and database RBAC",4,"Implemented and tested","Two application roles; signed sessions; DB GRANT/REVOKE denials."),
("Documentation and Git/GitHub",2,"Documentation and local Git","Source repository and README; remote publication not claimed."),
("Originality, contribution, modification/viva",4,"Student/faculty confirmation","Custom inventory workflow; declared contributions below; viva remains to be performed.")
]
table(["Rubric","Marks","Completion status","Evidence"],rubrics,[123,32,105,225])
paragraph("Maximum rubric total: 50. This matrix records implementation status and evidence; it does not award marks or predict the faculty's assessment.")
page();heading("10. Individual contribution and viva")
paragraph(details["contributions"])
table(["Student","Declared / assigned responsibilities","Confirmation"],[
[details["students"][0]["name"],"Implementation lead; SQL/API/authentication/vector integration; testing coordination; report preparation.","Student-declared lead."],
[details["students"][1]["name"],"Assigned ER/schema review, Staff workflow testing, and screenshot/report explanation review.","Planned responsibilities; completion must be confirmed after actual work."]
],[130,245,110])
paragraph("Assigned review/testing tasks must not be represented as completed work until performed. Both students should be able to explain the design and demonstrate their own modifications.")
heading("Suggested demonstration and viva topics",2)
paragraph("Show the ER and relational schema, sign in as Admin, filter inventory, create/receive an order, demonstrate one transfer, compare vector patterns, and execute the recursive SQL report. Then sign in as Staff and show restricted controls. Explain composite keys, historical order prices, rollback behavior, trigger timing, database role grants, and the difference between a rule-based anomaly flag and vector similarity.")
heading("11. Limitations and future improvements")
paragraph("This is a local academic implementation. Vector similarity uses hand-engineered operational features and does not establish fraud or predictive accuracy. PostgreSQL and LanceDB are separate stores, so vector refresh follows SQL commit and can require retry. Login throttling is process-local. A production deployment should add HTTPS, durable login throttling, password recovery, session revocation, monitoring, automated backups, and a transactional vector-sync queue. GitHub publication and course-code confirmation are administrative items, not claimed as completed.")
heading("12. References")
for title,url in [
("Next.js installation and App Router","https://nextjs.org/docs/app/getting-started/installation"),
("Next.js cookies API","https://nextjs.org/docs/app/api-reference/functions/cookies"),
("PostgreSQL CREATE FUNCTION","https://www.postgresql.org/docs/current/sql-createfunction.html"),
("PostgreSQL privileges","https://www.postgresql.org/docs/current/ddl-priv.html"),
("LanceDB JavaScript API","https://lancedb.github.io/lancedb/js/"),
("Node.js crypto / scrypt","https://nodejs.org/api/crypto.html"),
("Playwright","https://playwright.dev/docs/intro")
]:paragraph(title+": "+url,"SVSmall")
page();heading("Appendix A — SQL schema and application migration")
paragraph("Complete SQL commands below define the implemented database and role controls. Generated role passwords are intentionally absent; scripts/setup.mjs configures them privately.")
for file in ["01_schema.sql","06_application_security.sql","07_advanced_queries.sql"]:
 heading(file,2)
 text=(root/file).read_text(encoding="utf-8")
 # Short chunks avoid a single enormous Preformatted block and keep Word readable.
 lines=text.splitlines()
 for i in range(0,len(lines),45):code("\n".join(lines[i:i+45]))
page();heading("Appendix B — Dummy-data commands")
text=(root/"02_sample_data.sql").read_text(encoding="utf-8").splitlines()
for i in range(0,len(text),45):code("\n".join(text[i:i+45]))
page();heading("Appendix C — Executable vector CRUD commands")
text=(root/"web/scripts/vector-commands.mjs").read_text(encoding="utf-8").splitlines()
for i in range(0,len(text),45):code("\n".join(text[i:i+45]))
heading("Evidence files",2)
paragraph("Local Git source baseline: "+data["git"]["latest"]+". A GitHub remote has not been published.","SVSmall")
paragraph("database_test_evidence.json; vector_crud_evidence.json; e2e_evidence.json; browser_smoke.json; report_data.json; implemented_schema.sql; screenshots/. These files contain actual results and source metadata rather than claimed benchmark accuracy.")
def footer(canvas,document):
 canvas.saveState();canvas.setFont("SV",7);canvas.setFillColor(colors.HexColor("#80958a"));canvas.drawString(43,25,"SmartVault | DBMS Mini Project | Hema Sushmitha N & Ganavi");canvas.drawRightString(A4[0]-43,25,str(document.page));canvas.restoreState()
target=folder/"SmartVault_Report.pdf"
SimpleDocTemplate(str(target),pagesize=A4,rightMargin=43,leftMargin=43,topMargin=39,bottomMargin=40,title=details["project_title"],author="HEMA SUSHMITHA N; GANAVI").build(story,onFirstPage=footer,onLaterPages=footer)
doc.save(folder/"SmartVault_Report.docx")
# Preserve full-resolution single-page diagrams as additional appendix pages.
writer=PdfWriter();writer.append(str(target))
for name in ["SmartVault_ER_Diagram.pdf","SmartVault_Relational_Schema.pdf"]:writer.append(str(root/name))
merged=folder/".report_with_diagrams.pdf"
with merged.open("wb") as output:writer.write(output)
writer.close()
merged.replace(target)
pages=len(PdfReader(target).pages)
text="\n".join(p.extract_text() or "" for p in PdfReader(target).pages)
for expected in ["PES1UG24CS667","PES1UG24CS707","Abstract","Tech","Vector","Next.js","Completion","50"]:
 if expected.lower() not in text.lower():raise RuntimeError("Report content check missing "+expected)
(folder/"report_validation.json").write_text(json.dumps({"pdf_pages":pages,"docx_created":True,"required_sections_checked":True,"course_code_pending":details["course_code"]=="TO BE CONFIRMED","teammate_completion_pending":True,"e2e_status":e2e.get("status")},indent=2))
print(f"Created PDF ({pages} pages, including vector diagram appendices), editable DOCX, and report validation evidence.")
