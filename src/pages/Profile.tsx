import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Save, User, Users, LogIn } from "lucide-react";

function gradeColor(grade: number) {
  if (grade === 2) return "bg-red-500 text-white";
  if (grade === 3) return "bg-yellow-700 text-white";
  if (grade === 4) return "bg-yellow-400 text-black";
  if (grade === 5) return "bg-green-500 text-white";
  return "";
}

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Lobby join
  const [lobbyCode, setLobbyCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [myLobbies, setMyLobbies] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadProfile();
      loadMyLobbies();
    }
  }, [user]);

  const loadProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user!.id)
      .single();

    if (data) {
      setFullName(data.full_name || "");
      setBio(data.bio || "");
      setWebsite(data.website || "");
    }
    setLoaded(true);
  };

  const loadMyLobbies = async () => {
    const { data } = await supabase
      .from("lobby_participants")
      .select("*, lobbies(*)")
      .eq("user_id", user!.id)
      .order("joined_at", { ascending: false });
    if (data) setMyLobbies(data);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user!.id,
        full_name: fullName,
        bio,
        website,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      toast.error("Ошибка сохранения");
    } else {
      toast.success("Профиль обновлён!");
    }
    setSaving(false);
  };

  const joinLobby = async () => {
    if (!lobbyCode.trim()) { toast.error("Введите код лобби"); return; }
    setJoining(true);

    // Find lobby by code
    const { data: lobby } = await supabase
      .from("lobbies")
      .select("*")
      .eq("code", lobbyCode.trim().toUpperCase())
      .eq("is_active", true)
      .single();

    if (!lobby) {
      toast.error("Лобби не найдено или завершено");
      setJoining(false);
      return;
    }

    // Check if already joined
    const { data: existing } = await supabase
      .from("lobby_participants")
      .select("id")
      .eq("lobby_id", lobby.id)
      .eq("user_id", user!.id)
      .maybeSingle();

    if (existing) {
      navigate(`/lobby/${lobby.id}`);
      setJoining(false);
      return;
    }

    const nickname = fullName || user!.email?.split("@")[0] || "Ученик";
    const { error } = await supabase.from("lobby_participants").insert({
      lobby_id: lobby.id,
      user_id: user!.id,
      nickname,
      is_online: true,
    });

    if (error) {
      toast.error("Ошибка подключения: " + error.message);
    } else {
      toast.success("Вы подключились к лобби!");
      navigate(`/lobby/${lobby.id}`);
    }
    setJoining(false);
  };

  if (authLoading || !user || !loaded) return null;

  const initials = fullName ? fullName.split(" ").map(n => n[0]).join("").toUpperCase() : user.email?.[0]?.toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container flex items-center h-14">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Назад
          </Button>
        </div>
      </header>

      <main className="container max-w-2xl py-8 space-y-6">
        <div className="flex items-center gap-4 mb-8">
          <Avatar className="w-16 h-16">
            <AvatarFallback className="gradient-primary text-primary-foreground text-xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">Профиль</h1>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </div>

        {/* Join Lobby */}
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Присоединиться к лобби
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={lobbyCode}
                onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
                placeholder="Введите код (напр. PYT-7K)"
                className="font-mono"
              />
              <Button variant="hero" onClick={joinLobby} disabled={joining}>
                <LogIn className="w-4 h-4 mr-1" />
                {joining ? "..." : "Войти"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* My lobbies */}
        {myLobbies.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Мои лобби</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {myLobbies.map((ml: any) => {
                const lob = ml.lobbies;
                return (
                  <div
                    key={ml.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/lobby/${ml.lobby_id}`)}
                  >
                    <div>
                      <p className="font-medium">{lob?.title || "Лобби"}</p>
                      <p className="text-xs text-muted-foreground font-mono">Код: {lob?.code}</p>
                    </div>
                    <Badge variant={lob?.is_active ? "default" : "secondary"}>
                      {lob?.is_active ? "Активно" : "Завершено"}
                    </Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Profile form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Личные данные
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Имя</Label>
              <Input
                id="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ваше имя"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">О себе</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Расскажите о себе"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Сайт</Label>
              <Input
                id="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <Button variant="hero" onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-1" />
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
