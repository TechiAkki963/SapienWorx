import { Suspense } from "react";
import { SearchResultsV3 } from "../../../components/search-results-v3";

export default function SearchResultsPage() {
  return <Suspense fallback={null}><SearchResultsV3 /></Suspense>;
}
