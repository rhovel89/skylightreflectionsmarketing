import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/SiteShell'

export const dynamic='force-dynamic'
export const metadata:Metadata={
  title:'Childcare Resources for Central Illinois Families',
  description:'Independent information and official links to help Central Illinois parents and guardians research childcare, daycare, babysitters and early-learning programs. Central Illinois Local Pros does not collect childcare requests or recommend providers.',
  alternates:{canonical:'/childcare'},
  openGraph:{type:'website',url:'/childcare',title:'Childcare Resources for Central Illinois Families',description:'Parent-focused information, questions to ask and official Illinois resources for researching child care.'},
}

const ResourceLink=({href,title,children}:{href:string;title:string;children:React.ReactNode})=><div className="card"><h3>{title}</h3><p className="muted small">{children}</p><a className="btn btn-light" href={href} target="_blank" rel="noopener noreferrer">Open Official Resource ↗</a></div>

export default function Page(){
  return <SiteShell><main>
    <section className="pagehero"><div className="container"><div className="crumb">Home › Parent Resources › Childcare</div><h1>Childcare Information & Parent Resources</h1><p>Central Illinois Local Pros does not collect childcare requests or match families with caregivers. Use this page to research your options, understand what to verify, and go directly to official Illinois and federal resources.</p></div></section>

    <section className="section"><div className="container">
      <div className="card" style={{marginBottom:22}}><div className="kpi">Information only — you make the decision</div><h2>Important Childcare Disclaimer</h2><p><strong>Central Illinois Local Pros provides general educational information and links to third-party resources only.</strong> We do not license, employ, screen, background-check, endorse, recommend, guarantee, rank for safety, or place childcare providers, babysitters, nannies, daycare centers, early-learning programs, or other caregivers.</p><p className="muted">A link, social profile, business page, agency resource, directory result, or mention on this site is not a safety endorsement. Parents and guardians are responsible for independently verifying identity, licensing or lawful exemption status, inspection and compliance history, background checks, references, insurance where applicable, training, policies, and suitability before allowing any person or organization to care for a child.</p></div>

      <div className="section-head"><div><div className="kpi">Start here</div><h2>Official Childcare Research Resources</h2><p className="muted">Use official sources first, then independently confirm details directly with each program or caregiver.</p></div></div>
      <div className="grid grid-2" style={{marginBottom:28}}>
        <ResourceLink href="https://www.illinoiscaresforkids.org/provider-search" title="Illinois Cares for Kids Provider Search">Search Illinois early-learning and child-care programs by city, county, ZIP, distance and Circle of Quality.</ResourceLink>
        <ResourceLink href="https://www.illinoiscaresforkids.org/families-en/family-resources/ccr-r-agencies" title="Find Your Local CCR&R">Illinois Child Care Resource & Referral agencies can help families locate care, understand quality, and navigate child-care resources.</ResourceLink>
        <ResourceLink href="https://idec.illinois.gov/forparents/find-child-care.html" title="Illinois Department of Early Childhood">Illinois' current state lead agency for child-care licensing and early-childhood programs provides family and licensure resources.</ResourceLink>
        <ResourceLink href="https://www.childcare.gov/state-resources/illinois/understanding-and-finding-child-care-resources" title="ChildCare.gov — Illinois">Review Illinois-specific links for licensing, inspection reports, background-check requirements, complaints and other consumer information.</ResourceLink>
        <ResourceLink href="https://www.childcare.gov/consumer-education/find-and-choose-quality-child-care/simple-steps-for-finding-and-choosing-child-care" title="How to Find & Choose Child Care">Federal parent guidance covering licensing status, inspection reports, questions to ask, program visits and comparing options.</ResourceLink>
        <ResourceLink href="https://www.facebook.com/IllinoisCCAP" title="Illinois CCAP on Facebook">Official Illinois Child Care Assistance Program social page for program information and updates. Always confirm important eligibility or policy details through official state resources.</ResourceLink>
      </div>

      <div className="grid grid-2">
        <div className="card"><div className="kpi">Know what you are considering</div><h2>Understand the Type of Care</h2><ul>
          <li><strong>Licensed child-care center:</strong> Ask to see the current license and confirm its status through official state resources.</li>
          <li><strong>Licensed family or group child-care home:</strong> Confirm licensing, capacity, household/adult access, inspection history and current policies.</li>
          <li><strong>License-exempt or informal care:</strong> Some arrangements may legally operate without the same licensing structure. Ask why the arrangement is exempt and independently verify what oversight and background-check requirements apply.</li>
          <li><strong>Babysitter, nanny, family/friend/neighbor care:</strong> Parents may need to perform substantially more screening themselves because informal care may not be monitored like a licensed program.</li>
        </ul><p className="small muted">Licensing is an important baseline, but it is not a guarantee that a provider is the right fit or that a future safety issue cannot occur.</p></div>

        <div className="card"><div className="kpi">Safety & oversight</div><h2>Questions to Ask Every Provider</h2><ul>
          <li>Are you licensed? If not, what lawful exemption applies?</li>
          <li>Where can I review your current license, inspections, compliance history and substantiated complaints?</li>
          <li>Have all adults with access to children completed the background checks required for this type of care?</li>
          <li>Who is CPR/first-aid trained, and when were certifications last renewed?</li>
          <li>What are your child-to-adult ratios and typical group sizes?</li>
          <li>What is your pickup/release procedure and how do you verify authorized adults?</li>
          <li>What are your emergency, severe-weather, evacuation and lockdown procedures?</li>
          <li>How are injuries, incidents and suspected abuse or neglect documented and reported?</li>
        </ul></div>

        <div className="card"><div className="kpi">Daily care</div><h2>Ask About the Everyday Experience</h2><ul>
          <li>What does a normal day look like for my child's age group?</li>
          <li>How do you handle naps, feeding, outdoor play and screen time?</li>
          <li>What is your discipline and behavior-guidance policy?</li>
          <li>How do you handle diapering/toileting, handwashing and sanitation?</li>
          <li>What is your illness/exclusion policy?</li>
          <li>How are allergies, medications and special instructions handled?</li>
          <li>Do you transport children? If so, who drives and what vehicle/insurance/safety rules apply?</li>
          <li>How do families receive daily updates and communicate concerns?</li>
        </ul></div>

        <div className="card"><div className="kpi">Costs & policies</div><h2>Questions Before You Sign Anything</h2><ul>
          <li>What are tuition/rates, deposits, registration fees and late-pickup fees?</li>
          <li>What holidays, vacation weeks or other closures are still charged?</li>
          <li>Do you accept Illinois child-care assistance/CCAP, if relevant?</li>
          <li>What are the cancellation, withdrawal and notice requirements?</li>
          <li>Is there a waitlist and is any waitlist payment refundable?</li>
          <li>Can I review the full parent handbook or written agreement before paying?</li>
          <li>Can you provide current references from families who have used your care?</li>
        </ul></div>
      </div>
    </section>

    <section className="section alt"><div className="container"><div className="grid grid-2">
      <div className="card"><div className="kpi">Visit before deciding</div><h2>What to Look For In Person</h2><ul>
        <li>Children appear supervised, engaged and treated respectfully.</li>
        <li>Adults can clearly explain who is responsible for each group.</li>
        <li>Entrances, exits, outdoor areas, medications, cleaning products and hazards are appropriately secured.</li>
        <li>Sleep spaces and infant sleep practices appear consistent with current safe-sleep guidance.</li>
        <li>Bathrooms, diapering areas, food areas and play spaces appear maintained and sanitary.</li>
        <li>Emergency exits and plans are visible and staff can explain what happens during an emergency.</li>
        <li>Staff interaction feels calm, responsive and age-appropriate—not dismissive, threatening or chaotic.</li>
        <li>The provider welcomes reasonable questions instead of pressuring you to commit immediately.</li>
      </ul><p className="small muted">Visit more than one option whenever possible and compare what you saw with official licensing/inspection information.</p></div>

      <div className="card"><div className="kpi">Sitters, nannies & informal care</div><h2>Do Not Rely on a Facebook Profile Alone</h2><ul>
        <li>Verify the caregiver's identity and contact information.</li>
        <li>Speak directly with multiple references and ask specific questions about reliability and child supervision.</li>
        <li>Determine what background screening is appropriate and legally available for your situation.</li>
        <li>Confirm CPR/first-aid training and emergency readiness.</li>
        <li>If transportation is involved, verify driver's license, vehicle condition, insurance and child-restraint practices.</li>
        <li>Use public social/business profiles as one research input only—not proof of trustworthiness or safety.</li>
        <li>Set written expectations for schedule, visitors, transportation, discipline, photos/social posting, emergencies and authorized activities.</li>
        <li>Consider a meeting or observed trial period before leaving a child in someone's care.</li>
      </ul></div>

      <div className="card"><div className="kpi">Warning signs</div><h2>Red Flags Worth Investigating</h2><ul>
        <li>Refusing reasonable visits or basic questions about licensing/exemption status.</li>
        <li>Being unwilling to explain background checks, inspections, policies or who will have access to children.</li>
        <li>Unsafe sleep practices, unsecured hazards or unclear supervision.</li>
        <li>No clear authorized-pickup/release process.</li>
        <li>Frequent unexplained staff turnover or adults you were not told would be present.</li>
        <li>Pressure for unusually large cash payments, secrecy, or immediate commitments before you can review documents.</li>
        <li>Information on a website/Facebook page that conflicts with official licensing or inspection records.</li>
      </ul><p className="small muted">A red flag does not prove wrongdoing, but it is a reason to slow down, ask more questions and verify through independent sources.</p></div>

      <div className="card"><div className="kpi">After choosing care</div><h2>Keep Verifying Over Time</h2><ul>
        <li>Keep your agreement, emergency contacts and authorized-pickup list current.</li>
        <li>Provide health, allergy and medication information directly to the provider—not through Central Illinois Local Pros.</li>
        <li>Stay involved and communicate regularly with the caregiver or program.</li>
        <li>Periodically review current licensing/inspection information and updated policies.</li>
        <li>Ask questions when staffing, ownership, location, transportation or household circumstances change.</li>
      </ul><div className="actions"><a className="btn btn-primary" href="https://www.illinoiscaresforkids.org/provider-search" target="_blank" rel="noopener noreferrer">Search Official Illinois Providers ↗</a><Link className="btn btn-light" href="/local-services">Browse Other Local Services</Link></div></div>
    </div></div></section>
  </main></SiteShell>
}
