import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';

export default function NotFoundPage({ what = 'Page' }: { what?: string }) {
  return (
    <EmptyState title={`${what} not found`} action={<Link to="/" className="btn-secondary">Back to Overview</Link>}>
      The address may be mistyped, or the item may have been renamed or deleted.
    </EmptyState>
  );
}
