import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { requireSuperAdmin } from '@/lib/auth'
import { addUserRole, deleteUserRole } from '@/app/admin/actions'

export async function TeamRoles() {
  await requireSuperAdmin('/admin/team')
  const s = await createClient()
  const { data, error } = await s.from('user_roles').select('user_id,role,tenant_id').eq('tenant_id', TENANT_ID)
  const rows = (data ?? []) as any[]
  const admins = rows.filter((row) => row.role === 'admin').length
  const superAdmins = rows.filter((row) => row.role === 'super_admin').length
  const staff = rows.filter((row) => row.role === 'staff').length

  return <>
    <div className="admin-page-head">
      <div>
        <div className="kpi">Protected Access Control</div>
        <h1>Team / Roles</h1>
        <p className="muted">Super Admin controls staff access. Business owners belong in business_owners, not staff roles.</p>
      </div>
      <span className="badge sponsored">Super Admin Only</span>
    </div>

    <div className="stat-grid">
      <div className="stat">Staff Roles<strong>{rows.length}</strong><span className="small muted">Total tenant role assignments</span></div>
      <div className="stat">Staff<strong>{staff}</strong><span className="small muted">Standard staff access</span></div>
      <div className="stat">Admins<strong>{admins}</strong><span className="small muted">Administrative access</span></div>
      <div className="stat">Super Admins<strong>{superAdmins}</strong><span className="small muted">Highest staff privilege</span></div>
    </div>

    <details className="admin-create-disclosure" style={{ marginTop: 16 }}>
      <summary><span className="admin-create-disclosure-title"><strong>Assign Staff Role</strong><span>Add an authenticated user to the protected staff console.</span></span></summary>
      <div className="admin-create-disclosure-body">
        <form action={addUserRole} className="admin-card">
          <div className="admin-form-grid">
            <label>User UUID<input name="user_id" required /></label>
            <label>Role<select name="role"><option value="staff">Staff</option><option value="admin">Admin</option><option value="super_admin">Super Admin</option></select></label>
          </div>
          <button className="btn btn-primary">Assign Role</button>
        </form>
      </div>
    </details>

    {error && <div className="notice warn">{error.message}</div>}

    <div className="admin-list-meta">
      <span className="kpi">Current Staff Access</span>
      <span className="small muted">Remove only roles that are no longer required.</span>
    </div>
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead><tr><th>User ID</th><th>Role</th><th>Action</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={`${row.user_id}-${row.role}`}>
          <td><code className="admin-cell-code">{row.user_id}</code></td>
          <td><span className={`badge ${row.role === 'super_admin' ? 'sponsored' : row.role === 'admin' ? 'verified' : 'neutral'}`}>{roleLabel(row.role)}</span></td>
          <td><form action={deleteUserRole}><input type="hidden" name="user_id" value={row.user_id} /><input type="hidden" name="role" value={row.role} /><button className="btn btn-small btn-danger">Remove</button></form></td>
        </tr>)}</tbody>
      </table>
    </div>

    <div className="notice" style={{ marginTop: 15 }}><strong>Bootstrap rule:</strong> create the owner's Auth account first, then assign its UUID the first super_admin role in Supabase. After that, team roles are editable here.</div>
  </>
}

function roleLabel(role: string) {
  return role === 'super_admin' ? 'Super Admin' : role === 'admin' ? 'Admin' : 'Staff'
}
