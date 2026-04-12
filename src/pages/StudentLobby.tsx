import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CodeEditor from "@/components/CodeEditor";
import { toast } from "sonner";
import { ArrowLeft, Save, MessageSquare, Clock } from "lucide-react";

// ── Default templates per language ──────────────────────────────────────────
const DEFAULT_TEMPLATES: Record<string, string> = {
  html: `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Мой сайт</title>
</head>
<body>
    
</body>
</html>`,
  css: `/* Мои стили */
body {
    margin: 0;
    font-family: Arial, sans-serif;
    background-color: #f0f0f0;
}

h1 {
    color: #333;
    text-align: center;
}`,
  javascript: `// Мой JavaScript код

document.addEventListener('DOMContentLoaded', () => {
    console.log('Страница загружена!');
    
});`,
  python: `# Мой Python код

print("Привет, мир!")
`,
};

function gradeColor(grade: number) {
  if (grade === 2) return "bg-red-500 text-white";
  if (grade === 3) return "bg-yellow-700 text-white";
  if (grade === 4) return "bg-yellow-400 text-black";
  if (grade === 5) return "bg-green-500 text-white";
  return "";
}

function gradeLabel(grade: number) {
  if (grade === 2) return "Плохо";
  if (grade === 3) return "Удовл.";
  if (grade === 4) return "Хорошо";
  if (grade === 5) return "Отлично";
  return "";
}

export default function StudentLobby() {
  const { lobbyId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [lobby, setLobby] = useState<any>(null);
  const [participant, setParticipant] = useState<any>(null);
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [grade, setGrade] = useState<any>(null);

  // Prevent overwriting local edits from realtime updates
  const isEditingRef = useRef(false);
  const editTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && lobbyId) loadLobby();
  }, [user, lobbyId]);

  const loadLobby = async () => {
    const { data: lob } = await supabase
      .from("lobbies")
      .select("*")
      .eq("id", lobbyId)
      .single();
    if (!lob) { toast.error("Лобби не найдено"); navigate("/profile"); return; }
    setLobby(lob);

    const { data: part } = await supabase
      .from("lobby_participants")
      .select("*")
      .eq("lobby_id", lobbyId)
      .eq("user_id", user!.id)
      .single();

    if (part) {
      setParticipant(part);
      // If student has no code yet — use the default template for the language
      const initialCode = part.student_code || DEFAULT_TEMPLATES[lob.language] || DEFAULT_TEMPLATES["html"];
      setCode(initialCode);

      // If no code was saved yet — save the template immediately
      if (!part.student_code) {
        await supabase
          .from("lobby_participants")
          .update({ student_code: initialCode })
          .eq("id", part.id);
      }
    }

    const { data: gr } = await supabase
      .from("lobby_grades")
      .select("*")
      .eq("lobby_id", lobbyId!)
      .eq("student_id", user!.id)
      .maybeSingle();
    if (gr) setGrade(gr);

    // Mark as online
    if (part) {
      await supabase.from("lobby_participants").update({ is_online: true }).eq("id", part.id);
    }
  };

  // Set offline on unmount
  useEffect(() => {
    return () => {
      if (participant) {
        supabase.from("lobby_participants").update({ is_online: false }).eq("id", participant.id);
      }
      if (editTimerRef.current) clearTimeout(editTimerRef.current);
    };
  }, [participant]);

  // Realtime — teacher grades + teacher code updates
  useEffect(() => {
    if (!lobbyId || !user) return;
    const channel = supabase
      .channel(`student-${lobbyId}-${user.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "lobby_grades",
        filter: `lobby_id=eq.${lobbyId}`,
      }, (payload) => {
        const data = payload.new as any;
        if (data && data.student_id === user.id) setGrade(data);
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "lobby_participants",
        filter: `lobby_id=eq.${lobbyId}`,
      }, (payload) => {
        const data = payload.new as any;
        if (data && data.user_id === user.id) {
          // Only update code from server if student is NOT currently typing
          if (!isEditingRef.current) {
            setCode(data.student_code || "");
          }
          setParticipant(data);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [lobbyId, user]);

  // Track when student is editing (don't overwrite with server data for 3s)
  const handleCodeChange = (newCode: string) => {
    isEditingRef.current = true;
    setCode(newCode);
    if (editTimerRef.current) clearTimeout(editTimerRef.current);
    editTimerRef.current = setTimeout(() => {
      isEditingRef.current = false;
    }, 3000);
  };

  const saveCode = async () => {
    if (!participant) return;
    setSaving(true);
    const { error } = await supabase
      .from("lobby_participants")
      .update({ student_code: code })
      .eq("id", participant.id);
    if (error) toast.error("Ошибка сохранения");
    else {
      toast.success("Код сохранён!");
      setLastSaved(new Date());
    }
    setSaving(false);
  };

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!participant) return;
    const interval = setInterval(() => {
      if (code && participant) {
        supabase.from("lobby_participants")
          .update({ student_code: code })
          .eq("id", participant.id)
          .then(({ error }) => {
            if (!error) setLastSaved(new Date());
          });
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [code, participant]);

  if (authLoading || !user || !lobby) return null;

  const lang: "html" | "css" | "javascript" | "python" =
    lobby.language === "python" ? "python"
    : lobby.language === "css" ? "css"
    : lobby.language === "javascript" ? "javascript"
    : "html";

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm shrink-0 z-10">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/profile")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Профиль
            </Button>
            <span className="font-semibold">{lobby.title}</span>
            <Badge variant={lobby.is_active ? "default" : "secondary"} className="text-xs">
              {lobby.is_active ? "Активно" : "Завершено"}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            {lastSaved && (
              <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                Сохранено {lastSaved.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            {grade && (
              <div className={`inline-flex flex-col items-center justify-center w-10 h-10 rounded-full text-sm font-bold ${gradeColor(grade.grade)}`}>
                <span>{grade.grade}</span>
              </div>
            )}
            {grade && (
              <span className="hidden sm:block text-xs text-muted-foreground">{gradeLabel(grade.grade)}</span>
            )}
            <Button variant="hero" size="sm" onClick={saveCode} disabled={saving} className="gap-1.5">
              <Save className="w-4 h-4" />
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </header>

      {/* Teacher comment */}
      {grade?.comment && (
        <div className="shrink-0 bg-primary/5 border-b border-primary/20 px-4 py-2">
          <div className="flex items-center gap-2 text-sm">
            <MessageSquare className="w-4 h-4 text-primary shrink-0" />
            <span className="text-muted-foreground">Комментарий учителя:</span>
            <span className="text-foreground font-medium">{grade.comment}</span>
          </div>
        </div>
      )}

      {/* Lobby closed notice */}
      {!lobby.is_active && (
        <div className="shrink-0 bg-muted/60 border-b border-border/50 px-4 py-2 text-center text-sm text-muted-foreground">
          Урок завершён — редактирование недоступно
        </div>
      )}

      {/* Editor — takes all remaining space */}
      <main className="flex-1 overflow-hidden p-3">
        <div className="h-full rounded-lg overflow-hidden border border-border/40">
          <CodeEditor
            language={lang}
            value={code}
            onChange={lobby.is_active ? handleCodeChange : () => {}}
          />
        </div>
      </main>
    </div>
  );
}
