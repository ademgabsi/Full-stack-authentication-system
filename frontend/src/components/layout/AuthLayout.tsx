import { Outlet } from 'react-router';
import { Link } from 'react-router';
import { Shell } from 'lucide-react';

export function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <Shell className="h-8 w-8 text-primary-600" />
            <span className="text-2xl font-bold text-gray-900">Hackathon</span>
          </Link>
        </div>
        <Outlet />
      </div>
    </div>
  );
}