import { redirect } from 'next/navigation';

export default function LegacyBranchesPage({ params }: { params: { centerSlug: string } }) {
  redirect(`/center/${encodeURIComponent(params.centerSlug)}/branches-list`);
}
