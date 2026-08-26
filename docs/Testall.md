# Master Architecture Prompt: Candidate Search Results UI

**Objective:** Build the `/search/results` Next.js page. This interface must consume the paginated JSON response from the backend search API and render it in a high-density, two-column layout. The design must heavily prioritise keyword highlighting and bulk communication actions.

## 1. Page Layout & Search Context

The page must utilise a standard two-column grid.

- **Top Context Bar:** A horizontal strip at the very top displaying the active search parameters as pill-shaped tags (e.g., `Keywords: Customer Success`, `Location: Chennai`). Include a prominent **"Modify"** text link that navigates the user back to the advanced search form, preserving their previous inputs in the state.
- **Left Sidebar (Refinement Filters):** A narrow, sticky left column containing quick-access facet filters (e.g., checkboxes for 'Active in last 15 days', 'Notice Period', 'Salary ranges'). Changing these must trigger an immediate re-fetch of the results.
- **Main Feed (Right Column):** The wider column housing the bulk action bar and the vertical list of candidate cards.

## 2. The Bulk Action Bar (Sticky)

Immediately above the candidate list, implement a sticky horizontal bar that remains visible as the user scrolls down the page.

- **Selection Controls:** A master checkbox to "Select all candidates on this page".
- **Pagination & Sorting:** Dropdowns to adjust "Sort by: Relevance / Date" and "Show: 40 per page".
- **Primary Action (Send Email):** A solid blue button (using the primary Brand Blue `#144A75`) labelled **"Send Email"**. This button must track how many candidates are selected. When clicked, it opens the bulk-messaging modal which will dispatch the payloads to our Spring Mail RabbitMQ queue.

## 3. The Candidate Result Card (`CandidateResultCard.tsx`)

Each candidate in the list must be rendered using a highly structured, bordered card component to ensure uniform spacing.

- **Left Edge:** A checkbox for individual selection.
- **Header:** The candidate's full name (bold, primary text colour).
- **Avatar:** A small circular profile photo on the far right (or a placeholder initial if none exists).
- **Core Meta Data Row:** Three distinct data points separated by vertical dividers (`|`): Total Experience, Current Salary, and Current Location.
- **Professional Summary:** Below the meta row, display two lines:
  - _Line 1:_ Current Job Title at Current Company.
  - _Line 2:_ Highest Education Degree & Institute.
- **Action Footer:** Small, secondary text links at the bottom right of the card for "Download CV" and "Save Candidate". Add a timestamp for "Last active" or "Profile updated".

## 4. Text Highlighting Engine (Critical UX)

To help recruiters scan results instantly, the frontend must dynamically highlight the exact boolean keywords they searched for.

- **Implementation:** Create a custom React hook or utility function (e.g., `useKeywordHighlight`) that accepts the raw text snippet and an array of the searched keywords.
- **Rendering:** Use regular expressions to find matches (case-insensitive) and wrap those specific words in a HTML `<mark>` tag.
- **Styling:** Apply a vivid yellow background to the `<mark>` tag (e.g., `bg-yellow-200 text-black`) to mimic a physical highlighter pen across the 'Key Skills' and 'Current Role' text strings.
