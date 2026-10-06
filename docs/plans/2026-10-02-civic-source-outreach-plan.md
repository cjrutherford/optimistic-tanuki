# Civic sources: email subscriptions and local-government outreach

Date: 2026-10-02. This follows the discovery benchmark
(`2026-10-01-daylight-discovery-benchmark.md`). Many small towns publish
little that can be crawled, so the briefing also needs material sent to it:
email lists, official submissions, and licensed public notices.

Sources are two research passes on 2026-10-01 (read-only; no forms were
submitted). Items marked _unverified_ were not confirmed on an official page.

## 1. Subscription checklist (owner submits)

**Before you start:**

- Use the dedicated briefing mailbox. Put its IMAP URL in `.env` as
  `CIVIC_INBOX_IMAP_URL`.
- CivicPlus "Notify Me" needs a free website account, and confirmation
  emails must be clicked from the mailbox.
- Tick agenda, minutes and news lists. Skip jobs, bids and SMS.

| #   | Place                           | Channel                                      | Sign-up                                                             | Tick                                                                                        |
| --- | ------------------------------- | -------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | City of Nashville GA            | CivicPlus Notify Me                          | https://www.nashvillega.com/list.aspx                               | Agenda Center (all), News Flash, Alert Center                                               |
| 2   | City of Tifton GA               | CivicPlus Notify Me                          | https://www.tiftonga.gov/list.aspx                                  | Agenda Center: City Council, DDA, Historic Preservation, Planning & Zoning, URA; News Flash |
| 3   | City of Groton CT               | CivicPlus Notify Me                          | https://www.cityofgroton.com/list.aspx                              | Agenda Center (Mayor & Council, P&Z and the others), News Flash                             |
| 4   | Town of Stonington CT           | CivicPlus Notify Me                          | https://www.stonington-ct.gov/list.aspx                             | Agenda Center (incl. P&Z, Board of Education), News Flash, Town Clerk                       |
| 5   | Town of Groton CT               | eNotification (likely CAPTCHA)               | https://www.groton-ct.gov/enotify/index.php                         | Boards and committees, alerts                                                               |
| 6   | Town of Groton CT               | Town Manager's newsletter (Constant Contact) | https://lp.constantcontactpages.com/sl/sYGEOfI                      | Monthly newsletter                                                                          |
| 7   | Escambia County FL (Ferry Pass) | CivicClerk agenda alerts                     | https://escambiacofl.civicclerk.com/Web/Home.aspx?command=subscribe | Board of County Commissioners meetings                                                      |
| 8   | Escambia Clerk FL               | CivicPlus Notify Me (_unverified_)           | https://www.escambiaclerk.com/AlertCenter.aspx                      | Agendas, minutes                                                                            |
| 9   | Groton Public Schools CT        | BOE calendar alerts (_unverified_)           | https://www.grotonschools.org/aboutus/board-of-education/calendar   | Board meetings                                                                              |

**State lists, systematic across towns:**

| #   | Channel                             | Sign-up                                                                                                                   | Filter                      |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 10  | GA EPD Watershed Protection notices | https://epd.georgia.gov/watershed-protection-branch-public-announcements/subscribe-watershed-protection-branch-updates    | —                           |
| 11  | GA EPD Air Protection notices       | https://epd.georgia.gov/public-announcements-0/air-protection-branch-public-announcements/subscribe-air-protection-branch | —                           |
| 12  | FL DEP permit notices (PASS)        | https://floridadep.gov/northeast/ne-permitting/content/environmental-resource-permit-application-notices                  | Counties: Madison, Escambia |
| 13  | CT DEEP public notices eAlerts      | https://portal.ct.gov/DEEP/About/Public-Notices                                                                           | —                           |

**No email channel found:** Adel, Cook County, Cook County Schools, Berrien
County GA, Berrien County Schools, Tift County, Tift County Schools, City of
Madison FL, Madison County FL, Madison County Schools, and the Escambia
school district. These are what the outreach in section 3 is for.

After subscribing, record each sender address. Each becomes the `from` list
of an `email` source for that place in SD.0's database.

## 2. Channels being built

- **Done:** email ingestion (`createEmailAdapter`, commit 31e6a883). It reads
  the mailbox read-only.
- **Next, no outreach needed:**
  - State DOT project data (FDOT FeatureServer, GDOT hub, CTDOT open data).
  - Local finance and audit filings (GA Audits dashboard, FL DFS/Auditor
    General, CT EARS).
  - Election results (FL downloads, CT SODA, GA zip files).
  - Regional bodies' agendas (SGRC, SECOG, NCFRPC, ECRC).
  - GDELT for news discovery: free, attribution required, rate-limited.
- **Blocked on a licence:** statewide public notices.
  - Georgia's terms forbid automated access.
  - Florida needs written permission.
  - Connecticut's terms are unknown.
  - See 3a.

## 3. Outreach plan

**Goal:** official material arrives directly, and officials onboard
themselves as verified officials. The product already supports this: the
`local_hub_verified_official` role, official-record submission (D19, D20),
and the officials service's domain, roster and callback verification
(ported in P2.5).

**Who sends what:** I draft; the owner sends. Nothing is sent to anyone
without the owner's say-so.

### 3a. Press associations: a public-notice licence

The highest value per conversation: one agreement covers every town in a
state.

| State | Contact                                                                                | Ask                                                                           |
| ----- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| GA    | mail@gapress.org; GeorgiaPublicNotice@gmail.com                                        | A data feed or licence for notices by county; permission for automated access |
| FL    | support@floridapublicnotices.com (Florida Press Service)                               | Written authorisation, or a county feed                                       |
| CT    | archive@icreateads.com (connecticutpublicnotices.com); CT Daily Newspapers Association | Terms, and a feed                                                             |

The pitch: notices drive readers to the legal record and credit the
newspaper of record. We'd link the notice and name the paper, never replace
it.

### 3b. Clerks: direct submission

For each pilot place, the clerk (or equivalent) gets a short note:

- **What it is:** a free daily civic briefing for the town that cites
  official records.
- **The ask (ordered from easiest):**
  1. Add our address to the agenda distribution list.
  2. When posting an agenda or minutes, CC it to us.
  3. Become a verified official and submit records directly. That gives
     the town's records an "official record" label in the briefing.
- **What they get:** a link to their briefing, and coverage notes showing
  what's missing for their town.

**Clerk contacts, as published:**

| Place              | Clerk                                        | Contact                                                     | Verified     |
| ------------------ | -------------------------------------------- | ----------------------------------------------------------- | ------------ |
| Adel               | Rhonda Rowe, City Clerk / Asst. City Manager | rrowe@cityofadelga.gov, 229-896-4504                        | yes          |
| Cook County GA     | County Clerk                                 | countyclerk@cookcountyga.us, 229-896-2266                   | _unverified_ |
| Nashville GA       | Amanda Thacker, City Clerk                   | 229-686-5527 (no email published)                           | partly       |
| Berrien County GA  | Teresa Hayes, County Clerk/HR                | thayes@berriencountga.gov as published (domain looks wrong) | check        |
| Tifton             | Jessica White, City Clerk                    | cityclerk@tiftonga.gov, 229-391-3970                        | yes          |
| Tift County        | Miriam Jordan, County Clerk                  | miriam.jordan@tiftcounty.org, 229-386-7850                  | yes          |
| Town of Groton     | Marisol Melendez, Town Clerk                 | townclerk@groton-ct.gov, 860-441-6640                       | yes          |
| City of Groton     | City Clerk                                   | clerk@cityofgroton-ct.gov, 860-446-4102                     | _unverified_ |
| Stonington         | Town Clerk                                   | clerk@stonington-ct.gov, 860-535-5060                       | _unverified_ |
| City of Madison FL | Lee Anne Hall, City Clerk                    | 850-973-5081 (email obscured)                               | partly       |
| Madison County FL  | Clerk of Court (clerk to BOCC)               | 850-973-1500; BOCC 850-973-3179                             | _unverified_ |
| Escambia County    | Clerk of the Circuit Court (clerk to BCC)    | 850-595-4830                                                | _unverified_ |

**Order:**

1. Places with no email channel and a verified contact: Adel, Tift County.
2. Places that have Notify Me, to ask them to CC us as well.
3. The remaining places once contacts are confirmed.

### 3c. Regional bodies and amplifiers

**Regional bodies:** Southern Georgia Regional Commission (sgrc@sgrc.us; it
covers Cook, Berrien and Tift), SECOG (860-889-2324), North Central Florida
RPC (352-955-2200) and Emerald Coast RC (850-332-7976). Ask for agenda
distribution, and an introduction to member clerks.

**Amplifiers:**

- Georgia Municipal Association, Florida League of Cities and the
  Connecticut Conference of Municipalities. One mention in a clerks'
  newsletter reaches every town.
- County clerk associations.

### 3d. Self-onboarding in the product

Each step is an addition to a planned slice, not a new phase:

- **P2.5:** official application, then domain and roster check, then
  callback, then the `local_hub_verified_official` role.
- **P4.4:** an "Are you a clerk or official?" entry point on each town's
  briefing page, leading to submission.
- **The submission inbox:** officials can email agendas to a per-town
  address that is mapped to their verified account (a later slice, on top
  of the email adapter).

### 3e. Tracking

Keep one row per contact in a tracking sheet (owner's choice of tool): date
sent, response, channel agreed, and date of first item received. Re-run the
discovery benchmark monthly, adding a column for items received by email or
submission.

## 4. Open questions for the owner

- The sending identity and domain for outreach, and who signs the notes.
- Whether to pursue public-notice licences, and the budget if fees are
  asked.
- Whether to approach the state municipal leagues before or after the first
  clerks respond.
