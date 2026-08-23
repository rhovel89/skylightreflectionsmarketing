// Smart Niche Finder legal-category clarity patch.
// Keep one legal niche and label it clearly for lawyers/law firms.
try {
  if (typeof PN !== 'undefined' && Array.isArray(PN)) {
    const attorneyIndex = PN.findIndex(x => Array.isArray(x) && x[0] === 'Attorneys');
    if (attorneyIndex >= 0) {
      PN[attorneyIndex] = ['Lawyers & Law Firms', 'lawyer', 'Strong'];
    } else if (!PN.some(x => Array.isArray(x) && x[0] === 'Lawyers & Law Firms')) {
      PN.push(['Lawyers & Law Firms', 'lawyer', 'Strong']);
    }
  }
} catch (e) {
  console.warn('Lawyers niche patch could not load:', e?.message || e);
}
