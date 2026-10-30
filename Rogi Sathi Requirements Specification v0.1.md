# Unified Health Platform for Bangladesh

*Requirements Specification, v0.2 (revised around the unified health system idea)*

This version builds one central platform where private hospitals, clinics and diagnostic centers each manage their own patients, while patients, doctors, prices and records are linked through a shared registry. It replaces the earlier government-hospital and low-literacy focus.

## 1. Overview

Patients and providers in Bangladesh have no shared system for records, doctor availability or prices, so each hospital works alone and patients carry paper between them.

### 1.1 Problem statement

1. **Scattered records:** Reports and prescriptions are on paper or inside separate hospital systems, so tests are repeated and history is lost between providers.
2. **No single directory:** Patients cannot easily see which doctor sits at which hospital, and when.
3. **No price visibility:** Doctor fees and diagnostic test prices differ by provider and are hard to compare or verify.
4. **No cost expectation for treatment:** Patients rarely know a likely cost range before committing.
5. **Small providers lack tools:** Many clinics and diagnostic centers still run on paper and have no affordable software.

### 1.2 Vision

One platform where each private hospital, clinic or diagnostic center registers and manages its own patients independently, while the patient owns one health record that follows them across providers, with their consent.

### 1.3 One-line scope (for your proposal)

> *A consent-based unified health platform for Bangladesh in which healthcare providers independently manage their patients, and patients get one record, a central doctor directory, and cross-provider fee and test price comparison.*

### 1.4 Novelty

1. **Two-sided design:** a provider workspace and a patient-owned record on one platform, not one or the other.
2. **Cross-provider price comparison** for doctor fees and diagnostic tests, with treatment costs as ranges.
3. **Price verification from real bills:** patients can upload receipts to check that what was charged matches the published price.
4. **Granular consent** by record category, so a dermatologist sees only what is relevant.
5. **Duplicate-test alerts** across providers, built from the shared record.

### 1.5 Reference systems

- **India (ABDM):** a 14-digit health ID, a national facility registry, an open appointment network (UHI) and a consent manager, with records held by providers and shared on consent. This is the closest model to copy in structure.
- **England (NHS):** one patient number and the NHS App, within a tax-funded system. NHS England is being merged into the Department of Health and Social Care, so describe it as in transition.
- **Japan:** a national fee schedule makes prices identical everywhere, so price comparison matters less there.

The gap this project targets: none of these compares **private-market prices across providers** for the patient. Check Bangladesh's current digital health initiatives (DGHS, DHIS2, any national health ID) and other apps before the final submission, and put the findings in a literature gap table.

## 2. Stakeholders and Why Providers Join

The platform works only if providers join, and private hospitals have a real reason to hesitate: price transparency exposes their margins. This section is the answer to the question your supervisor will ask first.

### 2.1 Stakeholders

| Stakeholder | Role | What they need |
| --- | --- | --- |
| Patient | Owns the record, searches and compares | One record, price visibility, easy booking |
| Family caregiver | Manages a child's or parent's profile | Proxy access, reminders |
| Doctor | Practices at one or more facilities | Patient history, duplicate-test avoidance, schedule management |
| Hospital or clinic admin | Runs a provider workspace | Patient registration, appointments, billing, reports |
| Diagnostic center | Runs tests and issues reports | Report delivery to the patient's record, test price listing |
| Platform admin | Verifies providers and moderates data | Provider verification, audit, dispute handling |
| Regulator (future) | DGHS or similar body | Aggregated, anonymised data; licensing link |

### 2.2 Why providers will join

| Incentive | How the platform delivers it | Strength |
| --- | --- | --- |
| Free software | A lightweight provider workspace (registration, queue, appointments, report upload) for clinics still on paper | Strong for small providers |
| New patients | Appearing in the central directory and appointment search | Strong |
| Less paperwork | Reports delivered digitally to the patient, fewer re-requests | Medium |
| Patient demand | Patients prefer providers that appear on the platform | Grows with adoption |
| Licensing or insurance link | A policy proposal: participation counted in licensing or insurer empanelment, as India links hospital participation to its health insurance scheme | Strongest, but outside student control |

### 2.3 Adoption model

1. **Voluntary-first:** start with small clinics and diagnostic centers that gain most and fear transparency least.
2. **Opt-in pricing:** providers choose which prices to publish, and the directory shows "price not published" openly.
3. **Patient-verified prices:** receipts uploaded by patients show real prices, so unwilling providers cannot be the only source.
4. **Policy extension:** propose licensing-linked participation as future work, not as something the prototype assumes.

Be honest in the report: a student project cannot force private hospitals to join. It can show a working model and the evidence for why a mandate or insurance link would work.

## 3. Scope and Phasing

The MVP is a working multi-provider prototype with a patient app, a provider workspace and a central registry, using a small set of pilot or mock providers.

### 3.1 Phases

| Phase | Contents |
| --- | --- |
| **Phase 1: MVP (thesis deliverable)** | Patient registration and health ID; provider onboarding and verification; provider workspace (patient registration, appointments, report and prescription upload); patient record vault with OCR and manual confirmation; consent with categories; central doctor and facility directory; doctor fee and test price comparison; appointment booking; duplicate-test alert; family profiles; emergency card |
| **Phase 2: Extended pilot** | Treatment cost ranges; price verification from patient receipts; trend charts and AI-assisted doctor summary; SMS and push reminders; vaccination reminders; provider analytics |
| **Future work (discuss, do not build)** | National integration and licensing or insurance link; public hospital participation; wearable and IoT ingestion with risk scoring; ambient AI scribe; payments; telemedicine |

### 3.2 What happened to the uploaded feature list

| Feature | Decision | Reason |
| --- | --- | --- |
| AI clinical copilot and longitudinal timeline | **Keep, simplified** | OCR, structured extraction of a few lab markers, trend chart. The doctor summary is labelled "AI-generated, verify". No model fine-tuning. |
| Granular consent masking | **Keep** | Category tags per document (General, Mental Health, Reproductive, Other Sensitive). No automated LLM redaction. |
| Emergency profile (QR or NFC) | **Keep, simplified** | Opt-in, patient-chosen fields, signed QR readable offline. NFC deferred. "Zero-knowledge" is the wrong term: call it an offline-readable signed emergency card. |
| Family guardianship vault | **Keep** | Natural fit: caregivers manage children and elderly parents. Vaccination reminders use the national schedule (verify with DGHS). |
| IoT and wearable ingestion, risk scoring | **Future work** | Needs devices, validation and medical-device compliance. |
| Ambient AI scribe | **Future work** | Needs doctor cooperation, good Bangla clinical speech recognition and heavy privacy work. |
| ABDM sandbox, Aadhaar OTP, CERT-In audit | **Replace** | India-specific. Use mobile OTP, optional NID verification, a FHIR-shaped data model and an independent security review. |

## 4. Functional Requirements: Patient Side

Priority: **M** = Must (MVP), **S** = Should, **C** = Could (Phase 2).

### 4.1 Identity and access

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1.1 | The system shall register patients by mobile number verified with an OTP. | M |
| FR-1.2 | The system shall issue each patient a unique platform health ID. | M |
| FR-1.3 | The system shall support optional NID verification if lawful access is available. | C |
| FR-1.4 | The system shall support one login with several roles (patient, caregiver). | M |
| FR-1.5 | The system shall support PIN or biometric lock on the mobile app. | S |

### 4.2 Health record vault

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-2.1 | Patients shall see prescriptions, reports, bills and visit summaries from all connected providers in one timeline. | M |
| FR-2.2 | Patients shall be able to upload photos or PDFs of their own paper records. | M |
| FR-2.3 | The system shall run OCR on uploads and extract date, doctor, medicines, test names and values. | M |
| FR-2.4 | Extracted data shall require confirmation by the patient, caregiver or provider staff before it is saved. | M |
| FR-2.5 | The original image shall always be kept next to the extracted data. | M |
| FR-2.6 | Each record shall show its source (provider upload, patient upload, OCR) and verification status. | M |
| FR-2.7 | The system shall chart the trend of selected lab markers (for example HbA1c, glucose, creatinine, lipids). | S |
| FR-2.8 | The system shall generate a short AI-assisted history summary for doctors, labelled AI-generated and requiring clinician verification. | C |
| FR-2.9 | The system shall warn when a newly ordered test duplicates a recent result in the record. | M |

### 4.3 Consent and sharing

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-3.1 | No provider or doctor shall see patient data without the patient's explicit consent. | M |
| FR-3.2 | Consent shall be given by OTP or QR code, scoped to a provider, a duration and record categories. | M |
| FR-3.3 | Categories shall include General, Mental Health, Reproductive Health and Other Sensitive. | M |
| FR-3.4 | Patients shall be able to revoke consent at any time. | M |
| FR-3.5 | Every access to patient data shall be logged and visible to the patient. | M |
| FR-3.6 | A provider shall always be able to see records that the provider itself created, even after consent expires, as required for its own legal record keeping. | S |

### 4.4 Search, compare and book

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-4.1 | Patients shall search doctors by name, specialty, hospital and area. | M |
| FR-4.2 | Patients shall see each doctor's facilities, days and hours in one place. | M |
| FR-4.3 | Patients shall request, view, reschedule and cancel appointments. | M |
| FR-4.4 | The system shall send appointment reminders by push notification and SMS. | S |
| FR-4.5 | Patients shall compare doctor fees and test prices across providers (see section 5). | M |

### 4.5 Family and emergency

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-5.1 | A primary user shall manage profiles for children and dependent adults, with permissions set by the guardian. | M |
| FR-5.2 | The system shall show child vaccination reminders from a configurable national schedule, with the source cited. | S |
| FR-5.3 | The patient shall opt in to an emergency card showing only chosen fields (blood group, severe allergies, implants, emergency contact). | M |
| FR-5.4 | The emergency card shall be a digitally signed QR code that a reader app can verify offline. | S |
| FR-5.5 | The patient shall be able to disable or regenerate the emergency card. | M |

## 5. Functional Requirements: Providers and Central Registry

Each provider runs its own workspace independently, and a shared registry connects providers for directory, price comparison and consent.

### 5.1 Provider onboarding and workspace

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-6.1 | A hospital, clinic or diagnostic center shall register with its legal name, license details and contact person. | M |
| FR-6.2 | A platform admin shall verify the provider's documents before it can publish data. | M |
| FR-6.3 | Each provider shall have an isolated workspace: its data is invisible to other providers. | M |
| FR-6.4 | Provider admins shall create staff accounts with roles (admin, doctor, receptionist, lab technician, billing). | M |
| FR-6.5 | Staff shall register patients (new or by platform health ID) and open visits. | M |
| FR-6.6 | Staff shall manage the appointment calendar and an on-site queue. | M |
| FR-6.7 | Doctors shall write prescriptions and visit notes into the patient's record, with the consented scope. | M |
| FR-6.8 | Lab staff shall upload test reports to a patient's record. | M |
| FR-6.9 | The workspace shall create bills and receipts from the provider's own price list. | S |
| FR-6.10 | Providers shall export their own data in a standard format. | S |

### 5.2 Doctor directory

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-7.1 | The registry shall list doctors with name, specialty, qualifications and registration number, verified against the national medical council record where possible. | M |
| FR-7.2 | A doctor shall be linked to several facilities, each with its own schedule and fee. | M |
| FR-7.3 | The directory shall show "which doctor sits where and when" in one view. | M |
| FR-7.4 | Provider admins shall keep schedules up to date, and out-of-date entries shall be flagged. | M |

### 5.3 Doctor fee analysis

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-8.1 | Each doctor listing shall show the visit fee, follow-up fee and the date it was last updated. | M |
| FR-8.2 | Patients shall filter and sort doctors by specialty, area, fee range, availability and distance, according to their own choice. | M |
| FR-8.3 | The system shall show fee distribution for a specialty (minimum, median, maximum) in an area. | S |
| FR-8.4 | The system shall not rank doctors as "best" using fee alone, and shall state that fee does not indicate quality. | M |

### 5.4 Diagnostic test price comparison and verification

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-9.1 | Providers shall publish a test price list using a standard test name and code. | M |
| FR-9.2 | Patients shall compare the price of the same test across providers. | M |
| FR-9.3 | Each price shall show its source (provider-published or patient-reported) and date. | M |
| FR-9.4 | Patients shall be able to upload a bill or receipt to report the price actually charged. | S |
| FR-9.5 | The system shall flag a provider when billed prices differ from published prices beyond a set tolerance, and send it to a reviewer before anything is shown publicly. | C |
| FR-9.6 | Test names shall be normalised using a mapping table (for example to LOINC) so that different provider names compare correctly. | S |

### 5.5 Treatment cost

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-10.1 | Providers may publish package prices for defined procedures. | C |
| FR-10.2 | Treatment cost shall appear only as a **range** with an explanation that the final cost depends on the case. | C |
| FR-10.3 | When enough anonymised bills exist, the range shall be calculated from them, and a minimum sample size shall be enforced before showing any figure. | C |
| FR-10.4 | The system shall never present a treatment cost as a fixed quote or a medical recommendation. | M |

### 5.6 Administration and moderation

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-11.1 | Admins shall suspend or remove a provider that breaks the rules. | M |
| FR-11.2 | Providers shall be able to dispute a flagged price with evidence, and the outcome shall be logged. | S |
| FR-11.3 | Admins shall not read patient clinical data except through a logged, justified emergency procedure. | S |
| FR-11.4 | The system shall provide usage, data-quality and audit dashboards. | S |

## 6. Non-Functional Requirements and Data Model

### 6.1 Non-functional requirements

| ID | Category | Requirement |
| --- | --- | --- |
| NFR-1 | Multi-tenancy | One provider must never read another provider's data. Isolation shall be enforced in the data layer and tested automatically. |
| NFR-2 | Security | TLS in transit, encryption at rest, role-based access, keys kept out of the codebase. |
| NFR-3 | Privacy | Data minimisation, explicit consent, access logs, deletion on request. Check the current status of Bangladesh's data protection law and align with it. |
| NFR-4 | Interoperability | Data model based on HL7 FHIR resources so later integration is possible. |
| NFR-5 | Performance | Common screens load within a few seconds on a mid-range phone over a mobile connection. Set a number after baseline testing. |
| NFR-6 | Availability | Pilot target uptime during clinic hours. Agree a figure with the supervisor. |
| NFR-7 | Data quality | Every price and schedule shows its source and last-updated date. |
| NFR-8 | Language | Bangla and English interface. |
| NFR-9 | Usability | Core tasks (find a doctor, book, view a report) completed by first-time users without training, checked in usability tests. |
| NFR-10 | Auditability | Every read and write of clinical data is logged with who, when and why. |
| NFR-11 | Safety | Clear "not medical advice" notices and emergency-number guidance. |
| NFR-12 | Maintainability | Modular services, documented APIs, automated tests for consent and isolation. |

### 6.2 Data model

| Entity | FHIR resource | Notes |
| --- | --- | --- |
| Patient | Patient | Platform health ID, linked mobile number |
| Provider | Organization | Hospital, clinic or diagnostic center |
| Facility site | Location | Address, hours |
| Doctor | Practitioner | Registration number |
| Doctor at facility | PractitionerRole | Specialty, schedule, fee: the "who sits where" link |
| Appointment | Appointment, Schedule, Slot | Status flow: requested, confirmed, done, cancelled |
| Uploaded file | DocumentReference | Original image or PDF |
| Lab result | DiagnosticReport, Observation | Coded values and units |
| Prescription | MedicationRequest | Medicine, dose, duration |
| Allergy | AllergyIntolerance | Used for emergency card |
| Consent | Consent | Provider, categories, expiry |
| Access log | AuditEvent | Immutable |
| Price item | ChargeItemDefinition | Test or procedure price, source, date |
| Bill | Invoice | Used for price verification |

### 6.3 Code systems and mapping

- **LOINC** for lab tests, with a local mapping table for names used in Bangladesh.
- **ICD-10** for diagnoses where needed.
- A **local drug table** mapping Bangladeshi brand names to generic names. This is a likely gap and a possible contribution.
- Every structured field stores its source and verification status.

## 7. Architecture, Technology and Security

A hybrid design keeps clinical data inside each provider's isolated workspace, and holds only the identity, directory, price and consent registry centrally.

### 7.1 Components

1. **Patient app (mobile):** records, consent, search, booking, emergency card.
2. **Provider workspace (web):** patient registration, calendar, prescriptions, report upload, price list, billing.
3. **Central registry service:** patient identity, facility and doctor directory, price database, consent manager.
4. **Provider data partitions:** each provider's clinical data, separated by tenant and checked on every request.
5. **Document pipeline:** upload, OCR, extraction, human confirmation, storage.
6. **Notification service:** push and SMS reminders.
7. **Audit and admin service:** access logs, verification, moderation.

A drawn architecture diagram of these seven parts would fit well here and can be added once the component list is agreed.

### 7.2 Suggested technology (student-scale)

Verify that each service is currently available, fits your budget and meets your university's data rules before committing.

| Layer | Suggested choice | Notes |
| --- | --- | --- |
| Mobile app | Flutter | One codebase for Android and iOS |
| Provider web app | React or Next.js with Tailwind CSS | Responsive, light pages |
| Backend | Python (FastAPI) or Node.js | Fast to build, good AI library support |
| FHIR layer | HAPI FHIR or Medplum | Open-source FHIR servers. A FHIR-shaped schema in PostgreSQL is acceptable for a prototype if time is short. |
| Database | PostgreSQL with row-level security | Row-level security supports tenant isolation |
| File storage | S3-compatible object storage | Encrypted at rest |
| OCR | Tesseract or PaddleOCR, compared with a cloud OCR such as Google Document AI | Measure accuracy on a test set; it becomes an evaluation result |
| AI summary (optional) | An LLM API restricted to the patient's confirmed data | Always labelled AI-generated |
| Search | PostgreSQL full-text search | A separate vector database is unnecessary at this scale |
| Notifications | A Bangladesh SMS gateway and push notifications |  |
| Cryptography | libsodium or the platform standard library | Do not design your own cryptography |

### 7.3 Security and privacy

| Threat | Control |
| --- | --- |
| One provider reading another's data | Tenant isolation in the database, tested automatically |
| Access without consent | Consent check on every API request, not only in the interface |
| Stolen phone | PIN or biometric lock, remote session revoke |
| Fake provider or false prices | Document verification, admin suspension, source and date on every price |
| Misleading price claims | Reviewer step and provider dispute process before any public flag |
| OCR error causing harm | Mandatory human confirmation, original image always kept |
| Insider misuse | Role-based access, immutable audit log, break-glass procedure for admins |
| Emergency card exposure | Opt-in, minimal fields, patient can disable or regenerate |

### 7.4 Legal and ethical points

- Check Bangladesh's current data protection and health data rules, and record the findings and limits in the report.
- Use synthetic or consented data only in the prototype. Do not use real patient records without formal permission.
- Do not make clinical claims. The platform organises information and does not diagnose or treat.
- Get ethics approval or supervisor sign-off before any survey or interview.

## 8. Feasibility, Risks, Evaluation and Timeline

A full national version is not feasible for a student project because it depends on provider adoption and policy. A pilot with a handful of mock or willing providers is feasible and is enough to prove the model.

### 8.1 Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Private hospitals refuse to publish prices | Price comparison stays thin | Start with willing small providers; allow patient-reported receipts; show "price not published" openly |
| Price data goes out of date | Users lose trust | Source and date on every price; flag stale entries |
| Doctor fees mistaken for quality | Misleading choices | No fee-based ranking; visible disclaimer |
| Legal or defamation claims over price flags | Provider disputes | Reviewer step, dispute process, wording that states facts only |
| Provider fear of data sharing | No adoption | Tenant isolation; consent-only sharing; providers keep their own data |
| OCR inaccurate on Bangla handwriting | Poor record quality | Human confirmation; prioritise printed reports; report measured accuracy |
| Privacy incident | Harm and loss of trust | Synthetic data, strict access control, audit logs |
| Scope creep | Unfinished project | Fixed MVP list in section 3 |

### 8.2 Evaluation plan

| Goal | Metric | Method |
| --- | --- | --- |
| Providers can run their work independently | Task success and time for core provider tasks | Usability test with clinic or lab staff, or role-played staff |
| Patients find and compare easily | Task success rate and time versus manual search | Task-based test with real users |
| Tenant isolation holds | Pass rate of isolation tests | Automated tests with cross-tenant access attempts |
| Consent works | Pass rate of consent tests | Automated tests for revoke, expiry and category masking |
| Record quality | OCR field accuracy before and after correction | Test set of printed and handwritten documents |
| Fewer duplicate tests | Alerts raised and accepted | Scenario tests with synthetic records |
| Price coverage and freshness | Providers, doctors and tests listed; average age of entries | Data counts from the pilot |
| Price verification works | Share of reported receipts that match listed prices | Seeded receipt tests |

Baseline evidence for the problem should come from a short survey or interviews with patients and clinic staff, plus published studies and news reports.

### 8.3 Timeline (adjust to your deadline)

| Weeks | Work | Output |
| --- | --- | --- |
| 1 to 3 | Literature review, survey design, competitor and gap research | Literature gap table, survey results |
| 4 to 5 | Requirements and design | This document refined, wireframes, data model |
| 6 to 9 | Provider workspace and tenant isolation | Multi-provider core |
| 10 to 12 | Patient app: vault, OCR, consent, search, booking | Working patient app |
| 13 to 14 | Directory, fee and test price comparison | Central registry and comparison |
| 15 to 16 | Pilot with mock or willing providers | Pilot data and feedback |
| 17 to 18 | Evaluation and writing | Results, report, presentation |

## 9. Supervisor Questions and Open Questions

### 9.1 Prepared answers

| Question | Answer |
| --- | --- |
| What problem are you solving? | Records, doctor availability and prices are scattered across providers, so patients repeat tests, cannot compare costs and carry paper between hospitals. |
| Why is it important? | Fragmentation raises cost, delays care and breaks treatment history. Small providers have no affordable software. |
| What is new? | A two-sided platform: a provider workspace plus a patient-owned record, with cross-provider doctor and test price comparison and receipt-based price verification. |
| How does it work? | Providers register and run isolated workspaces. A central registry holds identity, directory, prices and consent. Clinical data moves only with patient consent, using FHIR-shaped resources. |
| Why will private hospitals join? | Free tools, new patients through the directory, less paperwork, patient demand, and a proposed licensing or insurance link in the long term. |
| Is it implementable? | A national version depends on policy. A pilot with mock or willing providers is implementable and enough to prove the model. |
| How is privacy protected? | Consent on every access, category masking, tenant isolation, audit logs, encryption, synthetic data in the prototype. |
| How do you verify prices? | Providers publish prices with a date, patients can upload receipts, and large differences go to a reviewer before anything is shown publicly. |
| What if providers publish wrong prices? | Source and date are shown, stale entries are flagged, and a dispute process exists. |
| How do you measure success? | Section 8.2. |

### 9.2 Open questions for you

1. Is this a thesis, final-year project, competition or startup idea? It sets depth and timeline.
2. Which pilot clinics, labs or contacts can you reach?
3. What skills are in your team (mobile, web, backend, AI)?
4. Should the first version focus on one city, one specialty or one type of provider, such as diagnostic centers?
5. Is a Bangladesh-only scope fine, or do you also want an India comparison chapter?
6. Do you have a cloud budget, and does your university have data or ethics rules for user testing?
