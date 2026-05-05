import { useParams, Link } from 'react-router';
import { useGetUser } from '@/hooks/useAdmin';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Spinner } from '@/components/ui';
import { ErrorBanner } from '@/components/ui';
import { formatDate, getInitials } from '@/lib/utils';
import { ArrowLeft, Edit2, Mail, Shield, Calendar, CheckCircle, XCircle, Key } from 'lucide-react';

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: user, isLoading, isError, error } = useGetUser(id!);

  if (isError) {
    return <ErrorBanner error={error} />;
  }

  if (isLoading || !user) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  const details = [
    { label: 'Email', value: user.email, icon: Mail },
    { label: 'Role', value: user.role, icon: Shield },
    { label: 'Created', value: formatDate(user.createdAt), icon: Calendar },
    { label: 'Last Login', value: formatDate(user.lastLogin), icon: Calendar },
    { label: 'Email Verified', value: user.isVerified ? 'Yes' : 'No', icon: user.isVerified ? CheckCircle : XCircle },
    { label: 'MFA Enabled', value: user.mfaEnabled ? 'Yes' : 'No', icon: Key },
    { label: 'Active', value: user.isActive ? 'Yes' : 'No', icon: user.isActive ? CheckCircle : XCircle },
    { label: 'Locked Until', value: user.lockedUntil ? formatDate(user.lockedUntil) : 'Not locked', icon: XCircle },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/admin/users" className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">User Details</h1>
        </div>
        <Link to={`/admin/users/${user.id}/edit`}>
          <Button><Edit2 className="h-4 w-4 mr-2" />Edit</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile card */}
        <Card>
          <CardContent className="flex flex-col items-center py-8">
            {user.image ? (
              <img src={user.image} alt="" className="h-24 w-24 rounded-full object-cover mb-4" />
            ) : (
              <div className="h-24 w-24 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-semibold mb-4">
                {getInitials(user.fullName)}
              </div>
            )}
            <h2 className="text-lg font-semibold text-gray-900">{user.fullName}</h2>
            <p className="text-sm text-gray-500">{user.email}</p>
            <div className="flex gap-2 mt-3">
              <Badge variant={user.role === 'admin' ? 'info' : 'default'}>{user.role}</Badge>
              <Badge variant={user.isActive ? 'success' : 'danger'}>{user.isActive ? 'Active' : 'Inactive'}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              {details.map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <dt className="flex items-center gap-2 text-sm text-gray-500">
                    <Icon className="h-4 w-4" />
                    {label}
                  </dt>
                  <dd className="text-sm font-medium text-gray-900">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}