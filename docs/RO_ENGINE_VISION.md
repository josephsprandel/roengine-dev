# RO Engine - Project Vision & Context

## Origin Story

**Founder:** Joe, owner of AutoHouse Automotive
- **Location:** Greenland, Arkansas (Washington County, Northwest Arkansas)
- **Shop:** 6-bay European vehicle repair shop specializing in Volvo
- **Team:** 3 technicians, 1 service advisor (Bailey)
- **Philosophy:** Voluntaryist/anarcho-capitalist - building solutions without relying on broken systems

**The Journey:**
- **2013:** Built custom PHP shop management system for AutoHouse
- **2023:** Used it successfully for 10 years, but PHP/legacy stack showing age
- **2024:** Recognized AI opportunity that incumbents are missing
- **2025:** Started building RO Engine as modern replacement
- **2026:** Testing in production at AutoHouse, preparing for SaaS launch

## The Problem We're Solving

### Industry Reality
- **Market:** 100,000+ independent repair shops in the US
- **Current Solutions:** 
  - ShopWare: $450/month, built for 2005, zero AI
  - Tekmetric: $199/month, dealer-focused, no AI recommendations
  - Mitchell1/AutoFluent: $200-500/month, legacy software
- **Market Gap:** ZERO shop management systems have AI service recommendations
- **Penetration:** 97% of shops use some SMS (PartsTech 2025 report)
- **Opportunity:** Everyone uses legacy software, ripe for disruption

### The Advisor Knowledge Problem
**Scenario: 2018 Volvo XC60, 75,000 miles comes in for oil change**

**Veteran Advisor (10 years experience):**
- Knows: Transmission fluid due at 60K (now 15K overdue)
- Knows: Brake fluid flush every 30K (due now at 75K)
- Knows: XC60s commonly need sway bar links at 70K
- Knows: Cabin air filter every 15K (customer deferred last time)
- **Recommends:** Oil change + transmission + brakes + sway bar inspection + cabin filter
- **Result:** $847 repair order

**New Advisor (3 months experience):**
- Customer asks for oil change
- Does oil change
- **Result:** $125 repair order
- **Missed revenue:** $722 (85% of potential)

**The Core Problem:**
- Training advisors takes years
- Knowledge is tribal (in veteran's head, not documented)
- High turnover = knowledge walks out the door
- Inconsistent recommendations = inconsistent revenue
- Customer doesn't know what they don't know

## Our Solution: AI Service Advisor

### Core Value Proposition
**"Turn new service advisors into veterans in days, not years"**

### How It Works
1. **AI knows manufacturer maintenance schedules** (Volvo, Subaru, Honda, Toyota, etc.)
2. **AI knows physics** (brake fluid absorbs moisture, transmission fluid breaks down)
3. **AI knows common failures** (XC60 sway bar links, S60 PCV systems)
4. **AI remembers deferred services** (customer said "not today" 6 months ago)
5. **AI explains WHY** (not just what, but why it matters - in customer language)

### The Impact
**PartsTech 2025 Industry Report - Proven Data:**
- Digital estimates increase ARO by 50%
- AutoHouse current ARO: ~$850
- Target with AI recommendations: ~$1,275
- Extra revenue: $425/RO × 120 ROs/month = **$51K/month** ($612K/year)

**For the industry:**
- New advisors productive from day one
- Consistent recommendations (every vehicle gets full review)
- Customer education (builds trust, increases approval rates)
- Reduced training costs (AI is the training)

## Business Model

### Pricing Strategy
- **RO Engine:** $99/month
- **Competitors:** $199-450/month
- **Savings:** 50-78% cheaper than incumbents
- **Differentiation:** Only system with AI service recommendations

### Target Market
**Phase 1:** Independent shops (1-3 locations)
- 6-12 bays per location
- European specialists (Volvo, BMW, Audi, Mercedes)
- Progressive owners who embrace technology
- Annual revenue: $500K-2M per location

**Phase 2:** Small chains (4-10 locations)
**Phase 3:** Franchise networks

### Go-to-Market
1. **Proof of Concept:** AutoHouse (current - testing in production)
2. **Beta Launch:** 10 shops in Northwest Arkansas (Q2 2026)
3. **Regional Expansion:** Arkansas → Missouri → Oklahoma (Q3-Q4 2026)
4. **National Launch:** 2027

### Unit Economics (at scale)
```
REVENUE:
100 shops × $99/mo = $9,900/month = $118,800/year
500 shops × $99/mo = $49,500/month = $594,000/year

COSTS (estimated):
Infrastructure: $500-1,000/month (hosting, databases, AI API calls)
Support: $2,000-4,000/month (1 support person per 100 shops)
Development: $8,000/month (Joe's time/salary)
Total costs at 500 shops: ~$12,500/month = $150,000/year

PROFIT:
500 shops: $594K revenue - $150K costs = $444K profit (75% margin)

EXIT VALUATION:
500 shops × $99/mo = $594K ARR
SaaS multiples: 5-10× ARR
Exit range: $3-6M
```

## Product Roadmap

### Week 1-2: Foundation (Current Status)
- ✅ Invoice system (close, reopen, payments, void, print)
- ✅ AI maintenance recommendations (35 Volvo services)
- ✅ Work order management
- ✅ Parts management with AI pricing
- ✅ Customer/vehicle management

### Week 3-4: AI Service Advisor Core
- Digital estimate workflow (SMS/email link)
- Maintenance schedule expansion (Subaru, Honda, Toyota)
- Customer explanation generator (Opus-powered)
- Service approval tracking & metrics
- Goal: Prove 50% ARO increase at AutoHouse

### Month 2-3: Multi-Tenant Prep
- Shop settings UI (tax rates, labor rates, branding)
- User roles & permissions (owner, manager, advisor, tech)
- Stripe Connect integration (billing)
- Subdomain routing (shopname.roengine.com)
- Beta shop onboarding flow

### Month 4-6: Beta Launch Features
- Service history integration (track what was actually done)
- Technician productivity tracking (flat-rate hours)
- Shop supplies auto-calculation (% of parts/labor)
- Analytics dashboard (ARO trends, approval rates, tech efficiency)
- Mobile optimization (advisors use on tablets)

### Month 6-12: Advanced AI Features
- AI diagnostic assistant (TSB search, common failures)
- Visual diagnostics (photo → diagnosis)
- Parts price optimization (hit 58% GP target)
- Predictive maintenance (AI predicts failures before they happen)
- Customer communication automation (service reminders, follow-ups)

## The 30+ AI Feature Ideas

### Tier 1: Service Advisor AI (Core Product)
1. **Maintenance Schedule Knowledge** - Every manufacturer's intervals
2. **Service Recommendation Engine** - What's due based on mileage/time
3. **Customer Explanation Generator** - Technical → clear language
4. **Deferred Service Tracking** - Remember what customer declined
5. **Urgency Calculation** - Overdue vs due soon vs coming up
6. **Cost Estimation** - Labor + parts pricing with markup
7. **Digital Estimate Generation** - Mobile-friendly approval workflow
8. **Approval Rate Tracking** - Which services convert, which don't
9. **Service Bundling** - "While we're in there" recommendations
10. **Customer Education** - Why it matters (physics, safety, cost avoidance)

### Tier 2: Parts & Pricing AI
11. **AI Parts Manager** - Gemini vision scraping of product labels
12. **Multi-Vendor Comparison** - PartsTech + inventory + alternatives
13. **Smart Part Numbering** - Auto-generate SKUs from photos
14. **Inventory Prediction** - What parts to stock based on vehicle mix
15. **Markup Optimization** - Hit target GP% (58%) automatically
16. **Supplier Intelligence** - Best vendor by price/availability/quality
17. **Cross-Reference Lookup** - OEM → aftermarket equivalents
18. **Core Charge Tracking** - Automatically handle deposits/returns

### Tier 3: Diagnostic AI (Premium Tier)
19. **TSB Database Search** - Find bulletins by symptom/DTC code
20. **Common Failure Patterns** - Model-specific known issues
21. **Visual Diagnostics** - Photo of oil-soaked coil → valve cover gasket
22. **Wiring Diagram Analysis** - "Which circuits cause fuse 23 to blow?"
23. **Symptom Correlation** - Customer complaint → likely causes
24. **Diagnostic Flowchart Generator** - Step-by-step troubleshooting
25. **Labor Time Estimation** - AI predicts job duration (better than flat-rate books)
26. **Warranty Claim Builder** - Auto-generate documentation for extended warranties

### Tier 4: Operations AI
27. **Technician Dispatch Optimization** - Best tech for each job
28. **Bay Scheduling** - Maximize throughput (2.2 cars/bay/day benchmark)
29. **Workflow Automation** - Auto-create ROs from appointments
30. **Customer Communication Bot** - Approval requests, updates, pickup notifications
31. **Invoice Audit** - Flag unusual pricing, missing items, calculation errors
32. **Payroll Calculation** - Flat-rate hours × tech rate, advisor commissions
33. **Inventory Reorder Alerts** - "Order brake pads, you're at 2 units"
34. **Shop Performance Analytics** - ARO trends, tech efficiency, approval rates

### Tier 5: Future/Experimental
35. **Voice-to-RO** - Advisor speaks, AI creates work order
36. **Predictive Failures** - "This vehicle will need struts in 10K miles"
37. **Customer Lifetime Value** - Predict high-value customers, retention strategies
38. **Marketing Automation** - Service reminders, educational content, promotions
39. **Vendor Negotiation Assistant** - "AutoZone markup vs NAPA, suggest order split"
40. **Competitor Intelligence** - Track local shop pricing, adjust strategy

## Competitive Advantages

### What Makes RO Engine Different

**1. AI-First, Not Bolt-On**
- Competitors might add AI features eventually
- We're building AI into the core from day one
- Service recommendations aren't an add-on, they're the product

**2. Built by a Shop Owner for Shop Owners**
- I know the pain points (I live them daily)
- AutoHouse is the testing ground (real customers, real money)
- Not designed by developers who've never turned a wrench

**3. Modern Stack, Not Legacy Refactor**
- Competitors are maintaining 10-20 year old codebases
- We're building with 2025 tools (Next.js, React, AI APIs)
- Fast iteration, modern UX, mobile-first

**4. Price Disruption**
- $99/month vs $199-450/month
- Same features, better AI, fraction of the cost
- Margins still healthy (75% at scale)

**5. Proven ROI**
- Not "AI will help someday"
- PartsTech data: 50% ARO increase with digital estimates
- Measurable impact: $51K/month revenue increase for AutoHouse

## Success Metrics

### AutoHouse Validation (Phase 1)
- **Current ARO:** ~$850
- **Target ARO:** ~$1,275 (50% increase)
- **Current Monthly Revenue:** ~$25,500 (30 ROs/month)
- **Target Monthly Revenue:** ~$153,000 (120 ROs/month at higher ARO)
- **Timeline:** Prove 50% ARO increase by end of Q1 2026

### Beta Launch (Phase 2 - 10 shops)
- **Acquisition:** 10 beta shops by end of Q2 2026
- **Retention:** 80%+ retention after 3 months
- **Revenue:** $990/month MRR
- **Feedback:** Gather feature requests, pain points, workflows

### Regional Expansion (Phase 3 - 100 shops)
- **Acquisition:** 100 shops by end of Q4 2026
- **Revenue:** $9,900/month MRR = $118,800 ARR
- **Support Load:** <2 hours/week per shop
- **Churn:** <5% monthly

### National Scale (Phase 4 - 500 shops)
- **Acquisition:** 500 shops by end of 2027
- **Revenue:** $49,500/month MRR = $594,000 ARR
- **Profit:** $444,000/year (75% margin)
- **Valuation:** $3-6M (5-10× ARR multiple)

## Philosophy & Values

### Product Philosophy
- **Ship fast, iterate faster** - Test in production (AutoHouse is production)
- **AI as assistant, not replacement** - Augment advisors, don't replace them
- **Simplicity over features** - Do fewer things, do them excellently
- **Data-driven decisions** - Measure everything, trust the numbers

### Business Philosophy
- **Voluntaryist principles** - Consensual transactions, no coercion
- **Independence** - Not beholden to VCs, control our own destiny
- **Value creation** - Charge for value delivered, not time or features
- **Transparency** - Show ROI, share metrics, build trust

### Technical Philosophy
- **Modern stack** - Use best tools available in 2025
- **Boring technology** - Proven patterns, not bleeding edge
- **Vertical integration** - Own the whole stack (no Zapier duct tape)
- **Autonomous AI** - Let Claude Code test, iterate, improve

## Current State (February 2026)

**Where We Are:**
- RO Engine deployed on AutoHouse server (onsite testing environment)
- Running parallel to ShopWare (production operations still on legacy system)
- Testing real workflows with simulated data
- Invoice system complete (payments, reopen, void, print)
- AI maintenance recommendations working (35 Volvo services)
- Parts management with AI pricing
- Google Places address autocomplete
- Clean, modern UI with shadcn/ui components
- Iteratively polishing UX based on hands-on testing

**Current Phase:**
- **Testing:** Simulating real customer workflows (customer → vehicle → RO → recommendations)
- **Polishing:** Refining UI/UX based on actual usage (card sizes, editability, flow)
- **Validation:** Proving features work before replacing ShopWare
- **Timeline:** Still on ShopWare for production, RO Engine not yet handling real customers

**What's Next:**
- Complete feature parity with ShopWare (enough to switch over)
- Digital estimate workflow (prove 50% ARO increase)
- Expand maintenance coverage (Subaru, Honda, Toyota)
- Switch AutoHouse from ShopWare to RO Engine (production cutover)
- Then: Multi-tenant prep for beta shops (Q2 2026)

**The Goal:**
Replace ShopWare at AutoHouse first (prove it works in real production).
Then sell it to other shops who want to escape expensive legacy systems.

---

*This document is the strategic context. See /docs/RO_ENGINE_TECHNICAL.md for technical implementation details.*
```

## **Better Framing:**
```
REALITY:
├─ RO Engine: Testing environment (parallel to production)
├─ ShopWare: Still handling real business operations
├─ Goal: Reach feature parity → cutover → then SaaS
└─ Not "in production" but "pre-production testing"

HONEST STATUS:
├─ Server deployed onsite ✓
├─ Real workflows simulated ✓
├─ Features being polished ✓
├─ Not yet handling paying customers ✗
└─ ShopWare still critical (can't turn off yet)
```

## **Usage:**

### **For Strategic Discussions (with me, Desktop Claude):**
```
"Reference /docs/RO_ENGINE_VISION.md for project context.

I want to discuss: [pricing strategy / feature prioritization / go-to-market]"
```

### **For Technical Work (with Claude Code):**
```
"Reference /docs/RO_ENGINE_VISION.md for strategy context.
Reference /docs/RO_ENGINE_TECHNICAL.md for technical details.

Task: [specific coding work]"
```

### **For Comprehensive Context (planning sessions):**
```
"Read both /docs/RO_ENGINE_VISION.md and /docs/RO_ENGINE_TECHNICAL.md.

We need to plan: [major feature / architecture decision / roadmap]"