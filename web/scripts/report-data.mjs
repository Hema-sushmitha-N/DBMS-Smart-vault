import fs from 'node:fs/promises';import path from 'node:path';import sharp from 'sharp';import {spawnSync} from 'node:child_process';
process.loadEnvFile('.env.local');
const {query,poolFor}=await import('../lib/db.mjs');const {reports}=await import('../lib/reports.mjs');
const root=path.resolve('..'),report=path.join(root,'report');await fs.mkdir(path.join(report,'assets'),{recursive:true});
const tables=['app_users','categories','suppliers','warehouses','products','inventory','purchase_orders','purchase_order_items','stock_movements','low_stock_alerts','anomaly_logs'];
const data={generated_at:new Date().toISOString(),versions:{},tables:{},reports,roles:[],git:{}};
for(const pkg of ['next','react','pg','@lancedb/lancedb','jose','zod','@playwright/test'])data.versions[pkg]=JSON.parse(await fs.readFile(path.join('node_modules',pkg,'package.json'),'utf8')).version;
for(const table of tables){const select=table==='app_users'?'user_id,full_name,email,role':'*';data.tables[table]=(await query('ADMIN','SELECT '+select+' FROM smartvault.'+table+' ORDER BY 1')).rows;}
data.constraints=(await query('ADMIN',"SELECT c.relname AS table_name,co.conname AS name,pg_get_constraintdef(co.oid) AS definition FROM pg_constraint co JOIN pg_class c ON co.conrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='smartvault' ORDER BY c.relname,co.contype,co.conname")).rows;
data.columns=(await query('ADMIN',"SELECT c.relname AS table_name,a.attname AS column_name,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS required FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid JOIN pg_attribute a ON a.attrelid=c.oid WHERE n.nspname='smartvault' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum")).rows;
data.roles=(await query('ADMIN',"SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname IN('smartvault_admin','smartvault_staff','smartvault_auth') ORDER BY rolname")).rows;
data.server=(await query('ADMIN','SELECT version() AS version')).rows[0].version;
const log=spawnSync('git',['-C',root,'log','-1','--format=%H|%s'],{encoding:'utf8',windowsHide:true});data.git={latest:log.status===0?log.stdout.trim():'Local repository initialization pending',remote:'Not published'};
async function tree(dir,prefix=''){let lines=[];const entries=(await fs.readdir(dir,{withFileTypes:true})).filter(e=>!['node_modules','.next','.git','.env.local'].includes(e.name)).sort((a,b)=>a.name.localeCompare(b.name));for(const e of entries){lines.push(prefix+'|-- '+e.name+(e.isDirectory()?'/':''));if(e.isDirectory())lines.push(...await tree(path.join(dir,e.name),prefix+'|   '));}return lines;}
data.project_tree=['web/',...await tree(process.cwd())].join('\n');
await fs.writeFile(path.join(report,'report_data.json'),JSON.stringify(data,null,2));
for(const [source,target]of [['ER_Diagram.svg','er_diagram.png'],['Relational_Schema.svg','relational_schema.png']])await sharp(await fs.readFile(path.join(report,'diagram_sources',source))).png().toFile(path.join(report,'assets',target));
for(const name of ['SmartVault_ER_Diagram.pdf','SmartVault_Relational_Schema.pdf'])await fs.copyFile(path.join(report,'diagram_sources',name),path.join(root,name));
await fs.mkdir(path.join(root,'actual_results'),{recursive:true});
for(const table of tables){const rows=data.tables[table];if(!rows.length)continue;const keys=Object.keys(rows[0]);const cell=x=>'"'+String(x??'').replaceAll('"','""')+'"';const csv=[keys.join(','),...rows.map(r=>keys.map(k=>cell(r[k]instanceof Date?r[k].toISOString():r[k])).join(','))].join('\n');await fs.writeFile(path.join(root,'actual_results',table+'.csv'),csv);}
await poolFor('ADMIN').end();console.log('Report data, public sample exports, diagram images, and updated single-page PDFs prepared.');
