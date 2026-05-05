import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/api/admin.api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { ErrorBanner } from '@/components/ui';
import { Users, UserCheck, UserX, Shield } from 'lucide-react';

export default function AdminOverview() {
  const { data: usersData, isError, error } = useQuery({
    queryKey: ['admin', 'users', { page: 1, limit: 25 }],
    queryFn: () => adminApi.listUsers({ page: 1, limit: 25 }),
  });

  if (isError) {
    return <ErrorBanner error={error} />;
  }

  const users = usersData?.users ?? [];
  const totalUsers = usersData?.total ?? 0;
  const activeUsers = users.filter((u) => u.isActive).length;
  const adminUsers = users.filter((u) => u.role === 'admin').length;

  const stats = [
    { label: 'Total Users', value: totalUsers, icon: Users, color: 'bg-primary-50 text-primary-600' },
    { label: 'Active Users', value: activeUsers, icon: UserCheck, color: 'bg-success-50 text-success-600' },
    { label: 'Inactive Users', value: totalUsers - activeUsers, icon: UserX, color: 'bg-danger-50 text-danger-600' },
    { label: 'Admins', value: adminUsers, icon: Shield, color: 'bg-warning-50 text-warning-600' },
  ];

  const recentUsers = users.slice(0, 5);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Users</CardTitle>
        </CardHeader>
        <CardContent>
          {recentUsers.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No users yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{user.fullName}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{user.email}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          user.role === 'admin' ? 'bg-primary-50 text-primary-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          user.isActive ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700'
                        }`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}