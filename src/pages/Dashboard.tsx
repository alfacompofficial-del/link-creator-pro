import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Code2, Plus, Globe, ExternalLink, LogOut, User, Trash2, Copy, Shield, Users } from "lucide-react";
import { toast } from "sonner";

const SITE_BASE_URL = `${window.location.origin}/site`;

interface Site {
  id: string;
  subdomain: string;
  title: string;
  description: string;
  created_at: string;
}

export default function Dashboard() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { isAdmin, isTeacher } = useAdmin();
  const navigate = useNavigate();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchSites();
  }, [user]);

  const fetchSites = async () => {
    const { data, error } = await supabase
      .from("sites")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });

    if (!error && data) setSites(data);
    setLoading(false);
  };

  const deleteSite = async (id: string) => {
    const { error } = await supabase.from("sites").delete().eq("id", id);
    if (error) {
      toast.error("Ошибка удаления");
    } else {
      toast.success("Сайт удалён");
      setSites(sites.filter((s) => s.id !== id));
    }
  };

  const copySiteLink = (subdomain: string) => {
    const link = `${SITE_BASE_URL}/${subdomain}`;
    navigator.clipboard.writeText(link);
    toast.success("Ссылка скопирована!");
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Code2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">AlfaHost</span>
          </Link>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate("/admin")} className="text-primary border-primary/30">
                <Shield className="w-4 h-4 mr-1" />
                Админ
              </Button>
            )}
            {(isAdmin || isTeacher) && (
              <Button variant="outline" size="sm" onClick={() => navigate("/lobby")} className="text-primary border-primary/30">
                <Users className="w-4 h-4 mr-1" />
                Лобби
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => navigate("/profile")}>
              <User className="w-4 h-4 mr-1" />
              Профиль
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-1" />
              Выйти
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Мои сайты</h1>
            <p className="text-muted-foreground mt-1">Управляйте своими опубликованными сайтами</p>
          </div>
          <Button variant="hero" onClick={() => navigate("/editor")}>
            <Plus className="w-4 h-4 mr-1" />
            Создать сайт
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-5 bg-muted rounded w-2/3" />
                  <div className="h-4 bg-muted rounded w-full mt-2" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : sites.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Пока нет сайтов</h3>
              <p className="text-muted-foreground mb-6">Создайте свой первый сайт прямо сейчас</p>
              <Button variant="hero" onClick={() => navigate("/editor")}>
                <Plus className="w-4 h-4 mr-1" />
                Создать сайт
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sites.map((site) => (
              <Card key={site.id} className="group hover:shadow-lg transition-all duration-300 border-border/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{site.title || "Без названия"}</CardTitle>
                      <CardDescription className="mt-1 font-mono text-xs">
                        /site/{site.subdomain}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => copySiteLink(site.subdomain)}
                        title="Скопировать ссылку"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => navigate(`/editor/${site.id}`)}
                      >
                        <Code2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteSite(site.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {site.description || "Без описания"}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/editor/${site.id}`)}
                    >
                      Редактировать
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => window.open(`${SITE_BASE_URL}/${site.subdomain}`, "_blank")}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}