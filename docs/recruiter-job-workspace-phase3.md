# Recruiter Job Workspace — Phase 3

Status: implementation branch `RecruiterJobWorkspace`; review only.

## Goal

Turn recruiter job management into a compact, table-first operating workspace while preserving mobile usability and the existing create/edit/status/share/applicant workflows.

SapienWorx remains cross-industry. Role/function choices cover healthcare, finance, HR, operations, sales, marketing, technology, product, design, manufacturing, logistics, hospitality, education, construction, legal, retail and other domains.

## First slice

- server-side recruiter job search and filters
- status, employment type, work mode, role/function and closing-soon filters
- stable URL state and pagination
- sorting by recent update, application volume, creation date or deadline
- organization-wide summary counts independent of the active filter
- compact table-first desktop workspace
- mobile job cards preserving all primary actions
- immutable job references retained throughout the workspace
- expanded cross-industry role categories in the job builder
- existing applicant, edit, preview, share and status controls preserved

## Boundaries

This slice does not redesign recruiter candidate discovery, Sapien Signal, outreach or the application pipeline. Those remain separate workstreams.
