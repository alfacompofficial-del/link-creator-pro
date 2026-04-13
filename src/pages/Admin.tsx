import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, FolderOpen, Eye, Mail, Globe, Save, Lock, GraduationCap, Plus, Copy, Play } from "lucide-react";
import { toast } from "sonner";
import CodeEditor from "@/components/CodeEditor";

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
  js_code: string | null;
  created_at: string;
}

interface Lobby {
  id: string;
  title: string;
  code: string;
  language: string;
  status: string;
  created_at: string;
}

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isTeacher, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserInfo[]>([]);
  const [totalSites, setTotalSites] = useState(0);
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  const [userSites, setUserSites] = useState<UserSite[]>([]);
  const [viewingSite, setViewingSite] = useState<UserSite | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  
  // Teacher edit state
  const [activeTab, setActiveTab] = useState("html");
  const [htmlCode, setHtmlCode] = useState("");
  const [cssCode, setCssCode] = useState("");
  const [jsCode, setJsCode] = useState("");
  const [saving, setSaving] = useState(false);

  // Lobbies state
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [lobbyTitle, setLobbyTitle] = useState("");
  const [lobbyLang, setLobbyLang] = useState("HTML/CSS/JS");
  const [creatingLobby, setCreatingLobby] = useState(false);

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) navigate("/auth");
      else if (!isAdmin && !isTeacher) {
        toast.error("Доступ запрещён");
        navigate("/dashboard");
      }
    }
  }, [user, isAdmin, isTeacher, authLoading, adminLoading, navigate]);

  useEffect(() => {
    if (isAdmin || isTeacher) {
      loadStats();
      if (user) loadLobbies(user.id);
    }
  }, [isAdmin, isTeacher, user]);

  const loadStats = async () => {
    const { count } = await supabase
      .from("sites")
      .select("*", { count: "exact", head: true });

    setTotalSites(count || 0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("admin-users", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (response.data?.users) {
        setUsers(response.data.users);
      } else if (response.data?.error) {
        toast.error(response.data.error);
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

  const loadLobbies = async (teacherId: string) => {
    const { data } = await supabase
      .from("lobbies")
      .select("*")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });
    setLobbies(data || []);
  };

  const handleCreateLobby = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !lobbyTitle.trim()) return;
    setCreatingLobby(true);
    
    // Generate code e.g. PYT-7K
    const prefix = lobbyLang === "Python" ? "PYT" : "WEB";
    const shortCode = `${prefix}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const { error } = await supabase.from("lobbies").insert({
      teacher_id: user.id,
      title: lobbyTitle,
      code: shortCode,
      language: lobbyLang
    });

    if (error) {
      toast.error("Ошибка при создании лобби: " + error.message);
    } else {
      toast.success(`Лобби ${shortCode} создано!`);
      setLobbyTitle("");
      loadLobbies(user.id);
    }
    setCreatingLobby(false);
  };

  const handleSelectUser = (u: UserInfo) => {
    setSelectedUser(u);
    setViewingSite(null);
    loadUserSites(u.id);
  };

  const handleOpenSite = (site: UserSite) => {
    setViewingSite(site);
    setHtmlCode(site.html_code || "");
    setCssCode(site.css_code || "");
    setJsCode(site.js_code || "");
    setActiveTab("html");
  };

  const generatePreview = (html: string, css: string, js: string) => {
    return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <base target="_blank">
  <style>${css}</style>
</head>
<body>
${html}
<script>${js}<\/script>
</body>
</html>`;
  };

  const handleSaveAsTeacher = async () => {
    if (!viewingSite) return;
    setSaving(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("teacher-update-site", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: {
          siteId: viewingSite.id,
          htmlCode,
          cssCode,
          jsCode,
          fullHtml: generatePreview(htmlCode, cssCode, jsCode)
        }
      });

      if (response.error || response.data?.error) {
        throw new Error(response.data?.error || response.error?.message || "Ошибка сохранения");
      }

      toast.success("Код ученика успешно сохранен!");
      
      // Update local state so it doesn't revert if toggled
      const updatedSite = { ...viewingSite, html_code: htmlCode, css_code: cssCode, js_code: jsCode };
      setViewingSite(updatedSite);
      setUserSites(prev => prev.map(s => s.id === updatedSite.id ? updatedSite : s));
      
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || adminLoading || (!isAdmin && !isTeacher)) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container flex items-center gap-3 h-14">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Назад
          </Button>
          <span className="text-sm font-semibold text-primary">
            {isAdmin ? "Админ-панель" : "Учительская"}
          </span>
          <span className="text-xs text-muted-foreground ml-auto">
            {user?.email}
          </span>
        </div>
      </header>

      <main className="container py-8">
        <Tabs defaultValue={isAdmin ? "stats" : "users"} className="space-y-6">
          <TabsList>
            {isAdmin && (
              <TabsTrigger value="stats">
                <Users className="w-4 h-4 mr-1" />
                Статистика
              </TabsTrigger>
            )}
            <TabsTrigger value="lobbies">
              <GraduationCap className="w-4 h-4 mr-1" />
              Лобби (Уроки)
            </TabsTrigger>
            <TabsTrigger value="users">
              <FolderOpen className="w-4 h-4 mr-1" />
              Ученики и Проекты
            </TabsTrigger>
          </TabsList>

          {/* Stats Tab (Only for Super Admin) */}
          {isAdmin && (
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
                          <span className="text-xs text-muted-foreground font-mono">#{u.id.slice(0, 8)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Lobbies Tab (For Teachers) */}
          <TabsContent value="lobbies" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Lobbies list */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">Ваши актуальные лобби</h3>
                </div>
                
                {lobbies.length === 0 ? (
                  <Card className="border-border/50">
                    <CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center">
                      <GraduationCap className="w-12 h-12 mb-3 opacity-20" />
                      Вы еще не создали ни одного лобби
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-3">
                    {lobbies.map((lobby) => (
                      <Card key={lobby.id} className="border-primary/20 hover:border-primary/50 transition-colors">
                        <CardContent className="py-4 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`w-2 h-2 rounded-full ${lobby.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`} />
                              <h4 className="font-semibold text-lg">{lobby.title}</h4>
                            </div>
                            <div className="flex gap-3 text-sm text-muted-foreground">
                              <span>Код: <strong className="text-foreground tracking-wider">{lobby.code}</strong></span>
                              <span>•</span>
                              <span>Язык: {lobby.language}</span>
                              <span>•</span>
                              <span>{new Date(lobby.created_at).toLocaleDateString("ru-RU")}</span>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => {
                              navigator.clipboard.writeText(lobby.code);
                              toast.success("Код скопирован");
                            }}>
                              <Copy className="w-4 h-4 mr-1" /> Код
                            </Button>
                            <Button variant="hero" size="sm">
                              <Play className="w-4 h-4 mr-1" /> Войти
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Create Lobby Pane */}
              <Card className="lg:col-span-1 border-primary/20 border-2 shadow-lg h-fit sticky top-20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary" />
                    Создать новое лобби
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateLobby} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Тема урока</label>
                      <input
                        type="text"
                        required
                        value={lobbyTitle}
                        onChange={(e) => setLobbyTitle(e.target.value)}
                        placeholder="Например: Урок 7 - CSS Grid"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Язык</label>
                      <select
                        value={lobbyLang}
                        onChange={(e) => setLobbyLang(e.target.value)}
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="HTML/CSS/JS">Web (HTML/CSS/JS)</option>
                        <option value="Python">Python</option>
                      </select>
                    </div>

                    <Button type="submit" variant="hero" className="w-full" disabled={creatingLobby}>
                      {creatingLobby ? "Создание..." : "Сгенерировать код"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Users & Projects Tab (For Both) */}
          <TabsContent value="users" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* User list */}
              <Card className="lg:col-span-1 border-border/50">
                <CardHeader>
                  <CardTitle className="text-base text-muted-foreground">Ученики</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 max-h-[600px] overflow-y-auto">
                  {loadingUsers ? (
                    <p className="text-sm text-muted-foreground">Загрузка списка...</p>
                  ) : (
                    users.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => handleSelectUser(u)}
                        className={`w-full text-left p-3 rounded-lg transition-colors flex items-center justify-between group ${
                          selectedUser?.id === u.id
                            ? "bg-primary/10 border border-primary/30"
                            : "hover:bg-muted/30 border border-transparent"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{u.email}</p>
                        </div>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Projects pane */}
              <div className="lg:col-span-2 space-y-4">
                {selectedUser ? (
                  <>
                    <h3 className="font-semibold flex items-center gap-2">
                      Проекты: <span className="text-muted-foreground">{selectedUser.email}</span>
                    </h3>
                    
                    {/* View Editor Mode */}
                    {viewingSite ? (
                      <Card className="border-border/50 shadow-md">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              {viewingSite.title || viewingSite.subdomain} <span className="text-muted-foreground text-sm font-normal">(/site/{viewingSite.subdomain})</span>
                            </CardTitle>
                            <div className="flex items-center gap-2">
                              <Button variant="hero" size="sm" onClick={handleSaveAsTeacher} disabled={saving}>
                                <Save className="w-4 h-4 mr-1" />
                                {saving ? "Сохранение..." : "Сохранить код"}
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setViewingSite(null)}>
                                Закрыть
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-[500px]">
                            <TabsList className="mb-4 w-fit">
                              <TabsTrigger value="html" className="font-mono text-sm">HTML</TabsTrigger>
                              <TabsTrigger value="css" className="font-mono text-sm">CSS</TabsTrigger>
                              <TabsTrigger value="js" className="font-mono text-sm">JavaScript</TabsTrigger>
                            </TabsList>
                            <div className="flex-1 min-h-0 border rounded-md overflow-hidden">
                              {activeTab === "html" && (
                                <CodeEditor language="html" value={htmlCode} onChange={setHtmlCode} />
                              )}
                              {activeTab === "css" && (
                                <CodeEditor language="css" value={cssCode} onChange={setCssCode} />
                              )}
                              {activeTab === "js" && (
                                <CodeEditor language="javascript" value={jsCode} onChange={setJsCode} />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              Вы редактируете этот код в режиме учителя. Ученик увидит эти изменения сразу после сохранения.
                            </p>
                          </Tabs>
                        </CardContent>
                      </Card>
                    ) : userSites.length === 0 ? (
                      <Card className="border-border/50">
                        <CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center">
                          <FolderOpen className="w-10 h-10 mb-3 opacity-20" />
                          У этого ученика пока нет проектов
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-3">
                        {userSites.map((site) => (
                          <Card key={site.id} className="cursor-pointer hover:border-primary/50 transition-colors border-border/50" onClick={() => handleOpenSite(site)}>
                            <CardContent className="py-4 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Globe className="w-6 h-6 text-primary/50" />
                                <div>
                                  <p className="font-medium text-sm">{site.title || "Без названия"}</p>
                                  <p className="text-xs text-muted-foreground font-mono mt-0.5">/site/{site.subdomain}</p>
                                </div>
                              </div>
                              <Button variant="secondary" size="sm">
                                <Eye className="w-4 h-4 mr-1" />
                                Просмотр / Редактирование
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Card className="border-border/50">
                    <CardContent className="py-20 text-center text-muted-foreground flex flex-col items-center">
                      <Users className="w-12 h-12 mb-4 opacity-20" />
                      Выберите ученика из списка слева, чтобы посмотреть его проекты
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
