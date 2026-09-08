# Graph Report - lonera-website  (2026-09-08)

## Corpus Check
- Corpus is ~25,935 words - fits in a single context window. You may not need a graph.

## Summary
- 149 nodes · 179 edges · 38 communities (11 shown, 24 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.86)
- Token cost: 305,284 input · 0 output

## Community Hubs (Navigation)
- Customer UI Rendering
- Community & Tickets Store
- Dashboard Rendering
- Express Server Config
- Voice Search & Intent
- Home Screen Design Concepts
- Jobs Board
- Marketplace Board
- Ticket Persistence
- Seed Demo Data
- Two-App Architecture
- Contrast Preference
- Bilingual Dictionaries
- Language Preference
- Font Scale Preference
- Booking Request Flow
- Sidebar Navigation
- Clients Panel
- Create Panel
- Insights Panel
- Dashboard Jobs Panel
- Messages Panel
- Payments Panel
- Schedule Panel
- Verification Panel
- About Section
- Mobile Bottom Nav
- Service Categories
- Community Seed
- Item Conditions
- FAQ Content
- Grocery Store Data
- Job Categories
- Market Categories
- Ticket Seed

## God Nodes (most connected - your core abstractions)
1. `applyI18n()` - 13 edges
2. `runSearch()` - 13 edges
3. `renderListings()` - 11 edges
4. `renderCompareTable()` - 9 edges
5. `submitTicket()` - 9 edges
6. `Lonera App Home Screen Thumbnail` - 9 edges
7. `submitTicket()` - 8 edges
8. `openModal()` - 8 edges
9. `renderLiveRequests()` - 7 edges
10. `renderNotifications()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `escapeHtml()` --semantically_similar_to--> `escapeHtml()`  [INFERRED] [semantically similar]
  dashboard.html → index.html
- `timeAgo()` --semantically_similar_to--> `timeAgo()`  [INFERRED] [semantically similar]
  dashboard.html → index.html
- `loadTickets()` --semantically_similar_to--> `loadTickets()`  [INFERRED] [semantically similar]
  dashboard.html → index.html
- `submitTicket()` --semantically_similar_to--> `submitTicket()`  [INFERRED] [semantically similar]
  dashboard.html → index.html
- `renderNotifications()` --semantically_similar_to--> `renderNotifications()`  [INFERRED] [semantically similar]
  dashboard.html → index.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Shared support-ticket workflow (submit, store, notify) across customer and provider surfaces** — index_tickets_store, dashboard_tickets_store, index_submitticket, dashboard_submitticket, index_rendernotifications, dashboard_rendernotifications [INFERRED 0.85]
- **Customer booking request flow into Provider Dashboard requests inbox** — index_saverequest, index_requests_store, dashboard_requests_store, dashboard_renderliverequests, dashboard_loadrequests [INFERRED 0.90]
- **Bilingual EN/KO localization pattern shared by both apps** — dashboard_dt, index_t, dashboard_lang_pref, index_lang_pref, dashboard_applyi18n, index_applyi18n [INFERRED 0.85]

## Communities (38 total, 24 thin omitted)

### Community 0 - "Customer UI Rendering"
Cohesion: 0.15
Nodes (20): applyI18n(), availInfo(), Browse by picture categories block, catOf(), FAQ block, Featured banner carousel, langBadges(), Listing detail modal (+12 more)

### Community 1 - "Community & Tickets Store"
Cohesion: 0.15
Nodes (19): lonera_community localStorage store (dashboard), generateTicketRef(), loadCommunity(), Community block, lonera_community localStorage store (index), escapeHtml(), generateTicketRef(), Grocery Deals block (+11 more)

### Community 2 - "Dashboard Rendering"
Cohesion: 0.18
Nodes (16): applyI18n(), escapeHtml(), loadRequests(), loadTickets(), renderDashCommunityFeed(), renderDashTicketList(), renderLiveRequests(), renderNotifications() (+8 more)

### Community 3 - "Express Server Config"
Cohesion: 0.12
Nodes (14): dependencies, express, description, main, name, private, scripts, dev (+6 more)

### Community 4 - "Voice Search & Intent"
Cohesion: 0.18
Nodes (5): cleanupNote(), cleanupNote(), runSearch(), sortListings(), Top search / voice hero section

### Community 5 - "Home Screen Design Concepts"
Cohesion: 0.31
Nodes (11): Accessibility Controls (Font Size, High Contrast), Bottom Navigation Bar, Dark Themed Hero Section, Hero Headline: Find Help You Can Trust, Lonera App Home Screen Thumbnail, Calgary Korean Community Local Marketplace Purpose, Korean Language Toggle, Lonera Brand Header (+3 more)

### Community 6 - "Jobs Board"
Cohesion: 0.50
Nodes (5): Jobs board block, lonera_jobs localStorage store (index), loadJobs(), renderJobsGrid(), saveJobPost()

### Community 7 - "Marketplace Board"
Cohesion: 0.50
Nodes (5): loadMarket(), lonera_marketplace localStorage store (index), Marketplace board block, renderMarketGrid(), saveMarketItem()

### Community 8 - "Ticket Persistence"
Cohesion: 0.67
Nodes (4): saveTickets(), lonera_tickets localStorage store (dashboard), saveTickets(), lonera_tickets localStorage store (index)

### Community 9 - "Seed Demo Data"
Cohesion: 0.50
Nodes (4): Home section (sec-home), Quotes section (sec-quotes), JOBS_SEED data, LISTINGS data (demo providers)

### Community 10 - "Two-App Architecture"
Cohesion: 0.67
Nodes (3): Dashboard Page (Provider Dashboard App), Index Page (Lonera Marketplace App), Provider CTA block (link to dashboard)

## Knowledge Gaps
- **56 isolated node(s):** `name`, `version`, `private`, `description`, `main` (+51 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 69 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `applyI18n()` connect `Customer UI Rendering` to `Community & Tickets Store`, `Dashboard Rendering`, `Jobs Board`, `Marketplace Board`?**
  _High betweenness centrality (0.137) - this node is a cross-community bridge._
- **Why does `runSearch()` connect `Voice Search & Intent` to `Customer UI Rendering`, `Community & Tickets Store`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `renderListings()` connect `Customer UI Rendering` to `Community & Tickets Store`, `Voice Search & Intent`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _56 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community & Tickets Store` be split into smaller, more focused modules?**
  _Cohesion score 0.14619883040935672 - nodes in this community are weakly interconnected._
- **Should `Express Server Config` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._