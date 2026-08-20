# Portal Project — Product Requirements Document

**File:** `PRD.md`
**Version:** 2.0
**Status:** Comprehensive Product Definition
**Date:** 20 August 2026

---

# 1. Executive Summary

## 1.1 Product Name

**Portal**

Portal is a multi-tenant recruitment, candidate-management, career-profile, document-processing and hiring platform.

The system consists of three primary application experiences:

1. **Candidate Portal**
2. **Recruiter / Organization Portal**
3. **Master Admin / Super Admin Portal**

A shared platform layer provides:

- Authentication
- Authorization
- Resume/document parsing
- Document storage
- Notifications
- Search
- Usage metering
- Monetization
- Billing
- Analytics
- Audit logging
- Background processing
- Platform configuration

---

# 2. Product Vision

Portal should provide a single platform where:

### Candidates

Can create a professional profile quickly, primarily by uploading an existing resume and allowing the platform's parser to extract structured information.

### Recruiters

Can manage organizations, jobs, candidates, applications and recruitment workflows from one system.

### Master Admin

Can operate and govern the entire platform as a **Super Admin**, including users, organizations, security, configuration, monetization, billing, documents, parser operations, analytics and emergency system controls.

---

# 3. Critical Architecture Decisions

## 3.1 Parser Is a Shared Platform Service

The parser is **not an Admin feature**.

The parser belongs to the platform's shared service layer.

### Primary consumer

**Candidate**

Primary use case:

```text
Upload Resume
      ↓
Validate File
      ↓
Parse Resume
      ↓
Extract Structured Data
      ↓
Review
      ↓
Edit
      ↓
Confirm
      ↓
Create / Update Candidate Profile
```

### Secondary consumers

**Recruiter**

- Candidate resume parsing
- Recruitment documents
- Candidate onboarding
- Structured document extraction

**Master Admin**

- Invoices
- Platform documents
- Authorized business documents
- Parser monitoring/configuration

---

## 3.2 Parser Must Not Require AI

The initial parser must be built without:

- LLMs
- Generative AI APIs
- AI-based candidate scoring
- AI-based matching

The initial implementation should use open-source deterministic technologies for:

- PDF extraction
- DOCX extraction
- OCR
- Pattern matching
- Section detection
- Entity extraction
- Date normalization
- Text normalization

The architecture must, however, provide extension points for future AI capabilities.

---

# 4. Problem Statement

## Candidate Problems

Candidates commonly have to:

- Re-enter information from their resumes.
- Create profiles manually.
- Maintain multiple versions of information.
- Upload documents repeatedly.
- Track applications across systems.

Portal reduces this friction through structured profile creation and resume parsing.

## Recruiter Problems

Recruiters need to:

- Publish jobs.
- Search candidates.
- Review resumes.
- Manage applications.
- Track hiring pipelines.
- Collaborate with recruitment teams.
- Manage documents.
- Monitor hiring performance.

Portal brings these workflows into one system.

## Platform Owner Problems

The platform owner needs:

- Centralized user management.
- Tenant management.
- Monetization.
- Billing.
- Usage controls.
- Parser monitoring.
- Security.
- Analytics.
- Auditability.
- Operational controls.

Master Admin provides this centralized governance layer.

---

# 5. Product Objectives

## Primary Objectives

- Make candidate onboarding fast.
- Automate resume-to-profile data extraction without AI.
- Provide recruiters with a practical ATS-style workflow.
- Provide organizations with controlled recruitment workspaces.
- Provide a powerful Super Admin console.
- Create a configurable monetization engine.
- Create a provider-independent billing architecture.
- Keep document storage secure.
- Maintain strong tenant isolation.
- Build an architecture ready for future scale and AI.

---

# 6. Target Users

## 6.1 Candidate

An individual seeking employment or managing their professional profile.

## 6.2 Recruiter

A recruitment professional managing candidates and jobs.

## 6.3 Organization

A company or recruitment organization employing one or more recruiters.

## 6.4 Organization Administrator

A recruiter/user with permission to manage organization-level settings and members.

## 6.5 Master Admin / Super Admin

The highest privilege platform operator.

---

# 7. User Role Hierarchy

```text
Master Admin / Super Admin
          │
          ├── Platform-wide control
          │
          ├── Organizations
          │      └── Organization Admin
          │              └── Recruiters
          │
          └── Candidates
```

Master Admin has cross-platform authority.

Organization users are tenant-scoped.

Candidates are independent platform users unless explicitly associated with a recruitment workflow.

---

# 8. Master Admin / Super Admin Definition

Master Admin is the **highest-privilege role in Portal**.

The Master Admin has complete operational authority over the application.

## Master Admin Capabilities

### Users

- Create users.
- View users.
- Edit users.
- Activate/deactivate users.
- Suspend accounts.
- Restore accounts.
- Reset access.
- Manage roles.
- View user activity.
- View subscriptions.
- View usage.

### Organizations

- Create organizations.
- Edit organizations.
- Suspend organizations.
- Restore organizations.
- Manage organization administrators.
- View organization usage.
- View organization billing.
- View organization activity.

### Cross-Tenant Access

Master Admin can access data across organizations where required for platform operations.

### Impersonation

Master Admin may impersonate a candidate, recruiter or organization administrator for support/debugging.

Every impersonation must record:

- Admin identity
- Impersonated user
- Start time
- End time
- Reason
- Actions performed

### Emergency Access

Provide a controlled break-glass mechanism for emergency operational actions.

### Platform Configuration

Master Admin can modify:

- Global settings
- Feature flags
- Limits
- Parser configuration
- Storage configuration
- Notification configuration
- Monetization configuration
- Security policies

### System Operations

Master Admin can:

- Monitor background jobs.
- Retry jobs.
- Cancel jobs.
- View system errors.
- Monitor storage.
- Monitor parser activity.
- Monitor application health.

### Data Operations

Where supported:

- Export data.
- Trigger backups.
- Restore approved data.
- Perform administrative cleanup.
- Manage retention.

### Audit

All Master Admin actions must be audited.

Administrative audit records should be protected against ordinary modification.

---

# 9. Candidate Portal

# 9.1 Candidate Onboarding

Candidate onboarding should support:

9.1 Candidate Onboarding
Candidate onboarding should support:

1. Registration.

2. Email verification.

3. Basic information.

4. Resume upload (with a clear data residency acknowledgement, e.g., "Your data will be securely processed and stored in the UK in accordance with UK GDPR").

5. Mandatory, unbundled checkboxes for standard Terms of Service and the Data Processing Agreement (preceded by an itemised DPDP-compliant notice detailing data collection purposes in multiple languages).

6. An optional, unbundled checkbox for future AI Training Consent.

7. Resume parsing.

8. Parsed-data review.

9. Profile creation and completion.

10. Job discovery.

The candidate should be encouraged to use resume parsing as the fastest profile-creation path.

1. Updates to Section 9.1: Candidate Onboarding
   I recommend inserting the following steps into the onboarding flow to ensure consent is captured before any document processing begins:

9.1.4 (Revised): Resume/CV upload with a clear data residency acknowledgement (e.g., "Your data will be securely processed and stored in [Region] in accordance with UK GDPR").

9.1.5 (New): A mandatory, unbundled checkbox for standard Terms of Service and the Data Processing Agreement.

9.1.6 (New): An optional, unbundled checkbox specifically for future AI Training Consent.

2. Proposed Sub-section: 9.2 GDPR & Privacy Mandates
   Add this entirely new sub-section to govern the engineering requirements for candidate data rights:

Explicit Consent Mechanisms: Consent requests must be clear, plain-spoken, and not bundled with other terms. Pre-ticked boxes are strictly prohibited.

Right to Erasure (Right to be Forgotten): The candidate dashboard must include a self-serve "Delete My Account & Data" function. This action must trigger a cascading hard delete of the profile, uploaded documents, and parsed metadata within 30 days, leaving only a pseudonymised audit record of the deletion event.

Data Minimisation: The parser must only extract fields explicitly defined in the schema. Any extraneous sensitive personal data (e.g., medical history or religious beliefs inadvertently included in a CV) must be automatically discarded by the normalisation engine.

3. Proposed Sub-section: 9.3 AI Model Training Consent
   To legally prepare for Phase 3 without violating the MVP's deterministic nature, insert this guidance:

The Consent Copy: > "I agree to allow Sapienworx to securely use my anonymised CV data and manual profile corrections to help improve future automated features."

Revocability: Candidates must be able to toggle this consent on or off at any time via their account settings.

Data Anonymisation Pipeline: If consent is granted, any data flagged for the future Phase 3 training repository must first pass through a redaction step to strip personally identifiable information (PII) such as names, contact details, and precise addresses.

4. Database & Audit Adjustments
   The database schema (specifically users or candidate_profiles) must be updated to include timestamped boolean fields: tos_agreed_at, gdpr_consent_at, and ai_training_consent_at.

## Any modification to these consent states by the candidate must generate an immutable entry in the audit_logs table.

Candidate Onboarding: Expand the onboarding flow to state: "The consent checkbox must be preceded by an itemised DPDP-compliant Notice detailing the specific data points collected and their explicit processing purpose. The UI must support rendering this notice in multiple languages".

---

# 10. Candidate Authentication

Support:

- Registration
- Login
- Logout
- Email verification
- Password reset
- Session management
- Account deactivation
- Account deletion where applicable

Future-ready:

- OAuth
- Social login
- MFA

---

# 11. Candidate Dashboard

Dashboard should display:

- Profile completion percentage
- Resume status
- Resume parsing CTA
- Latest profile activity
- Saved jobs
- Recent applications
- Application statuses
- Notifications
- Recommended actions
- Document status

Primary CTA:

**Complete Your Profile**

Secondary CTA:

**Upload & Parse Resume**

---

# 12. Candidate Profile

Profile sections:

## Personal

- Full name
- Email
- Phone
- Date of birth where legally appropriate and optional
- Location
- Profile photo

## Professional

- Headline
- Summary
- Total experience
- Current employment
- Availability
- Preferred work type

## Experience

- Company
- Role
- Location
- Start date
- End date
- Current position
- Description
- Responsibilities
- Achievements

## Education

- Institution
- Degree
- Field
- Start date
- End date
- Grade/score where applicable

## Skills

- Skill
- Category
- Proficiency
- Years of experience where available

## Certifications

- Certification
- Issuer
- Issue date
- Expiry date
- Credential ID
- Credential URL

## Projects

- Project name
- Description
- Role
- Technologies
- URL
- Dates

## Languages

- Language
- Proficiency

## Links

- LinkedIn
- GitHub
- Portfolio
- Website
- Other links

---

# 13. Profile Creation Through Resume Parsing

Candidate can create a profile primarily through resume parsing.

Profile Creation Through Resume Parsing: Append the following requirement: "The review interface must utilise a split-screen design, displaying the original uploaded document alongside the extracted structured fields to facilitate rapid visual verification".

### Workflow

```text
Candidate uploads resume
        ↓
Parser processes document
        ↓
Structured fields generated
        ↓
Candidate reviews fields
        ↓
Candidate edits fields
        ↓
Candidate confirms
        ↓
Profile is created
```

The parser should populate as much information as reliably extracted.

Missing information should remain editable.

---

# 14. Resume Management

Candidates should be able to:

- Upload resume.
- View resume.
- Download resume.
- Replace resume.
- Parse resume.
- Re-parse resume.
- Maintain resume versions.
- Mark a resume as primary.
- Delete old versions where permitted.

Future support:

- Multiple targeted resumes.
- Job-specific resumes.
- Resume templates.

---

# 15. Resume Parser

## Supported Formats

MVP:

- PDF
- DOCX
- TXT

Future:

- Scanned PDF
- PNG
- JPEG
- Other office formats

## Extraction Targets

- Name
- Email
- Phone
- Location
- Summary
- Skills
- Experience
- Employers
- Job titles
- Employment dates
- Education
- Degrees
- Certifications
- Projects
- Languages
- Achievements
- URLs

---

# 16. Parser Processing Architecture

```text
Upload
  ↓
File Validation
  ↓
Secure Storage
  ↓
Parser Job
  ↓
Text Extraction
  ↓
OCR fallback if necessary
  ↓
Normalization
  ↓
Section Detection
  ↓
Field Extraction
  ↓
Entity Normalization
  ↓
Quality Assessment
  ↓
Structured Result
  ↓
User Review
  ↓
Confirmation
```

Parser jobs should run asynchronously.

Parser Processing Architecture Update the flowchart to explicitly route processing failures: Text Extraction → OCR Fallback → Validation → (If Failed) Route to Dead Letter Queue.

# 17. Parser Quality and Confidence

The parser should provide field-level quality indicators where practical.

For example:

```text
Name             High
Email            High
Phone            High
Experience       Medium
Skills           Medium
Education        High
Certifications   Low
```

These indicators are guidance only.

The system must not represent deterministic extraction as guaranteed accuracy.

---

# 18. Parser Versioning

Parser versions should be tracked.

Each parser result should contain:

- Parser version
- Schema version
- Processing timestamp
- Source document ID
- Processing duration
- Warnings
- Errors

This allows parser improvements without invalidating historical results.

---

# 19. Parser Limits

Usage can be controlled by subscription plan.

Possible limits:

- Number of parses per month
- Maximum file size
- Number of documents
- OCR allowance
- Processing priority

Master Admin can configure these limits.

---

# 20. Recruiter Portal

Recruiter portal should function as the recruitment workspace.

Primary areas:

- Dashboard
- Jobs
- Candidates
- Applications
- Pipeline
- Documents
- Tasks
- Reports
- Organization
- Settings

1. The Recruiter-Facing Privacy Notice (UI Phrasing)
   When a recruiter initiates a "Share Profile" action, they should be presented with a mandatory confirmation modal containing the following copy:

Confidentiality & Data Sharing Notice
By generating this link, you confirm that you have a lawful basis to process and share this candidate's personal data with the intended recipient. This profile contains sensitive information and must only be used for the purpose of evaluating the candidate for this specific role.

Please ensure this action complies with your organisation’s data protection policies and UK GDPR regulations.

They must click a distinct "I Confirm & Share" button to proceed.

2. Technical Safeguards for External Sharing
   To enforce these privacy standards systemically, I recommend adding the following architectural rules to the document:

Time-Limited Access: Shared links must not be permanent. They should automatically expire after a default period (e.g., 7 or 14 days), enforcing the data minimisation principle.

Active Revocation: Recruiters must be provided with a "Revoke Access" control within their application pipeline view, allowing them to instantly invalidate a shared link if sent in error or once the role is filled.

Unauthenticated View Constraints: The external view provided to the hiring manager must be strictly read-only. It should mask highly sensitive background data (such as equal opportunities monitoring information, if collected) unless explicitly toggled on by the recruiter.

Audit Trail: The generation of the external link must create a mandatory record in the audit_logs table. This record must capture the recruiter's ID, the candidate's ID, the timestamp, and the recipient's email address if entered

# 21. Organization Management

Organizations are tenants.

An organization can contain:

- Organization administrator
- Recruiters
- Jobs
- Applications
- Documents
- Usage
- Subscription
- Billing information

---

# 22. Organization Members

Organization administrators can manage permitted members.

Member states:

- Invited
- Active
- Suspended
- Removed

Member permissions should be role-based.

---

# 23. Recruiter Roles

Potential organization-level roles:

### Organization Admin

Can manage organization settings and members.

### Recruiter

Can manage assigned recruitment workflows.

### Hiring Manager

Can review candidates and applications where permitted.

The exact role set can be configurable.

---

# 24. Recruiter Dashboard

Display:

- Active jobs
- Draft jobs
- New applications
- Candidates in screening
- Candidates in interview
- Offers
- Hires
- Recent activity
- Recruitment funnel

Recruiter Dashboard: Append the UI requirements for the Internal Job Card. Add: "Active jobs must be displayed as interactive cards surfacing primary metadata (Title, Department, Status), performance metrics (Total applications, New applications, Screening stage count), and administrative details (Assigned recruiter, Closing date)."

---

# 25. Job Management

Recruiters can:

- Create job.
- Save draft.
- Publish.
- Edit.
- Unpublish.
- Close.
- Archive.
- Duplicate.

Job fields:

- Title
- Description
- Department
- Location
- Work mode
- Employment type
- Experience
- Education
- Required skills
- Preferred skills
- Salary/range where supported
- Number of openings
- Recruiter
- Status
- Dates

## Job Management: Expand the list of actions a recruiter can perform. Add: "Share job (generates a public link for external distribution)."

# 26. Job Lifecycle

```text
Draft
  ↓
Published
  ↓
Active
  ↓
Closed
  ↓
Archived
```

Jobs can be unpublished or reopened according to permissions.

---

# 27. Candidate Discovery

Recruiters can search candidates by:

- Keyword
- Skill
- Experience
- Location
- Education
- Certification
- Application status
- Job association
- Availability where provided

Search should support:

- Sorting
- Pagination
- Filters
- Saved searches in future versions

## Candidate Discovery: Add a subsection titled "Public Job Cards". Define it as: "When a job is shared externally or viewed by a candidate, it must render a public-facing card displaying the Job Title, Location, Work Mode, Employment Type, Salary Range, and the hiring Organisation's branding, alongside a prominent 'Apply' primary CTA."

# 28. Candidate Visibility

Candidate privacy must be respected.

Candidate information should only become available to recruiters according to defined product rules, such as:

- Application to a recruiter's job.
- Candidate explicitly making profile discoverable.
- Organization-approved sourcing workflow.

Master Admin has platform-level access subject to audit/security policies.

---

# 29. Application Management

Application record should contain:

- Candidate
- Job
- Organization
- Current stage
- Recruiter
- Applied date
- Updated date
- Notes
- Activity history
- Documents
- Interview records where supported

---

# 30. Recruitment Pipeline

Default pipeline:

```text
Applied
 ↓
Screening
 ↓
Shortlisted
 ↓
Interview
 ↓
Assessment
 ↓
Offer
 ↓
Hired
```

Alternative terminal states:

- Rejected
- Withdrawn

Organizations may configure additional stages.

---

# 31. Recruitment Activities

Recruiters should be able to record:

- Notes
- Calls
- Emails
- Interviews
- Tasks
- Assessments
- Status changes

Every important application activity should have timestamps and actor information.

---

# 32. Interview Management

MVP foundation should support:

- Interview stage
- Interview date/time
- Interview type
- Interviewer
- Notes
- Status

Future:

- Calendar integration
- Automated scheduling
- Video meeting integration

---

# 33. Recruiter Documents

Recruiters can manage authorized:

- Candidate resumes
- Cover letters
- Recruitment documents
- Offer documents
- Internal recruitment documents

Access must be controlled.

---

# 34. Recruiter Parser

Recruiters can use the shared parser for:

- Resume extraction
- Candidate onboarding
- Recruitment documents
- Structured document extraction

The parser must remain the same shared service used by candidates.

---

# 35. Master Admin Portal

Master Admin is a separate high-security application area.

Primary navigation:

```text
Dashboard
Users
Candidates
Recruiters
Organizations
Jobs
Applications
Documents
Parser
Plans
Monetization
Subscriptions
Billing
Reports
Analytics
Notifications
Security
Audit Logs
System
Settings
Feature Flags
```

---

# 36. Master Admin Dashboard

KPIs:

### Users

- Total users
- New users
- Active users
- Suspended users

### Recruitment

- Organizations
- Recruiters
- Jobs
- Applications
- Hires

### Platform

- Parser jobs
- Documents
- Storage
- Background jobs
- Errors

### Monetization

- Active subscriptions
- MRR/recurring revenue where applicable
- Revenue
- Failed payments
- Trials
- Churn

---

# 37. Master Admin User Management

Features:

- Global search
- Filtering
- User detail
- Role management
- Account status
- Subscription status
- Usage
- Activity
- Documents
- Security events
- Impersonation

---

# 38. Master Admin Organization Management

Features:

- Organization search
- Organization profile
- Members
- Jobs
- Applications
- Documents
- Subscription
- Usage
- Billing
- Activity
- Suspension
- Deactivation

---

# 39. Master Admin Parser Administration

Master Admin can:

- Enable/disable parser functionality.
- Configure file size limits.
- Configure supported formats.
- Configure parser quotas.
- View parser jobs.
- View parser failures.
- View processing duration.
- View parser usage.
- View usage by organization.
- View usage by candidate.
- View usage by recruiter.
- Manage parser versions.
- Configure OCR behavior.
- Retry failed jobs.

This does **not** mean the parser belongs to Admin.

---

# 40. Platform Document Administration

Master Admin can manage authorized platform documents including:

- Invoices
- Generated documents
- Business documents
- Templates
- Operational documents

Document access must be audited.

---

# 41. Monetization Architecture

Monetization is a first-class Master Admin module.

The system should support:

- Free plans
- Paid plans
- Trial plans
- Organization plans
- Candidate plans
- Usage-based pricing
- Feature-based pricing

---

# 42. Plan Configuration

Each plan may define:

- Name
- Description
- Price
- Billing cycle
- Currency
- User type
- Parser quota
- Storage quota
- Job quota
- Recruiter seat quota
- Candidate quota
- Feature access
- Trial period
- Status

---

# 43. Subscription Lifecycle

```text
Trial
 ↓
Active
 ↓
Past Due
 ↓
Suspended
 ↓
Cancelled
```

Plans may also support:

- Upgrade
- Downgrade
- Renewal
- Grace periods

---

# 44. Billing

Billing module should include:

- Customers
- Payment methods where supported
- Subscriptions
- Invoices
- Payments
- Failed payments
- Refunds
- Credits
- Billing history

Payment provider must be abstracted.

---

# 45. Usage-Based Limits

Track:

- Parser usage
- Storage
- Jobs
- Seats
- Documents
- Candidate records

Usage should be recorded independently from pricing.

---

# 46. Invoice Management

Invoices should support:

- Invoice number
- Customer
- Organization/user
- Billing period
- Line items
- Taxes where applicable
- Discounts
- Total
- Currency
- Status
- PDF/document reference
- Payment status

The shared parser may be used for authorized invoice/document extraction workflows.

---

# 47. Notifications

Notification channels:

- In-app
- Email

Notification categories:

- Account
- Security
- Application
- Recruitment
- Billing
- Subscription
- System

Users should be able to manage notification preferences where appropriate.

---

# 48. Notification Templates

Templates should support:

- Event
- Subject
- Body
- Variables
- Status
- Version

Master Admin can manage system templates.

---

# 49. Search

Portal requires separate search domains:

### Candidate Search

Recruiter-oriented.

### Job Search

Candidate-oriented.

### Admin Search

Global administrative search.

Search should support:

- Keyword
- Filters
- Sorting
- Pagination
- Indexing

---

# 50. Analytics

## Candidate Analytics

Potential:

- Applications
- Profile completion
- Application status

## Recruiter Analytics

- Jobs
- Applications
- Pipeline
- Conversion
- Hiring

## Organization Analytics

- Recruiter performance
- Jobs
- Candidates
- Hiring funnel

## Master Admin Analytics

- Users
- Organizations
- Revenue
- Subscriptions
- Parser
- Storage
- Platform activity

---

# 51. Reporting

Reports should be exportable where authorized.

Potential exports:

- Users
- Organizations
- Jobs
- Applications
- Parser usage
- Billing
- Subscriptions
- Revenue
- Audit records

Export permissions must be strictly controlled.

---

# 52. Document Management Architecture

Document service must support:

- Upload
- Download
- Preview where supported
- Metadata
- Versioning
- Access control
- Retention
- Deletion
- Storage lifecycle

Storage:

**Object storage**

Metadata:

**PostgreSQL**

## Document Management Architecture: Append requirements for automatic object lifecycle management, quarantine stages, and retention rules split between personal CVs and statutory financial documents.

Document Management Architecture: Append the requirement that document metadata must explicitly track the malware scan status (e.g., pending, clean, quarantined) and maintain strict tenant association for every file.

# 53. Security Architecture

## Authentication

- Secure password hashing
- Secure sessions/tokens
- Email verification
- Password reset
- Rate limiting

## Authorization

- RBAC
- Resource-level authorization
- Tenant isolation
- Backend enforcement

## Files

- MIME validation
- File-size limits
- Extension validation
- Malware/security scanning where available
- Private storage

## Security Architecture (Files): Add magic byte inspection, automated virus scanning, and bucket-level server-side encryption to the file security checklist.

# 54. Master Admin Security

Because Master Admin has exceptional privileges:

- MFA-ready architecture is required.
- Sensitive actions should require additional confirmation.
- Impersonation must be audited.
- Break-glass actions must be audited.
- Data exports must be audited.
- Security configuration changes must be audited.
- Destructive actions should require confirmation.

---

# 55. Audit Logging

Audit every sensitive action.

Audit record:

```text
ID
Actor
Actor Role
Action
Target Type
Target ID
Timestamp
IP
User Agent
Impersonation Context
Metadata
```

Audit logs should be append-oriented.

If Master Admin can correct/remove audit information, that action must itself create a higher-level audit record.

---

# 56. Data Privacy

Candidate data should not be publicly exposed by default.

Documents must be private.

Access should be granted according to:

- Candidate settings
- Application relationships
- Organization permissions
- Admin authorization

## Data Privacy: Rename this section to "Data Privacy, DPDP, & GDPR Compliance". Append the following requirements: "The platform must maintain a dedicated Data Principal Rights dashboard allowing users to access, correct, and erase their data". "Candidates must be provided with a 'Right to Nominate' feature within their account settings to appoint a legal nominee for their data". "A Grievance Redressal workflow must be integrated into the candidate and recruiter portals, ensuring queries are routed directly to the Data Protection Officer"

# 57. Data Retention

The system should support configurable retention policies for:

- User accounts
- Applications
- Documents
- Parser results
- Audit logs
- Billing records

Master Admin can configure retention policies where legally and technically appropriate.

---

# 58. Background Job System

Use background jobs for:

- Parser processing
- OCR
- Document processing
- Email
- Notifications
- Reports
- Billing synchronization
- Cleanup jobs

Job states:

```text
Queued
Processing
Completed
Failed
Cancelled
Retrying
```

Background Job System Add: "Queue Segregation: Implement distinct queue priorities to ensure candidate onboarding parses are prioritised over bulk recruiter uploads."Add: "Tenant Rate Limiting: Enforce concurrency limits to guarantee fair distribution of computational resources across all active organisations."

---

# 59. System Health

Master Admin should be able to monitor:

- API health
- Database health
- Queue health
- Parser health
- Storage health
- Email service
- Billing service
- Error rate
- Processing latency

---

# 60. Platform Configuration

Master Admin can configure:

- Platform name
- Branding
- File limits
- Parser settings
- Storage limits
- Notification settings
- Email configuration
- Security configuration
- Default settings
- Feature flags
- Maintenance mode

---

# 61. Feature Flags

Feature flags should support:

- Global enable/disable
- Role-specific availability
- Organization-specific availability
- Gradual rollout where required

Examples:

- New parser version
- New billing feature
- New recruiter feature

---

# 62. API Architecture

Suggested domains:

```text
/auth
/users
/candidates
/recruiters
/organizations
/jobs
/applications
/documents
/parser
/notifications
/search
/plans
/subscriptions
/usage
/billing
/reports
/admin
/audit
/system
```

Every API endpoint requires:

- Authentication definition
- Authorization definition
- Validation
- Error handling
- Consistent response structure
- Pagination where appropriate

---

# 63. Database

Recommended database:

**PostgreSQL**

Core entities:

```text
users
roles
permissions
role_permissions
organizations
organization_members
candidate_profiles
candidate_experiences
candidate_education
candidate_skills
candidate_certifications
candidate_projects
candidate_languages
candidate_links
resumes
documents
parser_jobs
parser_results
jobs
job_skills
applications
application_stages
application_activities
interviews
notes
notifications
notification_templates
plans
plan_features
subscriptions
usage_records
invoices
invoice_items
payments
audit_logs
platform_settings
feature_flags
background_jobs
```

Use foreign keys, indexes, constraints and migrations.

## Database: Under the "Core entities" list, insert organization_storage_usage to ensure the platform formally tracks tenant storage quotas asynchronously.

# 64. Storage

S3-compatible object storage should store:

- Resumes
- Documents
- Generated PDFs
- Invoices
- Other binary files

Database stores metadata.

Files should never be exposed through unrestricted public URLs.

---

# 65. Recommended Technology Stack

## Frontend

- TypeScript
- React / Next.js or equivalent
- Modern component architecture
- Responsive design

## Backend

- Node.js
- TypeScript
- NestJS/Fastify/Express or equivalent

## Database

- PostgreSQL

## Queue/Cache

- Redis

## Storage

- AWS S3 or S3-compatible storage

## Parser

Open-source PDF/DOCX/OCR/text-processing libraries.

## Deployment

Containerized deployment should be supported.

---

# 66. Cost Optimization Principles

The initial system should prioritize low operating cost.

Use open-source technologies wherever practical.

Avoid unnecessary:

- AI API calls
- Proprietary parsing services
- Proprietary search engines
- Proprietary document processing
- Excessive microservices

The architecture should begin modular but not unnecessarily distributed.

A modular monolith plus workers is acceptable for MVP.

---

# 67. Scalability

The system should be designed so that:

- Parser workers can scale independently.
- Background workers can scale independently.
- API servers can scale horizontally.
- Storage scales independently.
- Database can be optimized/indexed as usage grows.

Do not introduce microservices solely for architectural appearance.

---

# 68. Performance Requirements

Target:

- Fast authentication.
- Fast dashboard rendering.
- Paginated large datasets.
- Asynchronous parser processing.
- Efficient database queries.
- Optimized file upload.
- Background document processing.

Parser processing time should be tracked.

---

# 69. Accessibility

Support:

- Keyboard navigation
- Semantic HTML
- Accessible forms
- Clear labels
- Accessible error messages
- Focus management
- Accessible dialogs
- Responsive design
- Adequate contrast

---

# 70. Error Handling

Errors should be categorized.

### User errors

- Invalid login
- Invalid form
- Unsupported file
- File too large

### Processing errors

- Parser failure
- OCR failure
- Background job failure
- Document processing failure

### System errors

- Database unavailable
- Storage unavailable
- External billing failure

Users should receive understandable messages while detailed technical information goes to logs.

---

# 71. Testing Strategy

## Unit

Test business logic independently.

## Integration

Test module interactions.

## End-to-End

Test complete user journeys.

Critical journeys:

### Candidate

```text
Register
→ Upload Resume
→ Parse
→ Review
→ Confirm
→ Profile Created
→ Search Job
→ Apply
→ Track Application
```

### Recruiter

```text
Register
→ Create Organization
→ Create Job
→ Publish
→ Receive Application
→ Screen
→ Interview
→ Offer
→ Hire
```

### Master Admin

```text
Login
→ Dashboard
→ Manage User
→ Manage Organization
→ Configure Plan
→ Review Billing
→ Monitor Parser
→ Review Audit
```

---

# 72. Backup and Recovery

Implement:

- Database backups
- Storage durability
- Backup monitoring
- Recovery documentation
- Disaster recovery strategy

Master Admin should have access to approved backup/recovery controls without exposing raw infrastructure credentials.

---

# 73. Deployment Environments

Maintain:

1. Development
2. Staging
3. Production

Configuration must be environment-specific.

Secrets must never be committed to source control.

---

# 74. Observability

Implement:

- Structured logs
- Error monitoring
- Health checks
- Metrics
- Background job monitoring
- Parser metrics
- Billing event logging
- Audit logs

Never log sensitive credentials.

---

# 75. MVP Definition

## Candidate

Must have:

- Registration
- Login
- Profile
- Resume upload
- Resume parsing
- Parsed-data review
- Profile population
- Job search
- Job application
- Application tracking
- Documents
- Notifications

## Recruiter

Must have:

- Registration
- Organization
- Organization membership
- Jobs
- Candidate search
- Applications
- Pipeline
- Candidate viewing
- Documents
- Parser

## Master Admin

Must have:

- Dashboard
- Users
- Candidates
- Recruiters
- Organizations
- RBAC
- Parser administration
- Documents
- Plans
- Monetization
- Billing foundation
- Usage
- Reports
- Notifications
- Audit logs
- Settings
- Feature flags

---

# 76. Phase 2

Potential features:

- Multiple resumes
- Resume templates
- Saved jobs
- Saved searches
- Advanced recruiter workflows
- Interview scheduling
- Calendar integration
- Advanced analytics
- Organization-level reports
- Coupons
- Discounts
- Advanced subscription management
- Bulk operations

---

# 77. Phase 3

Potential features:

- AI-assisted parsing
- Semantic candidate search
- Candidate-job matching
- AI-assisted job descriptions
- AI interview assistance
- Automated recommendations
- External ATS integrations
- Enterprise SSO
- Mobile applications
- Advanced workflow automation

---

# 78. Future AI Architecture

Future AI must be implemented as an optional service layer.

Example:

```text
                Shared Parser
                     │
          ┌──────────┴──────────┐
          │                     │
 Deterministic Parser      AI Enhancement
          │                     │
          └──────────┬──────────┘
                     ↓
             Normalized Schema
```

AI should enhance the parser rather than make the entire platform dependent on it.

Future AI Architecture Add: "Shadow Testing Capability: The platform must support running the future AI enhancement concurrently with the deterministic parser to compare accuracy silently before production cutover".

# 79. Business Rules

## Candidate

- Candidate owns their profile.
- Candidate controls permitted profile visibility.
- Candidate must review parser output.
- Existing profile data must not be silently overwritten.

## Recruiter

- Recruiter access is organization-scoped.
- Recruiter can only access permitted candidates.
- Recruiter can only manage permitted jobs/applications.

## Organization

- Organization owns organization-level recruitment data.
- Organization subscription controls applicable limits.

## Master Admin

- Master Admin has cross-platform authority.
- Sensitive actions are audited.
- Impersonation is audited.
- Emergency actions are audited.

---

# 80. Subscription Business Rules

When a subscription reaches a limit:

- New usage should be blocked or restricted according to plan rules.
- Existing data should remain accessible.
- Users should receive a clear explanation.
- Upgrade options should be presented where applicable.

Subscription expiration must not automatically delete user data.

---

# 81. Data Export

Authorized users should be able to export permitted information.

Candidate exports may include:

- Profile
- Resume
- Applications
- Documents

Recruiter exports may include:

- Jobs
- Applications
- Candidate information they are authorized to access

Master Admin may perform system-wide exports subject to audit/security controls.

---

# 82. Account Deletion

Candidate deletion should support:

- Confirmation.
- Authentication verification.
- Data retention rules.
- Document handling.
- Application handling.
- Audit requirements.

System records required for legal/billing/audit purposes may need to be retained according to policy.

---

# 83. UX Design Principles

Portal should have:

- Professional recruitment-oriented design.
- Clear hierarchy.
- Minimal unnecessary complexity.
- Consistent navigation.
- Clear actions.
- Responsive components.
- Accessible forms.
- Strong empty states.
- Clear errors.
- Clear success feedback.

## UX Design Principles: Expand the "Strong empty states" bullet point to read: "Strong empty states that always include an actionable primary CTA to guide the user to their next logical step".

# 84. Candidate UX Principle

The candidate should not need to manually fill dozens of profile fields before seeing value.

Preferred experience:

**Resume first → Parse → Review → Profile created → Improve profile**

---

# 85. Recruiter UX Principle

The recruiter should be able to move from:

**Job → Candidates → Application → Screening → Interview → Offer → Hire**

with minimal navigation friction.

Recruiter UX Principle: Add the following sentence: "The core recruitment pipeline—specifically reviewing applications, changing candidate stages, and adding notes—must be fully functional and optimised for mobile devices".

---

# 86. Master Admin UX Principle

Master Admin should be able to understand platform health quickly.

The dashboard should answer:

- How many users?
- How many organizations?
- How many jobs?
- How many applications?
- How much revenue?
- How many active subscriptions?
- How much parser usage?
- How much storage?
- Are there system problems?
- What happened recently?

---

# 87. Acceptance Criteria

The product is MVP-ready when:

### Platform

- Authentication works.
- RBAC works.
- Tenant isolation works.
- Documents are secure.
- Background processing works.
- Audit logging works.

### Candidate

- Registration works.
- Profile creation works.
- Resume upload works.
- Parser works without AI.
- Parsed data can be reviewed.
- Parsed data can be edited.
- Confirmed data populates profile.
- Jobs can be searched.
- Applications can be submitted.
- Applications can be tracked.

### Recruiter

- Organization can be created.
- Recruiters can join organizations.
- Jobs can be created.
- Jobs can be published.
- Candidates can apply.
- Applications can be managed.
- Pipeline works.
- Candidate search works.
- Parser works where authorized.

### Master Admin

- Users can be managed.
- Organizations can be managed.
- Roles can be managed.
- Cross-tenant visibility works.
- Impersonation works and is audited.
- Parser can be monitored/configured.
- Plans can be created.
- Monetization can be configured.
- Billing foundation works.
- Usage is tracked.
- Reports work.
- Audit logs work.
- System settings work.
- Feature flags work.

---

# 88. Final Product Architecture

```text
                         PORTAL
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   CANDIDATE           RECRUITER        MASTER ADMIN
     PORTAL               PORTAL         / SUPER ADMIN
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                  SHARED PLATFORM
                      SERVICES
                           │
       ┌───────────┬───────┼────────┬────────────┐
       │           │       │        │            │
       ▼           ▼       ▼        ▼            ▼
    Parser      Documents Search Notifications Billing
       │           │       │        │            │
       └───────────┴───────┼────────┴────────────┘
                           │
                    Platform Core
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
         PostgreSQL      Redis       Object Storage
```

---

# 89. Final Product Principles

The following principles are mandatory:

1. **Portal is the complete product, not just a parser.**
2. **Candidate, Recruiter and Master Admin are separate experiences built on a shared platform.**
3. **Master Admin is the Super Admin and has the highest platform privileges.**
4. **The parser is a shared platform service, not an Admin-only feature.**
5. **Candidate resume parsing is one of the most important MVP workflows.**
6. **Candidate profile creation can primarily happen through resume parsing.**
7. **Parser MVP must not depend on AI.**
8. **All parsed information must be reviewable before becoming authoritative profile data.**
9. **Recruiters are tenant-scoped.**
10. **Organization data must be isolated.**
11. **Master Admin has cross-tenant operational authority.**
12. **Master Admin actions must be strongly audited.**
13. **Documents are private by default.**
14. **Monetization and billing belong under Master Admin governance.**
15. **Usage metering must be independent of pricing rules.**
16. **The architecture must remain ready for future AI.**
17. **The platform should prioritize open-source and cost-efficient technologies.**
18. **Security must be enforced server-side.**
19. **Expensive document processing should be asynchronous.**
20. **The MVP should be modular, reliable and extensible rather than unnecessarily complex.**

---

# 90. Definition of Done

Portal is considered ready for MVP release only when the following end-to-end experience works:

```text
CANDIDATE

Register
   ↓
Upload Resume
   ↓
Parse Resume
   ↓
Review Extracted Information
   ↓
Edit / Confirm
   ↓
Profile Created
   ↓
Search Jobs
   ↓
Apply
   ↓
Track Application


RECRUITER

Register
   ↓
Create / Join Organization
   ↓
Create Job
   ↓
Publish Job
   ↓
Receive Applications
   ↓
Review Candidates
   ↓
Screen
   ↓
Interview
   ↓
Offer
   ↓
Hire


MASTER ADMIN

Login
   ↓
Platform Dashboard
   ↓
Manage Users
   ↓
Manage Organizations
   ↓
Manage Roles
   ↓
Monitor Parser
   ↓
Manage Plans
   ↓
Manage Monetization
   ↓
Manage Billing
   ↓
Review Analytics
   ↓
Review Audit Logs
   ↓
Manage Platform Configuration
```

The implementation must preserve the separation between **shared platform services** and **role-specific interfaces**, with the parser remaining a shared capability throughout the product lifecycle.
