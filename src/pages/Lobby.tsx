import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import CodeEditor from "@/components/CodeEditor";
import { toast } from "sonner";

import {
  ArrowLeft, Plus, Users, Code2, Star, Download, Save, MessageSquare,
  Circle, ChevronRight, GraduationCap, BookOpen, Zap
} from "lucide-react";

function generateLobbyCode(): string {
  const prefixes = ["PYT", "FLX", "WEB", "CSS", "HTM", "JSX", "COD", "DEV"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = Math.floor(Math.random() * 90 + 10).toString();
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return `${prefix}-${suffix}${letter}`;
}

const LANGUAGES = [
  { value: "html", label: "HTML / CSS / JS" },
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "css", label: "CSS" },
];

interface Lobby {
  id: string;
  title: string;
  language: string;
  code: string;
  is_active: boolean;
  created_at: string;
}

interface Participant {
  id: string;
  lobby_id: string;
  user_id: string;
  nickname: string;
  student_code: string;
  is_online: boolean;
  joined_at: string;
}

interface Grade {
  id: string;
  lobby_id: string;
  student_id: string;
  teacher_id: string;
  grade: number;
  comment: string;
  updated_at: string;
}

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

export default function LobbyPage() {
  const { user, loading: authLoading } = useAuth();
  const { isTeacher, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();

  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [selectedLobby, setSelectedLobby] = useState<Lobby | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);

  // Create lobby form
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newLanguage, setNewLanguage] = useState("html");

  // Split-view: selected student
  const [activeStudent, setActiveStudent] = useState<Participant | null>(null);
  const [savingCode, setSavingCode] = useState(false);
  // Teacher editor tabs (for HTML lobbies)
  const [teacherTab, setTeacherTab] = useState<"html"|"css"|"js"|"preview">("html");
  const [editHtml, setEditHtml] = useState("");
  const [editCss, setEditCss] = useState("");
  const [editJs, setEditJs] = useState("");
  // For single-language lobbies
  const [editingCode, setEditingCode] = useState("");
  const teacherSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Grading dialog
  const [gradingStudent, setGradingStudent] = useState<Participant | null>(null);
  const [gradeValue, setGradeValue] = useState(5);
  const [gradeComment, setGradeComment] = useState("");
  const [savingGrade, setSavingGrade] = useState(false);

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) { navigate("/auth"); return; }
      if (!isTeacher) { navigate("/dashboard"); toast.error("Доступ только для учителей"); return; }
    }
  }, [user, authLoading, adminLoading, isTeacher, navigate]);

  useEffect(() => {
    if (user && isTeacher) fetchLobbies();
  }, [user, isTeacher]);

  const fetchLobbies = async () => {
    const { data } = await supabase
      .from("lobbies")
      .select("*")
      .eq("teacher_id", user!.id)
      .order("created_at", { ascending: false });
    if (data) setLobbies(data);
    setLoading(false);
  };

  const createLobby = async () => {
    if (!newTitle.trim()) { toast.error("Введите название урока"); return; }
    const code = generateLobbyCode();
    const { error } = await supabase.from("lobbies").insert({
      teacher_id: user!.id,
      title: newTitle.trim(),
      language: newLanguage,
      code,
    });
    if (error) { toast.error("Ошибка создания: " + error.message); return; }
    toast.success(`Лобби создано! Код: ${code}`);
    setNewTitle("");
    setShowCreate(false);
    fetchLobbies();
  };

  const selectLobby = async (lobby: Lobby) => {
    setSelectedLobby(lobby);
    setActiveStudent(null);
    setGradingStudent(null);
    const { data: parts } = await supabase
      .from("lobby_participants")
      .select("*")
      .eq("lobby_id", lobby.id)
      .order("joined_at", { ascending: true });
    if (parts) setParticipants(parts);
    const { data: gr } = await supabase
      .from("lobby_grades")
      .select("*")
      .eq("lobby_id", lobby.id);
    if (gr) setGrades(gr);
  };

  // Realtime subscriptions
  useEffect(() => {
    if (!selectedLobby) return;
    const channel = supabase
      .channel(`lobby-${selectedLobby.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lobby_participants", filter: `lobby_id=eq.${selectedLobby.id}` }, (payload) => {
        // Update participant in list without full reload
        if (payload.eventType === "UPDATE") {
          const updated = payload.new as Participant;
          setParticipants(prev => prev.map(p => p.id === updated.id ? updated : p));
          // If this is the currently viewed student, update code too
          setActiveStudent(prev => {
            if (prev && prev.id === updated.id) {
              setEditingCode(updated.student_code || "");
              return updated;
            }
            return prev;
          });
        } else {
          // INSERT or DELETE — refetch
          supabase.from("lobby_participants").select("*").eq("lobby_id", selectedLobby.id).order("joined_at", { ascending: true })
            .then(({ data }) => { if (data) setParticipants(data); });
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lobby_grades", filter: `lobby_id=eq.${selectedLobby.id}` }, () => {
        supabase.from("lobby_grades").select("*").eq("lobby_id", selectedLobby.id).then(({ data }) => { if (data) setGrades(data); });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedLobby?.id]);

  // ── Parse student code (JSON for html, plain for others) ─────────────────
  const parseStudentCodeForTeacher = (raw: string, language: string) => {
    if (language === "html") {
      if (!raw) return { html: "", css: "", js: "" };
      try {
        const p = JSON.parse(raw);
        if (p && typeof p === "object" && "html" in p)
          return { html: p.html || "", css: p.css || "", js: p.js || "" };
      } catch {}
      return { html: raw, css: "", js: "" };
    }
    return { html: raw || "", css: "", js: "" };
  };

  const openStudent = (p: Participant) => {
    setActiveStudent(p);
    setTeacherTab("html");
    if (selectedLobby?.language === "html") {
      const parsed = parseStudentCodeForTeacher(p.student_code, "html");
      setEditHtml(parsed.html);
      setEditCss(parsed.css);
      setEditJs(parsed.js);
    } else {
      setEditingCode(p.student_code || "");
    }
  };

  // Serialize and save teacher's edits for a specific student
  const doSaveStudentCode = async (student: Participant, html: string, css: string, js: string, single: string) => {
    if (!selectedLobby) return;
    let serialized = single;
    if (selectedLobby.language === "html") {
      let deployed_url = "";
      try {
        const p = JSON.parse(student.student_code || "{}");
        if (p && typeof p === "object" && p.deployed_url) deployed_url = p.deployed_url;
      } catch {}
      serialized = JSON.stringify({ html, css, js, deployed_url });
    }
    const { error } = await supabase
      .from("lobby_participants")
      .update({ student_code: serialized })
      .eq("id", student.id);
    if (!error) {
      setParticipants(prev => prev.map(p => p.id === student.id ? { ...p, student_code: serialized } : p));
    }
  };

  const saveStudentCode = async () => {
    if (!activeStudent) return;
    setSavingCode(true);
    await doSaveStudentCode(activeStudent, editHtml, editCss, editJs, editingCode);
    toast.success("Код сохранён");
    setSavingCode(false);
  };

  // Auto-save teacher edits after 1.5s
  const teacherAutoSave = (html: string, css: string, js: string, single: string) => {
    if (!activeStudent) return;
    if (teacherSaveTimerRef.current) clearTimeout(teacherSaveTimerRef.current);
    teacherSaveTimerRef.current = setTimeout(() => {
      doSaveStudentCode(activeStudent, html, css, js, single);
    }, 1500);
  };

  const openGrading = (p: Participant) => {
    setGradingStudent(p);
    const existing = grades.find(g => g.student_id === p.user_id);
    if (existing) {
      setGradeValue(existing.grade);
      setGradeComment(existing.comment || "");
    } else {
      setGradeValue(5);
      setGradeComment("");
    }
  };

  const saveGrade = async () => {
    if (!gradingStudent || !selectedLobby) return;
    setSavingGrade(true);
    const existing = grades.find(g => g.student_id === gradingStudent.user_id);
    let error;
    if (existing) {
      ({ error } = await supabase.from("lobby_grades").update({ grade: gradeValue, comment: gradeComment }).eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("lobby_grades").insert({
        lobby_id: selectedLobby.id,
        student_id: gradingStudent.user_id,
        teacher_id: user!.id,
        grade: gradeValue,
        comment: gradeComment,
      }));
    }
    if (error) toast.error("Ошибка: " + error.message);
    else {
      toast.success("Оценка сохранена");
      setGradingStudent(null);
      const { data } = await supabase.from("lobby_grades").select("*").eq("lobby_id", selectedLobby.id);
      if (data) setGrades(data);
    }
    setSavingGrade(false);
  };

  const exportToExcel = () => {
    if (!selectedLobby) return;

    // Helper: escape XML special chars
    const esc = (v: unknown) =>
      String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    // Build rows: header + data
    const header = ["Ученик", "Оценка"];

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">`;
    html += `<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>`;
    html += `<x:Name>Оценки</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>`;
    html += `</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table border="1">`;
    html += `<tr>${header.map(h => `<th style="background:#4F46E5;color:#fff;font-weight:bold;">${esc(h)}</th>`).join("")}</tr>`;

    participants.forEach(p => {
      const g = grades.find(gr => gr.student_id === p.user_id);
      let gradeBg = "";
      if (g) {
        if (g.grade === 2) gradeBg = "background-color: #ef4444; color: #fff;";
        if (g.grade === 3) gradeBg = "background-color: #d97706; color: #fff;";
        if (g.grade === 4) gradeBg = "background-color: #facc15; color: #000;";
        if (g.grade === 5) gradeBg = "background-color: #22c55e; color: #fff;";
      }

      const row = [
        esc(p.nickname),
        `<td style="font-weight:bold;text-align:center;${gradeBg}">${g ? String(g.grade) : "Нет"}</td>`
      ];

      html += `<tr><td>${row[0]}</td>${row[1]}</tr>`;
    });
    html += `</table></body></html>`;

    const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedLobby.title}_оценки.xls`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel файл скачан!");
  };

  const toggleLobbyActive = async () => {
    if (!selectedLobby) return;
    const { error } = await supabase
      .from("lobbies")
      .update({ is_active: !selectedLobby.is_active })
      .eq("id", selectedLobby.id);
    if (!error) {
      const updated = { ...selectedLobby, is_active: !selectedLobby.is_active };
      setSelectedLobby(updated);
      setLobbies(prev => prev.map(l => l.id === updated.id ? updated : l));
      toast.success(updated.is_active ? "Лобби активировано" : "Лобби завершено");
    }
  };

  if (authLoading || adminLoading || !user) return null;

  const lang = selectedLobby
    ? (selectedLobby.language === "python" ? "python"
      : selectedLobby.language === "css" ? "css"
      : selectedLobby.language === "javascript" ? "javascript"
      : "html")
    : "html";

  // ── LOBBY CLASSROOM VIEW (split-view) ──────────────────────────────────────
  if (selectedLobby) {
    return (
      <div className="h-screen bg-background flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm shrink-0 z-10">
          <div className="flex items-center justify-between h-14 px-2 md:px-4 overflow-x-auto scroolbar-hide">
            <div className="flex items-center gap-1 md:gap-3 min-w-0 mr-2">
              <Button variant="ghost" size="sm" onClick={() => { setSelectedLobby(null); setActiveStudent(null); }} className="px-2 shrink-0">
                <ArrowLeft className="w-4 h-4 md:mr-1" /> <span className="hidden md:inline">Лобби</span>
              </Button>
              <div className="flex items-center gap-1 md:gap-2 min-w-0">
                <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
                <span className="font-semibold text-sm md:text-base truncate max-w-[80px] sm:max-w-[200px]">{selectedLobby.title}</span>
                <Badge variant={selectedLobby.is_active ? "default" : "secondary"} className="text-[10px] md:text-xs shrink-0">
                  {selectedLobby.is_active ? "Актив" : "Завершено"}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-1 md:gap-2 shrink-0">
              <div className="hidden md:flex items-center gap-1.5 bg-muted/60 rounded-lg px-2 py-1 md:px-3 md:py-1.5">
                <span className="text-xs text-muted-foreground">Код:</span>
                <span className="font-mono font-bold text-primary text-sm tracking-widest">{selectedLobby.code}</span>
              </div>
              <Badge variant="outline" className="gap-1 hidden sm:flex">
                <Users className="w-3 h-3" />
                {participants.length}
              </Badge>
              <Button variant="outline" size="sm" onClick={toggleLobbyActive} className="text-xs px-2 h-8 md:px-3">
                {selectedLobby.is_active ? "Завершить" : "Активировать"}
              </Button>
              <Button variant="outline" size="sm" onClick={exportToExcel} className="text-xs px-2 h-8 md:px-3" title="Скачать Excel">
                <Download className="w-4 h-4 md:mr-1" /> <span className="hidden md:inline">Excel</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Split view body */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* LEFT: Students panel */}
          <div className={`w-full md:w-72 shrink-0 border-r border-border/50 bg-card/30 flex-col overflow-hidden absolute inset-0 md:relative z-10 md:z-0 bg-background md:bg-transparent ${activeStudent ? 'hidden md:flex' : 'flex'}`}>
            <div className="px-3 py-2 border-b border-border/40 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Ученики ({participants.length})
              </p>
            </div>

            {participants.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center mb-3">
                  <Users className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Ожидание учеников</p>
                <p className="text-xs text-muted-foreground">Поделитесь кодом лобби</p>
                <div className="mt-3 px-3 py-1.5 bg-primary/10 rounded-lg border border-primary/20">
                  <span className="font-mono font-bold text-primary text-sm">{selectedLobby.code}</span>
                </div>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {participants.map(p => {
                    const g = grades.find(gr => gr.student_id === p.user_id);
                    const isActive = activeStudent?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => openStudent(p)}
                        className={`w-full text-left rounded-lg px-3 py-2.5 transition-all border ${
                          isActive
                            ? "bg-primary/15 border-primary/40"
                            : "bg-transparent border-transparent hover:bg-muted/50 hover:border-border/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${p.is_online ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30"}`} />
                            <span className="text-sm font-medium truncate">{p.nickname}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {g && (
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${gradeColor(g.grade)}`}>
                                {g.grade}
                              </span>
                            )}
                            <ChevronRight className={`w-3 h-3 text-muted-foreground/50 ${isActive ? "text-primary" : ""}`} />
                          </div>
                        </div>
                        {g?.comment && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate pl-4">{g.comment}</p>
                        )}
                        <p className="text-xs text-muted-foreground/60 mt-0.5 pl-4">
                          {p.student_code ? `${p.student_code.split('\n').length} строк` : "Пустой"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* RIGHT: Code editor */}
          <div className={`flex-1 flex-col overflow-hidden ${activeStudent ? 'flex' : 'hidden md:flex'}`}>
            {activeStudent ? (
              <>
                {/* Student code toolbar */}
                <div className="shrink-0 flex flex-wrap items-center justify-between px-2 md:px-4 py-2 border-b border-border/50 bg-card/50 gap-2">
                  <div className="flex items-center gap-1 md:gap-2 min-w-0">
                    <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 shrink-0" onClick={() => setActiveStudent(null)}>
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${activeStudent.is_online ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                    <span className="font-semibold text-sm truncate max-w-[100px] sm:max-w-xs">{activeStudent.nickname}</span>
                    <span className="hidden sm:inline text-xs text-muted-foreground shrink-0">
                      {activeStudent.is_online ? "онлайн" : "офф"}
                    </span>
                    {(() => {
                      const g = grades.find(gr => gr.student_id === activeStudent.user_id);
                      return g ? (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] md:text-xs font-bold shrink-0 ${gradeColor(g.grade)}`}>
                          {g.grade} <span className="hidden sm:inline">— {gradeLabel(g.grade)}</span>
                        </span>
                      ) : null;
                    })()}
                    {(() => {
                      try {
                        const parsed = JSON.parse(activeStudent.student_code || "{}");
                        if (parsed && typeof parsed === "object" && parsed.deployed_url) {
                          return (
                            <a href={`/site/${parsed.deployed_url}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] md:text-xs text-primary hover:underline shrink-0 bg-primary/10 px-1.5 py-0.5 rounded ml-2 border border-primary/20">
                              <Globe className="w-3 h-3" /> {parsed.deployed_url}
                            </a>
                          );
                        }
                      } catch {}
                      return null;
                    })()}
                  </div>
                  <div className="flex items-center gap-1 md:gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openGrading(activeStudent)}
                      className="gap-1 px-2 md:px-3 h-8 text-xs md:text-sm"
                    >
                      <Star className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">
                        {grades.find(g => g.student_id === activeStudent.user_id) ? "Изменить оценку" : "Оценка"}
                      </span>
                    </Button>
                    <Button
                      variant="hero"
                      size="sm"
                      onClick={saveStudentCode}
                      disabled={savingCode}
                      className="gap-1 px-2 md:px-3 h-8 text-xs md:text-sm"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{savingCode ? "..." : "Сохранить"}</span>
                    </Button>
                  </div>
                </div>

                {/* Comment bar if exists */}
                {(() => {
                  const g = grades.find(gr => gr.student_id === activeStudent.user_id);
                  return g?.comment ? (
                    <div className="shrink-0 px-4 py-1.5 bg-muted/30 border-b border-border/30 flex items-center gap-2 text-xs text-muted-foreground">
                      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                      <span>Комментарий: <span className="text-foreground">{g.comment}</span></span>
                    </div>
                  ) : null;
                })()}

                {/* Code editor with tabs for HTML lobbies */}
                {selectedLobby.language === "html" ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Tab bar */}
                    <div className="shrink-0 flex border-b border-border/50 bg-card/20 px-3 pt-1.5 gap-1">
                      {(["html", "css", "js", "preview"] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => setTeacherTab(tab)}
                          className={`px-4 py-1 text-xs font-semibold rounded-t-md transition-all border-b-2 ${
                            teacherTab === tab
                              ? "border-primary text-primary bg-primary/10"
                              : "border-transparent text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {tab.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <div className="flex-1 overflow-hidden p-2">
                      <div className="h-full rounded-md overflow-hidden border border-border/40">
                        {teacherTab === "html" && (
                          <CodeEditor language="html" value={editHtml}
                            onChange={v => { setEditHtml(v); teacherAutoSave(v, editCss, editJs, ""); }} />
                        )}
                        {teacherTab === "css" && (
                          <CodeEditor language="css" value={editCss}
                            onChange={v => { setEditCss(v); teacherAutoSave(editHtml, v, editJs, ""); }} />
                        )}
                        {teacherTab === "js" && (
                          <CodeEditor language="javascript" value={editJs}
                            onChange={v => { setEditJs(v); teacherAutoSave(editHtml, editCss, v, ""); }} />
                        )}
                        {teacherTab === "preview" && (
                          <div className="flex-1 bg-white relative h-full">
                            <iframe
                              srcDoc={`<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Превью</title><style>${editCss}</style></head><body>${editHtml}<script>${editJs}</script></body></html>`}
                              className="w-full h-full border-0 absolute inset-0"
                              title="Превью сайта"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-hidden p-2">
                    <div className="h-full rounded-md overflow-hidden border border-border/40">
                      <CodeEditor
                        language={lang}
                        value={editingCode}
                        onChange={v => { setEditingCode(v); teacherAutoSave("", "", "", v); }}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Placeholder when no student selected */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-24 h-24 rounded-2xl bg-muted/30 border border-border/40 flex items-center justify-center mb-6">
                  <Code2 className="w-12 h-12 text-muted-foreground/30" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Выберите ученика</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Нажмите на ученика в списке слева, чтобы просмотреть и отредактировать его код в реальном времени
                </p>
                {participants.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {participants.slice(0, 4).map(p => (
                      <button
                        key={p.id}
                        onClick={() => openStudent(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/40 hover:bg-primary/10 hover:border-primary/30 transition-all text-sm"
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${p.is_online ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                        {p.nickname}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Grading dialog */}
        <Dialog open={!!gradingStudent} onOpenChange={(open) => { if (!open) setGradingStudent(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5" />
                Оценка — {gradingStudent?.nickname}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Выберите оценку</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[2, 3, 4, 5].map(v => (
                    <button
                      key={v}
                      onClick={() => setGradeValue(v)}
                      className={`flex flex-col items-center gap-1 py-3 rounded-xl text-lg font-bold transition-all ${gradeColor(v)} ${gradeValue === v ? "ring-2 ring-ring ring-offset-2 scale-105" : "opacity-50 hover:opacity-80"}`}
                    >
                      {v}
                      <span className="text-[10px] font-normal opacity-80">{gradeLabel(v)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> Комментарий
                </Label>
                <Textarea
                  value={gradeComment}
                  onChange={e => setGradeComment(e.target.value)}
                  placeholder="Хорошая работа! Обрати внимание на..."
                  rows={3}
                  className="resize-none"
                />
              </div>
              <Button variant="hero" onClick={saveGrade} disabled={savingGrade} className="w-full">
                <Save className="w-4 h-4 mr-1" />
                {savingGrade ? "Сохранение..." : "Сохранить оценку"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── LOBBY LIST ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Дашборд
            </Button>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <span className="font-semibold">Мои лобби</span>
            </div>
          </div>
          <Button variant="hero" size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" /> Создать лобби
          </Button>
        </div>
      </header>

      <main className="container py-6">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
        ) : lobbies.length === 0 && !showCreate ? (
          <Card className="text-center py-16">
            <CardContent>
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Нет лобби</h3>
              <p className="text-muted-foreground mb-6">Создайте лобби для урока и следите за кодом учеников в реальном времени</p>
              <Button variant="hero" onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4 mr-1" /> Создать лобби
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {showCreate && (
              <Card className="mb-6 border-primary/30 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" /> Новое лобби
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Название урока</Label>
                    <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Урок 7 — Циклы" />
                  </div>
                  <div className="space-y-2">
                    <Label>Язык программирования</Label>
                    <Select value={newLanguage} onValueChange={setNewLanguage}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map(l => (
                          <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="hero" onClick={createLobby}><Plus className="w-4 h-4 mr-1" /> Создать</Button>
                    <Button variant="outline" onClick={() => setShowCreate(false)}>Отмена</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lobbies.map(lobby => (
                <Card
                  key={lobby.id}
                  className="cursor-pointer hover:shadow-lg transition-all border-border/50 hover:border-primary/30 group"
                  onClick={() => selectLobby(lobby)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">{lobby.title}</CardTitle>
                        <CardDescription className="font-mono mt-1">Код: <span className="font-bold text-primary">{lobby.code}</span></CardDescription>
                      </div>
                      <Badge variant={lobby.is_active ? "default" : "secondary"}>
                        {lobby.is_active ? "Активно" : "Завершено"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {LANGUAGES.find(l => l.value === lobby.language)?.label || lobby.language}
                      </p>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
