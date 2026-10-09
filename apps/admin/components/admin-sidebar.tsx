'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type AdminSidebarProps = {
  user: {
    id: string;
    name: string;
    email: string;
    role: 'ADMIN' | 'STAFF';
  };
};

const navigation = [
  {
    href: '/',
    label: 'Dashboard',
    icon: '▦',
    adminOnly: false,
  },
  {
    href: '/records',
    label: 'Records',
    icon: '☷',
    adminOnly: false,
  },
  {
    href: '/batches',
    label: 'Batches',
    icon: '◫',
    adminOnly: false,
  },
  {
    href: '/users',
    label: 'Users',
    icon: '♙',
    adminOnly: true,
  },
];

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = useState(false);

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    }

    document.body.style.overflow = 'hidden';

    document.addEventListener('keydown', handleKeyDown);

    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  async function logout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  function closeMenu() {
    setOpen(false);
  }

  const visibleNavigation = navigation.filter((item) => !item.adminOnly || user.role === 'ADMIN');

  return (
    <>
      <header className="admin-mobile-topbar">
        <button
          ref={menuButtonRef}
          className="admin-mobile-menu-button"
          type="button"
          aria-label={open ? 'Navigation open' : 'Open navigation'}
          aria-controls="admin-navigation"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <span aria-hidden="true">☰</span>
        </button>

        <Link className="admin-mobile-title" href="/" onClick={closeMenu}>
          <span className="admin-brand-mark" aria-hidden="true">
            D
          </span>

          <span>Data Extractor</span>
        </Link>

        <span className="admin-mobile-label">{user.role === 'ADMIN' ? 'Admin' : 'Staff'}</span>
      </header>

      <button
        className={`admin-sidebar-backdrop${open ? ' is-open' : ''}`}
        type="button"
        aria-label="Close navigation"
        tabIndex={open ? 0 : -1}
        onClick={closeMenu}
      />

      <aside
        id="admin-navigation"
        className={`admin-sidebar${open ? ' is-open' : ''}`}
        aria-label="Admin navigation"
      >
        <div className="admin-sidebar-brand">
          <Link href="/" className="admin-brand" onClick={closeMenu}>
            <span className="admin-brand-mark" aria-hidden="true">
              D
            </span>

            <span className="admin-brand-copy">
              <strong>Data Extractor</strong>
              <small>{user.role === 'ADMIN' ? 'Admin Portal' : 'Staff Portal'}</small>
            </span>
          </Link>

          <button
            ref={closeButtonRef}
            className="admin-sidebar-close"
            type="button"
            aria-label="Close navigation"
            onClick={closeMenu}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <nav className="admin-sidebar-nav" aria-label="Main navigation">
          <span className="admin-sidebar-section-label">WORKSPACE</span>

          {visibleNavigation.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-nav-link${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={closeMenu}
              >
                <span className="admin-nav-icon" aria-hidden="true">
                  {item.icon}
                </span>

                <span>{item.label}</span>

                {active && <span className="admin-nav-indicator" aria-hidden="true" />}
              </Link>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-user">
            <div className="admin-sidebar-avatar">{getInitials(user.name)}</div>

            <div className="admin-sidebar-user-copy">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
          </div>

          <div className="admin-sidebar-footer-copy">
            <span className="admin-status-dot" aria-hidden="true" />

            <span>{user.role === 'ADMIN' ? 'Administrator' : 'Staff account'}</span>
          </div>

          <button className="admin-signout-button" type="button" onClick={logout}>
            <span aria-hidden="true">↪</span>
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
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
