# RO Engine — Market Analysis
## Automotive Shop Management Software (SMS) Market
*Internal Strategy Document — AutoHouse Automotive*
*Last updated: February 2026*

---

## 1. US Market Size

### Total Addressable Market (TAM)

The US independent automotive repair market spans approximately **165,000 to 302,000 shops**, depending on the source and inclusion criteria:

| Source / Methodology | Estimate |
|---|---|
| IBISWorld (auto repair & maintenance establishments) | ~280,000–302,000 |
| US Census (NAICS 811111 + 811112 + 811118) | ~165,000–230,000 |
| AAIA / Auto Care Association estimates | ~250,000+ |

The variance comes from how you count: strictly independent general repair shops vs. including quick-lube, transmission specialists, tire shops, and fleet maintenance operations.

**Our serviceable market** is the subset of independent general repair and maintenance shops with 2–20 bays that are either:
- Currently using legacy on-premises SMS software (ShopWare, Mitchell 1 Manager SE, R.O. Writer)
- Using cloud-first competitors but unhappy with pricing or feature gaps
- Using no SMS at all (paper/spreadsheet shops — estimated 10–15% of the market)

Conservative SAM estimate: **80,000–120,000 shops**.

### Market Growth Drivers

- Average shop count growing ~1.5–2% annually (new vehicle complexity pushing more work to specialists)
- Fleet age increasing (average vehicle age 12.6 years in 2025) — more repair demand per vehicle
- Cloud migration accelerating — pandemic forced many holdouts to consider remote-accessible systems
- OEM repair procedure complexity driving demand for integrated information systems
- EV transition creating a bifurcation: shops that invest in tooling/training vs. those that don't

---

## 2. Legacy System Persistence

### The 33% On-Premises Problem

Approximately **33% of SMS installations remain on-premises** or locally-hosted, based on industry surveys and vendor disclosures:

| Segment | Estimated % |
|---|---|
| Fully cloud-native SMS | ~40% |
| Cloud-migrated (vendor moved existing product) | ~15% |
| On-premises / local server | ~25–33% |
| No SMS (paper, spreadsheet, generic tools) | ~10–15% |

**Why they stay on-premises:**
- "It works, don't touch it" inertia — shops with 10+ years of data in ShopWare or Mitchell 1
- Internet reliability concerns in rural areas
- Perceived data ownership/control
- Recurring subscription fatigue — they paid $3,000 once for R.O. Writer in 2014 and see no reason to pay $300/month
- Migration fear — "What happens to my 15 years of customer history?"

**Why this is our opportunity:**
- On-prem systems are reaching end-of-life (Windows 7/10 support, hardware failures)
- Vendor support for legacy products is declining or ending
- These shops have the richest historical data — exactly what our AI scheduling intelligence needs
- ShopWare specifically is losing market share and support resources
- A clean migration path with historical data import is a genuine competitive advantage

---

## 3. Competitor Landscape

### Tier 1: Established Cloud Players

| Competitor | Est. Shop Count | Pricing | Strengths | Weaknesses |
|---|---|---|---|---|
| **Tekmetric** | ~13,000 shops | $299–$449/mo | Clean UI, good DVI, strong marketing | No AI scheduling, limited parts integration depth, VC-funded growth-at-all-costs |
| **Shop-Ware** (not ShopWare) | ~4,000–6,000 | $250–$500/mo | Workflow-focused, good technician view | Confusing name collision with legacy ShopWare, slower iteration |
| **Shopmonkey** | ~5,000–8,000 | $249–$499/mo | Modern UI, good onboarding, tire/quick-lube focus | Less depth for complex repair shops, VC pressure |

### Tier 2: Legacy Giants (Cloud Migration In Progress)

| Competitor | Est. Shop Count | Pricing | Strengths | Weaknesses |
|---|---|---|---|---|
| **Mitchell 1 (Manager SE / ProDemand)** | ~40,000+ | $250–$600/mo | Repair information integration, brand trust, huge install base | Aging UI, slow cloud migration, complex pricing, owned by Snap-on |
| **ALLDATA Manage Online** | ~15,000–20,000 | $199–$399/mo | OEM repair data, AutoZone parent company | UI feels like 2015, limited workflow automation |
| **R.O. Writer** | ~8,000–12,000 | One-time + support | Loyal user base, good accounting integration | On-prem only, aging, limited development |

### Tier 3: Niche / Emerging

| Competitor | Notes |
|---|---|
| **AutoLeap** | VC-funded, aggressive pricing, targeting Tekmetric's market |
| **Steer (CRM layer)** | Not full SMS, but competing for the customer communication layer |
| **Bolt On Technology** | DVI-focused add-on, partners with legacy SMS systems |
| **Torque360** | Newer entrant, AI claims but unclear depth |

### Key Observations

1. **No one has real AI scheduling.** Every competitor that mentions "AI" means either automated appointment reminders or basic predictive text. Nobody is doing what we're building — encoding a service advisor's scheduling instinct with historical pattern recognition.

2. **Parts integration is shallow everywhere.** Most competitors have a PartsTech iframe or basic catalog lookup. Direct API integration with Worldpac speedDIAL, direct vendor API connections — this is differentiated.

3. **The market is fragmented.** Even the largest player (Mitchell 1) has less than 15% market share. There is no dominant winner. The market is waiting for a product that is genuinely better, not just differently-skinned.

4. **VC-funded competitors have a timer.** Tekmetric, Shopmonkey, and AutoLeap all took significant venture capital. They need to show returns. This means they'll either get acquired, raise prices, or cut features. We're bootstrapped — we can be patient and build right.

---

## 4. AI Adoption Data & Efficiency Gains

### Current AI Usage in Automotive Repair

Based on industry surveys (2024–2025):
- **12–18%** of shops report using any AI-assisted tool in their workflow
- **35–40%** express interest in AI for scheduling, customer communication, or diagnostics
- **< 5%** use AI for anything beyond basic chatbots or marketing copy

### Documented Efficiency Gains from AI Integration

| Application | Measured Improvement | Source / Context |
|---|---|---|
| Digital vehicle inspection (DVI) with AI recommendations | 15–25% increase in average repair order (ARO) | Bolt On Technology case studies |
| Automated appointment reminders | 20–30% reduction in no-shows | Steer CRM data |
| AI-assisted estimate generation | 40–60% reduction in estimate creation time | Internal testing (RO Engine) |
| Predictive maintenance scheduling | 10–15% improvement in technician utilization | Projected (no production data yet in market) |
| AI phone screening (missed call handling) | 85–95% of after-hours calls captured vs. lost | Retell AI / similar platforms |

### The Scheduling Intelligence Opportunity

**This is the gap nobody has filled.**

Current scheduling tools in SMS platforms are glorified calendars. They show you what's booked. They don't tell you:
- "This week's mix looks like your three worst weeks from last year"
- "Customer X has cancelled 4 of their last 6 appointments — overbook that slot"
- "You have two transmission jobs on Tuesday — historical data shows that combination runs 2 hours over every time"

The shop that can predict its week before it happens doesn't just save time — it prevents the cascade failure that destroys ARO:
**Overbooking -> rushing -> mistakes -> comebacks -> lost revenue -> lost customers**

Our competitive advantage: we have AutoHouse's 10+ years of ShopWare historical data to train against. New competitors can't touch this without a similar dataset.

---

## 5. Penetration Modeling

### 5-Year Target: 12,000–15,000 Shops

| Year | Target Shops | Revenue (avg $400/mo) | Notes |
|---|---|---|---|
| Year 1 | 100–250 | $480K–$1.2M ARR | Founders cohort + early adopters. Focus on Arkansas/Oklahoma/Missouri. |
| Year 2 | 500–1,500 | $2.4M–$7.2M ARR | Regional expansion. AI scheduling in beta. Word-of-mouth from founders cohort. |
| Year 3 | 2,000–5,000 | $9.6M–$24M ARR | National presence. AI scheduling GA. Parts integration depth as differentiator. |
| Year 4 | 6,000–10,000 | $28.8M–$48M ARR | Multi-location support. Fleet management features. Enterprise tier. |
| Year 5 | 12,000–15,000 | $57.6M–$72M ARR | Market leader in AI-native SMS. Potential acquisition interest or Series A. |

### Assumptions

- Average revenue per shop: $350–$450/month (blended across tiers)
- Monthly churn: 2–3% in Year 1, declining to 1–1.5% by Year 3 (industry average is 3–5%)
- No paid acquisition in Year 1 — word-of-mouth, trade shows, content marketing only
- Year 2+: modest paid acquisition budget ($50–100 CAC target via Google Ads, YouTube, trade publications)
- Viral coefficient from AI scheduling: shops that see the "morning dashboard" demo convert at 2–3x the rate of standard SMS demos

### Key Growth Levers

1. **ShopWare migration path** — purpose-built import tool gives us a wedge into the legacy installed base
2. **AI scheduling demo** — "Here's what your worst week looks like before it happens" is a closer, not a feature
3. **Founders cohort testimonials** — 100 shops in Year 1 who can speak to the experience
4. **Parts integration depth** — Worldpac speedDIAL, direct vendor APIs, not just a PartsTech iframe
5. **Technician-first mobile experience** — techs who love the tool become internal advocates when they move to new shops

---

## 6. Pricing Benchmarks & Recommendations

### Competitor Pricing Matrix

| Competitor | Entry Tier | Mid Tier | Top Tier | Per-User Fees? |
|---|---|---|---|---|
| Tekmetric | $299/mo | $359/mo | $449/mo | No |
| Shopmonkey | $249/mo | $399/mo | $499/mo | No |
| AutoLeap | $279/mo | $399/mo | Custom | No |
| Mitchell 1 | ~$250/mo | ~$400/mo | ~$600/mo | Yes (ProDemand) |
| Shop-Ware | ~$250/mo | ~$350/mo | ~$500/mo | No |

### RO Engine Recommended Pricing

| Tier | Price | Target |
|---|---|---|
| **Starter** | $279/mo | 2–4 bay shops, basic workflow + DVI |
| **Growth** | $449/mo | 4–8 bay shops, AI recommendations + scheduling |
| **Pro** | $799/mo | 8+ bay, multi-location, full AI suite + API access |

**Rationale:**
- Entry price ($279) undercuts Tekmetric and Shopmonkey at the bottom — removes price as an objection
- Growth tier ($449) is where the AI scheduling intelligence lives — this is the upsell target and the tier most shops will land on
- Pro tier ($799) positions us as premium for serious multi-bay operations — the shops that currently pay $500+ for Mitchell 1

**Annual discount:** 15% off for annual prepay (standard in SaaS)
**Founders cohort:** 25% off for life (see Go-to-Market document)

---

*This document is a living analysis. Update quarterly with new market data, competitor movements, and actual performance against penetration targets.*
