import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import CodeEditor from "@/components/CodeEditor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Code2, Eye, Save, ArrowLeft, Globe, Search, Copy, ExternalLink } from "lucide-react";

const SITE_BASE_URL = `${window.location.origin}/site`;

export default function Editor() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isEditing = !!id;

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

  const [htmlCode, setHtmlCode] = useState(isEditing ? "" : DEFAULT_HTML);
  const [cssCode, setCssCode] = useState("");
  const [jsCode, setJsCode] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("html");
  const [showPreview, setShowPreview] = useState(false);
  const [savedLink, setSavedLink] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (id && user) loadSite();
  }, [id, user]);

  const loadSite = async () => {
    const { data, error } = await supabase
      .from("sites")
      .select("*")
      .eq("id", id)
      .eq("user_id", user!.id)
      .single();

    if (error || !data) {
      toast.error("Сайт не найден");
      navigate("/dashboard");
      return;
    }

    setHtmlCode(data.html_code || "");
    setCssCode(data.css_code || "");
    setJsCode(data.js_code || "");
    setSubdomain(data.subdomain);
    setTitle(data.title || "");
    setDescription(data.description || "");
    setKeywords(data.keywords || "");
  };

  const generatePreview = () => {
    return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="keywords" content="${keywords}">
  <style>${cssCode}</style>
</head>
<body>
${htmlCode}
<script>${jsCode}<\/script>
</body>
</html>`;
  };

  const handleSave = async () => {
    if (!subdomain.trim()) {
      toast.error("Укажите имя для ссылки");
      return;
    }

    if (!/^[a-z0-9-]+$/.test(subdomain)) {
      toast.error("Имя может содержать только буквы (a-z), цифры и дефис");
      return;
    }

    setSaving(true);

    const siteData = {
      user_id: user!.id,
      subdomain: subdomain.toLowerCase(),
      html_code: htmlCode,
      css_code: cssCode,
      js_code: jsCode,
      title,
      description,
      keywords,
      full_html: generatePreview(),
    };

    let error;
    if (isEditing) {
      ({ error } = await supabase.from("sites").update(siteData).eq("id", id));
    } else {
      ({ error } = await supabase.from("sites").insert(siteData));
    }

    if (error) {
      if (error.code === "23505") {
        toast.error("Это имя уже занято, выберите другое");
      } else {
        toast.error("Ошибка сохранения: " + error.message);
      }
    } else {
      const link = `${SITE_BASE_URL}/${subdomain}`;
      setSavedLink(link);
      toast.success(isEditing ? "Сайт обновлён!" : "Сайт создан!");
    }
    setSaving(false);
  };

  const copyLink = () => {
    if (savedLink) {
      navigator.clipboard.writeText(savedLink);
      toast.success("Ссылка скопирована!");
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Назад
            </Button>
            <span className="text-sm text-muted-foreground">
              {isEditing ? "Редактирование" : "Новый сайт"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Eye className="w-4 h-4 mr-1" />
              {showPreview ? "Код" : "Превью"}
            </Button>
            <Button variant="hero" size="sm" onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-1" />
              {saving ? "Сохранение..." : "Опубликовать"}
            </Button>
          </div>
        </div>
      </header>

      {/* Success banner with link */}
      {savedLink && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-3">
          <div className="container flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <Globe className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-medium truncate">Ваш сайт:</span>
              <code className="text-sm font-mono text-primary truncate">{savedLink}</code>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={copyLink}>
                <Copy className="w-4 h-4 mr-1" />
                Копировать
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open(savedLink, "_blank")}>
                <ExternalLink className="w-4 h-4 mr-1" />
                Открыть
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Settings panel */}
        <aside className={`${activeTab === 'settings' && !showPreview ? 'block' : 'hidden'} lg:block w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-border/50 bg-card/30 p-4 space-y-4 overflow-y-auto shrink-0 max-h-screen lg:max-h-none`}>
          <div>
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4" />
              Настройки ссылки
            </h3>
            <div className="space-y-2">
              <Label htmlFor="subdomain">Имя сайта (в ссылке)</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground whitespace-nowrap">/site/</span>
                <Input
                  id="subdomain"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                  placeholder="mysite"
                  className="font-mono"
                />
              </div>
              {subdomain && (
                <p className="text-xs text-muted-foreground font-mono">
                  {SITE_BASE_URL}/{subdomain}
                </p>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <Search className="w-4 h-4" />
              SEO настройки
            </h3>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="title">Заголовок (title)</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Мой крутой сайт"
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground">{title.length}/60</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Описание (meta description)</Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Описание для поисковых систем"
                  maxLength={160}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">{description.length}/160</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="keywords">Ключевые слова</Label>
                <Input
                  id="keywords"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="сайт, html, веб"
                />
              </div>
            </div>
          </div>
        </aside>

        {/* Editor / Preview */}
        <main className={`${activeTab === 'settings' && !showPreview ? 'hidden' : 'flex'} lg:flex flex-1 flex-col h-[700px] md:h-[800px] lg:h-auto min-h-0 shrink-0`}>
          {showPreview ? (
            <div className="flex-1 bg-background relative h-full">
              <iframe
                srcDoc={generatePreview()}
                className="w-full h-full border-0 absolute inset-0"
                title="Превью сайта"
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <TabsList className="mx-4 mt-4 w-fit flex flex-wrap gap-1">
                  <TabsTrigger value="settings" className="lg:hidden font-mono text-sm">Настройки</TabsTrigger>
                  <TabsTrigger value="html" className="font-mono text-sm">HTML</TabsTrigger>
                  <TabsTrigger value="css" className="font-mono text-sm">CSS</TabsTrigger>
                  <TabsTrigger value="js" className="font-mono text-sm">JavaScript</TabsTrigger>
                </TabsList>
                <TabsContent value="html" className="flex-1 px-4 pb-4">
                  <CodeEditor language="html" value={htmlCode} onChange={setHtmlCode} />
                </TabsContent>
                <TabsContent value="css" className="flex-1 px-4 pb-4">
                  <CodeEditor language="css" value={cssCode} onChange={setCssCode} />
                </TabsContent>
                <TabsContent value="js" className="flex-1 px-4 pb-4">
                  <CodeEditor language="javascript" value={jsCode} onChange={setJsCode} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}