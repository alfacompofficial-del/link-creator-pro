import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Code2, Globe, Search, Zap, ArrowRight } from "lucide-react";

const SITE_BASE_URL = "link-from-code.lovable.app";

export default function Index() {
  const navigate = useNavigate();

  const features = [
    {
      icon: Code2,
      title: "Вставьте код",
      description: "HTML, CSS и JavaScript — просто вставьте свой код в редактор",
    },
    {
      icon: Globe,
      title: "Получите ссылку",
      description: `Ваш сайт будет доступен как ${SITE_BASE_URL}/site/yourname`,
    },
    {
      icon: Search,
      title: "SEO оптимизация",
      description: "Настройте title, description и keywords для поисковиков",
    },
    {
      icon: Zap,
      title: "Мгновенно",
      description: "Сайт становится доступен сразу после публикации",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
              <Code2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">AlfaHost</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Войти
            </Button>
            <Button variant="hero" onClick={() => navigate("/auth")}>
              Начать бесплатно
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero opacity-[0.03]" />
        <div className="container py-24 md:py-32 relative">
          <div className="max-w-3xl mx-auto text-center animate-fade-up">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              Бесплатный хостинг HTML-сайтов
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
              Превратите свой код в{" "}
              <span className="text-gradient">живой сайт</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Вставьте HTML, CSS и JavaScript — получите готовую ссылку на ваш сайт с SEO-оптимизацией за секунды
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="hero" size="lg" onClick={() => navigate("/auth")} className="text-base px-8">
                Создать сайт
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <Button variant="hero-outline" size="lg" onClick={() => navigate("/auth")} className="text-base px-8">
                Узнать больше
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Как это работает</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <div
              key={i}
              className="group p-6 rounded-xl border border-border/50 bg-card hover:shadow-lg hover:border-primary/20 transition-all duration-300"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <feature.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container pb-20">
        <div className="gradient-hero rounded-2xl p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20" />
          <div className="relative">
            <h2 className="text-3xl font-bold text-primary-foreground mb-4">
              Готовы начать?
            </h2>
            <p className="text-primary-foreground/80 mb-8 max-w-lg mx-auto">
              Создайте свой первый сайт бесплатно. Регистрация займёт минуту.
            </p>
            <Button
              variant="outline"
              size="lg"
              className="bg-primary-foreground/10 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
              onClick={() => navigate("/auth")}
            >
              Зарегистрироваться
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container text-center text-sm text-muted-foreground">
          © 2026 AlfaHost — Бесплатный хостинг сайтов
        </div>
      </footer>
    </div>
  );
}