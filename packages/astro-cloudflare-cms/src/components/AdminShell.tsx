import { SidebarInset, SidebarProvider, SidebarTrigger } from './ui/sidebar';
import AppSidebar from './AppSidebar';

interface Props {
  title: string;
  currentPath: string;
  isMaster: boolean;
  userName: string;
  userRole: string;
  /** Persisted collapse state, read from the `sidebar_state` cookie by AdminLayout. */
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export default function AdminShell({
  title,
  currentPath,
  isMaster,
  userName,
  userRole,
  defaultOpen = true,
  actions,
  children,
}: Props) {
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar
        currentPath={currentPath}
        isMaster={isMaster}
        userName={userName}
        userRole={userRole}
      />
      <SidebarInset className="min-w-0">
        <header className="flex items-center gap-2 border-b px-4 py-2">
          <SidebarTrigger />
          <h1 className="text-base font-semibold">{title}</h1>
          <div className="ml-auto">{actions}</div>
        </header>
        <main className="min-w-0 p-4">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
