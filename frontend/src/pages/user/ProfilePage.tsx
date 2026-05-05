import { useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Alert, ErrorBanner } from '@/components/ui';
import { useProfile, useUpdateProfile, useUploadImage } from '@/hooks/useUser';
import { getInitials } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { ArrowLeft, Camera, Loader2 } from 'lucide-react';

const schema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').optional(),
  email: z.string().email('Invalid email').optional(),
});

type FormData = z.infer<typeof schema>;

export default function ProfilePage() {
  const setUser = useAuthStore((s) => s.setUser);
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const uploadImage = useUploadImage();
  const [successMessage, setSuccessMessage] = useState('');

  const {
    register: reg,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: profile?.fullName ?? '',
      email: profile?.email ?? '',
    },
    values: profile ? { fullName: profile.fullName, email: profile.email } : undefined,
  });

  const onSubmit = (data: FormData) => {
    setSuccessMessage('');
    updateProfile.mutate(data, {
      onSuccess: (updated) => {
        setUser(updated as any);
        setSuccessMessage('Profile updated successfully');
      },
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadImage.mutate(file, {
      onSuccess: (data) => {
        if (profile) {
          setUser({ ...profile, image: data.image } as any);
        }
      },
    });
  };

  if (isLoading || !profile) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary-600" /></div>;
  }

  return (
    <div>
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>

      {successMessage && (
        <Alert variant="success" className="mb-4">{successMessage}</Alert>
      )}
      {updateProfile.isError && (
        <ErrorBanner error={updateProfile.error} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avatar */}
        <Card>
          <CardContent className="flex flex-col items-center py-8">
            <div className="relative">
              {profile.image ? (
                <img src={profile.image} alt="" className="h-24 w-24 rounded-full object-cover" />
              ) : (
                <div className="h-24 w-24 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-semibold">
                  {getInitials(profile.fullName)}
                </div>
              )}
              <label className="absolute bottom-0 right-0 h-8 w-8 bg-primary-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-primary-700 transition-colors shadow-sm">
                <Camera className="h-4 w-4 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </label>
              {uploadImage.isPending && (
                <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              )}
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">{profile.fullName}</h3>
            <p className="text-sm text-gray-500">{profile.email}</p>
          </CardContent>
        </Card>

        {/* Edit form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Edit Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Full Name"
                id="fullName"
                placeholder="Your name"
                error={errors.fullName?.message}
                {...reg('fullName')}
              />
              <Input
                label="Email"
                id="email"
                type="email"
                placeholder="your@email.com"
                error={errors.email?.message}
                {...reg('email')}
              />
              <div className="flex justify-end">
                <Button type="submit" loading={updateProfile.isPending}>
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
