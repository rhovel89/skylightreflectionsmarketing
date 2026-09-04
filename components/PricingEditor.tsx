import { getPublicConfig } from '@/lib/data'
import { savePlan, createPlan } from '@/app/admin/actions'

export async function PricingEditor() {
  const cfg = await getPublicConfig()
  const plans = cfg.plans ?? []
  const active = plans.filter((plan) => plan.is_active).length

  return <>
    <div className="admin-page-head">
      <div>
        <div className="kpi">Public Monetization</div>
        <h1>Pricing & Plans</h1>
        <p className="muted">This is the single source of truth for public plan names, prices and features. Stripe remains disconnected until explicitly enabled.</p>
      </div>
      <span className="badge verified">Editable</span>
    </div>

    <div className="stat-grid">
      <div className="stat">Total Plans<strong>{plans.length}</strong><span className="small muted">All configured plans</span></div>
      <div className="stat">Active Plans<strong>{active}</strong><span className="small muted">Currently available publicly</span></div>
      <div className="stat">Inactive Plans<strong>{plans.length - active}</strong><span className="small muted">Hidden from purchase flows</span></div>
    </div>

    <details className="admin-create-disclosure" style={{ marginTop: 16 }}>
      <summary><span className="admin-create-disclosure-title"><strong>Add a Plan</strong><span>Create another package without cluttering the active plan editor.</span></span></summary>
      <div className="admin-create-disclosure-body">
        <form action={createPlan} className="admin-card">
          <div className="admin-form-grid">
            <label>Name<input name="name" required /></label>
            <label>Slug<input name="slug" required /></label>
            <label>Monthly Price ($)<input type="number" name="monthly_price" min="0" defaultValue="0" /></label>
            <label>Annual Price ($)<input type="number" name="annual_price" min="0" defaultValue="0" /></label>
            <label>Badge<input name="badge" /></label>
            <label>Sort Order<input type="number" name="sort_order" defaultValue="100" /></label>
            <label className="full-row">Description<textarea name="description" /></label>
          </div>
          <button className="btn btn-primary">Add Plan</button>
        </form>
      </div>
    </details>

    <div className="admin-workspace-heading">
      <div><div className="kpi">Plan Editor</div><h2>Customer-facing packages</h2></div>
      <p className="muted">Each card edits one plan independently. Save only the plan you changed.</p>
    </div>

    <div className="admin-settings-grid">
      {plans.map((plan) => <form action={savePlan} key={plan.id} className="admin-card admin-setting-card">
        <input type="hidden" name="id" value={plan.id} />
        <div className="admin-setting-card-head">
          <div>
            <div className="badges">
              <span className={`badge ${plan.is_active ? 'verified' : 'neutral'}`}>{plan.is_active ? 'Active' : 'Inactive'}</span>
              {plan.badge ? <span className="badge sponsored">{plan.badge}</span> : null}
            </div>
            <h2>{plan.name}</h2>
            <p className="small muted">${(plan.monthly_price_cents / 100).toFixed(0)}/mo{plan.annual_price_cents ? ` · $${(plan.annual_price_cents / 100).toFixed(0)}/yr` : ''}</p>
          </div>
        </div>
        <div className="admin-form-grid">
          <label>Plan Name<input name="name" defaultValue={plan.name} /></label>
          <label>Badge<input name="badge" defaultValue={plan.badge ?? ''} /></label>
          <label>Monthly Price ($)<input type="number" step="1" min="0" name="monthly_price" defaultValue={plan.monthly_price_cents / 100} /></label>
          <label>Annual Price ($)<input type="number" step="1" min="0" name="annual_price" defaultValue={(plan.annual_price_cents ?? 0) / 100} /></label>
          <label>Sort Order<input type="number" name="sort_order" defaultValue={plan.sort_order ?? 0} /></label>
          <label className="check"><input type="checkbox" name="is_active" defaultChecked={plan.is_active} /> Active Plan</label>
          <label className="full-row">Description<textarea name="description" defaultValue={plan.description ?? ''} /></label>
          <label className="full-row">Features — one per line<textarea name="features" defaultValue={Array.isArray(plan.features) ? (plan.features as string[]).join('\n') : JSON.stringify(plan.features)} /></label>
        </div>
        <div className="admin-form-savebar admin-form-savebar-inline">
          <div><strong>{plan.name}</strong><span>Changes affect the customer-facing plan card.</span></div>
          <button className="btn btn-primary">Save Plan</button>
        </div>
      </form>)}
    </div>
  </>
}
