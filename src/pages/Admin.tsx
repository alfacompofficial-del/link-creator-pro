import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, FolderOpen, Eye, Mail, Globe, Code2 } from "lucide-react";
import { toast } from "sonner";

interface UserInfo {
  id: string;
  email: string;
  created_at: string;
}

interface UserSite {
  id: string;
  subdomain: string;
  title: string | null;
  html_code: string | null;
  css_code: string | null;
  js_code: string | null;
  created_at: string;
}

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserInfo[]>([]);
  const [totalSites, setTotalSites] = useState(0);
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  const [userSites, setUserSites] = useState<UserSite[]>([]);
  const [viewingSite, setViewingSite] = useState<UserSite | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) navigate("/auth");
      else if (!isAdmin) {
        toast.error("Доступ запрещён");
        navigate("/dashboard");
      }
    }
  }, [user, isAdmin, authLoading, adminLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadStats();
    }
  }, [isAdmin]);

  const loadStats = async () => {
    // Load sites count
    const { count } = await supabase
      .from("sites")
      .select("*", { count: "exact", head: true });

    setTotalSites(count || 0);

    // Load users with emails via edge function
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("admin-users", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (response.data?.users) {
        setUsers(response.data.users);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    }

    setLoadingUsers(false);
  };

  const loadUserSites = async (userId: string) => {
    const { data } = await supabase
      .from("sites")
      .select("id, subdomain, title, html_code, css_code, js_code, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    setUserSites(data || []);
  };

  const handleSelectUser = (u: UserInfo) => {
    setSelectedUser(u);
    setViewingSite(null);
    loadUserSites(u.id);
  };

  if (authLoading || adminLoading || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Назад
            </Button>
            <span className="text-sm font-semibold text-primary">Админ-панель</span>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <Tabs defaultValue="stats" className="space-y-6">
          <TabsList>
            <TabsTrigger value="stats">
              <Users className="w-4 h-4 mr-1" />
              Статистика
            </TabsTrigger>
            <TabsTrigger value="users">
              <FolderOpen className="w-4 h-4 mr-1" />
              Пользователи и проекты
            </TabsTrigger>
          </TabsList>

          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Пользователей</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{users.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Всего сайтов</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{totalSites}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Зарегистрированные пользователи
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingUsers ? (
                  <p className="text-muted-foreground">Загрузка...</p>
                ) : (
                  <div className="space-y-2">
                    {users.map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                        <div>
                          <p className="font-medium">{u.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Регистрация: {new Date(u.created_at).toLocaleDateString("ru-RU")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users & Projects Tab */}
          <TabsContent value="users" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* User list */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-base">Пользователи</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleSelectUser(u)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedUser?.id === u.id
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted/30 border border-transparent"
                      }`}
                    >
                      <p className="font-medium text-sm">{u.email}</p>
                    </button>
                  ))}
                </CardContent>
              </Card>

              {/* Projects */}
              <div className="lg:col-span-2 space-y-4">
                {selectedUser ? (
                  <>
                    <h3 className="font-semibold">
                      Проекты: {selectedUser.email}
                    </h3>
                    {viewingSite ? (
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Eye className="w-4 h-4" />
                              {viewingSite.title || viewingSite.subdomain} — Просмотр кода
                            </CardTitle>
                            <Button variant="ghost" size="sm" onClick={() => setViewingSite(null)}>
                              Назад к проектам
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <p className="text-sm font-semibold mb-2 text-muted-foreground">HTML</p>
                            <pre className="bg-muted/50 p-4 rounded-lg text-sm overflow-auto max-h-60 font-mono">
                              {viewingSite.html_code || "— пусто —"}
                            </pre>
                          </div>
                          <div>
                            <p className="text-sm font-semibold mb-2 text-muted-foreground">CSS</p>
                            <pre className="bg-muted/50 p-4 rounded-lg text-sm overflow-auto max-h-60 font-mono">
                              {viewingSite.css_code || "— пусто —"}
                            </pre>
                          </div>
                          <div>
                            <p className="text-sm font-semibold mb-2 text-muted-foreground">JavaScript</p>
                            <pre className="bg-muted/50 p-4 rounded-lg text-sm overflow-auto max-h-60 font-mono">
                              {viewingSite.js_code || "— пусто —"}
                            </pre>
                          </div>
                        </CardContent>
                      </Card>
                    ) : userSites.length === 0 ? (
                      <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                          У этого пользователя нет проектов
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-2">
                        {userSites.map((site) => (
                          <Card key={site.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setViewingSite(site)}>
                            <CardContent className="py-4 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Globe className="w-5 h-5 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">{site.title || "Без названия"}</p>
                                  <p className="text-xs text-muted-foreground font-mono">/site/{site.subdomain}</p>
                                </div>
                              </div>
                              <Button variant="ghost" size="sm">
                                <Eye className="w-4 h-4 mr-1" />
                                Код
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Выберите пользователя слева
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
