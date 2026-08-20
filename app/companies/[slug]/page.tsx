import { CompanyJobsPage, companySlugs } from "../../../components/public-site";

export function generateStaticParams() {
  return companySlugs.map((slug) => ({ slug }));
}

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CompanyJobsPage slug={slug} />;
}
