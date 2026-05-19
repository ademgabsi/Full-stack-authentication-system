import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Alert, Input, ErrorBanner, Modal } from '@/components/ui';
import { useProfile, useRequestDeletion, useConfirmDeletion, useCancelDeletion } from '@/hooks/useUser';
import { Link } from 'react-router';
import { ArrowLeft, AlertTriangle, Trash2, Loader2 } from 'lucide-react';

export default function DeleteAccountPage() {
  const { data: profile, isLoading } = useProfile();

  const requestDeletion = useRequestDeletion();
  const confirmDeletion = useConfirmDeletion();
  const cancelDeletion = useCancelDeletion();

  const [code, setCode] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [localError, setLocalError] = useState('');

  const codeSent = !!profile?.scheduledDeletionAt || false;

  if (isLoading || !profile) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    );
  }

  const handleRequestDeletion = () => {
    setLocalError('');
    setSuccessMessage('');
    requestDeletion.mutate(undefined, {
      onSuccess: (data) => {
        setSuccessMessage(data.message);
      },
    });
  };

  const handleConfirmDeletion = () => {
    setLocalError('');
    if (!code.trim()) {
      setLocalError('Please enter the confirmation code');
      return;
    }
    confirmDeletion.mutate(code.trim(), {
      onError: () => {
        setCode('');
      },
    });
  };

  const handleRequestCancelCode = () => {
    setLocalError('');
    setSuccessMessage('');
    requestDeletion.mutate(undefined, {
      onSuccess: (data) => {
        setSuccessMessage(data.message);
        setShowConfirmModal(true);
      },
    });
  };

  const handleCancelDeletion = () => {
    setLocalError('');
    setSuccessMessage('');
    if (!code.trim()) {
      setLocalError('Please enter the confirmation code');
      return;
    }
    cancelDeletion.mutate(code.trim(), {
      onSuccess: (data) => {
        setCode('');
        setShowConfirmModal(false);
        setSuccessMessage(data.message);
      },
      onError: () => {
        setCode('');
      },
    });
  };

  const isPendingDeletion = !!profile.scheduledDeletionAt;

  return (
    <div className="max-w-2xl">
      <Link
        to="/security"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Security
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Delete Account</h1>

      {successMessage && (
        <Alert variant="success" className="mb-4">
          {successMessage}
        </Alert>
      )}

      {isPendingDeletion && (
        <Alert variant="warning" className="mb-4">
          Your account is scheduled for deletion on{' '}
          {new Date(profile.scheduledDeletionAt!).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
          . You can cancel this before the deletion date.
        </Alert>
      )}

      <Card className="mb-6 border-red-200">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <CardTitle className="text-red-700">Delete Your Account</CardTitle>
              <p className="text-sm text-gray-500 mt-0.5">
                Permanently delete your account and all associated data
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-red-700">
                <strong>Warning:</strong> This action is irreversible. Your account
                and all associated data will be permanently deleted 14 days after
                confirmation. During this period, you can cancel the deletion at any
                time.
              </p>
            </div>

            <div className="space-y-2 text-sm text-gray-600">
              <p>When your account is deleted:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Your profile and personal information will be removed</li>
                <li>All active sessions will be terminated</li>
                <li>Your profile image will be deleted</li>
                <li>Passkeys and MFA settings will be removed</li>
                <li>This action is delayed by 14 days for your safety</li>
              </ul>
            </div>

            {!isPendingDeletion ? (
              <div className="space-y-4 pt-4 border-t">
                <p className="text-sm text-gray-500">
                  A confirmation code will be sent to your email address. You will
                  need this code to confirm the deletion.
                </p>

                {!codeSent ? (
                  <>
                    {requestDeletion.isError && (
                      <ErrorBanner error={requestDeletion.error} />
                    )}
                    <Button
                      variant="danger"
                      onClick={handleRequestDeletion}
                      loading={requestDeletion.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Request Account Deletion
                    </Button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <Input
                      label="Confirmation Code"
                      id="code"
                      type="text"
                      placeholder="Enter the code sent to your email"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value);
                        setLocalError('');
                      }}
                      error={localError}
                    />
                    {(confirmDeletion.isError || requestDeletion.isError) && (
                      <ErrorBanner
                        error={confirmDeletion.error || requestDeletion.error}
                      />
                    )}
                    <div className="flex gap-3">
                      <Button
                        variant="danger"
                        onClick={handleConfirmDeletion}
                        loading={confirmDeletion.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Confirm Deletion
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleRequestDeletion}
                        loading={requestDeletion.isPending}
                      >
                        Resend Code
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 pt-4 border-t">
                <Button
                  variant="secondary"
                  onClick={handleRequestCancelCode}
                  loading={requestDeletion.isPending}
                >
                  Cancel Deletion
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Modal
        open={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Cancel Account Deletion"
      >
        <p className="text-sm text-gray-500 mb-4">
          To cancel the account deletion, please enter the confirmation code sent
          to your email.
        </p>
        {cancelDeletion.isError && (
          <ErrorBanner error={cancelDeletion.error} />
        )}
        {requestDeletion.isError && (
          <ErrorBanner error={requestDeletion.error} />
        )}
        <div className="space-y-4">
          <Input
            label="Confirmation Code"
            id="cancel-code"
            type="text"
            placeholder="Enter the code sent to your email"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setLocalError('');
            }}
            error={localError}
          />
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setShowConfirmModal(false)}
            >
              Back
            </Button>
            <Button
              variant="primary"
              onClick={handleCancelDeletion}
              loading={cancelDeletion.isPending}
            >
              Confirm Cancel
            </Button>
          </div>
          <div className="text-center">
            <button
              type="button"
              className="text-sm text-primary-600 hover:text-primary-700"
              onClick={() => {
                setCode('');
                handleRequestCancelCode();
              }}
            >
              Resend code
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
