import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Alert, Spinner, ErrorBanner } from '@/components/ui';
import { useGetUser, useUpdateUser } from '@/hooks/useAdmin';
import { ArrowLeft } from 'lucide-react';
import type { UserRole } from '@/types';

const schema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').optional(),
  role: z.enum(['user', 'admin']).optional(),
  isActive: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

export default function UserEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: user, isLoading } = useGetUser(id!);
  const updateUser = useUpdateUser();
  const [success, setSuccess] = useState(false);

  const {
    register: reg,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: user
      ? {
          fullName: user.fullName,
          role: user.role as UserRole,
          isActive: user.isActive,
        }
      : undefined,
  });

  const isActive = watch('isActive');

  const onSubmit = (data: FormData) => {
    setSuccess(false);
    updateUser.mutate(
      { id: id!, data },
      {
        onSuccess: () => {
          setSuccess(true);
          navigate(`/admin/users/${id}`);
        },
      },
    );
  };

  if (isLoading || !user) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/admin/users/${id}`} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit User</h1>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Edit {user.fullName}</CardTitle>
        </CardHeader>
        <CardContent>
          {success && <Alert variant="success" className="mb-4">User updated successfully</Alert>}
          {updateUser.isError && (
            <ErrorBanner error={updateUser.error} />
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Full Name"
              id="fullName"
              placeholder="Full name"
              error={errors.fullName?.message}
              {...reg('fullName')}
            />

            <div className="space-y-1">
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">Role</label>
              <select
                id="role"
                {...reg('role')}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              {errors.role && <p className="text-sm text-danger-600">{errors.role.message}</p>}
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isActive"
                {...reg('isActive')}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Account Active {isActive !== undefined && <span className="text-gray-500">({isActive ? 'Currently active' : 'Currently inactive'})</span>}
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Link to={`/admin/users/${id}`}>
                <Button variant="secondary" type="button">Cancel</Button>
              </Link>
              <Button type="submit" loading={updateUser.isPending}>Save Changes</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}