# Project Charter: KapwaRelief / KapwaHelp
**Version:** 2026.3 | **Status:** Baseline Approved  
**Nature:** Citizen-Led, Volunteer-Driven, Decentralized Coordination Platform

---

## 1. Project Objectives & Mission
The mission of **KapwaRelief** is to bridge the "Information Gap" between high-level government reports and the actual, granular needs of isolated communities. 

* **Real-Time Coordination:** Provide a **high-speed, mobile-first visualization** of urgent, verified needs to prevent "aid clustering."
* **Radical Transparency:** Maintain an **immutable public ledger** of every relief action, tracking the journey from donor to recipient.
* **Standardized Protocol:** Establish an offline-ready "Needs Assessment" format for grassroots data interoperability.
* **Institutional Memory:** Archive longitudinal data to identify recurring **"dead zones"** for future preparedness.

---

## 2. Financial & Operational Disclaimer (The "Matchmaker" Model)

**KapwaRelief** operates as a coordination layer, distinct from traditional warehouse-based NGOs:

* **No Internal Inventory:** We do **not** maintain a physical warehouse or stockpile. We provide the "Ground Truth" data so independent donors can deploy resources.
* **Donation-Based Fulfillment:** Every "Relief Action" is powered by **external donations**. We track the *flow* without owning the supplies.
* **No Centralized Funding:** We facilitate **Direct-to-Community** support by connecting verified needs with willing "Kapwa" donors.
* **Volunteer-Led Infrastructure:** 100% of donor resources go to the field; no "Admin Fees" are deducted for the digital platform.

---

## 3. User Roles & Audience

### A. Main Audience (The Consumers)
* **The Donor Community:** Individuals/CSR requiring **"Proof of Impact"** (GPS-tagged photos).
* **Local Community Leaders:** Checking "Match" status to manage local expectations.
* **Humanitarian Auditors:** Verifying that efforts complement official state responses.

### B. Primary Users (The Data Contributors)
* **Field Responders (Submitters):** Pre-vetted volunteers using a **low-bandwidth PWA** for field assessments.
* **Validation Team (Reviewers):** Remote volunteers cross-referencing reports with trusted media.
* **System Admins (Curators):** Manage Event IDs and trigger data migration to the archive.

---

## 4. The "Lean" Data Model
*Constraint: Zero dependency on external hazard APIs to maintain a sub-1MB app shell.*

#### 1. The "Needs" Dataset (Source: Field Leads)
* **Location:** GPS Coordinates + Geohash + Baranggay/Sitio name.
* **The "Gap":** Categorized by **Lunas** (Medical), **Sustenance** (Food/Water), and **Shelter**.
* **Access Status:** Toggle: *Truck / 4x4 / Boat / Foot-only / Cut-off*.

#### 2. The "Action" Dataset (Source: Relief Ops)
* **Live Status:** `Unverified` → `Verified` → `In-Transit` → `Completed`.
* **Proof of Relief:** Single low-res photo (<300KB) + timestamp.
* **Donor ID:** Reference code linking aid to a specific drive.

---

## 5. Operational Deep-Dive: Methodology

### A. Data Gathering (The "How")
We utilize a **Tiered Collection Method** to balance speed with accuracy.
* **Field-First Input:** Data is gathered via a **Custom PWA Form** designed for "Fatigue-Friendly" entry (large buttons, minimal typing, offline-first).
* **GPS-Locked Assessments:** Every "Need" must be submitted with active GPS coordinates. If the volunteer is offline, the app caches coordinates at the moment of assessment.
* **Visual Verification:** A mandatory **low-resolution photo** (compressed client-side to <300KB) acts as the primary "Proof of Need" to prevent fraudulent or duplicate pins.
* **Accessibility Toggling:** Volunteers select a "Passability" status. This is crucial for matching the right donor (e.g., matching a donor with a boat to a community marked "Boat-only").

### B. The Workflow (The "Journey of a Pin")

To maintain Radical Transparency, every data point follows a linear, audited lifecycle:

| Stage | Action | Actor | System State |
| :--- | :--- | :--- | :--- |
| **1. Submission** | Field Lead uploads "Need" (Qty/Location/Photo). | Field Volunteer | `Status: Pending` (Hidden) |
| **2. Triangulation** | Admin verifies via phone/radio/secondary source. | Validation Team | `Status: Verified` (Live) |
| **3. Matching** | Donor sees pin and commits to delivery. | External Donor | `Status: In-Transit` (Color Change) |
| **4. Fulfillment** | Aid delivered; "Proof of Relief" photo taken. | Logistics/Field Lead | `Status: Completed` (Fades) |
| **5. Audit** | Data moved to Static Transparency Ledger. | System Admin | `Archived` (Subdomain) |

### C. The "Citizen-Led" Verification Method
Unlike government top-down reporting, our methodology relies on **Vouched Identity**:
* **Vouching System:** New volunteers cannot submit "Verified" pins immediately. They must be "vouched for" by an existing Field Lead or Admin.
* **Cross-Check Boundary:** If two volunteers report conflicting data for the same Geohash, the system flags it for immediate **"Admin Intervention"** before it goes live.

### D. Data Sourcing Boundary
* **Primary Source:** 100% of "Actionable Need" data is sourced from **KapwaRelief Verified Volunteers**.
* **Secondary Source:** Logistics data (Road closures) is cross-referenced from **DPWH/LGU** social media, but only pinned if a volunteer confirms the local impact.

---

## 6. Defined Boundaries & Constraints (The "Guardrails")

* **Non-SAR Status:** **NOT a Search and Rescue tool.** Requests are referred to 911/PCG.
* **Geographic Focus:** Rendering is restricted to **Active Operations Zones**.
* **The "21-Day Live" Rule:** Data is moved to `reports.KapwaRelief.ph` after 21 days to clear the live DB.
* **Privacy Boundary:** Beneficiary PII is never public per **DPA** standards; only "Family Units" or "Totals" are shown.
