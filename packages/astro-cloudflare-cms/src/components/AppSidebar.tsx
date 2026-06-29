import { config } from 'virtual:acc-config';
import { Newspaper, FolderTree, Users, Shield, User, LogOut, ExternalLink } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from './ui/sidebar';

interface Props {
  currentPath: string;
  isMaster: boolean;
  userName: string;
  userRole: string;
}

export default function AppSidebar({ currentPath, isMaster, userName, userRole }: Props) {
  const navItems = [
    {
      label: '記事',
      href: `${config.adminBasePath}`,
      icon: Newspaper,
      active: currentPath === `${config.adminBasePath}` || currentPath.startsWith(`${config.adminBasePath}/articles`),
      masterOnly: false,
    },
    {
      label: 'カテゴリ',
      href: `${config.adminBasePath}/categories`,
      icon: FolderTree,
      active: currentPath.startsWith(`${config.adminBasePath}/categories`),
      masterOnly: true,
    },
    {
      label: 'ユーザー',
      href: `${config.adminBasePath}/users`,
      icon: Users,
      active: currentPath.startsWith(`${config.adminBasePath}/users`),
      masterOnly: true,
    },
  ];

  const visibleItems = navItems.filter((item) => !item.masterOnly || isMaster);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href={`${config.adminBasePath}`}>
                <span className="flex aspect-square size-7 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                  {(config.brand[0] ?? 'a').toUpperCase()}
                </span>
                <span className="font-semibold">{config.brand}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={item.active} tooltip={item.label}>
                    <a href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="公開サイトを見る">
              <a href={`${config.newsBasePath}`} target="_blank" rel="noopener">
                <ExternalLink />
                <span>公開サイト</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={`${userName}（${userRole}）`}>
              {isMaster ? <Shield /> : <User />}
              <span>{userName}（{userRole}）</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <form method="POST" action={`${config.adminBasePath}/api/logout`}>
              <SidebarMenuButton asChild tooltip="ログアウト">
                <button type="submit">
                  <LogOut />
                  <span>ログアウト</span>
                </button>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
