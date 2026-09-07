'use client'

export function VisibilityReportPrintButton(){
  return <button className="btn btn-primary no-print" onClick={()=>window.print()}>Print / Save PDF</button>
}
