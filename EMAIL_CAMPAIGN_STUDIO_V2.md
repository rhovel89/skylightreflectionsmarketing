# Email Campaign Studio V2 — Implementation Handoff

Project: Central Illinois Local Pros  
Owner brand: Skylight Reflections Marketing  
Admin route family: `/admin/email-drips`  
Tenant: `central-illinois-local-pros`

## 1. Purpose

Email Campaign Studio V2 is the private admin system for business-owner lifecycle messaging, promotional nurture, campaign QA, engagement tracking and conversion attribution.

The system deliberately separates three concepts:

1. **Transactional lifecycle email** — required account/business workflow messages such as profile approval and ownership approval. These do not require promotional opt-in.
2. **Promotional drip campaign** — optional education, Sponsored-placement and Skylight-growth nurture. These require the business submission to have opted in to marketing.
3. **Master template** — reusable source copy. Promotional templates create an independent Draft campaign snapshot. Transactional templates replace future matching transactional outbox inserts by `template_key`.

A master-template edit never rewrites a previously created promotional campaign and never rewrites a queued or sent email.

## 2. Trust and messaging invariants

These rules are product requirements, not merely copy preferences.

- Draft campaigns never send.
- Approval and Go Live are separate actions.
- Editing an Approved or Paused campaign returns it to Draft and clears prior approval.
- A Live campaign must be paused before core copy or sequence changes.
- Promotional enrollment requires `business_submissions.marketing_opt_in = true`.
- Sponsored/Featured placement must remain clearly separate from organic rank and verification.
- Paid placement does not make a listing Verified.
- Claiming a business does not make it Verified.
- Verification remains source-backed and staff-controlled.
- Skylight Reflections Marketing copy must not guarantee Google rankings, traffic or leads.
- Test sends do not enroll a business, advance a sequence, or count toward production campaign analytics.
- Open tracking is directional only; click and conversion events are stronger engagement signals.

## 3. Admin information architecture

The email tool is located under Admin → Growth & Sales → Email Drip Campaigns.

Routes:

| Route | Purpose |
| --- | --- |
| `/admin/email-drips` | Campaign Studio: create/edit/approve/live/pause campaigns, targeting, scheduling, enrollments, queue activity and campaign metrics. |
| `/admin/email-drips/templates` | Master Template Library: edit lifecycle copy, edit promotional template copy and create Draft campaigns from promotional templates. |
| `/admin/email-drips/preview` | Visual Email Editor, desktop/mobile production preview and private test-send lab. |
| `/admin/email-drips/conversions` | Conversion attribution dashboard for campaign-generated inquiries. |
| `/email/open?token=<uuid>` | Public tracking-pixel endpoint for sent drip messages. |
| `/email/click?token=<uuid>` | Public tracked CTA redirect endpoint for sent drip messages. |
| `/email/unsubscribe?token=<uuid>` | Public promotional unsubscribe endpoint. |

All `/admin/email-drips*` pages are admin-protected through `requireAdmin`.

## 4. Core database model

### `email_drip_campaigns`

Campaign configuration and review state.

Important fields:

- `id`, `tenant_id`, `name`, `slug`
- `audience`
- `audience_rules jsonb`
- `trigger_event`
- `status`: `draft | approved | live | paused | archived`
- `purpose`
- `start_at`
- `send_timezone` (Central Illinois uses `America/Chicago`)
- `send_hour`
- `campaign_goal`
- `conversion_goal`
- `utm_source`, `utm_medium`, `utm_campaign`
- `source_template_id`
- `source_template_version_at`
- `created_by`, `approved_by`, `approved_at`

`source_template_id` records provenance only. A campaign is a snapshot; it does not inherit later template edits.

### `email_drip_steps`

Ordered campaign sequence.

- `campaign_id`
- `step_order`
- `delay_days`
- `subject`
- `preheader`
- `body`
- `cta_label`
- `cta_url`
- `is_active`

`delay_days` is measured from the campaign enrollment start baseline, not from the previous send.

### `email_drip_enrollments`

Per-business/per-recipient campaign state.

- `campaign_id`, `business_id`
- `recipient_email`, `recipient_name`
- `status`: `active | paused | completed | unsubscribed`
- `next_step_order`
- `next_send_at`
- `last_sent_at`
- `enrolled_at`
- `unsubscribe_token`
- source metadata for automatic/manual enrollment

### `email_outbox`

Immutable send snapshot and delivery/engagement record.

Important fields include:

- `message_type`: `transactional | drip`
- `template_key`
- `campaign_id`, `enrollment_id`, `step_id`
- snapshotted `subject`, `preheader`, `body`, CTA fields
- `status`: queued/sending/sent/failed/cancelled
- provider message ID and error state
- tracking token
- open count/timestamps
- click count/timestamps
- conversion count/timestamp

A queued email does not re-read its campaign/template body later.

### `email_engagement_events`

Append-only open/click event history tied to outbox/campaign/enrollment/step.

### `email_campaign_conversions`

Outcome attribution for actual marketing inquiries following tracked email clicks.

Current production attribution model:

- same normalized recipient email
- most recent tracked drip click
- click occurred before the inquiry
- click occurred within the previous 30 days

Current types:

- `sponsored_inquiry`
- `skylight_inquiry`
- `marketing_inquiry`

The conversion dashboard intentionally does not treat an open or click as a business result.

### `email_template_library`

Master reusable copy.

Fields:

- `slug`, `name`
- `delivery_class`: `transactional | promotional`
- `system_template_key` for lifecycle overrides
- default `audience`, `trigger_event`, `campaign_goal`, `conversion_goal`
- `audience_rules`
- `purpose`
- `compliance_note`
- default send hour and UTM values
- `steps jsonb`
- `can_create_campaign`
- `is_active`
- `sort_order`

RLS limits management to tenant staff/admin/super_admin roles.

## 5. Transactional template override design

`public.apply_transactional_email_template()` is a `BEFORE INSERT` trigger on `email_outbox`.

Behavior:

1. It only runs when `message_type = 'transactional'`.
2. It looks for an active `email_template_library` record whose `system_template_key` matches the outbox `template_key`.
3. It takes the first template step and replaces the hardcoded subject/body/CTA snapshot for that new outbox row.
4. Supported lifecycle tokens are:
   - `{{business_name}}`
   - `{{business_id}}`
   - `{{business_slug}}`
   - `{{recipient_name}}`
5. If no active matching master exists, the existing system-generated copy remains unchanged.

This provides central editability without altering business claim/verification RPC logic.

## 6. Seeded template catalog

### A. Claim Your Listing

Delivery class: Transactional  
System key: `business_submission_approved`  
Trigger: staff approves a submitted business profile  
Purpose: send the account holder into ownership evidence while explicitly preserving the claim/verification/publication separation.

Master subject:

`Your business profile is ready to claim`

CTA:

`Claim Your Business` → `/claim?business={{business_id}}`

### B. Finish Verification

Delivery class: Transactional  
System key: `business_claim_approved`  
Trigger: staff approves ownership evidence  
Purpose: explain that the listing is now Claimed but still needs the final source-backed directory verification gate when applicable.

Master subject:

`Ownership approved — finish verification for {{business_name}}`

CTA:

`Open Business Portal` → `/business-portal`

### C. Profile Optimization Before Paid Visibility

Delivery class: Promotional  
Audience: verified opt-in business owners  
Goal: education  
Sequence: Day 2 / Day 6 / Day 10

Topics:

1. Make the live profile easier to understand and choose.
2. Improve clarity, trust and the next action.
3. Strengthen the destination before buying additional visibility.

This campaign states that profile quality does not change organic ranking rules or guarantee leads.

### D. Sponsored Placement Education

Delivery class: Promotional  
Audience: verified opt-in business owners  
Goal: sponsored  
Conversion goal: `sponsored_inquiry`  
Sequence: Day 2 / Day 5 / Day 9 / Day 14

The copy explicitly states that Sponsored/Featured visibility is paid and labeled, does not change organic position, does not change verification and does not guarantee leads.

### E. Skylight Local Growth Nurture

Delivery class: Promotional  
Audience: verified opt-in business owners  
Goal: Skylight growth  
Conversion goal: `skylight_inquiry`  
Sequence: Day 3 / Day 7 / Day 12 / Day 18 / Day 25

Topics cover:

- local SEO foundations
- Google Business Profile quality
- website conversion
- lead-generation paths
- pre-traffic readiness
- optional Skylight Reflections Marketing visibility review

No ranking or lead guarantees are used.

## 7. Template-to-campaign installation flow

Action: `createCampaignFromTemplate`

Promotional templates only.

1. Require Admin.
2. Read one active tenant template.
3. Reject transactional/reference-only templates.
4. Validate there is at least one usable step.
5. Create `email_drip_campaigns` row with `status='draft'`.
6. Copy template targeting, schedule defaults, campaign/conversion goals and UTM defaults.
7. Save `source_template_id` and the master `updated_at` as `source_template_version_at`.
8. Copy all template steps into `email_drip_steps`.
9. Redirect to Campaign Studio.

No approval, enrollment or send occurs during installation.

## 8. Visual editor and test-send flow

`/admin/email-drips/preview` uses `renderBusinessEmailHtml`, the same HTML renderer used by actual sends.

Admin can:

- choose campaign and step
- edit the saved step while the campaign is not Live
- inspect desktop preview
- inspect mobile preview
- see subject/preheader/CTA state
- see provider/postal-address readiness
- send `[TEST]` email to the signed-in admin address

Test email behavior:

- no business enrollment
- no sequence advancement
- no production tracking token
- no production unsubscribe token
- no production analytics pollution

## 9. Targeting and enrollment

Supported Campaign Studio audience modes:

- all verified opted-in businesses
- home services
- restaurants
- retail/local stores
- online businesses
- storefront/both businesses
- specific category
- specific city/service area

Automatic enrollment requires all of the following:

- promoted business submission exists
- submission was approved
- marketing opt-in is true
- business is published
- business is Verified
- campaign-specific audience rule matches
- campaign trigger is automatic rather than manual

Manual enrollment remains available for eligible recipients and is separately tracked.

## 10. Campaign QA and status model

Lifecycle:

`Draft → Approved → Live → Paused`

Additional terminal state:

`Archived`

Rules:

- Draft/Paused may be approved.
- Approval requires at least one active email step.
- Only Approved may go Live.
- Only Live may be paused.
- Live must be paused before archive.
- Any content/settings change to Approved/Paused returns campaign to Draft and clears approval.

This prevents post-approval copy substitution.

## 11. Engagement and conversion tracking

Open endpoint records pixel loads by tracking token.

Click endpoint:

1. records click count and timestamps
2. appends engagement event
3. returns the snapshotted CTA destination
4. redirect route sends the recipient to the intended URL

UTM parameters are added at queue/render time using campaign defaults.

The Conversion Dashboard currently attributes actual `marketing_leads` inserts to the last tracked click from the same email within 30 days.

## 12. Delivery configuration

Provider integration: Resend REST API.

Required for any send:

- `RESEND_API_KEY`
- `BUSINESS_NOTIFICATION_FROM_EMAIL` or fallback `LEAD_NOTIFICATION_FROM_EMAIL`

Additionally required for promotional drip delivery:

- `MARKETING_EMAIL_POSTAL_ADDRESS`

When promotional compliance configuration is missing, promotional delivery stays blocked rather than sending an incomplete footer.

## 13. Scheduling

Campaign `start_at`, Central timezone and step delays are persisted and respected by the queue.

Manual admin action can process due emails immediately.

Unattended scheduling must only be wired through a protected production runner that has the appropriate server-side credential. Do not create an unauthenticated RLS bypass merely to trigger the queue.

## 14. Important implementation files

- `app/admin/email-drips/page.tsx`
- `app/admin/email-drips/actions.ts`
- `app/admin/email-drips/layout.tsx`
- `app/admin/email-drips/templates/page.tsx`
- `app/admin/email-drips/templates/actions.ts`
- `app/admin/email-drips/preview/page.tsx`
- `app/admin/email-drips/preview/actions.ts`
- `app/admin/email-drips/conversions/page.tsx`
- `app/admin/email-drips/conversions/actions.ts`
- `lib/business-email.ts`
- `lib/business-email-template.ts`
- `app/email/open/route.ts`
- `app/email/click/route.ts`
- `app/email/unsubscribe/*`

## 15. Migration lineage for V2

Key migrations:

- `20260905033532_expand_email_drip_campaign_operations.sql`
- `20260905034000_prevent_duplicate_drip_step_delivery.sql`
- `20260905041809_add_email_campaign_conversion_attribution.sql`
- `20260905043752_add_email_template_library_and_lifecycle_copy.sql`
- `20260905043836_link_campaigns_to_email_templates.sql`

## 16. Validation checklist

Before calling a release aligned:

1. GitHub branch HEAD identified.
2. TypeScript check passes.
3. Next.js production build passes.
4. Production server smoke test passes.
5. Supabase migrations are present in production and source.
6. Admin can load Template Library.
7. Promotional template creates a Draft campaign with copied steps.
8. Transactional template edit affects a new matching outbox insert but not an existing row.
9. Anonymous/public users cannot access admin template data.
10. Draft campaign cannot send.
11. Live campaign cannot be silently edited.
12. Promotional opt-out is respected.
13. Test send does not create production engagement records.
14. Tracking open/click endpoints reject invalid tokens safely.
15. GitHub HEAD, Vercel production Git SHA and canonical `/api/health` `deployment_commit` match before claiming exact production alignment.

## 17. Recommended future additions

These are not required for V2 correctness and should remain separate follow-up work:

- controlled A/B subject testing
- resend-to-non-openers with frequency caps
- template version history/rollback
- conversion attribution to completed Stripe purchases
- campaign revenue-value configuration
- protected unattended queue runner after production sender/cron credentials are confirmed
- provider webhook ingestion for delivery/bounce/complaint events

Do not implement any of these by weakening the current trust, opt-in, RLS or approval gates.
