import { Suspense } from "react";
import { SearchResultsV2 } from "../../../components/search-results-v2";

export default function SearchResultsPage() {
  return <Suspense fallback={null}><SearchResultsV2 /></Suspense>;
}
