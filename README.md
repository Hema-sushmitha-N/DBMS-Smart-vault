# SmartVault — Inventory & Anomaly Detection

Next.js application with PostgreSQL, a persistent LanceDB vector database,
Admin/Staff authentication, database-enforced permissions, purchase-order
receiving, inventory movements, alerts, analytics, and live SQL reports.

## Run on this laptop

Double-click **Start_SmartVault.cmd**. The application opens at
http://127.0.0.1:3080. PostgreSQL runs locally on port 5432.
pgAdmin remains available through the internal launcher when needed.

Demo accounts (local academic demonstration only):

| Role | Email | Password |
| --- | --- | --- |
| Admin | asha@smartvault.example | VaultAdmin!2026 |
| Staff | ravi@smartvault.example | VaultStaff!2026 |

These passwords are scrypt-hashed in PostgreSQL. Server database passwords and
the signing key are generated separately and excluded from Git.

## Source layout

- web/app — Next.js pages and API route handlers.
- web/components — responsive interface and forms.
- web/lib — sessions, password hashing, database pools, reports, vector CRUD.
- web/scripts — setup and reproducible vector examples.
- web/tests — unit, PostgreSQL, browser, and isolated end-to-end checks.
- 01–07 SQL files — original schema/data plus application permissions and queries.
- report — report documents, screenshots, schema export, and test evidence.
- .local — private runtime state, credentials, PostgreSQL and LanceDB files.
- .tools — project-local PostgreSQL/pgAdmin and report-generation environment.

## Developer commands

From web/:

    npm ci
    npm run setup
    npm run build
    npm start

Setup requires an initialized PostgreSQL database containing scripts 01 and 02.
It applies 06, initializes separate restricted database roles, hashes demo
passwords, creates private .env.local, and populates the LanceDB table.
Do not rerun 01 or 02 against the existing populated database.

    npm test
    node tests/database.mjs
    node scripts/vector-demo.mjs
    npm run test:e2e

The end-to-end suite makes an isolated PostgreSQL copy and vector directory,
then runs a separate production server. Successful runs remove their test DB.
Your live sample balances are preserved.

05_verify.sql checks the original seed baseline; use it before additional
application movements. Current operational reconciliation is the ledger report.

## Permissions

Staff can read inventory, reports, and patterns, record movements, and create
orders. Admin additionally manages master data, creates users, receives/cancels
orders, and edits vector records. PostgreSQL GRANT/REVOKE permissions enforce
these differences using distinct non-superuser database login roles.
Neither application role may read password hashes or directly edit balances.
Trusted SECURITY DEFINER functions have a fixed search path and controlled grants.

Sessions use signed eight-hour HttpOnly/SameSite=Strict cookies. Every request
loads the current user role. Mutations validate origin and inputs; SQL values
are parameterized. Login attempts are rate-limited in-process for this local demo.

## Vector model

LanceDB stores one six-dimensional normalized operational feature vector for each
product/warehouse inventory position. Features are stock coverage, issue share,
receipt volume, transfer share, turnover, and smoothed movement activity.
Cosine similarity retrieves neighboring inventory patterns. These are engineered
numeric features, not learned language embeddings or a fraud probability.

Movement commits are atomic in PostgreSQL. Vector refresh follows the commit;
an indexing failure is reported as pending and can be repaired using Refresh
patterns. Cross-store updates are not a distributed transaction. The small demo
uses exact vector search without claiming a trained ANN index.

## Documentation and evidence

See report/SmartVault_Report.pdf and report/SmartVault_Report.docx.
The evaluation matrix references actual code and test evidence. No marks are
self-awarded; viva and contribution declarations require student/faculty input.
The report title page's course code remains to be confirmed if not supplied.

## Git and portability

Private data, .env.local, binaries, node_modules, test databases, and build output
are ignored. Commit only source, SQL, diagrams, documentation, and evidence.
A GitHub remote is optional for a local demo and has not been published implicitly.
For another computer, install PostgreSQL and Node, load 01, 02, and 06 in order,
provide private database configuration to scripts/setup.mjs, install dependencies,
and run setup/build/start. .local/connection.json is laptop-specific and never shared.
