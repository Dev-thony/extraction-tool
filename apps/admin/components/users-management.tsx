'use client';

import { useEffect, useMemo, useState } from 'react';

type UserRole = 'ADMIN' | 'STAFF';

type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type UsersManagementProps = {
  currentUserId: string;
  currentUserRole: UserRole;
};

type UserForm = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

const emptyForm: UserForm = {
  name: '',
  email: '',
  password: '',
  role: 'STAFF',
};

export function UsersManagement({ currentUserId, currentUserRole }: UsersManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [search, setSearch] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const [form, setForm] = useState<UserForm>(emptyForm);

  async function loadUsers() {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/users', {
        method: 'GET',
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load users.');
      }

      setUsers(data.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return users;
    }

    return users.filter((user) => {
      return (
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query)
      );
    });
  }, [users, search]);

  const activeAdminCount = users.filter((user) => user.role === 'ADMIN' && user.isActive).length;

  const activeUserCount = users.filter((user) => user.isActive).length;

  const staffCount = users.filter((user) => user.role === 'STAFF').length;

  function clearMessages() {
    setError('');
    setSuccess('');
  }

  function openCreateModal() {
    clearMessages();

    setForm({
      ...emptyForm,
    });

    setEditingUser(null);
    setShowCreateModal(true);
  }

  function openEditModal(user: User) {
    clearMessages();

    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
    });

    setEditingUser(user);
    setShowCreateModal(false);
  }

  function closeModals() {
    if (saving) {
      return;
    }

    setShowCreateModal(false);
    setEditingUser(null);
    setDeletingUser(null);
  }

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSaving(true);
      clearMessages();

      if (!form.password) {
        setError('A password is required when creating a user.');
        return;
      }

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to create user.');
      }

      setUsers((current) => [data.user, ...current]);

      setShowCreateModal(false);

      setSuccess(`${data.user.name} was created successfully.`);

      setForm({
        ...emptyForm,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create user.');
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingUser) {
      return;
    }

    try {
      setSaving(true);
      clearMessages();

      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        role: form.role,
      };

      if (form.password.trim()) {
        payload.password = form.password;
      }

      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to update user.');
      }

      setUsers((current) => current.map((user) => (user.id === editingUser.id ? data.user : user)));

      setEditingUser(null);

      setSuccess(`${data.user.name} was updated successfully.`);

      setForm({
        ...emptyForm,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update user.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleUserStatus(user: User) {
    if (user.id === currentUserId || saving) {
      return;
    }

    try {
      setSaving(true);
      clearMessages();

      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !user.isActive,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to update account status.');
      }

      setUsers((current) => current.map((item) => (item.id === user.id ? data.user : item)));

      setSuccess(`${user.name} is now ${data.user.isActive ? 'active' : 'inactive'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update account status.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser() {
    if (!deletingUser) {
      return;
    }

    try {
      setSaving(true);
      clearMessages();

      const response = await fetch(`/api/users/${deletingUser.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to delete user.');
      }

      setUsers((current) => current.filter((user) => user.id !== deletingUser.id));

      setSuccess(`${deletingUser.name} was deleted.`);

      setDeletingUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete user.');
    } finally {
      setSaving(false);
    }
  }

  function formatDate(value: string | null) {
    if (!value) {
      return 'Never';
    }

    return new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  return (
    <section className="users-management">
      <div className="users-page-header">
        <div>
          <div className="users-breadcrumb">
            Administration
            <span>/</span>
            Users
          </div>

          <h1>Account Management</h1>

          <p>Create and manage administrator and staff accounts.</p>
        </div>

        <button type="button" className="users-primary-button" onClick={openCreateModal}>
          <span aria-hidden="true">+</span>
          Add user
        </button>
      </div>

      <div className="users-stats">
        <div className="users-stat-card">
          <span>Total users</span>
          <strong>{users.length}</strong>
        </div>

        <div className="users-stat-card">
          <span>Active users</span>
          <strong>{activeUserCount}</strong>
        </div>

        <div className="users-stat-card">
          <span>Administrators</span>
          <strong>{activeAdminCount}</strong>
        </div>

        <div className="users-stat-card">
          <span>Staff</span>
          <strong>{staffCount}</strong>
        </div>
      </div>

      {error && (
        <div className="users-alert users-alert-error" role="alert">
          <span aria-hidden="true">!</span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="users-alert users-alert-success" role="status">
          <span aria-hidden="true">✓</span>
          <span>{success}</span>
        </div>
      )}

      <div className="users-toolbar">
        <div className="users-search">
          <span aria-hidden="true">⌕</span>

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email or role..."
            aria-label="Search users"
          />
        </div>

        <div className="users-results-count">
          {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}
        </div>
      </div>

      <div className="users-table-card">
        {loading ? (
          <UsersLoading />
        ) : filteredUsers.length === 0 ? (
          <UsersEmpty hasSearch={Boolean(search.trim())} onAddUser={openCreateModal} />
        ) : (
          <div className="users-table-wrapper">
            <table className="users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last login</th>
                  <th>Created</th>
                  <th className="users-actions-header">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => {
                  const isCurrentUser = user.id === currentUserId;

                  const isLastActiveAdmin =
                    user.role === 'ADMIN' && user.isActive && activeAdminCount === 1;

                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="users-user-cell">
                          <div className="users-avatar">{getInitials(user.name)}</div>

                          <div>
                            <strong>{user.name}</strong>

                            <span>{user.email}</span>

                            {isCurrentUser && <small>You</small>}
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`users-role-badge ${
                            user.role === 'ADMIN' ? 'is-admin' : 'is-staff'
                          }`}
                        >
                          {user.role === 'ADMIN' ? 'Administrator' : 'Staff'}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`users-status-badge ${
                            user.isActive ? 'is-active' : 'is-inactive'
                          }`}
                        >
                          <span className="users-status-dot" aria-hidden="true" />
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td>
                        <span className="users-date">{formatDate(user.lastLoginAt)}</span>
                      </td>

                      <td>
                        <span className="users-date">{formatDate(user.createdAt)}</span>
                      </td>

                      <td>
                        <div className="users-actions">
                          <button
                            type="button"
                            className="users-action-button"
                            onClick={() => openEditModal(user)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="users-action-button"
                            disabled={isCurrentUser || isLastActiveAdmin || saving}
                            onClick={() => toggleUserStatus(user)}
                            title={
                              isCurrentUser
                                ? 'You cannot deactivate your own account.'
                                : isLastActiveAdmin
                                  ? 'The last active administrator cannot be deactivated.'
                                  : undefined
                            }
                          >
                            {user.isActive ? 'Deactivate' : 'Activate'}
                          </button>

                          <button
                            type="button"
                            className="users-action-button users-action-danger"
                            disabled={isCurrentUser || isLastActiveAdmin || saving}
                            onClick={() => setDeletingUser(user)}
                            title={
                              isCurrentUser
                                ? 'You cannot delete your own account.'
                                : isLastActiveAdmin
                                  ? 'The last active administrator cannot be deleted.'
                                  : undefined
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(showCreateModal || editingUser) && (
        <UserModal
          title={editingUser ? 'Edit user' : 'Create user'}
          description={
            editingUser
              ? 'Update this account and optionally set a new password.'
              : 'Create a new administrator or staff account.'
          }
          form={form}
          setForm={setForm}
          saving={saving}
          isEditing={Boolean(editingUser)}
          currentUserRole={currentUserRole}
          onClose={closeModals}
          onSubmit={editingUser ? updateUser : createUser}
        />
      )}

      {deletingUser && (
        <DeleteModal
          user={deletingUser}
          saving={saving}
          onCancel={() => (saving ? undefined : setDeletingUser(null))}
          onConfirm={deleteUser}
        />
      )}
    </section>
  );
}

function UserModal({
  title,
  description,
  form,
  setForm,
  saving,
  isEditing,
  currentUserRole,
  onClose,
  onSubmit,
}: {
  title: string;
  description: string;
  form: UserForm;
  setForm: React.Dispatch<React.SetStateAction<UserForm>>;
  saving: boolean;
  isEditing: boolean;
  currentUserRole: UserRole;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="users-modal-backdrop">
      <div
        className="users-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-modal-title"
      >
        <div className="users-modal-header">
          <div>
            <h2 id="user-modal-title">{title}</h2>

            <p>{description}</p>
          </div>

          <button
            type="button"
            className="users-modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form className="users-form" onSubmit={onSubmit}>
          <label>
            <span>Full name</span>

            <input
              type="text"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Enter full name"
              required
              maxLength={100}
              autoComplete="name"
            />
          </label>

          <label>
            <span>Email address</span>

            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              placeholder="name@example.com"
              required
              autoComplete="email"
            />
          </label>

          <label>
            <span>{isEditing ? 'New password' : 'Password'}</span>

            <input
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              placeholder={
                isEditing ? 'Leave blank to keep current password' : 'Minimum 12 characters'
              }
              minLength={12}
              maxLength={128}
              required={!isEditing}
              autoComplete={isEditing ? 'new-password' : 'new-password'}
            />

            <small>Password must contain at least 12 characters.</small>
          </label>

          <label>
            <span>Role</span>

            <select
              value={form.role}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  role: event.target.value as UserRole,
                }))
              }
            >
              <option value="STAFF">Staff</option>

              <option value="ADMIN">Administrator</option>
            </select>
          </label>

          <div className="users-form-note">
            <strong>Account security</strong>

            <p>
              Administrators can manage user accounts. Staff accounts do not receive account
              management access.
            </p>

            {currentUserRole === 'ADMIN' && (
              <p>The last active administrator cannot be deactivated, demoted, or deleted.</p>
            )}
          </div>

          <div className="users-modal-actions">
            <button
              type="button"
              className="users-secondary-button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button type="submit" className="users-primary-button" disabled={saving}>
              {saving ? 'Saving...' : isEditing ? 'Save changes' : 'Create user'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteModal({
  user,
  saving,
  onCancel,
  onConfirm,
}: {
  user: User;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="users-modal-backdrop">
      <div
        className="users-modal users-delete-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-user-title"
      >
        <div className="users-delete-icon">!</div>

        <h2 id="delete-user-title">Delete user?</h2>

        <p>
          This will permanently delete <strong>{user.name}</strong> and their account.
        </p>

        <div className="users-modal-actions">
          <button
            type="button"
            className="users-secondary-button"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            className="users-danger-button"
            onClick={onConfirm}
            disabled={saving}
          >
            {saving ? 'Deleting...' : 'Delete user'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UsersLoading() {
  return (
    <div className="users-loading">
      <div className="users-loading-row" />
      <div className="users-loading-row" />
      <div className="users-loading-row" />
      <div className="users-loading-row" />
    </div>
  );
}

function UsersEmpty({ hasSearch, onAddUser }: { hasSearch: boolean; onAddUser: () => void }) {
  return (
    <div className="users-empty">
      <div className="users-empty-icon">♙</div>

      <h3>{hasSearch ? 'No users found' : 'No user accounts'}</h3>

      <p>{hasSearch ? 'Try changing your search.' : 'Create the first account to get started.'}</p>

      {!hasSearch && (
        <button type="button" className="users-primary-button" onClick={onAddUser}>
          Add user
        </button>
      )}
    </div>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return 'U';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
