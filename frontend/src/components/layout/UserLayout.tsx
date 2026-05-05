import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router';
import { useAuthStore } from '@/stores/auth.store';
import { getInitials } from '@/lib/utils';
import { User, LogOut, ChevronDown } from 'lucide-react';

export function UserLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [profileDropdown, setProfileDropdown] = useState(false);

  const handleLogout = () => {
    const refreshToken = localStorage.getItem('refreshToken');
    logout();
    navigate('/login');
    if (refreshToken) {
      import('@/api/auth.api').then(({ authApi }) =>
        authApi.logout(refreshToken).catch(() => {}),
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-bold">H</span>
              </div>
              <span className="font-semibold text-gray-900">Hackathon</span>
            </Link>

            {/* Profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdown(!profileDropdown)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {user?.image ? (
                  <img src={user.image} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-medium">
                    {user ? getInitials(user.fullName) : '?'}
                  </div>
                )}
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </button>
              {profileDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileDropdown(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg border border-gray-200 shadow-lg z-50 py-1">
                    <Link
                      to="/dashboard"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => setProfileDropdown(false)}
                    >
                      <User className="inline h-4 w-4 mr-2" />
                      Profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-danger-600 hover:bg-gray-50"
                    >
                      <LogOut className="inline h-4 w-4 mr-2" />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}