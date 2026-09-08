export type EstateGuideSection={heading:string;paragraphs?:string[];bullets?:string[]}
export type EstateGuideFaq={q:string;a:string}
export type EstateGuideSource={label:string;url:string}
export type EstateGuide={slug:string;title:string;description:string;excerpt:string;category:string;keywords:string[];updated:string;sections:EstateGuideSection[];faqs:EstateGuideFaq[];sources:EstateGuideSource[]}

const IRS_ESTATE='https://www.irs.gov/businesses/small-businesses-self-employed/estate-tax'
const IRS_ESTATE_FAQ='https://www.irs.gov/businesses/small-businesses-self-employed/frequently-asked-questions-on-estate-taxes'
const IRS_GIFT_FAQ='https://www.irs.gov/businesses/small-businesses-self-employed/frequently-asked-questions-on-gift-taxes'
const CFPB_POA='https://www.consumerfinance.gov/ask-cfpb/what-is-a-power-of-attorney-poa-en-1149/'
const CFPB_MONEY='https://www.consumerfinance.gov/consumer-tools/managing-someone-elses-money/'
const NIA_ADVANCE='https://www.nia.nih.gov/health/advance-care-planning/advance-care-planning-advance-directives-health-care'
const NIA_PROXY='https://www.nia.nih.gov/health/advance-care-planning/choosing-health-care-proxy'
const NIA_AFFAIRS='https://www.nia.nih.gov/health/advance-care-planning/getting-your-affairs-order-checklist-documents-prepare-future'

export const estateGuides:EstateGuide[]=[
{
slug:'estate-planning-101',
title:'Estate Planning 101: A Practical Guide to Wills, Trusts and Planning Ahead',
description:'Learn the basic parts of an estate plan, including wills, trusts, powers of attorney, health care directives, beneficiaries and when to speak with an estate-planning attorney.',
excerpt:'A plain-English starting point for understanding what an estate plan can include, what each document is meant to do, and what to organize before you meet with an attorney.',
category:'Estate Planning Basics',
keywords:['estate planning','estate planning guide','wills and trusts','estate planning attorney','estate plan checklist'],
updated:'2026-09-07',
sections:[
{heading:'What is estate planning?',paragraphs:['Estate planning is the process of deciding how you want important financial, family, health-care and property matters handled during your life and after your death. It is broader than simply writing a will. A complete plan may address who receives property, who can act for you if you cannot act for yourself, who should manage assets for children or other beneficiaries, and how a business or other complicated property should be handled.','The exact documents and legal rules vary by state. The goal of a good first conversation is not to diagnose your own legal needs, but to understand the decisions that need to be made and bring those decisions to a qualified attorney.']},
{heading:'Common pieces of an estate plan',bullets:['A last will and testament that states how probate assets should be distributed and can nominate an executor or personal representative.','A revocable living trust when appropriate, together with a plan for transferring or “funding” assets into the trust.','A financial power of attorney naming someone to handle permitted financial matters if needed.','Advance health-care documents, which may include a living will and a health-care power of attorney or proxy depending on state law.','Beneficiary designations for life insurance, retirement accounts and other assets that pass by contract.','Instructions for business interests, digital assets, personal property and other special situations.']},
{heading:'Who should think about estate planning?',paragraphs:['Estate planning is not only for wealthy households. Parents with minor children, homeowners, business owners, people in blended families, adults caring for aging relatives, unmarried partners and anyone who wants to choose who can make decisions during incapacity may all have planning issues worth discussing.','Tax planning is only one possible part of estate planning. For many families, the more immediate concerns are decision-making authority, beneficiary coordination, reducing confusion, protecting children and making sure important documents can be found.']},
{heading:'A useful first step',paragraphs:['Start by listing the people you may want involved, the broad categories of assets and debts you own, existing beneficiary designations, any current will or trust, and the questions you want answered. Do not put Social Security numbers, passwords, bank account numbers or sensitive legal documents into a general online inquiry form.','Skylight Reflections Marketing only asks preliminary qualifying questions and coordinates appointments. If an appointment is booked, the attorney or law office can tell you what documents, if any, they want you to bring directly to the legal consultation.']}
],
faqs:[{q:'Do I need to be wealthy to have an estate plan?',a:'No. Estate planning can address incapacity, health-care choices, guardianship nominations, beneficiaries and property distribution even when federal estate tax is not an issue.'},{q:'Is a will the same thing as an estate plan?',a:'No. A will can be an important part of a plan, but many plans also address powers of attorney, health-care directives, beneficiary designations, trusts or other planning needs.'},{q:'Can Skylight tell me which legal documents I need?',a:'No. Skylight handles preliminary qualification and appointment coordination, not legal advice. The attorney determines which legal tools fit your situation.'}],
sources:[{label:'National Institute on Aging — Getting Your Affairs in Order',url:NIA_AFFAIRS},{label:'Consumer Financial Protection Bureau — Power of Attorney',url:CFPB_POA}]
},
{
slug:'will-vs-trust',
title:'Will vs. Trust: What Is the Difference?',
description:'Compare wills and revocable living trusts, including probate, asset ownership, beneficiaries, incapacity planning and why many estate plans use both.',
excerpt:'Wills and trusts are different legal tools. This guide explains the practical differences, common misconceptions and questions to discuss with an estate-planning attorney.',
category:'Wills & Trusts',
keywords:['will vs trust','trust vs will','living trust vs will','do I need a trust','estate planning trust'],
updated:'2026-09-07',
sections:[
{heading:'The short version',paragraphs:['A will generally directs what happens to property that is subject to the probate process after death. A revocable living trust can hold property during life and provide instructions for management and distribution of property owned by the trust. Because not every asset passes through a will or a trust, beneficiary designations and ownership structure also matter.','Many estate plans use both tools. A person who creates a revocable trust may still have a “pour-over” will or another will that addresses property not transferred to the trust and other matters allowed under state law.']},
{heading:'What a will commonly does',bullets:['States how probate property should be distributed, subject to state law.','Names the person you want to administer the estate, subject to court appointment and state procedure.','Can nominate guardians for minor children in many states, although the court applies state law and the child’s best interests.','Can work with testamentary trusts or other provisions created at death.']},
{heading:'What a revocable living trust commonly does',bullets:['Holds assets that are actually transferred to the trust.','Names a trustee and successor trustee to manage trust property under the trust terms.','Can provide continuity if the person who created the trust becomes unable to manage trust assets.','May allow properly titled trust assets to avoid probate, although state law, asset type and ownership details matter.']},
{heading:'Important misconceptions',paragraphs:['A revocable living trust does not automatically protect your own assets from your creditors, eliminate all taxes, or control assets that were never transferred into the trust. A will does not automatically control accounts that have a valid beneficiary designation or certain jointly owned property.','The right choice depends on state law, family structure, property, privacy goals, incapacity concerns and the amount of administration you are willing to do during life.']}
],
faqs:[{q:'Does a trust replace a will?',a:'Not always. Many people with revocable living trusts still use a will for property or decisions not handled by the trust.'},{q:'Does having a trust guarantee that probate is avoided?',a:'No. Whether probate is avoided depends on what the trust owns, how other assets are titled and designated, and the law of the applicable state.'},{q:'Is a trust only for rich people?',a:'No. Trusts can be used for many non-tax reasons, but whether a trust is worth the added complexity depends on the individual situation.'}],
sources:[{label:'National Institute on Aging — Getting Your Affairs in Order',url:NIA_AFFAIRS}]
},
{
slug:'revocable-living-trust-basics',
title:'Revocable Living Trust Basics: How Funding, Trustees and Beneficiaries Fit Together',
description:'Understand revocable living trusts, trust funding, successor trustees, beneficiaries and the questions to ask before deciding whether a living trust fits your estate plan.',
excerpt:'A revocable living trust only works as intended when the legal document and the ownership of assets work together. Learn the basic moving parts before your consultation.',
category:'Wills & Trusts',
keywords:['revocable living trust','living trust','how does a living trust work','funding a trust','successor trustee'],
updated:'2026-09-07',
sections:[
{heading:'What is a revocable living trust?',paragraphs:['A revocable living trust is a legal arrangement created during life. The person creating it may often serve as the initial trustee and retain the ability to amend or revoke it while legally capable, depending on the document and state law. A successor trustee can be named to take over management when the trust terms say that should happen.','The trust document contains instructions, but the trust generally needs to own or receive the assets that are intended to be governed by those instructions.']},
{heading:'Why “funding” matters',paragraphs:['Funding means changing ownership or beneficiary arrangements so that appropriate assets are connected to the trust. The exact process differs by asset. Real estate may require a deed; a bank or brokerage account may require retitling; retirement accounts raise separate beneficiary and tax considerations and should not be changed casually.','An unfunded or partially funded trust may fail to accomplish some of the owner’s goals. That is why implementation should be part of the planning discussion, not an afterthought.']},
{heading:'Roles to understand',bullets:['Grantor, settlor or trustmaker: the person creating the trust. Terminology varies.','Trustee: the person or institution managing trust property under the trust terms.','Successor trustee: the person or institution designated to step in later.','Beneficiary: the person or organization entitled to receive benefits under the trust terms.']},
{heading:'Questions to ask before creating one',bullets:['What specific problem would the trust solve for me?','Which assets should or should not be transferred to it?','Who should be successor trustee, and who should be backup?','How should assets be handled if I become incapacitated?','How should beneficiaries receive property, and at what ages or milestones?','What ongoing administration will be required?']}
],
faqs:[{q:'What happens if I create a trust but never transfer assets to it?',a:'The trust may not control assets that were never transferred or otherwise connected to it. Funding and beneficiary coordination are important parts of implementation.'},{q:'Can I be my own trustee?',a:'Many revocable living trusts name the person who created the trust as initial trustee, but the appropriate structure depends on the plan and state law.'},{q:'Is a revocable trust the same as an irrevocable trust?',a:'No. They can have very different control, tax, creditor and administration consequences. Ask an attorney which structure, if any, fits your goals.'}],
sources:[{label:'Consumer Financial Protection Bureau — Guides for Trustees and Other Fiduciaries',url:CFPB_MONEY}]
},
{
slug:'estate-planning-checklist',
title:'Estate Planning Checklist: What to Organize Before You Meet With an Attorney',
description:'Use this estate planning checklist to organize family information, assets, beneficiaries, decision-makers, business interests and questions before a legal consultation.',
excerpt:'A practical, non-sensitive checklist that helps you prepare for an estate-planning conversation without sending private financial documents through a public form.',
category:'Estate Planning Basics',
keywords:['estate planning checklist','estate planning documents checklist','prepare for estate planning attorney','estate planning information'],
updated:'2026-09-07',
sections:[
{heading:'1. List the people involved',bullets:['Spouse or partner.','Children, stepchildren and other dependents.','Anyone with special needs or who may need help managing an inheritance.','Potential executor, trustee, financial agent and health-care decision-maker.','Backup people for important roles.']},
{heading:'2. Make a high-level asset inventory',paragraphs:['You do not need account numbers for an initial planning list. Record broad categories such as home and other real estate, bank accounts, investment accounts, retirement accounts, life insurance, business interests, vehicles, valuable personal property and digital assets. Also note major debts.','The purpose is to help identify how assets are owned and how they may pass, not to publish private details.']},
{heading:'3. Review beneficiary designations',paragraphs:['Life insurance, retirement plans and some financial accounts can pass under beneficiary designations rather than a will. Old designations can conflict with current intentions. Make a list of which accounts have beneficiaries so the attorney can help you review coordination.']},
{heading:'4. Find existing planning documents',bullets:['Current will or trust.','Financial power of attorney.','Health-care power of attorney, health-care proxy or advance directive.','Prenuptial or postnuptial agreement if relevant.','Business agreements that affect ownership or transfer rights.','Prior beneficiary or transfer-on-death instructions.']},
{heading:'5. Write down your goals and questions',bullets:['Who should receive property?','Who should make financial decisions if you cannot?','Who should make health-care decisions?','Who should care for minor children?','Are there beneficiaries who should receive assets gradually rather than outright?','Do you own property in more than one state?','Do you own a business?','What would make administration easier for your family?']},
{heading:'Privacy reminder',paragraphs:['Do not send Social Security numbers, passwords, full account numbers, tax returns, medical records or confidential legal documents through Skylight’s preliminary appointment form. If your consultation is booked, the attorney or law office can tell you what to provide directly and how to provide it securely.']}
],
faqs:[{q:'Do I need exact account balances before my first estate-planning call?',a:'Usually a high-level inventory is a useful starting point. The attorney can tell you what exact values or documents are needed for legal or tax analysis.'},{q:'Should I upload my will or trust to Skylight?',a:'No. Skylight does not collect legal documents for the attorney. Bring or send documents directly to the law office only if the attorney requests them.'}],
sources:[{label:'National Institute on Aging — Getting Your Affairs in Order Checklist',url:NIA_AFFAIRS}]
},
{
slug:'power-of-attorney-guide',
title:'Power of Attorney Guide: Financial Authority, Durable POAs and Choosing an Agent',
description:'Learn what a power of attorney does, how financial and health-care powers differ, what “durable” can mean and how to think about choosing a trusted agent.',
excerpt:'A power of attorney can let someone act on your behalf. This guide explains the core concepts and the questions to take to an attorney.',
category:'Incapacity Planning',
keywords:['power of attorney','durable power of attorney','financial power of attorney','POA estate planning','choose power of attorney agent'],
updated:'2026-09-07',
sections:[
{heading:'What is a power of attorney?',paragraphs:['A power of attorney is a legal document that authorizes another person to act on your behalf within the authority granted by the document. The person acting is commonly called an agent or attorney-in-fact. State terminology and rules vary.','A financial power of attorney deals with financial or property matters. A health-care power of attorney or proxy addresses medical decisions and is a separate planning tool in many states.']},
{heading:'What does “durable” mean?',paragraphs:['A durable financial power of attorney is generally designed to remain effective even if the principal later becomes incapacitated, subject to state law and the document terms. The CFPB notes that durable financial powers of attorney can be used to plan ahead for a time when someone may be unable to make financial decisions.']},
{heading:'Choosing an agent',bullets:['Choose someone you trust with sensitive financial decisions.','Consider whether the person is organized, available and willing to serve.','Discuss whether a backup agent should be named.','Ask how the document defines when authority begins and ends.','Understand whether financial institutions may have their own review procedures.']},
{heading:'Why planning ahead matters',paragraphs:['Without valid advance authority, family members may have fewer options if a person becomes unable to manage finances. In some situations, court involvement may be needed. The exact alternatives depend on state law, so this is an area where state-specific legal advice matters.']}
],
faqs:[{q:'Is a power of attorney the same as guardianship?',a:'No. A power of attorney is authority granted through a legal document, while guardianship or conservatorship generally involves court appointment under state law.'},{q:'Can I change my power of attorney?',a:'Often a person who still has legal capacity can revoke or replace a power of attorney, but the requirements depend on state law and the document.'},{q:'Should the same person handle finances and health care?',a:'That is a planning choice, not a universal rule. Consider trust, skills, availability and family dynamics with your attorney.'}],
sources:[{label:'Consumer Financial Protection Bureau — What Is a Power of Attorney?',url:CFPB_POA},{label:'Consumer Financial Protection Bureau — Managing Someone Else’s Money',url:CFPB_MONEY}]
},
{
slug:'advance-directives-living-will-health-care-proxy',
title:'Advance Directives, Living Wills and Health Care Proxies: What They Mean',
description:'Understand advance directives, living wills, health-care proxies and durable powers of attorney for health care, including how these tools help communicate medical wishes.',
excerpt:'Health-care planning is a major part of estate planning. Learn the difference between written treatment instructions and naming someone to make decisions for you.',
category:'Incapacity Planning',
keywords:['advance directive','living will','health care proxy','health care power of attorney','medical power of attorney'],
updated:'2026-09-07',
sections:[
{heading:'Advance care planning in plain English',paragraphs:['Advance care planning means thinking about and communicating your preferences for future medical decisions in case you become seriously ill or unable to communicate. The National Institute on Aging identifies living wills and durable powers of attorney for health care as common advance directives.']},
{heading:'Living will',paragraphs:['A living will records preferences about medical treatment for situations covered by the document and applicable law. It is not the same as a last will and testament, which deals with property and estate administration after death.']},
{heading:'Health-care proxy or health-care power of attorney',paragraphs:['A health-care proxy is a person chosen to make medical decisions if you cannot communicate your own decisions. The legal document used to appoint that person may be called a durable power of attorney for health care, health-care power of attorney, proxy directive or another name depending on the state.']},
{heading:'Questions to discuss with the person you choose',bullets:['Do they understand your values and priorities?','Will they follow your wishes even if other people disagree?','Are they comfortable talking with doctors and asking questions?','Can they handle conflict or time-sensitive decisions?','Should you name a backup person?']},
{heading:'Keep the plan current',paragraphs:['NIA recommends revisiting advance-care decisions over time and after major life changes. Moving to another state can also be a reason to review documents because legal requirements vary.']}
],
faqs:[{q:'Is a living will the same as a will?',a:'No. A living will concerns medical treatment preferences, while a last will and testament concerns estate matters after death.'},{q:'Can I have both a living will and a health-care proxy?',a:'Yes. These tools can work together, subject to state law, because one records preferences while the other names a decision-maker.'}],
sources:[{label:'National Institute on Aging — Advance Directives for Health Care',url:NIA_ADVANCE},{label:'National Institute on Aging — Choosing a Health Care Proxy',url:NIA_PROXY}]
},
{
slug:'probate-basics',
title:'Probate Basics: What Probate Is and Why Estate Plans Try to Make Administration Easier',
description:'Learn what probate generally is, which assets may pass outside probate, why ownership and beneficiary designations matter and which questions to ask an attorney.',
excerpt:'Probate rules are state-specific, but the basic concept is simple: a court-supervised process may be used to administer certain property after death.',
category:'Probate & Administration',
keywords:['what is probate','probate process','avoid probate','estate administration','probate estate planning'],
updated:'2026-09-07',
sections:[
{heading:'What is probate?',paragraphs:['Probate is a court-supervised process used under state law to administer certain property and claims after someone dies. The process can include validating a will, appointing a personal representative, identifying property, addressing creditor claims and distributing property. Procedures, terminology, deadlines and costs vary significantly by state.']},
{heading:'Not every asset necessarily passes through probate',paragraphs:['Some assets may transfer under mechanisms outside the will, such as beneficiary designations, certain forms of joint ownership, transfer-on-death arrangements or properly funded trusts. Whether a particular asset avoids probate depends on ownership, documents and state law.']},
{heading:'Why coordination matters',paragraphs:['An estate plan can fail to work as expected when the will, trust, beneficiary designations and account ownership point in different directions. Probate planning is therefore less about finding one magic document and more about making the entire ownership and beneficiary structure consistent.']},
{heading:'Questions worth asking',bullets:['Which of my assets would likely be subject to probate under my state’s law?','Would a trust materially simplify administration for my situation?','Are my beneficiary designations consistent with the rest of my plan?','Do I own real estate in more than one state?','Who should serve as executor or personal representative?','What records should my family be able to locate quickly?']}
],
faqs:[{q:'Does a will avoid probate?',a:'Usually a will is used within the probate process rather than automatically avoiding it. State law and the ownership of each asset determine the process.'},{q:'Does every estate go through the same probate process?',a:'No. States may have different procedures, including simplified options for some estates.'},{q:'Can a trust avoid probate?',a:'Properly structured and funded trust assets may avoid probate, but a trust does not automatically control assets that were never transferred to it.'}],
sources:[{label:'National Institute on Aging — Getting Your Affairs in Order',url:NIA_AFFAIRS}]
},
{
slug:'estate-planning-for-parents-minor-children',
title:'Estate Planning for Parents With Minor Children: Guardians, Inheritance and Backup Plans',
description:'A practical estate-planning guide for parents covering guardian nominations, inheritance management, beneficiaries, life insurance coordination and incapacity planning.',
excerpt:'Parents are often planning for two different risks at once: who would care for children and who would manage money or property for them.',
category:'Family Estate Planning',
keywords:['estate planning for parents','will guardian minor children','trust for children','estate planning with kids','guardian nomination'],
updated:'2026-09-07',
sections:[
{heading:'Two different decisions: care and money',paragraphs:['Parents often focus first on who would raise their children, but the person caring for a child and the person managing inherited property do not always have to be the same person. An estate-planning attorney can explain the options available under your state’s law.']},
{heading:'Guardian nominations',paragraphs:['A will can often be used to nominate a preferred guardian for minor children. The court ultimately applies state law and the child’s best interests, so a nomination is important guidance rather than a private guarantee. Consider naming backups in case the first choice cannot serve.']},
{heading:'Managing an inheritance for a child',paragraphs:['Leaving substantial property outright to a minor can create administrative problems because minors generally cannot manage property the same way adults can. Trusts, custodial arrangements and other state-law tools can be used to manage property for younger beneficiaries. The right structure depends on the amount, the child’s needs and how long management should continue.']},
{heading:'Coordinate life insurance and retirement beneficiaries',paragraphs:['Beneficiary designations can control significant assets independently of a will. Parents should review whether naming a minor directly, a trust, a custodian or another structure is appropriate. Do not change retirement beneficiaries without understanding the legal and tax consequences.']},
{heading:'Plan for incapacity too',paragraphs:['A parent can be alive but temporarily or permanently unable to handle financial or health-care decisions. Financial powers of attorney, health-care directives and practical emergency information can be just as important as death planning.']}
],
faqs:[{q:'Can I name a guardian for my children in my will?',a:'Many states allow a parent to nominate a guardian in a will, but the court applies state law and the child’s best interests when making an appointment.'},{q:'Should a minor child be named directly as a life-insurance beneficiary?',a:'That can create management issues. Ask an attorney about trusts, custodial arrangements or other options before changing a beneficiary designation.'}],
sources:[{label:'National Institute on Aging — Getting Your Affairs in Order',url:NIA_AFFAIRS}]
},
{
slug:'estate-planning-for-business-owners',
title:'Estate Planning for Business Owners: Succession, Control and Continuity',
description:'Business owners can use estate and succession planning to address ownership transfers, decision-making authority, buy-sell agreements, key people and family goals.',
excerpt:'A business can be one of a family’s largest assets and one of its hardest assets to transfer. Estate planning should coordinate with the company’s governing documents.',
category:'Business Succession',
keywords:['estate planning for business owners','business succession planning','business owner estate plan','buy sell agreement estate planning','family business succession'],
updated:'2026-09-07',
sections:[
{heading:'Why business owners need a separate planning conversation',paragraphs:['A personal will or trust may not be enough to determine what happens to a business interest. Operating agreements, shareholder agreements, partnership agreements, buy-sell provisions, lender requirements and tax rules can all affect transfer rights and control.']},
{heading:'Questions a succession plan should address',bullets:['Who can operate the business if the owner is temporarily incapacitated?','Who should own the business after the owner’s death?','Is the intended successor willing and capable?','Should family members receive ownership, cash, or different assets?','Does a buy-sell agreement control the transfer?','How will a purchase obligation be funded?','Who has access to essential records, vendor information and operating systems?']},
{heading:'Separate ownership from management',paragraphs:['The person who inherits economic value does not necessarily have to be the person who manages day-to-day operations. Some plans separate voting rights, management authority and economic benefits, but the available structures depend on entity type and state law.']},
{heading:'Coordinate legal, tax and financial advice',paragraphs:['Business succession can involve income tax, estate and gift tax, valuation, insurance, corporate law and family dynamics. A coordinated team may include an estate-planning attorney, business attorney, CPA, valuation professional, insurance professional and financial adviser.']}
],
faqs:[{q:'Does my personal will control my LLC or corporation?',a:'Not necessarily. Entity agreements, ownership structure, transfer restrictions and state law may affect what can be transferred and who can control the business.'},{q:'What is a buy-sell agreement?',a:'It is generally an agreement governing how ownership interests may be bought or transferred after specified events. Its terms should be coordinated with the owner’s estate plan.'}],
sources:[{label:'IRS — Estate and Gift Taxes',url:'https://www.irs.gov/businesses/small-businesses-self-employed/estate-and-gift-taxes'}]
},
{
slug:'digital-assets-estate-planning',
title:'Digital Assets and Estate Planning: Accounts, Devices, Photos, Crypto and Online Access',
description:'Learn how to inventory digital assets, separate access instructions from legal documents, plan for online accounts and discuss digital property with an estate-planning attorney.',
excerpt:'Your estate may include online accounts and digital property that family members cannot easily find or access. A secure inventory can reduce confusion.',
category:'Estate Planning Basics',
keywords:['digital assets estate planning','digital estate plan','crypto estate planning','online accounts after death','passwords estate planning'],
updated:'2026-09-07',
sections:[
{heading:'What counts as a digital asset?',bullets:['Email and cloud-storage accounts.','Digital photos, videos and creative files.','Websites, domains and online businesses.','Social-media accounts.','Cryptocurrency and other blockchain-based assets.','Loyalty points or digital rewards where transferable.','Devices containing important records or credentials.']},
{heading:'Create an inventory without making it a security risk',paragraphs:['List the account or asset, where it is located, why it matters and what you want done with it. Avoid putting live passwords, seed phrases or private keys directly into a will because probate documents may become public and passwords change over time.','Consider a secure password manager, encrypted record or other controlled system for access instructions. Tell the appropriate fiduciary how to find the system without exposing the credentials unnecessarily.']},
{heading:'Legal authority still matters',paragraphs:['Possessing a password does not automatically create legal authority to access an account. Platform terms, privacy laws, fiduciary-access statutes and the estate-planning documents can affect what an executor, trustee or agent may do. Ask an attorney how your state handles digital assets.']},
{heading:'Special care for cryptocurrency',paragraphs:['Crypto can be permanently inaccessible if keys or recovery information are lost. At the same time, exposing a seed phrase can result in theft. The plan should address both legal authority and secure technical access, preferably with people who understand the security implications.']}
],
faqs:[{q:'Should I put passwords in my will?',a:'Usually that creates security and updating concerns. Ask your attorney about a separate secure access system and how your fiduciary should be authorized.'},{q:'Are social-media accounts estate property?',a:'Rights vary by the platform, account type and applicable law. Include the accounts in your inventory and ask how your state treats digital assets.'}],
sources:[{label:'National Institute on Aging — Getting Your Affairs in Order',url:NIA_AFFAIRS}]
},
{
slug:'when-to-update-estate-plan',
title:'When Should You Update Your Estate Plan? 12 Life Events That Should Trigger a Review',
description:'Review your estate plan after marriage, divorce, births, deaths, moving, buying property, business changes, beneficiary changes, health changes and tax-law updates.',
excerpt:'Estate plans are not “set it and forget it.” Major life, family, property and legal changes can make old documents inconsistent with current goals.',
category:'Estate Planning Basics',
keywords:['when to update estate plan','update will','review estate plan','change trust after marriage','estate planning life events'],
updated:'2026-09-07',
sections:[
{heading:'Life events that should prompt a review',bullets:['Marriage or a new long-term partnership.','Divorce or separation.','Birth or adoption of a child or grandchild.','Death or incapacity of a beneficiary or person named to serve.','A child reaching adulthood.','Moving to another state.','Buying or selling major real estate.','Starting, buying or selling a business.','A major change in wealth, debt or insurance.','A change in retirement-account or life-insurance beneficiaries.','A major health diagnosis or change in care needs.','A significant change in federal or state tax law.']},
{heading:'Why beneficiary designations deserve their own review',paragraphs:['A revised will does not necessarily change the beneficiary on a retirement account, life-insurance policy or transfer-on-death account. Review the entire plan, not just the document with “will” on the cover.']},
{heading:'Moving states can be especially important',paragraphs:['State law affects wills, trusts, powers of attorney, health-care directives, probate and taxes. Documents validly signed in one state may still require practical or legal updates after a move. A local attorney can review whether changes are advisable.']},
{heading:'Use a regular review cycle too',paragraphs:['Even without a major event, periodically confirm that the people you named are still appropriate, addresses and contact information are current, trust funding remains coordinated and beneficiaries still reflect your intentions.']}
],
faqs:[{q:'How often should I review my estate plan?',a:'There is no universal schedule. A practical approach is to review periodically and whenever a major family, financial, health, location or legal change occurs.'},{q:'Does changing my will automatically change life-insurance beneficiaries?',a:'Usually not. Beneficiary designations are separate and should be reviewed directly.'}],
sources:[{label:'National Institute on Aging — Advance Care Planning',url:NIA_ADVANCE},{label:'National Institute on Aging — Getting Your Affairs in Order',url:NIA_AFFAIRS}]
},
{
slug:'2026-federal-estate-gift-tax-basics',
title:'2026 Federal Estate and Gift Tax Basics: Exclusion Amounts, Annual Gifts and Portability',
description:'A current 2026 overview of the federal estate tax basic exclusion amount, annual gift tax exclusion and portability, with links to official IRS guidance.',
excerpt:'Federal transfer-tax numbers changed for 2026. This guide summarizes the current IRS figures and explains why most estate-planning decisions are broader than federal estate tax.',
category:'Estate & Gift Tax',
keywords:['2026 estate tax exemption','2026 gift tax exclusion','federal estate tax 2026','estate tax threshold 2026','gift tax 2026'],
updated:'2026-09-07',
sections:[
{heading:'2026 federal estate-tax basic exclusion amount',paragraphs:['For decedents dying in 2026, the IRS lists a $15,000,000 basic exclusion amount for federal estate tax purposes. The filing calculation can also involve adjusted taxable gifts and other rules, so the headline number is not a complete tax analysis.','The federal threshold is not the same thing as a state estate or inheritance tax threshold. State transfer-tax rules vary and may apply at much lower levels.']},
{heading:'2026 annual gift-tax exclusion',paragraphs:['The IRS lists the annual exclusion for gifts at $19,000 per recipient for 2026. A gift above the annual exclusion does not automatically mean that gift tax is immediately due; federal gift-tax reporting and the lifetime exclusion rules can interact. Large or unusual gifts should be discussed with a tax professional.']},
{heading:'Portability for a surviving spouse',paragraphs:['Federal law allows a surviving spouse, in qualifying circumstances, to use a deceased spouse’s unused exclusion amount through a portability election. The IRS explains that the election is made on an estate tax return and can matter even when the first spouse’s estate otherwise would not have a filing requirement. Deadlines and technical requirements matter.']},
{heading:'Why tax thresholds should not drive the entire estate plan',paragraphs:['Many people will never owe federal estate tax, but still need to plan for beneficiaries, incapacity, guardians, probate, business succession, health-care decisions and administration. Tax planning is one layer of a broader estate plan.']},
{heading:'Current-information warning',paragraphs:['Tax laws and indexed amounts can change. These figures are current as of September 7, 2026 and should be verified against current IRS guidance before anyone relies on them for a transaction or filing.']}
],
faqs:[{q:'What is the federal estate-tax exclusion for 2026?',a:'The IRS lists a $15,000,000 basic exclusion amount for decedents dying in 2026, subject to the full federal estate-tax rules.'},{q:'What is the annual gift-tax exclusion for 2026?',a:'The IRS lists $19,000 per recipient for 2026.'},{q:'Does a gift over $19,000 automatically create gift tax due?',a:'Not necessarily. Reporting requirements, lifetime exclusion usage and other rules may apply. Consult a qualified tax professional for a specific gift.'}],
sources:[{label:'IRS — Estate Tax',url:IRS_ESTATE},{label:'IRS — Frequently Asked Questions on Estate Taxes',url:IRS_ESTATE_FAQ},{label:'IRS — Frequently Asked Questions on Gift Taxes',url:IRS_GIFT_FAQ}]
},
{
slug:'prepare-for-estate-planning-attorney-consultation',
title:'How to Prepare for an Estate Planning Attorney Consultation',
description:'Know what to think about before an estate-planning consultation, which questions to write down, what information may be useful and what not to send through a public intake form.',
excerpt:'A productive consultation starts with goals and a high-level picture of your family and assets. The lawyer can tell you what detailed documents are actually needed.',
category:'Getting Started',
keywords:['estate planning attorney consultation','questions for estate planning attorney','prepare for estate planning meeting','estate lawyer consultation'],
updated:'2026-09-07',
sections:[
{heading:'Think about goals before documents',bullets:['Who should receive property?','Who should make financial decisions if you cannot?','Who should make health-care decisions?','Who should care for minor children?','Should any beneficiary receive property over time rather than all at once?','Do you want to reduce probate or simplify administration?','Do you own a business or property in multiple states?']},
{heading:'Prepare a high-level family and asset overview',paragraphs:['Write down the names and relationships of close family members and dependents. Make a category-level list of assets and debts. For the first conversation, you usually do not need to put confidential account numbers or passwords into an appointment-setting form.']},
{heading:'Find existing documents',paragraphs:['If you already have a will, trust, power of attorney, advance directive, marital agreement or business succession document, note that it exists. Once the attorney is engaged, the law office can explain whether they want a copy and how to transmit it securely.']},
{heading:'Questions to ask the attorney',bullets:['Which documents fit my goals and why?','How does my state’s law affect the plan?','Which assets need beneficiary changes or retitling?','If a trust is recommended, what exactly must be funded into it?','How should I choose executor, trustee and agents?','How often should I review the plan?','What are the legal fee, implementation steps and expected timeline?']},
{heading:'What Skylight does and does not collect',paragraphs:['Skylight Reflections Marketing asks preliminary qualifying questions and coordinates the appointment. Skylight does not collect your legal documents, Social Security number, bank account numbers, tax returns, medical records, passwords or confidential financial files for the attorney. Bring or send detailed materials directly to the law office only when requested.']}
],
faqs:[{q:'Do I need to send documents before the appointment is booked?',a:'Not to Skylight. The law office can tell you directly what documents, if any, it wants for the legal consultation.'},{q:'What should I know before calling an estate-planning attorney?',a:'A high-level understanding of your family, assets, existing documents and goals is usually enough to start a productive conversation.'}],
sources:[{label:'National Institute on Aging — Getting Your Affairs in Order',url:NIA_AFFAIRS}]
},
{
slug:'common-estate-planning-mistakes',
title:'12 Common Estate Planning Mistakes to Avoid',
description:'Learn common estate-planning mistakes involving outdated beneficiaries, unfunded trusts, missing incapacity documents, poor fiduciary choices and failure to review a plan.',
excerpt:'Many estate-plan problems come from coordination and maintenance, not from the absence of a complicated document. Use this list as a review checklist.',
category:'Estate Planning Basics',
keywords:['estate planning mistakes','common will mistakes','trust mistakes','estate planning errors','beneficiary mistakes'],
updated:'2026-09-07',
sections:[
{heading:'Common problems to watch for',bullets:['Assuming a will controls every asset.','Creating a trust but never funding it.','Forgetting to update beneficiary designations after major life changes.','Naming only one executor, trustee or agent with no backup.','Choosing a fiduciary based only on family position rather than trustworthiness and ability.','Ignoring financial and health-care incapacity planning.','Failing to plan for minor children or beneficiaries who need management help.','Not coordinating a business interest with operating or buy-sell agreements.','Keeping documents where no one can find them.','Putting passwords or secret crypto keys into documents that may become public.','Assuming federal estate tax is the only tax issue that matters.','Never reviewing the plan after signing it.']},
{heading:'The coordination problem',paragraphs:['Estate planning often fails at the seams between documents: the will says one thing, the beneficiary designation says another, the trust owns nothing, or a business agreement restricts the transfer someone expected. A periodic coordination review can be as important as the original drafting.']},
{heading:'Do not “fix” legal documents yourself without understanding the effect',paragraphs:['Handwritten changes, online forms, beneficiary edits and asset retitling can have consequences that vary by state and asset type. If the plan no longer matches your goals, take the old documents and the new goals to an attorney instead of assuming a small edit is harmless.']}
],
faqs:[{q:'What is the most common trust mistake?',a:'A frequent practical problem is failing to transfer intended assets into the trust or failing to coordinate beneficiary designations with the trust plan.'},{q:'Can an old beneficiary designation override a newer will?',a:'Beneficiary-designated assets often pass under the designation rather than the will, so they must be reviewed as part of the full plan.'}],
sources:[{label:'National Institute on Aging — Getting Your Affairs in Order',url:NIA_AFFAIRS},{label:'Consumer Financial Protection Bureau — Power of Attorney',url:CFPB_POA}]
},
{
slug:'asset-protection-estate-planning-basics',
title:'Asset Protection and Estate Planning: What the Term Really Means',
description:'Understand how asset-protection questions intersect with estate planning, trusts, insurance, business entities and creditor rules without assuming every trust provides protection.',
excerpt:'“Asset protection” can mean very different things. A revocable living trust is not automatically a creditor shield, and planning should begin with the risk you are actually trying to address.',
category:'Advanced Planning',
keywords:['asset protection estate planning','asset protection trust','trust creditor protection','estate planning asset protection','protect assets estate plan'],
updated:'2026-09-07',
sections:[
{heading:'Start by defining the risk',paragraphs:['Asset protection may refer to protecting property from future creditors, lawsuits, business risks, poor beneficiary money management, divorce exposure, long-term-care costs or estate administration problems. Those are different legal problems and may require different strategies.']},
{heading:'A revocable trust is not a universal asset-protection tool',paragraphs:['A standard revocable living trust generally leaves the person who created it with substantial control over the assets. That control is one reason the trust should not be assumed to shield the creator’s assets from personal creditors. More specialized strategies can involve irrevocable trusts, business entities, insurance and state-law exemptions, but they also involve tradeoffs and restrictions.']},
{heading:'Planning for beneficiaries is different from protecting your own assets',paragraphs:['A trust can sometimes be designed so a beneficiary receives assets under continuing trust terms rather than outright. That may provide management, spendthrift or other protections depending on the trust and state law. This is different from protecting assets from the creator’s own creditors.']},
{heading:'Timing and existing claims matter',paragraphs:['Transfers made after a claim arises, or with improper intent, can create fraudulent-transfer and other legal problems. Asset-protection planning should be done prospectively with qualified legal and tax advice, not as an emergency attempt to hide property.']}
],
faqs:[{q:'Does a revocable living trust protect my assets from lawsuits?',a:'Do not assume it does. Revocable trusts generally leave substantial control with the creator and are not a universal creditor-protection device.'},{q:'Is asset protection the same as avoiding estate tax?',a:'No. Creditor protection, transfer taxes, probate planning and beneficiary management are separate planning issues even though one plan may address several of them.'}],
sources:[{label:'IRS — Estate and Gift Taxes',url:'https://www.irs.gov/businesses/small-businesses-self-employed/estate-and-gift-taxes'}]
}
]

export function getEstateGuide(slug:string){return estateGuides.find(g=>g.slug===slug)||null}
export const estateGuideCategories=[...new Set(estateGuides.map(g=>g.category))]
