import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
  type SVGProps,
} from 'react'
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  useLocation,
  useNavigate,
  useParams,
  useRouteError,
} from 'react-router-dom'

import { signIn as apiSignIn } from './api/adminApi.ts'
import { setAuthToken } from './api/client.ts'
import { isLiveApi } from './api/config.ts'
import { isApiError, messageForCode } from './api/errors.ts'
import { Button, Field, TextInput, ToastProvider } from './kit/index.ts'
import { ItemEditorPage } from './app/items/ItemEditorPage.tsx'
import { LandingPage } from './app/landing/LandingPage.tsx'
import { RoomItemsListPage } from './app/items/RoomItemsListPage.tsx'
import { NarrationPage } from './app/narration/NarrationPage.tsx'
import { ActivityPage } from './app/activity/ActivityPage.tsx'
import { TenantOverviewPage } from './app/overview/TenantOverviewPage.tsx'
import { AuthoringStoreProvider } from './app/rooms/authoringStore.tsx'
import { RoomEditorPage } from './app/rooms/RoomEditorPage.tsx'
import { RoomsListPage } from './app/rooms/RoomsListPage.tsx'
import { GuideSettingsPage } from './app/settings/GuideSettingsPage.tsx'
import { GateSettingsPage } from './app/settings/GateSettingsPage.tsx'
import { MuseumSettingsPage } from './app/settings/MuseumSettingsPage.tsx'
import { VoiceSettingsPage } from './app/settings/VoiceSettingsPage.tsx'
import { TeamPage } from './app/team/TeamPage.tsx'
import { FleetPage } from './app/operator/FleetPage.tsx'
import { FleetStoreProvider, useFleetStore } from './app/operator/fleetStore.tsx'
import { scopedTenantContext } from './app/operator/scopedTenantContext.tsx'
import { TenantRecordPage } from './app/operator/TenantRecordPage.tsx'
import { HealthPage } from './app/operator/HealthPage.tsx'
import { SpendPage } from './app/operator/SpendPage.tsx'
import { AuditPage } from './app/operator/AuditPage.tsx'
import { AdminsPage } from './app/operator/AdminsPage.tsx'
import { TokenHarnessPage } from './preview/TokenHarnessPage.tsx'
import styles from './app/Phase3App.module.css'

type Role = 'MUSEUM_ADMIN' | 'SYSTEM_ADMIN'

type Session = {
  readonly email: string
  readonly role: Role
  /** Null for a system admin, who belongs to no museum. */
  readonly museumId: string | null
  /** Null in demo mode, when no API base URL is configured. */
  readonly token: string | null
  readonly expiresAt: string | null
}

type SignInInput = {
  readonly email: string
  readonly password: string
  readonly role: Role
}

/**
 * `credentials` covers anything that must stay indistinguishable — a wrong
 * password, an unknown email, or the right account at the wrong door. `service`
 * is a problem with the connection itself, which is safe to describe plainly.
 */
type SignInFailure = {
  readonly ok: false
  readonly kind: 'credentials' | 'service'
  readonly message: string
}

type AuthContextValue = {
  readonly session: Session | null
  readonly signIn: (input: SignInInput) => Promise<{ ok: true } | SignInFailure>
  readonly signOut: () => void
}

type SignInSurface = {
  readonly idPrefix: string
  readonly plane: 'tenant' | 'control'
  readonly role: Role
  readonly eyebrow: string
  readonly title: string
  readonly intro: string
  /**
   * Shown for every rejected attempt so that a wrong role is indistinguishable
   * from a wrong password, keeping each door silent about the other plane.
   */
  readonly failureMessage: string
  readonly showMuseumDoorLink: boolean
}

type NavItemConfig = {
  readonly id: string
  readonly label: string
  readonly icon: ReactElement
  readonly suffix?: number
  readonly path: string
}

type ViewportMode = 'wide' | 'desktop' | 'drawer'

/** Bumped from the phase3 key: a stored mock session cannot satisfy the token-bearing shape. */
const SESSION_KEY = 'adwa.admin.session.v2'
const SIDEBAR_KEY_PREFIX = 'adwa.admin.phase3.sidebar'
const DEMO_PASSWORD = 'demo123'

const DEMO_ACCOUNTS = [
  { email: 'curator@adwa.local', role: 'MUSEUM_ADMIN' },
  { email: 'operator@adwa.local', role: 'SYSTEM_ADMIN' },
] as const satisfies readonly { email: string; role: Role }[]

const MUSEUM_SIGN_IN_PATH = '/sign-in'
const OPERATOR_SIGN_IN_PATH = '/operator/sign-in'

const museumSignInSurface: SignInSurface = {
  idPrefix: 'museum-sign-in',
  plane: 'tenant',
  role: 'MUSEUM_ADMIN',
  eyebrow: 'Adwa museum admin',
  title: 'Museum sign in',
  intro: 'Administrator access to your museum’s rooms, narration, team, and settings.',
  failureMessage: 'Those credentials are not valid for museum administrator sign-in.',
  showMuseumDoorLink: false,
}

const operatorSignInSurface: SignInSurface = {
  idPrefix: 'operator-sign-in',
  plane: 'control',
  role: 'SYSTEM_ADMIN',
  eyebrow: 'Adwa ops console',
  title: 'Operator sign in',
  intro: 'System administrator access to the museum fleet, health, spend, and audit trail.',
  failureMessage: 'Those credentials are not valid for system administrator sign-in.',
  showMuseumDoorLink: true,
}

/**
 * Nesting here is load-bearing, not cosmetic. The authoring pages navigate with
 * `..`, which climbs one *route* level rather than one URL segment, so a flat
 * registration would send "back to rooms" to the tenant root instead.
 *
 * Rendered under both `/app` and `/operator/tenant/:museumId`.
 */
function tenantRouteTree(): ReactElement {
  return (
    <>
      <Route index element={<Navigate to="overview" replace />} />
      <Route path="overview" element={<TenantOverviewPage />} />

      <Route path="rooms">
        <Route index element={<RoomsListPage />} />
        <Route path="new" element={<RoomEditorPage mode="create" />} />
        <Route path=":roomId">
          <Route index element={<RoomEditorPage mode="edit" />} />
          <Route path="items">
            <Route index element={<RoomItemsListPage />} />
            <Route path=":itemId" element={<ItemEditorPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="narration" element={<NarrationPage />} />
      <Route path="team" element={<TeamPage />} />
      <Route path="activity" element={<ActivityPage />} />

      <Route path="settings">
        <Route index element={<Navigate to="museum" replace />} />
        <Route path="museum" element={<MuseumSettingsPage />} />
        <Route path="gate" element={<GateSettingsPage />} />
        <Route path="guide" element={<GuideSettingsPage />} />
        <Route path="voice" element={<VoiceSettingsPage />} />
      </Route>
    </>
  )
}

const authContext = createContext<AuthContextValue | null>(null)

function getLandingPath(role: Role): string {
  return role === 'SYSTEM_ADMIN' ? '/operator/fleet' : '/app/overview'
}

function getLandingLabel(role: Role): string {
  return role === 'SYSTEM_ADMIN' ? 'Continue to fleet' : 'Continue to dashboard'
}

function getSignInPathForRole(role: Role): string {
  return role === 'SYSTEM_ADMIN' ? OPERATOR_SIGN_IN_PATH : MUSEUM_SIGN_IN_PATH
}

function getSignInPathForLocation(pathname: string): string {
  const isControlPlane = pathname === '/operator' || pathname.startsWith('/operator/')
  return isControlPlane ? OPERATOR_SIGN_IN_PATH : MUSEUM_SIGN_IN_PATH
}

function getDemoEmail(role: Role): string {
  return DEMO_ACCOUNTS.find((candidate) => candidate.role === role)?.email ?? ''
}

function formatRole(role: Role): string {
  return role === 'SYSTEM_ADMIN' ? 'system administrator' : 'museum administrator'
}

function hasExpired(expiresAt: string | null): boolean {
  if (expiresAt === null) return false
  const at = new Date(expiresAt).getTime()
  return Number.isFinite(at) && at <= Date.now()
}

function writeSession(session: Session): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

/**
 * Reads the stored session, dropping it if the token has already expired so the
 * app returns to the door instead of firing requests that cannot succeed.
 */
function readSession(): Session | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(SESSION_KEY)
  if (raw === null) return null

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const role = parsed.role
    if (typeof parsed.email !== 'string') return null
    if (role !== 'MUSEUM_ADMIN' && role !== 'SYSTEM_ADMIN') return null

    const expiresAt = typeof parsed.expiresAt === 'string' ? parsed.expiresAt : null
    if (hasExpired(expiresAt)) {
      window.localStorage.removeItem(SESSION_KEY)
      return null
    }

    return {
      email: parsed.email,
      role,
      museumId: typeof parsed.museumId === 'string' ? parsed.museumId : null,
      token: typeof parsed.token === 'string' ? parsed.token : null,
      expiresAt,
    }
  } catch {
    return null
  }
}

function readSidebarPreference(session: Session | null): boolean | null {
  if (session === null || typeof window === 'undefined') return null
  const key = `${SIDEBAR_KEY_PREFIX}.${session.email}`
  const raw = window.localStorage.getItem(key)
  if (raw === 'collapsed') return true
  if (raw === 'expanded') return false
  return null
}

function writeSidebarPreference(session: Session, collapsed: boolean): void {
  if (typeof window === 'undefined') return
  const key = `${SIDEBAR_KEY_PREFIX}.${session.email}`
  window.localStorage.setItem(key, collapsed ? 'collapsed' : 'expanded')
}

function getViewportMode(width: number): ViewportMode {
  if (width >= 1280) return 'wide'
  if (width >= 1024) return 'desktop'
  return 'drawer'
}

function useViewportMode(): ViewportMode {
  const [mode, setMode] = useState<ViewportMode>(() => {
    if (typeof window === 'undefined') return 'wide'
    return getViewportMode(window.innerWidth)
  })

  useEffect(() => {
    function onResize(): void {
      setMode(getViewportMode(window.innerWidth))
    }

    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return mode
}

/** Any credential failure reads the same, so no attempt reveals what was wrong. */
const CREDENTIAL_FAILURE: SignInFailure = {
  ok: false,
  kind: 'credentials',
  message: 'Those credentials are not valid.',
}

function AuthProvider({ children }: { children: ReactNode }): ReactElement {
  const [session, setSession] = useState<Session | null>(() => {
    const restored = readSession()
    setAuthToken(restored?.token ?? null)
    return restored
  })

  useEffect(() => {
    setAuthToken(session?.token ?? null)
  }, [session])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      signIn: async ({ email, password, role }) => {
        const normalizedEmail = email.trim().toLowerCase()

        if (!isLiveApi) {
          const account = DEMO_ACCOUNTS.find((candidate) => candidate.email === normalizedEmail)
          if (password !== DEMO_PASSWORD || account === undefined || account.role !== role) {
            return CREDENTIAL_FAILURE
          }
          const next: Session = {
            email: normalizedEmail,
            role,
            museumId: null,
            token: null,
            expiresAt: null,
          }
          writeSession(next)
          setSession(next)
          return { ok: true }
        }

        try {
          const response = await apiSignIn({ email: normalizedEmail, password })

          /**
           * The server decides the role; the door only decides which surface was
           * used. A valid operator arriving at the museum door is refused with
           * the same message as a bad password, because saying "wrong door"
           * would disclose that the other plane exists.
           */
          if (response.role !== role) return CREDENTIAL_FAILURE

          const next: Session = {
            email: normalizedEmail,
            role: response.role,
            museumId: response.museumId,
            token: response.token,
            expiresAt: response.expiresAt,
          }
          setAuthToken(response.token)
          writeSession(next)
          setSession(next)
          return { ok: true }
        } catch (error) {
          // A rate limit or an unreachable server is not a hint about the account.
          if (
            isApiError(error) &&
            (error.code === 'RATE_LIMITED' ||
              error.code === 'NETWORK_ERROR' ||
              error.code === 'TIMEOUT')
          ) {
            return { ok: false, kind: 'service', message: messageForCode(error) }
          }
          return CREDENTIAL_FAILURE
        }
      },
      signOut: () => {
        setAuthToken(null)
        setSession(null)
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(SESSION_KEY)
        }
      },
    }),
    [session],
  )

  return <authContext.Provider value={value}>{children}</authContext.Provider>
}

function useAuth(): AuthContextValue {
  const context = useContext(authContext)
  if (context === null) {
    throw new Error('Auth context is unavailable.')
  }
  return context
}

/**
 * A data router (rather than <BrowserRouter>) is required: the editors' unsaved
 * changes guard uses useBlocker, which only exists on a data router.
 */
const appRouter = createBrowserRouter(
  createRoutesFromElements(
    <Route errorElement={<RouteErrorPage />}>
      <Route path="/" element={<RootRoute />} />
      <Route path={MUSEUM_SIGN_IN_PATH} element={<MuseumSignInPage />} />
      <Route path="/sign-out" element={<SignOutRoute surface={museumSignInSurface} />} />
      <Route path={OPERATOR_SIGN_IN_PATH} element={<OperatorSignInPage />} />
      <Route path="/operator/sign-out" element={<SignOutRoute surface={operatorSignInSurface} />} />
      <Route path="/dev/tokens" element={<TokenHarnessPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<FleetStoreBoundary />}>
          <Route path="/app" element={<TenantShell scopedMuseumId={null} />}>
            {tenantRouteTree()}
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          <Route path="/operator" element={<OperatorRoleGuard />}>
            <Route path="tenant/:museumId" element={<TenantShell scopedMuseumId="fromRoute" />}>
              {tenantRouteTree()}
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            <Route element={<OperatorShell />}>
              <Route index element={<Navigate to="fleet" replace />} />
              <Route path="fleet" element={<FleetPage />} />
              <Route path="fleet/new" element={<FleetPage />} />
              <Route path="fleet/:museumId" element={<TenantRecordPage />} />
              <Route path="health" element={<HealthPage />} />
              <Route path="spend" element={<SpendPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route path="admins" element={<AdminsPage />} />
              <Route
                path="*"
                element={
                  <PlaceholderPage
                    title="Operator route not found"
                    body="This control-plane route is not available in the current phase."
                  />
                }
              />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Route>,
  ),
)

function RootRoute(): ReactElement {
  const { session } = useAuth()
  if (session === null) return <LandingPage />
  return <Navigate to={getLandingPath(session.role)} replace />
}

function RequireAuth(): ReactElement {
  const { session } = useAuth()
  const location = useLocation()

  if (session === null) {
    return (
      <Navigate
        to={getSignInPathForLocation(location.pathname)}
        replace
        state={{ from: location.pathname }}
      />
    )
  }
  return <Outlet />
}

function FleetStoreBoundary(): ReactElement {
  return (
    <FleetStoreProvider>
      <Outlet />
    </FleetStoreProvider>
  )
}

function OperatorRoleGuard(): ReactElement {
  const { session } = useAuth()
  if (session?.role === 'MUSEUM_ADMIN') return <NotFoundPage />
  return <Outlet />
}

function SignOutRoute({ surface }: { surface: SignInSurface }): ReactElement {
  const { session, signOut } = useAuth()

  useLayoutEffect(() => {
    if (session !== null) {
      signOut()
    }
  }, [session, signOut])

  if (session !== null) {
    return <div className={styles.signInPage} data-plane={surface.plane} aria-hidden="true" />
  }

  return <Navigate to={getSignInPathForRole(surface.role)} replace />
}

function MuseumSignInPage(): ReactElement {
  return <SignInPanel surface={museumSignInSurface} />
}

function OperatorSignInPage(): ReactElement {
  const { session } = useAuth()

  // Same non-disclosure rule as the rest of /operator: a museum administrator
  // must not learn that an operator door exists at this address.
  if (session?.role === 'MUSEUM_ADMIN') return <NotFoundPage />

  return <SignInPanel surface={operatorSignInSurface} />
}

function SignInPanel({ surface }: { surface: SignInSurface }): ReactElement {
  const { session, signIn, signOut } = useAuth()
  const navigate = useNavigate()

  // Only prefill in demo mode; against a real API these would be misleading.
  const [email, setEmail] = useState<string>(() => (isLiveApi ? '' : getDemoEmail(surface.role)))
  const [password, setPassword] = useState(isLiveApi ? '' : DEMO_PASSWORD)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const header = (
    <div className={styles.signInTitleRow}>
      <span className={styles.brandMark} aria-hidden="true">
        A
      </span>
      <p className={`column-header ${styles.muted}`}>{surface.eyebrow}</p>
    </div>
  )

  if (session !== null) {
    return (
      <section className={styles.signInPage} data-plane={surface.plane}>
        <div className={styles.signInPanel}>
          <header className={styles.signInHeader}>
            {header}
            <h1 className="text-title">Already signed in</h1>
            <p className={`text-body ${styles.muted}`}>
              You are signed in as <strong>{session.email}</strong> ({formatRole(session.role)}).
            </p>
          </header>
          <div className={styles.roleButtons}>
            <Button onClick={() => navigate(getLandingPath(session.role), { replace: true })}>
              {getLandingLabel(session.role)}
            </Button>
            <Button tone="secondary" onClick={signOut}>
              Sign out and switch account
            </Button>
          </div>
        </div>
      </section>
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const result = await signIn({ email, password, role: surface.role })
      if (result.ok) {
        navigate(getLandingPath(surface.role), { replace: true })
        return
      }
      // The surface owns the credential wording so each door stays silent about the other.
      setError(result.kind === 'credentials' ? surface.failureMessage : result.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={styles.signInPage} data-plane={surface.plane}>
      <form
        className={styles.signInPanel}
        onSubmit={(event) => {
          void handleSubmit(event)
        }}
      >
        <header className={styles.signInHeader}>
          {header}
          <h1 className="text-title">{surface.title}</h1>
          <p className={`text-body ${styles.muted}`}>{surface.intro}</p>
        </header>

        <div className={styles.fieldStack}>
          <Field id={`${surface.idPrefix}-email`} label="Email" required>
            {(control) => (
              <TextInput
                {...control}
                value={email}
                onChange={setEmail}
                autoComplete="email"
                inputMode="email"
                type="email"
              />
            )}
          </Field>

          <Field id={`${surface.idPrefix}-password`} label="Password" required>
            {(control) => (
              <TextInput
                {...control}
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                type="password"
              />
            )}
          </Field>
        </div>

        {error !== null ? (
          <p className={`text-caption ${styles.errorText}`} role="alert">
            {error}
          </p>
        ) : null}

        <Button busy={busy} disabled={busy} type="submit">
          Continue
        </Button>

        {isLiveApi ? null : (
          <p className={`text-caption ${styles.muted}`}>
            Demo mode — no API configured. Sign in as{' '}
            <strong>{getDemoEmail(surface.role)}</strong> with password{' '}
            <strong>{DEMO_PASSWORD}</strong>.
          </p>
        )}

        {surface.showMuseumDoorLink ? (
          <Link className={`text-caption ${styles.signInAltDoor}`} to={MUSEUM_SIGN_IN_PATH}>
            Museum administrator sign-in
          </Link>
        ) : null}
      </form>
    </section>
  )
}

function PlaceholderPage({ title, body }: { title: string; body: string }): ReactElement {
  return (
    <div className={styles.pageContent}>
      <section className={styles.placeholderCard}>
        <h1 className="text-title">{title}</h1>
        <p className="text-body">{body}</p>
      </section>
    </div>
  )
}

function NotFoundPage(): ReactElement {
  return (
    <div className={styles.notFound} data-plane="tenant">
      <section className={`${styles.placeholderCard} ${styles.notFoundCard}`}>
        <h1 className="text-title">Page not found</h1>
        <p className="text-body">
          This route does not exist in the current admin surface. Use the sidebar or sign in again.
        </p>
      </section>
    </div>
  )
}

function RouteErrorPage(): ReactElement {
  const error = useRouteError()
  const detail = error instanceof Error ? error.message : String(error)

  return (
    <div className={styles.notFound} data-plane="tenant">
      <section className={`${styles.placeholderCard} ${styles.notFoundCard}`}>
        <h1 className="text-title">Something went wrong on this screen</h1>
        <p className="text-body">
          The rest of the console is still available. Go back to your dashboard and try again.
        </p>
        <p className={`text-caption ${styles.errorText}`}>{detail}</p>
        <Button tone="secondary" onClick={() => window.location.assign('/')}>
          Back to dashboard
        </Button>
      </section>
    </div>
  )
}

function OperatorShell(): ReactElement {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const viewport = useViewportMode()

  const [search, setSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const pref = readSidebarPreference(session)
    if (pref !== null) return pref
    if (typeof window === 'undefined') return false
    return getViewportMode(window.innerWidth) === 'desktop'
  })

  useEffect(() => {
    if (viewport === 'drawer') {
      setDrawerOpen(false)
      return
    }
    const pref = readSidebarPreference(session)
    if (pref !== null) {
      setCollapsed(pref)
      return
    }
    setCollapsed(viewport === 'desktop')
  }, [session, viewport])

  useEffect(() => {
    if (viewport === 'drawer') {
      setDrawerOpen(false)
      setAccountMenuOpen(false)
    }
  }, [location.pathname, viewport])

  if (session === null) return <Navigate to={OPERATOR_SIGN_IN_PATH} replace />

  const isDrawer = viewport === 'drawer'
  const showCollapsedRail = !isDrawer && collapsed
  const primaryItems: readonly NavItemConfig[] = [
    { id: 'fleet', label: 'Fleet', icon: <FleetIcon />, suffix: 42, path: '/operator/fleet' },
    { id: 'health', label: 'Health', icon: <HealthIcon />, suffix: 3, path: '/operator/health' },
    { id: 'spend', label: 'Spend', icon: <SpendIcon />, path: '/operator/spend' },
    { id: 'audit', label: 'Audit', icon: <AuditIcon />, path: '/operator/audit' },
    { id: 'admins', label: 'Admins', icon: <AdminsIcon />, path: '/operator/admins' },
  ]
  const secondaryItems: readonly NavItemConfig[] = [
    { id: 'notices', label: 'Notices', icon: <NoticeIcon />, suffix: 5, path: '/operator/fleet' },
    { id: 'help', label: 'Help', icon: <HelpIcon />, path: '/operator/fleet' },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon />, path: '/operator/fleet' },
  ]

  function toggleCollapse(): void {
    if (session === null) return
    const next = !collapsed
    setCollapsed(next)
    writeSidebarPreference(session, next)
  }

  function handleSignOut(): void {
    const signInPath = session === null ? MUSEUM_SIGN_IN_PATH : getSignInPathForRole(session.role)
    signOut()
    navigate(signInPath, { replace: true })
  }

  const sidebarContent = (
    <aside
      className={`${styles.sidebar} ${showCollapsedRail ? styles.sidebarCollapsed : ''}`}
      aria-label="Control navigation"
    >
      <div className={styles.sidebarHeader}>
        <div className={styles.sidebarBrand}>
          <span className={styles.brandMark} aria-hidden="true">
            A
          </span>
          {!showCollapsedRail ? (
            <strong className={`${styles.sidebarBrandLabel} text-body`}>ADWA OPS</strong>
          ) : null}
        </div>
        {!isDrawer ? (
          <Button
            tone="ghost"
            iconOnly
            compact
            label={showCollapsedRail ? 'Expand sidebar' : 'Collapse sidebar'}
            icon={showCollapsedRail ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            className={styles.collapseButton}
            onClick={toggleCollapse}
          />
        ) : (
          <Button
            tone="ghost"
            iconOnly
            compact
            label="Close drawer"
            icon={<CloseIcon />}
            className={styles.collapseButton}
            onClick={() => setDrawerOpen(false)}
          />
        )}
      </div>

      <div className={showCollapsedRail ? styles.collapsedHidden : ''}>
        <Field id="operator-shell-search" label="Search" labelHidden>
          {(control) => (
            <TextInput
              {...control}
              value={search}
              onChange={setSearch}
              type="search"
              placeholder="Search"
              shortcutHint="Ctrl+K"
              clearable
            />
          )}
        </Field>
      </div>

      <nav className={styles.navGroup}>
        {primaryItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            title={showCollapsedRail ? item.label : undefined}
          >
            <span className={styles.navItemStart}>
              <span className={styles.iconWrap} aria-hidden="true">
                {item.icon}
              </span>
              {!showCollapsedRail ? <span className={styles.label}>{item.label}</span> : null}
            </span>
            {item.suffix !== undefined ? <span className={styles.countBadge}>{item.suffix}</span> : null}
          </NavLink>
        ))}
      </nav>

      <div className={styles.divider} />

      <nav className={styles.navGroup}>
        {secondaryItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            title={showCollapsedRail ? item.label : undefined}
          >
            <span className={styles.navItemStart}>
              <span className={styles.iconWrap} aria-hidden="true">
                {item.icon}
              </span>
              {!showCollapsedRail ? <span className={styles.label}>{item.label}</span> : null}
            </span>
            {item.suffix !== undefined ? <span className={styles.countBadge}>{item.suffix}</span> : null}
          </NavLink>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <Button
          tone="ghost"
          className={styles.accountButton}
          aria-expanded={accountMenuOpen}
          aria-haspopup="menu"
          onClick={() => setAccountMenuOpen((open) => !open)}
        >
          <span className={styles.avatar} aria-hidden="true">
            {session.email.slice(0, 2).toUpperCase()}
          </span>
          {!showCollapsedRail ? (
            <span className={styles.accountIdentity}>
              <span className="text-body">{session.email}</span>
              <span className={`text-caption ${styles.muted}`}>{session.role}</span>
            </span>
          ) : null}
        </Button>
        {accountMenuOpen ? (
          <div className={styles.accountMenu} role="menu">
            <p className="text-body">{session.email}</p>
            <p className={`text-caption ${styles.muted}`}>{session.role}</p>
            <Button tone="secondary" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        ) : null}
      </div>
    </aside>
  )

  return (
    <div className={styles.tenantShell} data-plane="control">
      {isDrawer ? (
        <>
          {drawerOpen ? <button className={styles.drawerScrim} onClick={() => setDrawerOpen(false)} /> : null}
          {drawerOpen ? <div className={styles.drawerSidebar}>{sidebarContent}</div> : null}
        </>
      ) : (
        sidebarContent
      )}

      <main className={styles.contentRegion}>
        {isDrawer ? (
          <header className={styles.mobileBar}>
            <Button
              tone="ghost"
              iconOnly
              compact
              label="Open menu"
              icon={<MenuIcon />}
              className={styles.menuButton}
              onClick={() => setDrawerOpen(true)}
            />
            <p className="text-body">Control shell</p>
            <span className={styles.collapsedOnly}> </span>
          </header>
        ) : null}
        <Outlet />
      </main>
    </div>
  )
}

function TenantShell({
  scopedMuseumId,
}: {
  scopedMuseumId: 'fromRoute' | null
}): ReactElement {
  const { session, signOut } = useAuth()
  const { getMuseumById } = useFleetStore()
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const viewport = useViewportMode()

  const [search, setSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const pref = readSidebarPreference(session)
    if (pref !== null) return pref
    if (typeof window === 'undefined') return false
    return getViewportMode(window.innerWidth) === 'desktop'
  })

  useEffect(() => {
    if (viewport === 'drawer') {
      setDrawerOpen(false)
      return
    }
    const pref = readSidebarPreference(session)
    if (pref !== null) {
      setCollapsed(pref)
      return
    }
    setCollapsed(viewport === 'desktop')
  }, [session, viewport])

  useEffect(() => {
    if (viewport === 'drawer') {
      setDrawerOpen(false)
      setAccountMenuOpen(false)
    }
  }, [location.pathname, viewport])

  const museumId = scopedMuseumId === 'fromRoute' ? (params.museumId ?? null) : null
  const scopedMuseum = museumId === null ? undefined : getMuseumById(museumId)
  const museumName = scopedMuseum?.name ?? (museumId !== null ? museumId : null)
  const isScoped = museumId !== null
  const operatorEmail = isScoped && session !== null ? session.email : null
  const scopedContext = useMemo(
    () => ({
      isScoped,
      museumId,
      museumName,
      operatorEmail,
    }),
    [isScoped, museumId, museumName, operatorEmail],
  )

  if (session === null) {
    return (
      <Navigate to={museumId === null ? MUSEUM_SIGN_IN_PATH : OPERATOR_SIGN_IN_PATH} replace />
    )
  }

  const base = museumId === null ? '/app' : `/operator/tenant/${museumId}`
  const isDrawer = viewport === 'drawer'
  const showCollapsedRail = !isDrawer && collapsed

  const primaryItems: readonly NavItemConfig[] = [
    { id: 'overview', label: 'Overview', icon: <OverviewIcon />, path: `${base}/overview` },
    { id: 'rooms', label: 'Rooms', icon: <RoomsIcon />, suffix: 4, path: `${base}/rooms` },
    { id: 'narration', label: 'Narration', icon: <NarrationIcon />, suffix: 2, path: `${base}/narration` },
    { id: 'team', label: 'Team', icon: <TeamIcon />, path: `${base}/team` },
    { id: 'activity', label: 'Activity', icon: <ActivityIcon />, path: `${base}/activity` },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon />, path: `${base}/settings/museum` },
  ]

  const secondaryItems: readonly NavItemConfig[] = [
    { id: 'notices', label: 'Notices', icon: <NoticeIcon />, suffix: 7, path: `${base}/activity` },
    { id: 'help', label: 'Help', icon: <HelpIcon />, path: `${base}/overview` },
    { id: 'prefs', label: 'Preferences', icon: <SettingsIcon />, path: `${base}/settings/guide` },
  ]

  function toggleCollapse(): void {
    if (session === null) return
    const next = !collapsed
    setCollapsed(next)
    writeSidebarPreference(session, next)
  }

  function handleSignOut(): void {
    const signInPath = session === null ? MUSEUM_SIGN_IN_PATH : getSignInPathForRole(session.role)
    signOut()
    navigate(signInPath, { replace: true })
  }

  const sidebarContent = (
    <aside
      className={`${styles.sidebar} ${showCollapsedRail ? styles.sidebarCollapsed : ''}`}
      aria-label="Tenant navigation"
    >
      <div className={styles.sidebarHeader}>
        <div className={styles.sidebarBrand}>
          <span className={styles.brandMark} aria-hidden="true">
            A
          </span>
          {!showCollapsedRail ? (
            <strong className={`${styles.sidebarBrandLabel} text-body`}>ADWA</strong>
          ) : null}
        </div>
        {!isDrawer ? (
          <Button
            tone="ghost"
            iconOnly
            compact
            label={showCollapsedRail ? 'Expand sidebar' : 'Collapse sidebar'}
            icon={showCollapsedRail ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            className={styles.collapseButton}
            onClick={toggleCollapse}
          />
        ) : (
          <Button
            tone="ghost"
            iconOnly
            compact
            label="Close drawer"
            icon={<CloseIcon />}
            className={styles.collapseButton}
            onClick={() => setDrawerOpen(false)}
          />
        )}
      </div>

      <div className={showCollapsedRail ? styles.collapsedHidden : ''}>
        <Field id="tenant-shell-search" label="Search" labelHidden>
          {(control) => (
            <TextInput
              {...control}
              value={search}
              onChange={setSearch}
              type="search"
              placeholder="Search"
              shortcutHint="Ctrl+K"
              clearable
            />
          )}
        </Field>
      </div>

      <nav className={styles.navGroup}>
        {primaryItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            end={item.id === 'overview'}
            title={showCollapsedRail ? item.label : undefined}
          >
            <span className={styles.navItemStart}>
              <span className={styles.iconWrap} aria-hidden="true">
                {item.icon}
              </span>
              {!showCollapsedRail ? <span className={styles.label}>{item.label}</span> : null}
            </span>
            {item.suffix !== undefined ? <span className={styles.countBadge}>{item.suffix}</span> : null}
          </NavLink>
        ))}
      </nav>

      <div className={styles.divider} />

      <nav className={styles.navGroup}>
        {secondaryItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            title={showCollapsedRail ? item.label : undefined}
          >
            <span className={styles.navItemStart}>
              <span className={styles.iconWrap} aria-hidden="true">
                {item.icon}
              </span>
              {!showCollapsedRail ? <span className={styles.label}>{item.label}</span> : null}
            </span>
            {item.suffix !== undefined ? <span className={styles.countBadge}>{item.suffix}</span> : null}
          </NavLink>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <Button
          tone="ghost"
          className={styles.accountButton}
          aria-expanded={accountMenuOpen}
          aria-haspopup="menu"
          onClick={() => setAccountMenuOpen((open) => !open)}
        >
          <span className={styles.avatar} aria-hidden="true">
            {session.email.slice(0, 2).toUpperCase()}
          </span>
          {!showCollapsedRail ? (
            <span className={styles.accountIdentity}>
              <span className="text-body">{session.email}</span>
              <span className={`text-caption ${styles.muted}`}>{session.role}</span>
            </span>
          ) : null}
        </Button>
        {accountMenuOpen ? (
          <div className={styles.accountMenu} role="menu">
            <p className="text-body">{session.email}</p>
            <p className={`text-caption ${styles.muted}`}>{session.role}</p>
            <Button tone="secondary" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        ) : null}
      </div>
    </aside>
  )

  return (
    <scopedTenantContext.Provider value={scopedContext}>
      <AuthoringStoreProvider museumId={museumId ?? null}>
        <div className={styles.tenantShellFrame} data-plane="tenant">
          {isScoped ? (
            <header className={styles.scopeBand}>
              <div className={styles.scopeBandCopy}>
                <p className="text-body">
                  Scoped into <span className="museum-name">{museumName}</span>. You are editing tenant data as a
                  platform operator ({session.email}).
                </p>
              </div>
              <Button tone="secondary" compact onClick={() => navigate('/operator/fleet')}>
                Leave tenant
              </Button>
            </header>
          ) : null}

          <div className={styles.tenantShell}>
            {isDrawer ? (
              <>
                {drawerOpen ? <button className={styles.drawerScrim} onClick={() => setDrawerOpen(false)} /> : null}
                {drawerOpen ? (
                  <div className={`${styles.drawerSidebar} ${isScoped ? styles.scopedDrawerSidebar : ''}`}>
                    {sidebarContent}
                  </div>
                ) : null}
              </>
            ) : (
              sidebarContent
            )}

            <main className={styles.contentRegion}>
              {isDrawer ? (
                <header className={styles.mobileBar}>
                  <Button
                    tone="ghost"
                    iconOnly
                    compact
                    label="Open menu"
                    icon={<MenuIcon />}
                    className={styles.menuButton}
                    onClick={() => setDrawerOpen(true)}
                  />
                  <p className="text-body">Tenant shell</p>
                  <span className={styles.collapsedOnly}> </span>
                </header>
              ) : null}
              <Outlet />
            </main>
          </div>
        </div>
      </AuthoringStoreProvider>
    </scopedTenantContext.Provider>
  )
}

function iconBase(props: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  )
}

function MenuIcon(): ReactElement {
  return iconBase({
    children: (
      <>
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
      </>
    ),
  })
}

function CloseIcon(): ReactElement {
  return iconBase({
    children: (
      <>
        <path d="M6 6l12 12" />
        <path d="M18 6l-12 12" />
      </>
    ),
  })
}

function ChevronLeftIcon(): ReactElement {
  return iconBase({ children: <path d="M15 6l-6 6 6 6" /> })
}

function ChevronRightIcon(): ReactElement {
  return iconBase({ children: <path d="M9 6l6 6-6 6" /> })
}

function OverviewIcon(): ReactElement {
  return iconBase({
    children: (
      <>
        <path d="M4 4h7v7H4z" />
        <path d="M13 4h7v4h-7z" />
        <path d="M13 10h7v10h-7z" />
        <path d="M4 13h7v7H4z" />
      </>
    ),
  })
}

function FleetIcon(): ReactElement {
  return iconBase({
    children: (
      <>
        <path d="M4 8h16" />
        <path d="M4 14h16" />
        <path d="M7 5v14" />
        <path d="M17 5v14" />
      </>
    ),
  })
}

function HealthIcon(): ReactElement {
  return iconBase({
    children: (
      <>
        <path d="M4 12h4l2.4-4 3.2 8 2.2-4H20" />
      </>
    ),
  })
}

function SpendIcon(): ReactElement {
  return iconBase({
    children: (
      <>
        <path d="M12 4v16" />
        <path d="M16 8.5c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.8 3 4 3 4 1.3 4 3-1.8 3-4 3-4-1.3-4-3" />
      </>
    ),
  })
}

function AuditIcon(): ReactElement {
  return iconBase({
    children: (
      <>
        <path d="M5 4h14v16H5z" />
        <path d="M8 8h8" />
        <path d="M8 12h8" />
        <path d="M8 16h5" />
      </>
    ),
  })
}

function AdminsIcon(): ReactElement {
  return iconBase({
    children: (
      <>
        <circle cx="9" cy="10" r="2.5" />
        <circle cx="16" cy="9" r="2" />
        <path d="M5.5 18a3.5 3.5 0 0 1 7 0" />
        <path d="M13.5 18a2.8 2.8 0 0 1 5.2-1.4" />
      </>
    ),
  })
}

function RoomsIcon(): ReactElement {
  return iconBase({
    children: (
      <>
        <path d="M4 20h16V4H4z" />
        <path d="M10 4v16" />
      </>
    ),
  })
}

function NarrationIcon(): ReactElement {
  return iconBase({
    children: (
      <>
        <path d="M5 8h14" />
        <path d="M5 12h10" />
        <path d="M5 16h8" />
      </>
    ),
  })
}

function TeamIcon(): ReactElement {
  return iconBase({
    children: (
      <>
        <path d="M16 19a4 4 0 0 0-8 0" />
        <circle cx="12" cy="10" r="3" />
      </>
    ),
  })
}

function ActivityIcon(): ReactElement {
  return iconBase({
    children: (
      <>
        <path d="M4 12h4l2-4 4 8 2-4h4" />
      </>
    ),
  })
}

function SettingsIcon(): ReactElement {
  return iconBase({
    children: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a8 8 0 0 0-1.8-1L14.3 3h-4.6l-.4 2.9a8 8 0 0 0-1.8 1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 1.8 1l.4 2.9h4.6l.4-2.9a8 8 0 0 0 1.8-1l2.4 1 2-3.4-2-1.6c.1-.3.1-.7.1-1Z" />
      </>
    ),
  })
}

function NoticeIcon(): ReactElement {
  return iconBase({
    children: (
      <>
        <path d="M12 5a5 5 0 0 0-5 5v3l-2 3h14l-2-3v-3a5 5 0 0 0-5-5Z" />
        <path d="M10 19a2 2 0 0 0 4 0" />
      </>
    ),
  })
}

function HelpIcon(): ReactElement {
  return iconBase({
    children: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.8-2.5 2-2.5 4" />
        <path d="M12 17h.01" />
      </>
    ),
  })
}

function App(): ReactElement {
  return (
    <div className={styles.appRoot}>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={appRouter} />
        </ToastProvider>
      </AuthProvider>
    </div>
  )
}

export default App
