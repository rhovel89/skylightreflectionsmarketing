import { bulkImportSubmissions } from '@/app/admin/bulk-actions'

const headers = ['business_name', 'category', 'city', 'phone', 'website', 'description', 'contact_name', 'email', 'service_areas']

export function BulkImport() {
  return <>
    <div className="admin-page-head">
      <div>
        <div className="kpi">Controlled Intake</div>
        <h1>Bulk Import</h1>
        <p className="muted">Paste CSV using the required headers below. Imports enter the approval queue instead of publishing directly.</p>
      </div>
      <span className="badge sponsored">Approval Required</span>
    </div>

    <div className="admin-settings-grid admin-settings-grid-top">
      <div className="admin-card">
        <div className="kpi">Required CSV Structure</div>
        <h2>Columns</h2>
        <p className="small muted">Use the header names exactly. Empty optional values are allowed, but every row still goes through protected moderation.</p>
        <div className="admin-chip-list">{headers.map((header) => <code key={header}>{header}</code>)}</div>
      </div>
      <div className="admin-card">
        <div className="kpi">Safety Rule</div>
        <h2>Import does not mean publish</h2>
        <p className="small muted">Bulk rows are staged as submissions so staff can review category, city, duplicates and source quality before a canonical listing is created.</p>
        <a className="btn btn-light" href="/admin/submissions">Open Approval Queue</a>
      </div>
    </div>

    <form action={bulkImportSubmissions} className="admin-card admin-bulk-import-form">
      <div className="section-head compact-head">
        <div><div className="kpi">CSV Intake</div><h2>Paste Import Data</h2><p className="small muted">Include the header row as the first line.</p></div>
      </div>
      <label>CSV Data<textarea name="csv" placeholder="business_name,category,city,phone,..." required style={{ minHeight: 320 }} /></label>
      <div className="admin-form-savebar admin-form-savebar-inline">
        <div><strong>Send to moderation</strong><span>No imported row bypasses the approval queue.</span></div>
        <button className="btn btn-primary">Import to Approval Queue</button>
      </div>
    </form>
  </>
}
