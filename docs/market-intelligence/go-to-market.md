# RO Engine — Go-to-Market Strategy
## From AutoHouse to SaaS Platform
*Internal Strategy Document — AutoHouse Automotive*
*Last updated: February 2026*

---

## 1. Ideal Customer Profile (ICP)

### Primary ICP: The 4–12 Bay Independent Shop

| Attribute | Specification |
|---|---|
| **Bay count** | 4–12 bays |
| **Annual revenue** | $800K–$3M |
| **Staff** | 1–2 service advisors, 3–8 technicians, 1 owner |
| **Current SMS** | Legacy on-prem (ShopWare, R.O. Writer, Mitchell 1 Manager SE) OR cloud competitor they've outgrown |
| **Geography (Year 1)** | Arkansas, Oklahoma, Missouri, Texas, Kansas — expand from there |
| **Decision maker** | Owner or lead service advisor |
| **Pain signal** | "My scheduler is a whiteboard and my advisor's memory" |

### Why This ICP?

**4–12 bays is the sweet spot because:**
- Too complex for spreadsheets — they genuinely need workflow management
- Small enough that one champion (owner or lead SA) can drive adoption
- Large enough to generate meaningful revenue per account ($400–$800/mo)
- This is where scheduling intelligence delivers the highest ROI — the SA is managing enough volume that pattern recognition matters, but not so much that they've already hired a dedicated scheduler
- These shops feel the pain of legacy systems most acutely — they've outgrown their tool but can't justify a $50K enterprise system

**Who is NOT our ICP (yet):**
- 1–2 bay shops: price-sensitive, may not need AI scheduling, high churn risk
- 20+ bay / multi-location chains: need enterprise features we haven't built yet (Year 3–4 target)
- Quick-lube / tire-only: different workflow model, lower ARO, Shopmonkey owns this segment
- Dealership service departments: different buying process, CDK/Reynolds & Reynolds lock-in

### Secondary ICP: ShopWare Refugees

Any shop currently running ShopWare (the legacy on-prem product, not Shop-Ware the cloud product) is a high-priority target regardless of bay count. These shops:
- Are running end-of-life software
- Have years of historical data we can import
- Are actively looking for a replacement (ShopWare support is declining)
- AutoHouse's own migration story is the perfect case study

---

## 2. Product Ladder: Attach, Land, Expand

### The Strategy

Don't sell the full platform day one. **Attach** with a low-friction wedge, **Land** the core platform, **Expand** with AI features that prove their value over time.

### Phase 1: Attach (Free / Low-Cost Entry Points)

**Goal:** Get RO Engine into the shop's daily workflow before they commit to a platform switch.

| Wedge Product | Cost | Hook |
|---|---|---|
| **AI Phone Screening** (Retell) | Free trial / $49/mo add-on | "Never miss another after-hours call." Every shop loses 10–20 calls/week after hours. This is a pain point they feel in lost revenue immediately. |
| **Digital Vehicle Inspection** (standalone) | Free with branding | Give away a mobile DVI tool. Techs use it, customers see the branded reports, shop gets hooked on the workflow. |
| **ShopWare Migration Assessment** | Free | "We'll audit your ShopWare data and show you exactly what a migration looks like." No commitment, just information. Plants the seed. |

**Why attach first:**
- Platform switches are scary — shops have years of data and muscle memory
- Attaching a single tool lets them experience RO Engine quality without the commitment
- The phone screening wedge is especially powerful because it generates revenue (captured calls = booked appointments) from day one
- Once a tool is embedded in daily workflow, the switching cost works in OUR favor

### Phase 2: Land (Core Platform Adoption)

**Trigger:** The attach tool has been in use for 30–60 days. The shop trusts us. Now we offer the full migration.

| What We Offer | What They Get |
|---|---|
| Full data migration from legacy SMS | Continuity — their customer history, vehicle records, and RO history come with them |
| 30-day parallel run | Safety net — run both systems simultaneously, verify nothing is lost |
| On-site (or video call) training | 2–3 hour session with the SA and techs. Not a webinar. Personalized. |
| Dedicated onboarding contact | Not a ticket queue. A person who knows their shop by name for 90 days. |

**Pricing at Land:**
- Starter ($279/mo) or Growth ($449/mo) depending on bay count and features needed
- First month free if they came through an attach product
- Annual prepay discount: 15% off

### Phase 3: Expand (AI Features Unlock Revenue)

**Timeline:** 60–180 days after landing the core platform.

Once we have 60+ days of their data in the system, the AI features start generating value:

| Feature | Revenue Impact | Trigger |
|---|---|---|
| **AI Scheduling Intelligence** | "Your Tuesday looks like your worst weeks. Cap at 4 jobs." | 90 days of RO data accumulated |
| **Predictive Maintenance Outreach** | "These 47 customers are due for timing belts this quarter." | Customer + vehicle history imported |
| **Technician Utilization Dashboard** | "Tech A is at 72% utilization. Tech B is at 91% and burning out." | 60 days of time tracking data |
| **ARO Optimization Recommendations** | "Your best revenue weeks have this job mix pattern." | 6 months of RO data |

**This is where the Growth ($449) and Pro ($799) tiers earn their price.** The AI features don't just cost more — they provably generate more revenue than they cost. That's the expansion conversation: "The AI scheduling feature costs you an extra $170/month, but it prevented two overbooking weeks last month that would have cost you $3,000 in comebacks."

---

## 3. Pricing Tiers

### Tier Structure

| | Starter | Growth | Pro |
|---|---|---|---|
| **Price** | **$279/mo** | **$449/mo** | **$799/mo** |
| **Annual** | $237/mo (billed annually) | $382/mo (billed annually) | $679/mo (billed annually) |
| **Target** | 2–4 bay shops | 4–8 bay shops | 8+ bay / multi-location |
| **Users** | Up to 5 | Up to 15 | Unlimited |
| **ROs/month** | Unlimited | Unlimited | Unlimited |
| Core SMS (ROs, invoices, payments) | Yes | Yes | Yes |
| Digital Vehicle Inspection | Yes | Yes | Yes |
| Customer Portal (estimates, approvals) | Yes | Yes | Yes |
| SMS/Email Communication | Yes | Yes | Yes |
| Parts Integration (PartsTech) | Basic | Full | Full |
| Parts Integration (Worldpac Direct) | — | Yes | Yes |
| AI Maintenance Recommendations | — | Yes | Yes |
| AI Scheduling Intelligence | — | Yes | Yes |
| AI Phone Screening (Retell) | Add-on ($49) | Included | Included |
| Technician Utilization Analytics | — | — | Yes |
| ARO Optimization Dashboard | — | — | Yes |
| Multi-Location Support | — | — | Yes |
| API Access | — | — | Yes |
| Dedicated Account Manager | — | — | Yes |
| Custom Integrations | — | — | Yes |

### Pricing Rationale

- **$279 Starter** undercuts Tekmetric ($299) and Shopmonkey ($249 but with fewer features) — eliminates price as a switching objection
- **$449 Growth** is the target tier — AI scheduling intelligence is the feature that sells itself, and at $449 it's priced below Tekmetric's top tier while including more
- **$799 Pro** captures the high end that currently pays $500–$600+ for Mitchell 1 with add-ons — these shops need multi-location and analytics
- **Never charge per-RO or per-transaction** — shops hate metered pricing, and it creates a perverse incentive to not use the system
- **Never charge per-user** — we want every tech and SA using the system, not sharing logins to save money

---

## 4. Founders Cohort

### Structure

| Parameter | Value |
|---|---|
| **Cohort size** | 100 locations maximum |
| **Discount** | 25% off list price, locked for life |
| **Effective pricing** | Starter: $209/mo, Growth: $337/mo, Pro: $599/mo |
| **Commitment** | 12-month minimum |
| **What founders get** | Lifetime pricing lock, direct Slack channel with dev team, quarterly roadmap input session, "Founding Partner" badge in-app, priority support |
| **What we get** | 100 shops generating real-world data, testimonials, case studies, bug reports, feature validation, and ARR foundation |

### Founders Cohort Criteria

Not every shop gets in. This is selective:

1. **Must be ICP-aligned** — 4–12 bays, independent, serious about their business
2. **Must commit to feedback** — monthly 15-minute check-in call for the first 6 months
3. **Must allow case study use** — we can reference their shop name and results in marketing (with approval on specifics)
4. **Must be willing to run the full platform** — no cherry-picking features. We need complete usage data.

### Why 25% and Not More?

- 25% is meaningful enough to feel like a real deal (saves $840–$2,400/year depending on tier)
- But not so deep that it devalues the product or creates a "I'll just wait for the next discount" mentality
- "For life" is the hook — these shops will never pay more, even when the product is 10x what it is today
- At 100 shops on Growth tier (most likely landing spot), founders cohort generates ~$400K ARR — enough to fund continued development without external capital

### Cohort Sequencing

| Phase | Shops | Source |
|---|---|---|
| **Alpha (shops 1–10)** | Shops we know personally — Bailey's network, local NWA shops, ATRA connections | Direct outreach, in-person demos |
| **Beta (shops 11–50)** | Regional expansion — AR/OK/MO/TX shops found through trade shows, Facebook groups, word-of-mouth | Referrals from Alpha + targeted outreach |
| **General Founders (shops 51–100)** | National, inbound — shops that find us through content, YouTube, or trade publication coverage | Application-based (they apply, we select) |

---

## 5. Technician Utilization ROI Formula

### The Core Calculation

This is the formula that closes deals. Every service advisor and shop owner understands it intuitively, but seeing the math makes it real.

```
Annual Revenue Impact =
  (Techs x Billable Hours/Day x Days/Year x Labor Rate)
  x Utilization Improvement %
```

### Worked Example: Typical 6-Bay Shop

| Input | Value |
|---|---|
| Technicians | 4 |
| Billable hours per tech per day (current) | 5.5 of 8 available (68.75% utilization) |
| Working days per year | 250 |
| Effective labor rate | $160/hr |

**Current annual labor revenue:**
```
4 techs x 5.5 hrs/day x 250 days x $160/hr = $880,000
```

**With 10% utilization improvement (68.75% -> 78.75%):**
```
4 techs x 6.3 hrs/day x 250 days x $160/hr = $1,008,000
```

**Annual revenue gain: $128,000**

**Cost of RO Engine Growth tier: $5,388/year**

**ROI: 23.7x**

### Why This Formula Works in Sales Conversations

1. **Every shop knows their utilization is below 100%.** The national average is 65–75%. Nobody argues with this.
2. **The improvement we claim is modest.** 10% utilization gain is conservative. AI scheduling preventing even one overbooking disaster per month delivers more than this.
3. **The labor rate is THEIR number.** We're not making up revenue — we're using their posted rate.
4. **The ROI is absurd.** 23x return makes the $449/month feel like nothing. This isn't a cost — it's an investment that pays for itself in the first two weeks of each month.
5. **It scales with shop size.** More techs = more impact. The Pro tier at $799/month for an 8-tech shop is an even more dramatic ROI.

### The One-Liner

> "If our AI scheduling prevents one bad week per month — just one week where you would have overbooked and created comebacks — it pays for itself 20 times over."

---

## 6. Wedge Sequencing Strategy

### The Principle

Don't lead with the platform. Lead with the pain point. Each wedge addresses a specific, urgent problem that the shop feels today. The platform is what they discover after the wedge is embedded.

### Wedge Sequence (Priority Order)

#### Wedge 1: AI Phone Screening (Highest Priority)

**The pain:** Shops miss 10–20 calls per week outside business hours. Each missed call is a potential $500–$2,000 RO that goes to a competitor.

**The wedge:** Retell AI answers the phone 24/7. Takes messages, provides business hours, captures caller intent. Costs $49/month or free with Growth tier.

**Why it's Wedge 1:**
- Immediate, measurable ROI (captured calls -> booked appointments -> revenue)
- Zero workflow disruption — it just answers the phone when nobody else can
- Shop owner sees RO Engine's name and quality every morning when they review overnight calls
- Natural upsell: "You're capturing calls, but are you scheduling them optimally?"

#### Wedge 2: Digital Vehicle Inspection (DVI)

**The pain:** Paper inspections get lost, customers don't trust verbal explanations, and there's no documentation trail for declined services.

**The wedge:** Free mobile DVI tool with RO Engine branding. Techs take photos, rate items green/yellow/red, customers get a professional digital report.

**Why it's Wedge 2:**
- Techs interact with it daily — it becomes muscle memory
- Customer-facing reports build trust and increase approval rates
- Creates a data trail of declined services — feeds the "predictive maintenance outreach" AI feature later
- Once techs love the DVI tool, the advisor asks "What else does RO Engine do?"

#### Wedge 3: ShopWare Migration Assessment

**The pain:** ShopWare is dying. Shops know it. They're afraid to move because they don't know what migration looks like.

**The wedge:** Free assessment — we analyze their ShopWare data export and produce a report: "Here are your 3,847 customers, 12,409 vehicles, and 28,000 ROs. Here's exactly how they map into RO Engine. Here's what the first week looks like."

**Why it's Wedge 3:**
- Specific to the ShopWare refugee secondary ICP
- Eliminates the #1 switching objection (fear of data loss)
- Demonstrates competence and builds trust before any money changes hands
- AutoHouse's own migration is the case study: "We did this ourselves. Here's the before and after."

#### Wedge 4: Customer Communication Hub

**The pain:** Shops communicate with customers via personal cell phones, have no audit trail, and miss follow-ups.

**The wedge:** Unified SMS + email communication from a single dashboard, with templates and consent management already built.

**Why it's Wedge 4:**
- Addresses the growing compliance concern (TCPA consent for SMS)
- Provides an immediate "wow" moment when the advisor sends a professional estimate via text instead of calling
- Communication data feeds the AI features later (customer response patterns, preferred contact methods)

### Wedge-to-Platform Conversion Timeline

```
Week 0:   Wedge installed (phone screening, DVI, etc.)
Week 2:   First value demonstration (captured calls report, DVI adoption metrics)
Week 4:   "What else can RO Engine do?" conversation
Week 6:   Platform demo — focused on their specific pain points
Week 8:   Migration plan presented (if coming from legacy system)
Week 10:  Contract signed, onboarding begins
Week 12:  Live on full platform
Week 24:  AI features generating measurable results — expansion conversation
```

**Target conversion rate:** 30–40% of wedge users convert to full platform within 90 days. This is achievable because:
- The wedge pre-qualifies them (they have the pain, they trust the product)
- The wedge creates switching costs (data is already in RO Engine)
- The platform demo is personalized to their shop's actual data and workflow

---

*This document is a living strategy. Revisit quarterly. Update with actual conversion data, wedge performance metrics, and cohort feedback as we execute.*
