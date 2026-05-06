import { useState } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, Button, Modal, ErrorBanner, Alert } from '@/components/ui';
import { Input } from '@/components/ui';
import { ArrowLeft, Fingerprint, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useWebAuthnCredentials, useWebAuthnRegister, useRenameWebAuthnCredential, useDeleteWebAuthnCredential } from '@/hooks/useWebAuthn';

export default function PasskeysPage() {
  const { data: credentials, isLoading } = useWebAuthnCredentials();
  const register = useWebAuthnRegister();
  const rename = useRenameWebAuthnCredential();
  const remove = useDeleteWebAuthnCredential();

  const [showAddModal, setShowAddModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [success, setSuccess] = useState('');

  const handleRegister = () => {
    setSuccess('');
    register.mutate(newKeyName || undefined, {
      onSuccess: () => {
        setShowAddModal(false);
        setNewKeyName('');
        setSuccess('Passkey registered successfully');
      },
    });
  };

  const handleRename = () => {
    if (!editingId || !editName.trim()) return;
    setSuccess('');
    rename.mutate(
      { id: editingId, name: editName.trim() },
      {
        onSuccess: () => {
          setEditingId(null);
          setEditName('');
          setSuccess('Passkey renamed successfully');
        },
      },
    );
  };

  const handleDelete = () => {
    if (!deletingId) return;
    setSuccess('');
    remove.mutate(deletingId, {
      onSuccess: () => {
        setDeletingId(null);
        setSuccess('Passkey deleted successfully');
      },
    });
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary-600" /></div>;
  }

  return (
    <div>
      <Link to="/security" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="h-4 w-4" />
        Back to Security
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Passkeys</h1>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Passkey
        </Button>
      </div>

      {success && <Alert variant="success" className="mb-4">{success}</Alert>}

      {!credentials || credentials.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Fingerprint className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No passkeys registered</h3>
            <p className="text-sm text-gray-500 mb-4">
              Add a passkey for passwordless sign-in using your fingerprint, face, or device PIN.
            </p>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Passkey
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {credentials.map((cred) => (
            <Card key={cred.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center">
                    <Fingerprint className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{cred.name}</p>
                    <p className="text-xs text-gray-500">
                      Created {formatDate(cred.createdAt)}
                      {cred.lastUsedAt && ` · Last used ${formatDate(cred.lastUsedAt)}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setEditingId(cred.id);
                      setEditName(cred.name);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setDeletingId(cred.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Register New Passkey">
        {register.isError && <ErrorBanner error={register.error} />}
        <p className="text-sm text-gray-500 mb-4">
          You'll be prompted to authenticate with your device's biometric sensor or security key.
        </p>
        <Input
          label="Name (optional)"
          id="passkeyName"
          placeholder="e.g. My iPhone, YubiKey"
          value={newKeyName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewKeyName(e.target.value)}
        />
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
          <Button onClick={handleRegister} loading={register.isPending}>Register Passkey</Button>
        </div>
      </Modal>

      <Modal open={editingId !== null} onClose={() => setEditingId(null)} title="Rename Passkey">
        {rename.isError && <ErrorBanner error={rename.error} />}
        <Input
          label="Name"
          id="editName"
          value={editName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)}
        />
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
          <Button onClick={handleRename} loading={rename.isPending}>Save</Button>
        </div>
      </Modal>

      <Modal open={deletingId !== null} onClose={() => setDeletingId(null)} title="Delete Passkey">
        {remove.isError && <ErrorBanner error={remove.error} />}
        <p className="text-sm text-gray-500 mb-4">
          Are you sure you want to delete this passkey? You won't be able to use it to sign in anymore.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeletingId(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} loading={remove.isPending}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
