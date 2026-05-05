import { Link } from 'react-router';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import { useProfile } from '@/hooks/useUser';
import { formatDate, getInitials } from '@/lib/utils';
import { Shield, Mail, Calendar, CheckCircle, XCircle, User, Lock } from 'lucide-react';
import { Spinner, ErrorBanner } from '@/components/ui';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: profile, isLoading, isError, error } = useProfile();

  if (isError) {
    return <ErrorBanner error={error} />;
  }

  if (isLoading || !profile) {
    return <Spinner />;
  }

  const stats = [
    { label: 'Email Verified', value: profile.isVerified ? 'Yes' : 'No', icon: CheckCircle, variant: profile.isVerified ? 'success' as const : 'warning' as const },
    { label: 'MFA Enabled', value: profile.mfaEnabled ? 'Yes' : 'No', icon: Shield, variant: profile.mfaEnabled ? 'success' as const : 'warning' as const },
    { label: 'Account Active', value: profile.isActive ? 'Yes' : 'No', icon: profile.isActive ? CheckCircle : XCircle, variant: profile.isActive ? 'success' as const : 'danger' as const },
    { label: 'Last Login', value: formatDate(profile.lastLogin), icon: Calendar, variant: 'default' as const },
  ];

  const quickActions = [
    { label: 'Profile', description: 'View and edit your personal information', path: '/profile', icon: User },
    { label: 'Security', description: 'Manage 2FA and security settings', path: '/security', icon: Shield },
    { label: 'Change Password', description: 'Update your account password', path: '/profile/password', icon: Lock },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.fullName?.split(' ')[0]}
        </h1>
        <p className="text-gray-500 mt-1">Here's an overview of your account</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile card */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {profile.image ? (
                <img src={profile.image} alt="" className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <div className="h-16 w-16 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xl font-semibold">
                  {getInitials(profile.fullName)}
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{profile.fullName}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Mail className="h-4 w-4" />
                  {profile.email}
                </div>
                <Badge variant={profile.role === 'admin' ? 'info' : 'default'} className="mt-1">
                  {profile.role}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats card */}
        <Card>
          <CardHeader>
            <CardTitle>Account Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.map((stat) => (
                <div key={stat.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <stat.icon className="h-4 w-4" />
                    {stat.label}
                  </div>
                  <Badge variant={stat.variant}>{stat.value}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.path}
              to={action.path}
              className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-primary-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center group-hover:bg-primary-100 transition-colors">
                  <action.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 group-hover:text-primary-700 transition-colors">{action.label}</h3>
                  <p className="text-sm text-gray-500">{action.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
