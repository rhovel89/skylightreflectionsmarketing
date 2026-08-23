// Browser compatibility fix for SEO Audit Lab only.
// Keeps all existing SEO UI/report logic intact while routing the audit call
// through the authenticated CORS-safe proxy function.
if (typeof sb !== 'undefined' && sb?.functions?.invoke) {
  const seoAuditInvokeBase = sb.functions.invoke.bind(sb.functions);
  sb.functions.invoke = function(name, options) {
    return seoAuditInvokeBase(name === 'seo-audit' ? 'seo-audit-browser' : name, options);
  };
}
