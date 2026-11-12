# SmartVault presentation script

Open the two one-page diagram PDFs, the report PDF, and http://127.0.0.1:3080.
Start the application by double-clicking Start_SmartVault.cmd if necessary.
The demo accounts are in README.md. Practise the steps below before presenting.

## Hema: problem, ER diagram, and database design

Say: "SmartVault manages products and their stock across multiple warehouses. It records stock movements, purchase orders, low-stock alerts, and unusual inventory activity."

Show SmartVault_ER_Diagram.pdf. Say: "We use Chen notation: rectangles represent entities, ovals represent attributes, diamonds represent relationships, and underlined attributes identify primary keys. The 1 and N labels show relationship cardinality; double lines show total participation."

Point to Products, Categories, and Suppliers. Say: "Each product belongs to a category and can have a preferred supplier. Categories also have a parent relationship so that we can query a category hierarchy recursively."

Point to Inventory and Warehouses. Say: "Inventory connects a product with a warehouse. Its composite key is product_id and warehouse_id, because the same product can have a different quantity in every warehouse."

## Ganavi: remaining ER relationships, after reviewing them herself

Point to Stock Movements and App Users. Say: "Every movement records a product, a positive quantity, a movement type, and the user who performed it. A transfer has both a source and destination warehouse, while a receipt or issue uses the relevant warehouse."

Point to Purchase Orders and Purchase Order Items. Say: "An order belongs to a supplier and a destination warehouse, and contains multiple order items. Each item links an ordered product with its quantity and the unit cost agreed for that order."

Point to Low Stock Alerts and Anomaly Logs. Say: "Low-stock alerts record inventory that reaches its reorder threshold. Anomaly logs record movements that match our unusual-activity rules; these flags are prompts to investigate, not proof of fraud."

## Hema: relational schema and running application

Show SmartVault_Relational_Schema.pdf. Say: "We mapped the ER design into PostgreSQL tables. Primary keys identify rows, foreign keys connect related rows, and constraints prevent invalid quantities and references."

Log in as Admin. Show Dashboard and Inventory. Say: "These figures and rows come from PostgreSQL through our Next.js API. We can search products, filter warehouses, and sort inventory."

Show SQL Reports. Run the warehouse summary, category hierarchy, and ledger reconciliation reports. Say: "These execute real aggregate and recursive SQL queries. An empty reconciliation result means that recorded movements and inventory balances agree."

Create a small purchase order, then receive it once. Show its status and the inventory quantity. Say: "Receiving an order updates stock and records the receipt in a database transaction. A second receipt of the same order is rejected."

Demonstrate a small transfer between two warehouses with enough source stock. Say: "The source deduction and destination addition succeed together. If stock is insufficient, the transaction fails without leaving a partial transfer."

## Ganavi: Staff access and pattern comparison, after testing them herself

Log out and sign in as Staff. Show Inventory and the restricted navigation. Say: "Staff can inspect inventory, record movements, and create orders. Admin has additional management permissions, and PostgreSQL roles enforce these restrictions as well as the interface."

Open Patterns and select an inventory position. Say: "LanceDB stores six numeric features describing each product-and-warehouse inventory pattern. Cosine similarity finds other positions with similar operational behavior; this is similarity search, not a trained fraud prediction model."

## Closing and questions

Show report/SmartVault_Report.pdf if asked for documentation. Say: "The report includes the diagrams, SQL and vector commands, application structure, screenshots, and a rubric status table. Our local automated tests cover permissions, transactions, vector operations, and browser workflows."

Both students should practise explaining composite keys, foreign keys, triggers,
transactions, recursive queries, database roles, and cosine similarity. Explain
your own actual work when asked about individual contribution.

## Before presenting

- Confirm the course code in report/student_details.json and rebuild the report.
- Ganavi should actually review both diagrams, test the Staff workflow, and review the report. Record her completed contribution only after that work.
- Practise the presentation together, including questions and a small change each person can explain.
- Keep the laptop charged and the local app running. The project does not need an online deployment for this demo.
- Receiving an order and making a transfer change real demo data. The original 343-unit baseline is not expected after those actions; use the reconciliation report to check consistency.
- Keep private .local files and web/.env.local off shared/public repositories. Share source and the report, not database credentials.
