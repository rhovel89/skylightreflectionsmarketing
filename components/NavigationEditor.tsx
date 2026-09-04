import { getPublicConfig } from '@/lib/data'
import { saveNavItem, createNavItem } from '@/app/admin/actions'

const menuLabels: Record<string, string> = {
  header: 'Header',
  footer_find: 'Footer · Find',
  footer_explore: 'Footer · Explore',
  footer_business: 'Footer · Business',
  footer_company: 'Footer · Company',
  footer_legal: 'Footer · Legal',
}

export async function NavigationEditor() {
  const cfg = await getPublicConfig()
  const items = cfg.navigation ?? []
  const visible = items.filter((item) => item.is_visible).length
  const grouped = Object.entries(menuLabels).map(([key, label]) => ({
    key,
    label,
    items: items.filter((item) => item.menu_key === key).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
  }))

  return <>
    <div className="admin-page-head">
      <div>
        <div className="kpi">Public Site Structure</div>
        <h1>Navigation Editor</h1>
        <p className="muted">Rename, reorder, hide, add or redirect public header/footer links without touching application code.</p>
      </div>
      <span className="badge verified">Editable</span>
    </div>

    <div className="stat-grid">
      <div className="stat">Navigation Links<strong>{items.length}</strong><span className="small muted">Across header and footer menus</span></div>
      <div className="stat">Visible Links<strong>{visible}</strong><span className="small muted">Currently shown publicly</span></div>
      <div className="stat">Hidden Links<strong>{items.length - visible}</strong><span className="small muted">Retained but not displayed</span></div>
    </div>

    <details className="admin-create-disclosure" style={{ marginTop: 16 }}>
      <summary><span className="admin-create-disclosure-title"><strong>Add Navigation Link</strong><span>Create a new header or footer destination.</span></span></summary>
      <div className="admin-create-disclosure-body">
        <form action={createNavItem} className="admin-card">
          <div className="admin-form-grid">
            <label>Menu<select name="menu_key">{Object.entries(menuLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
            <label>Label<input name="label" required /></label>
            <label>Link<input name="href" required /></label>
            <label>Sort Order<input type="number" name="sort_order" defaultValue="100" /></label>
          </div>
          <button className="btn btn-primary">Add Link</button>
        </form>
      </div>
    </details>

    <div className="admin-workspace-heading">
      <div><div className="kpi">Menu Groups</div><h2>Edit public navigation by location</h2></div>
      <p className="muted">Links stay grouped by the menu where visitors actually see them.</p>
    </div>

    <div className="admin-settings-grid">
      {grouped.map((group) => <section className="admin-card admin-setting-card" key={group.key}>
        <div className="admin-setting-card-head">
          <div><div className="kpi">{group.label}</div><h2>{group.label}</h2><p className="small muted">{group.items.length} configured link{group.items.length === 1 ? '' : 's'}</p></div>
          <span className="badge neutral">{group.items.filter((item) => item.is_visible).length} visible</span>
        </div>

        <div className="admin-nav-editor-list">
          {group.items.map((item) => <form action={saveNavItem} className="admin-nav-editor-row" key={item.id}>
            <input type="hidden" name="id" value={item.id} />
            <div className="admin-nav-editor-row-head">
              <div><strong>{item.label}</strong><span>{item.href}</span></div>
              <span className={`badge ${item.is_visible ? 'verified' : 'neutral'}`}>{item.is_visible ? 'Visible' : 'Hidden'}</span>
            </div>
            <div className="admin-form-grid">
              <label>Menu<select name="menu_key" defaultValue={item.menu_key}>{Object.entries(menuLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
              <label>Label<input name="label" defaultValue={item.label} /></label>
              <label>Link<input name="href" defaultValue={item.href} /></label>
              <label>Sort Order<input name="sort_order" type="number" defaultValue={item.sort_order} /></label>
              <label className="check"><input type="checkbox" name="is_visible" defaultChecked={item.is_visible} /> Visible</label>
            </div>
            <div className="admin-row-actions"><button className="btn btn-primary btn-small">Save Link</button></div>
          </form>)}
          {!group.items.length && <div className="empty">No links are configured in this menu yet.</div>}
        </div>
      </section>)}
    </div>
  </>
}
