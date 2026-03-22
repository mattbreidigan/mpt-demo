# Demo To-Do Plan (3 Hours)

## Scope (Locked)
Build a single-page React demo with no backend and no database.
Flow: Dashboard -> Upload .docx template -> Detect placeholders -> Auto-generate form -> Fill values -> Export DOCX + PDF.

## 0) Setup (0:00-0:15)
- Initialize React app (Vite).
- Install libs for DOCX parsing/export and PDF export.
- Create pages/components:
  - Dashboard
  - TemplateParserPage
  - ReportEditorPage
- Add localStorage helpers for template schema + form values.

## 1) Upload + Placeholder Detection (0:15-1:00)
- Add .docx upload UI.
- Read uploaded file and detect placeholders (for example: {{client_name}}, {{test_result}}).
- De-duplicate and sort placeholder list.
- Infer field types from placeholder names:
  - Contains `date` -> date input
  - Contains `id`, `number`, `count` -> number input
  - Contains `status`, `result`, `pass_fail` -> select input
  - Default -> text input
- Save generated schema to localStorage.

## 2) Dynamic Form Generation (1:00-1:35)
- Render form fields from detected placeholder schema.
- Support field types: text, number, date, select.
- Auto-save values on every change.
- Show required/missing field summary.

## 3) DOCX Export (1:35-2:15)
- Replace template placeholders with entered values.
- Export completed .docx.
- File naming: `report-{projectId}-{yyyy-mm-dd}.docx`.

## 4) PDF Export (2:15-2:40)
- Generate PDF from the same filled data.
- Include report header + key-value sections + results table.
- File naming: `report-{projectId}-{yyyy-mm-dd}.pdf`.

## 5) Demo Polish (2:40-3:00)
- Add "Load sample placeholders" fallback button.
- Add "Reset demo data" button.
- Add clear success/error messages for upload and export.
- Add a short on-screen note: "PDF is generated from structured form data in MVP."

## Demo Script (Use During Presentation)
1. Upload a client Word template.
2. Show detected placeholders and generated fields.
3. Fill form values.
4. Export DOCX and open/download result.
5. Export PDF and show matching data.
6. Explain next step: swap localStorage with PostgreSQL/API.

## Out of Scope (For This 3-Hour MVP)
- Authentication/authorization
- Multi-user collaboration
- Full Word layout parity for PDF
- Formula/calculation engine
- Full 30-template coverage
