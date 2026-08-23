// Browser compatibility fix for SEO Audit Lab only.
// Keeps all existing SEO UI/report logic intact while routing the audit call
// through the authenticated CORS-safe proxy function.
if (typeof sb !== 'undefined' && sb?.functions?.invoke) {
  const seoAuditInvokeBase = sb.functions.invoke.bind(sb.functions);
  sb.functions.invoke = async function(name, options) {
    const isSeoAudit = name === 'seo-audit';
    const result = await seoAuditInvokeBase(isSeoAudit ? 'seo-audit-browser' : name, options);
    if (isSeoAudit && result?.error?.context) {
      try {
        const payload = await result.error.context.clone().json();
        if (payload?.error) result.error.message = payload.error;
      } catch {}
    }
    return result;
  };
}
