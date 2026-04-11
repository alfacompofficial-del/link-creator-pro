import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function SiteView() {
  const { subdomain } = useParams();
  const [html, setHtml] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (subdomain) loadSite();
  }, [subdomain]);

  const loadSite = async () => {
    const { data, error } = await supabase
      .from("sites")
      .select("full_html")
      .eq("subdomain", subdomain)
      .single();

    if (error || !data) {
      setNotFound(true);
    } else {
      setHtml(data.full_html);
    }
  };

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">404</h1>
          <p className="text-muted-foreground">Сайт не найден</p>
        </div>
      </div>
    );
  }

  if (!html) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  return (
    <iframe
      srcDoc={html}
      className="w-full h-screen border-0"
      title="Сайт"
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
    />
  );
}
