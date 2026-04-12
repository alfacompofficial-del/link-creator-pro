import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CodeEditor from "@/components/CodeEditor";
import { toast } from "sonner";
import { ArrowLeft, MessageSquare, CheckCircle2, Eye, Globe, ExternalLink, Copy } from "lucide-react";

// ── Default templates ────────────────────────────────────────────────────────
const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Мой сайт</title>
</head>
<body>
    
</body>
</html>`;

const DEFAULT_CSS = `/* Мои стили */
body {
    margin: 0;
    font-family: Arial, sans-serif;
}
`;

const DEFAULT_JS = `// Мой JavaScript код

document.addEventListener('DOMContentLoaded', () => {
    
});
`;

const DEFAULT_PYTHON = `# Мой Python код

print("Привет, мир!")
`;

// ── Code helpers (JSON for html, plain for others) ───────────────────────────
interface HtmlCode { html: string; css: string; js: string; deployed_url?: string; }

function parseCode(raw: string, language: string): HtmlCode | string {
  if (language === "html") {
    if (!raw) return { html: DEFAULT_HTML, css: DEFAULT_CSS, js: DEFAULT_JS };
    try {
      const p = JSON.parse(raw);
      if (p && typeof p === "object" && "html" in p) {
        return {
          html: p.html ?? DEFAULT_HTML,
          css: p.css ?? DEFAULT_CSS,
          js: p.js ?? DEFAULT_JS,
          deployed_url: p.deployed_url,
        };
      }
    } catch {}
    // Legacy plain string → treat as HTML
    return { html: raw || DEFAULT_HTML, css: DEFAULT_CSS, js: DEFAULT_JS };
  }
  if (!raw) {
    if (language === "python") return DEFAULT_PYTHON;
    if (language === "css") return DEFAULT_CSS;
    return "// Мой код\n";
  }
  return raw;
}

function serializeCode(data: HtmlCode | string, language: string): string {
  if (language === "html" && typeof data === "object") {
    return JSON.stringify(data);
  }
  return String(data);
}

// ── Grade helpers ─────────────────────────────────────────────────────────────
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

type TabKey = "html" | "css" | "js";
const TABS: { key: TabKey; label: string }[] = [
  { key: "html", label: "HTML" },
  { key: "css",  label: "CSS" },
  { key: "js",   label: "JS" },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function StudentLobby() {
  const { lobbyId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [lobby, setLobby] = useState<any>(null);
  const [participant, setParticipant] = useState<any>(null);
  const [grade, setGrade] = useState<any>(null);

  // For HTML lobbies — three tabs
  const [htmlCode, setHtmlCode] = useState(DEFAULT_HTML);
  const [cssCode, setCssCode] = useState(DEFAULT_CSS);
  const [jsCode, setJsCode] = useState(DEFAULT_JS);
  const [activeTab, setActiveTab] = useState<TabKey>("html");

  // For single-language lobbies
  const [code, setCode] = useState("");

  const [savedIndicator, setSavedIndicator] = useState(false);

  const [showPreview, setShowPreview] = useState(false);
  const [deployDialog, setDeployDialog] = useState(false);
  const [deploySubdomain, setDeploySubdomain] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedLink, setDeployedLink] = useState("");

  // Prevent overwriting local edits from teacher's realtime push
  const editingRef = useRef(false);
  const editTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const participantIdRef = useRef<string | null>(null);
  const languageRef = useRef<string>("html");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && lobbyId) loadLobby();
  }, [user, lobbyId]);

  const loadLobby = async () => {
    const { data: lob } = await supabase
      .from("lobbies").select("*").eq("id", lobbyId).single();
    if (!lob) { toast.error("Лобби не найдено"); navigate("/profile"); return; }
    setLobby(lob);
    languageRef.current = lob.language;

    const { data: part } = await supabase
      .from("lobby_participants").select("*")
      .eq("lobby_id", lobbyId).eq("user_id", user!.id).single();

    let savedRaw = part?.student_code || "";

    if (part) {
      setParticipant(part);
      participantIdRef.current = part.id;

      const parsed = parseCode(savedRaw, lob.language);

      if (lob.language === "html") {
        const c = parsed as HtmlCode;
        setHtmlCode(c.html);
        setCssCode(c.css);
        setJsCode(c.js);
        if (c.deployed_url) setDeployedLink(c.deployed_url);
        // If no code yet — save the default template immediately
        if (!savedRaw) {
          const defaultSerialized = serializeCode(c, "html");
          await supabase.from("lobby_participants")
            .update({ student_code: defaultSerialized })
            .eq("id", part.id);
        }
      } else {
        const c = parsed as string;
        setCode(c);
        if (!savedRaw) {
          await supabase.from("lobby_participants")
            .update({ student_code: c })
            .eq("id", part.id);
        }
      }
      // Mark online
      await supabase.from("lobby_participants").update({ is_online: true }).eq("id", part.id);
    }

    const { data: gr } = await supabase
      .from("lobby_grades").select("*")
      .eq("lobby_id", lobbyId!).eq("student_id", user!.id).maybeSingle();
    if (gr) setGrade(gr);
  };

  // Set offline on unmount
  useEffect(() => {
    return () => {
      if (participantIdRef.current) {
        supabase.from("lobby_participants")
          .update({ is_online: false }).eq("id", participantIdRef.current);
      }
      if (editTimerRef.current) clearTimeout(editTimerRef.current);
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  // Realtime — teacher grade + teacher code update (only for THIS student)
  useEffect(() => {
    if (!lobbyId || !user) return;
    const channel = supabase
      .channel(`student-rt-${lobbyId}-${user.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "lobby_grades",
        filter: `lobby_id=eq.${lobbyId}`,
      }, (payload) => {
        const data = payload.new as any;
        if (data?.student_id === user.id) setGrade(data);
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "lobby_participants",
        filter: `lobby_id=eq.${lobbyId}`,
      }, (payload) => {
        const data = payload.new as any;
        // ONLY update if it's THIS student AND they're not currently typing
        if (data?.user_id === user.id && !editingRef.current) {
          setParticipant(data);
          const parsed = parseCode(data.student_code || "", languageRef.current);
          if (languageRef.current === "html") {
            const c = parsed as HtmlCode;
            setHtmlCode(c.html);
            setCssCode(c.css);
            setJsCode(c.js);
            if (c.deployed_url) setDeployedLink(c.deployed_url);
          } else {
            setCode(parsed as string);
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [lobbyId, user]);

  // ── Auto-save: debounce 1.5s after last change ─────────────────────────────
  const triggerAutoSave = (
    html: string, css: string, js: string,
    singleCode: string, lang: string, partId: string
  ) => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      const serialized = lang === "html"
        ? serializeCode({ html, css, js, deployed_url: deployedLink }, "html")
        : singleCode;
      const { error } = await supabase
        .from("lobby_participants")
        .update({ student_code: serialized })
        .eq("id", partId);
      if (!error) {
        setSavedIndicator(true);
        setTimeout(() => setSavedIndicator(false), 2000);
      }
    }, 1500);
  };

  const handleHtmlChange = (v: string) => {
    if (!participant) return;
    editingRef.current = true;
    setHtmlCode(v);
    if (editTimerRef.current) clearTimeout(editTimerRef.current);
    editTimerRef.current = setTimeout(() => { editingRef.current = false; }, 3000);
    triggerAutoSave(v, cssCode, jsCode, "", "html", participant.id);
  };
  const handleCssChange = (v: string) => {
    if (!participant) return;
    editingRef.current = true;
    setCssCode(v);
    if (editTimerRef.current) clearTimeout(editTimerRef.current);
    editTimerRef.current = setTimeout(() => { editingRef.current = false; }, 3000);
    triggerAutoSave(htmlCode, v, jsCode, "", "html", participant.id);
  };
  const handleJsChange = (v: string) => {
    if (!participant) return;
    editingRef.current = true;
    setJsCode(v);
    if (editTimerRef.current) clearTimeout(editTimerRef.current);
    editTimerRef.current = setTimeout(() => { editingRef.current = false; }, 3000);
    triggerAutoSave(htmlCode, cssCode, v, "", "html", participant.id);
  };
  const handleCodeChange = (v: string) => {
    if (!participant || !lobby) return;
    editingRef.current = true;
    setCode(v);
    if (editTimerRef.current) clearTimeout(editTimerRef.current);
    editTimerRef.current = setTimeout(() => { editingRef.current = false; }, 3000);
    triggerAutoSave("", "", "", v, lobby.language, participant.id);
  };

  const generatePreview = () => {
    return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Превью</title>
  <style>${isHtml ? cssCode : ""}</style>
</head>
<body>
${isHtml ? htmlCode : ""}
<script>${isHtml ? jsCode : code}<\/script>
</body>
</html>`;
  };

  const handleDeploy = async () => {
    if (!deploySubdomain.trim()) { toast.error("Укажите имя ссылки"); return; }
    if (!/^[a-z0-9-]+$/.test(deploySubdomain)) { toast.error("Только a-z, 0-9 и дефис"); return; }
    setIsDeploying(true);
    const sub = deploySubdomain.toLowerCase();

    const siteData = {
      user_id: user!.id,
      subdomain: sub,
      html_code: isHtml ? htmlCode : "",
      css_code: isHtml ? cssCode : "",
      js_code: isHtml ? jsCode : code,
      title: lobby.title || "Сайт ученика",
      full_html: generatePreview()
    };

    const { error: insertError } = await supabase.from("sites").insert(siteData);
    if (insertError) {
      if (insertError.code === "23505") toast.error("Это имя уже занято, выберите другое");
      else toast.error("Ошибка публикации: " + insertError.message);
      setIsDeploying(false);
      return;
    }

    setDeployedLink(sub);
    if (isHtml && participant) {
      const serialized = serializeCode({ html: htmlCode, css: cssCode, js: jsCode, deployed_url: sub }, "html");
      await supabase.from("lobby_participants").update({ student_code: serialized }).eq("id", participant.id);
    }

    toast.success("Сайт успешно опубликован!");
    setDeployDialog(false);
    setIsDeploying(false);
  };

  if (authLoading || !user || !lobby) return null;

  const isHtml = lobby.language === "html";
  const lang: "html" | "css" | "javascript" | "python" =
    lobby.language === "python" ? "python"
    : lobby.language === "css" ? "css"
    : lobby.language === "javascript" ? "javascript"
    : "html";

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm shrink-0 z-10">
        <div className="flex items-center justify-between h-14 px-2 md:px-4 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1 md:gap-3 min-w-0 mr-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => navigate("/profile")} className="px-2 shrink-0">
              <ArrowLeft className="w-4 h-4 md:mr-1" /> <span className="hidden md:inline">Профиль</span>
            </Button>
            <span className="font-semibold text-sm md:text-base truncate max-w-[120px] sm:max-w-xs">{lobby.title}</span>
            <Badge variant={lobby.is_active ? "default" : "secondary"} className="text-[10px] md:text-xs hidden sm:inline-flex shrink-0">
              {lobby.is_active ? "Активно" : "Завершено"}
            </Badge>
          </div>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            {savedIndicator && (
              <span className="flex items-center gap-1 text-[10px] md:text-xs text-green-500 animate-fade-up">
                <CheckCircle2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Сохранено</span>
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)} className="h-8 md:h-9">
              <Eye className="w-3.5 h-3.5 md:mr-1" /> <span className="hidden sm:inline">{showPreview ? "Код" : "Превью"}</span>
            </Button>
            <Button variant="hero" size="sm" onClick={() => setDeployDialog(true)} className="h-8 md:h-9" disabled={!isHtml}>
              <Globe className="w-3.5 h-3.5 md:mr-1" /> <span className="hidden sm:inline">Опубликовать</span>
            </Button>
            {grade && (
              <div className={`inline-flex flex-col items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full text-xs md:text-sm font-bold shrink-0 ${gradeColor(grade.grade)}`}>
                <span>{grade.grade}</span>
              </div>
            )}
            {grade && (
              <span className="hidden sm:block text-xs text-muted-foreground whitespace-nowrap">{gradeLabel(grade.grade)}</span>
            )}
          </div>
        </div>
      </header>

      {/* Teacher comment */}
      {grade?.comment && (
        <div className="shrink-0 bg-primary/5 border-b border-primary/20 px-4 py-2">
          <div className="flex items-center gap-2 text-sm">
            <MessageSquare className="w-4 h-4 text-primary shrink-0" />
            <span className="text-muted-foreground">Комментарий учителя:</span>
            <span className="font-medium">{grade.comment}</span>
          </div>
        </div>
      )}

      {/* Lobby closed notice */}
      {!lobby.is_active && (
        <div className="shrink-0 bg-muted/60 border-b border-border/50 px-4 py-2 text-center text-sm text-muted-foreground">
          Урок завершён — редактирование недоступно
        </div>
      )}

      {/* Preview or Editor layout */}
      {showPreview ? (
        <div className="flex-1 bg-background relative">
          <iframe
            srcDoc={generatePreview()}
            className="w-full h-full border-0 absolute inset-0 bg-white"
            title="Превью сайта"
          />
        </div>
      ) : isHtml ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="shrink-0 flex border-b border-border/50 bg-card/30 px-3 pt-2 gap-1">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-1.5 text-sm font-medium rounded-t-md transition-all border-b-2 ${
                  activeTab === tab.key
                    ? "border-primary text-primary bg-primary/10"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Editor */}
          <div className="flex-1 overflow-hidden p-2">
            <div className="h-full rounded-lg overflow-hidden border border-border/40">
              {activeTab === "html" && (
                <CodeEditor
                  language="html"
                  value={htmlCode}
                  onChange={lobby.is_active ? handleHtmlChange : () => {}}
                />
              )}
              {activeTab === "css" && (
                <CodeEditor
                  language="css"
                  value={cssCode}
                  onChange={lobby.is_active ? handleCssChange : () => {}}
                />
              )}
              {activeTab === "js" && (
                <CodeEditor
                  language="javascript"
                  value={jsCode}
                  onChange={lobby.is_active ? handleJsChange : () => {}}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <main className="flex-1 overflow-hidden p-3">
          <div className="h-full rounded-lg overflow-hidden border border-border/40">
            <CodeEditor
              language={lang}
              value={code}
              onChange={lobby.is_active ? handleCodeChange : () => {}}
            />
          </div>
        </main>
      )}

      {/* Deploy Dialog */}
      <Dialog open={deployDialog} onOpenChange={setDeployDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Опубликовать сайт
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!deployedLink ? (
              <div className="space-y-2">
                <Label>Придумайте короткую ссылку</Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">/site/</span>
                  <Input
                    value={deploySubdomain}
                    onChange={(e) => setDeploySubdomain(e.target.value)}
                    placeholder="my-cool-site"
                    className="font-mono text-sm"
                  />
                </div>
                <Button variant="hero" onClick={handleDeploy} disabled={isDeploying} className="w-full mt-4">
                  {isDeploying ? "Публикация..." : "Опубликовать"}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-600 rounded-lg text-sm mb-4">
                  Вы уже опубликовали свой текущий сайт! 
                </div>
                <Label>Ваша ссылка:</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={`${window.location.origin}/site/${deployedLink}`} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/site/${deployedLink}`);
                    toast.success("Скопировано!");
                  }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => window.open(`/site/${deployedLink}`, "_blank")}>
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Чтобы обновить его, перейдите в <span className="font-semibold text-foreground">Профиль &gt; Мои сайты</span>.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
