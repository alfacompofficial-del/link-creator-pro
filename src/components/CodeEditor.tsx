import Editor, { OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { useRef, useEffect } from "react";

interface CodeEditorProps {
  language: "html" | "css" | "javascript" | "python";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// ─── HTML Tag Snippets ────────────────────────────────────────────────────────
const HTML_SNIPPETS: Record<string, { body: string; description: string }> = {
  html: {
    body: `<html lang="ru">\n    \${0}\n</html>`,
    description: "<html> тег",
  },
  head: { body: `<head>\n    \${0}\n</head>`, description: "<head> тег" },
  body: { body: `<body>\n    \${0}\n</body>`, description: "<body> тег" },
  div: { body: `<div>\n    \${0}\n</div>`, description: "<div> блок" },
  span: { body: `<span>\${0}</span>`, description: "<span> строчный элемент" },
  p: { body: `<p>\${0}</p>`, description: "<p> параграф" },
  h1: { body: `<h1>\${0}</h1>`, description: "<h1> заголовок" },
  h2: { body: `<h2>\${0}</h2>`, description: "<h2> заголовок" },
  h3: { body: `<h3>\${0}</h3>`, description: "<h3> заголовок" },
  h4: { body: `<h4>\${0}</h4>`, description: "<h4> заголовок" },
  h5: { body: `<h5>\${0}</h5>`, description: "<h5> заголовок" },
  h6: { body: `<h6>\${0}</h6>`, description: "<h6> заголовок" },
  a: {
    body: `<a href="\${1:#}">\${0}</a>`,
    description: "<a> ссылка",
  },
  img: {
    body: `<img src="\${1:url}" alt="\${2:описание}">`,
    description: "<img> изображение",
  },
  ul: {
    body: `<ul>\n    <li>\${0}</li>\n</ul>`,
    description: "<ul> ненумерованный список",
  },
  ol: {
    body: `<ol>\n    <li>\${0}</li>\n</ol>`,
    description: "<ol> нумерованный список",
  },
  li: { body: `<li>\${0}</li>`, description: "<li> элемент списка" },
  table: {
    body: `<table>\n    <thead>\n        <tr>\n            <th>\${1}</th>\n        </tr>\n    </thead>\n    <tbody>\n        <tr>\n            <td>\${0}</td>\n        </tr>\n    </tbody>\n</table>`,
    description: "<table> таблица",
  },
  tr: { body: `<tr>\n    \${0}\n</tr>`, description: "<tr> строка таблицы" },
  td: { body: `<td>\${0}</td>`, description: "<td> ячейка таблицы" },
  th: { body: `<th>\${0}</th>`, description: "<th> заголовок таблицы" },
  form: {
    body: `<form action="\${1:#}" method="\${2:post}">\n    \${0}\n</form>`,
    description: "<form> форма",
  },
  input: {
    body: `<input type="\${1:text}" name="\${2:name}" placeholder="\${3:текст}">`,
    description: "<input> поле ввода",
  },
  button: {
    body: `<button type="\${1:button}">\${0}</button>`,
    description: "<button> кнопка",
  },
  textarea: {
    body: `<textarea name="\${1:name}" rows="\${2:4}" cols="\${3:40}">\${0}</textarea>`,
    description: "<textarea> многостроковый ввод",
  },
  select: {
    body: `<select name="\${1:name}">\n    <option value="\${2:value}">\${0}</option>\n</select>`,
    description: "<select> выпадающий список",
  },
  label: {
    body: `<label for="\${1:id}">\${0}</label>`,
    description: "<label> метка",
  },
  nav: { body: `<nav>\n    \${0}\n</nav>`, description: "<nav> навигация" },
  header: {
    body: `<header>\n    \${0}\n</header>`,
    description: "<header> шапка",
  },
  footer: {
    body: `<footer>\n    \${0}\n</footer>`,
    description: "<footer> подвал",
  },
  main: {
    body: `<main>\n    \${0}\n</main>`,
    description: "<main> основное содержимое",
  },
  section: {
    body: `<section>\n    \${0}\n</section>`,
    description: "<section> раздел",
  },
  article: {
    body: `<article>\n    \${0}\n</article>`,
    description: "<article> статья",
  },
  aside: {
    body: `<aside>\n    \${0}\n</aside>`,
    description: "<aside> боковая панель",
  },
  script: {
    body: `<script>\n    \${0}\n</script>`,
    description: "<script> JavaScript",
  },
  style: {
    body: `<style>\n    \${0}\n</style>`,
    description: "<style> CSS стили",
  },
  link: {
    body: `<link rel="stylesheet" href="\${1:style.css}">`,
    description: "<link> подключение файла",
  },
  meta: {
    body: `<meta name="\${1:description}" content="\${0}">`,
    description: "<meta> метаданные",
  },
  iframe: {
    body: `<iframe src="\${1:url}" width="\${2:600}" height="\${3:400}">\${0}</iframe>`,
    description: "<iframe> встроенный фрейм",
  },
  video: {
    body: `<video src="\${1:url}" controls>\n    \${0}\n</video>`,
    description: "<video> видео",
  },
  audio: {
    body: `<audio src="\${1:url}" controls>\n    \${0}\n</audio>`,
    description: "<audio> аудио",
  },
  canvas: {
    body: `<canvas id="\${1:canvas}" width="\${2:800}" height="\${3:600}">\${0}</canvas>`,
    description: "<canvas> холст",
  },
  br: { body: `<br>`, description: "<br> перенос строки" },
  hr: { body: `<hr>`, description: "<hr> горизонтальная линия" },
  strong: { body: `<strong>\${0}</strong>`, description: "<strong> жирный" },
  em: { body: `<em>\${0}</em>`, description: "<em> курсив" },
  code: { body: `<code>\${0}</code>`, description: "<code> код" },
  pre: { body: `<pre>\${0}</pre>`, description: "<pre> форматированный текст" },
  blockquote: {
    body: `<blockquote>\${0}</blockquote>`,
    description: "<blockquote> цитата",
  },
};

// ─── CSS Snippets ─────────────────────────────────────────────────────────────
const CSS_SNIPPETS: Record<string, { body: string; description: string }> = {
  flexbox: {
    body: `display: flex;\njustify-content: \${1:center};\nalign-items: \${2:center};`,
    description: "Flexbox контейнер",
  },
  grid: {
    body: `display: grid;\ngrid-template-columns: \${1:repeat(3, 1fr)};\ngap: \${2:1rem};`,
    description: "Grid контейнер",
  },
  "media-mobile": {
    body: `@media (max-width: 768px) {\n    \${0}\n}`,
    description: "Media query для мобильных",
  },
  "box-shadow": {
    body: `box-shadow: \${1:0} \${2:4px} \${3:6px} rgba(0, 0, 0, \${4:0.1});`,
    description: "Тень блока",
  },
  transition: {
    body: `transition: \${1:all} \${2:0.3s} \${3:ease};`,
    description: "Плавный переход",
  },
  animation: {
    body: `animation: \${1:name} \${2:1s} \${3:ease-in-out} \${4:infinite};`,
    description: "Анимация",
  },
  gradient: {
    body: `background: linear-gradient(\${1:135deg}, \${2:#667eea}, \${3:#764ba2});`,
    description: "Градиент",
  },
};

// ─── JS Snippets ──────────────────────────────────────────────────────────────
const JS_SNIPPETS: Record<string, { body: string; description: string }> = {
  log: {
    body: `console.log(\${1:'значение'});`,
    description: "console.log()",
  },
  fn: {
    body: `function \${1:имяФункции}(\${2:params}) {\n    \${0}\n}`,
    description: "Функция",
  },
  afn: {
    body: `const \${1:имяФункции} = (\${2:params}) => {\n    \${0}\n};`,
    description: "Стрелочная функция",
  },
  cl: {
    body: `class \${1:ИмяКласса} {\n    constructor(\${2:params}) {\n        \${0}\n    }\n}`,
    description: "Класс",
  },
  for: {
    body: `for (let \${1:i} = 0; \${1:i} < \${2:array}.length; \${1:i}++) {\n    \${0}\n}`,
    description: "Цикл for",
  },
  forof: {
    body: `for (const \${1:item} of \${2:array}) {\n    \${0}\n}`,
    description: "Цикл for...of",
  },
  forEach: {
    body: `\${1:array}.forEach((\${2:item}) => {\n    \${0}\n});`,
    description: "forEach",
  },
  map: {
    body: `\${1:array}.map((\${2:item}) => \${0})`,
    description: "Array.map()",
  },
  filter: {
    body: `\${1:array}.filter((\${2:item}) => \${0})`,
    description: "Array.filter()",
  },
  reduce: {
    body: `\${1:array}.reduce((\${2:acc}, \${3:item}) => {\n    \${0}\n    return \${2:acc};\n}, \${4:initialValue})`,
    description: "Array.reduce()",
  },
  promise: {
    body: `new Promise((\${1:resolve}, \${2:reject}) => {\n    \${0}\n})`,
    description: "new Promise()",
  },
  async: {
    body: `async function \${1:имяФункции}(\${2:params}) {\n    try {\n        const result = await \${0};\n        return result;\n    } catch (error) {\n        console.error(error);\n    }\n}`,
    description: "async/await функция",
  },
  fetch: {
    body: `const response = await fetch('\${1:url}');\nconst data = await response.json();\nconsole.log(data);`,
    description: "fetch() запрос",
  },
  qs: {
    body: `document.querySelector('\${1:.selector}')`,
    description: "querySelector()",
  },
  qsa: {
    body: `document.querySelectorAll('\${1:.selector}')`,
    description: "querySelectorAll()",
  },
  gel: {
    body: `document.getElementById('\${1:id}')`,
    description: "getElementById()",
  },
  ae: {
    body: `\${1:element}.addEventListener('\${2:click}', (\${3:e}) => {\n    \${0}\n});`,
    description: "addEventListener()",
  },
  dom: {
    body: `document.addEventListener('DOMContentLoaded', () => {\n    \${0}\n});`,
    description: "DOMContentLoaded",
  },
  ls: {
    body: `localStorage.setItem('\${1:key}', JSON.stringify(\${2:value}));`,
    description: "localStorage.setItem()",
  },
  lg: {
    body: `JSON.parse(localStorage.getItem('\${1:key}'))`,
    description: "localStorage.getItem()",
  },
  try: {
    body: `try {\n    \${0}\n} catch (error) {\n    console.error(error);\n}`,
    description: "try/catch",
  },
  timeout: {
    body: `setTimeout(() => {\n    \${0}\n}, \${1:1000});`,
    description: "setTimeout()",
  },
  interval: {
    body: `setInterval(() => {\n    \${0}\n}, \${1:1000});`,
    description: "setInterval()",
  },
  imp: {
    body: `import \${1:module} from '\${2:path}';`,
    description: "import",
  },
  exp: {
    body: `export default \${0}`,
    description: "export default",
  },
  if: {
    body: `if (\${1:условие}) {\n    \${0}\n}`,
    description: "if условие",
  },
  ifel: {
    body: `if (\${1:условие}) {\n    \${2}\n} else {\n    \${0}\n}`,
    description: "if/else",
  },
  sw: {
    body: `switch (\${1:значение}) {\n    case \${2:вариант}:\n        \${0}\n        break;\n    default:\n        break;\n}`,
    description: "switch/case",
  },
  obj: {
    body: `const \${1:имя} = {\n    \${2:ключ}: \${3:значение},\n    \${0}\n};`,
    description: "Объект",
  },
  arr: {
    body: `const \${1:имя} = [\${0}];`,
    description: "Массив",
  },
};

// ─── Python Snippets ──────────────────────────────────────────────────────────
const PYTHON_SNIPPETS: Record<string, { body: string; description: string }> = {
  def: { body: `def \${1:name}(\${2:args}):\n    \${0:pass}`, description: "Function definition" },
  class: { body: `class \${1:Name}:\n    def __init__(self, \${2:args}):\n        \${0:pass}`, description: "Class definition" },
  for: { body: `for \${1:item} in \${2:iterable}:\n    \${0:pass}`, description: "For loop" },
  forr: { body: `for \${1:i} in range(\${2:10}):\n    \${0:pass}`, description: "For loop with range" },
  while: { body: `while \${1:condition}:\n    \${0:pass}`, description: "While loop" },
  if: { body: `if \${1:condition}:\n    \${0:pass}`, description: "If statement" },
  ife: { body: `if \${1:condition}:\n    \${2:pass}\nelse:\n    \${0:pass}`, description: "If/Else statement" },
  elif: { body: `elif \${1:condition}:\n    \${0:pass}`, description: "Elif statement" },
  try: { body: `try:\n    \${1:pass}\nexcept \${2:Exception} as \${3:e}:\n    \${0:pass}`, description: "Try/Except block" },
  main: { body: `if __name__ == '__main__':\n    \${0:main()}`, description: "Main block" },
  open: { body: `with open('\${1:file.txt}', '\${2:r}') as \${3:f}:\n    \${0:content = f.read()}`, description: "Open file context manager" },
  lam: { body: `lambda \${1:x}: \${0:x}`, description: "Lambda function" },
  listc: { body: `[\${1:x} for \${1:x} in \${2:iterable} if \${3:condition}]`, description: "List comprehension" },
  dictc: { body: `{\${1:k}: \${2:v} for \${1:k}, \${2:v} in \${3:iterable}}`, description: "Dict comprehension" },
  imp: { body: `import \${0:module}`, description: "Import" },
  from: { body: `from \${1:module} import \${0:name}`, description: "From import" },
};

// Helper to convert snippet body to insertText with tab stops
function snippetBodyToInsertText(body: string): string {
  // Replace ${1:placeholder}, ${0} etc. - Monaco uses the same format
  return body;
}

// ─── Register completions for HTML ───────────────────────────────────────────
function registerHtmlCompletions(monacoInstance: typeof monaco) {
  monacoInstance.languages.registerCompletionItemProvider("html", {
    triggerCharacters: ["<", " ", "\t"],
    provideCompletionItems: (model, position) => {
      const wordInfo = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: wordInfo.startColumn,
        endColumn: wordInfo.endColumn,
      };

      // Check if we're after a '<'
      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);
      const afterAngle = textBeforeCursor.lastIndexOf("<");
      const afterSpace = textBeforeCursor.lastIndexOf(" ");
      const isTagStart =
        afterAngle > afterSpace && afterAngle >= 0;

      const suggestions: monaco.languages.CompletionItem[] = [];

      Object.entries(HTML_SNIPPETS).forEach(([label, { body, description }]) => {
        suggestions.push({
          label: isTagStart ? label : `<${label}>`,
          kind: monacoInstance.languages.CompletionItemKind.Snippet,
          insertText: isTagStart ? body.replace(/^</, "") : body,
          insertTextRules:
            monacoInstance.languages.CompletionItemInsertTextRule
              .InsertAsSnippet,
          documentation: description,
          detail: description,
          range,
          sortText: "0" + label,
        });
      });

      return { suggestions };
    },
  });
}

// ─── Register completions for CSS ────────────────────────────────────────────
function registerCssCompletions(monacoInstance: typeof monaco) {
  monacoInstance.languages.registerCompletionItemProvider("css", {
    triggerCharacters: [" ", ":", "\t"],
    provideCompletionItems: (model, position) => {
      const wordInfo = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: wordInfo.startColumn,
        endColumn: wordInfo.endColumn,
      };

      const suggestions: monaco.languages.CompletionItem[] = [];

      Object.entries(CSS_SNIPPETS).forEach(([label, { body, description }]) => {
        suggestions.push({
          label,
          kind: monacoInstance.languages.CompletionItemKind.Snippet,
          insertText: body,
          insertTextRules:
            monacoInstance.languages.CompletionItemInsertTextRule
              .InsertAsSnippet,
          documentation: description,
          detail: description,
          range,
          sortText: "0" + label,
        });
      });

      return { suggestions };
    },
  });
}

// ─── Register completions for JS ─────────────────────────────────────────────
function registerJsCompletions(monacoInstance: typeof monaco) {
  const provider = {
    triggerCharacters: [" ", ".", "\t"],
    provideCompletionItems: (
      model: monaco.editor.ITextModel,
      position: monaco.Position
    ) => {
      const wordInfo = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: wordInfo.startColumn,
        endColumn: wordInfo.endColumn,
      };

      const suggestions: monaco.languages.CompletionItem[] = [];

      Object.entries(JS_SNIPPETS).forEach(([label, { body, description }]) => {
        suggestions.push({
          label,
          kind: monacoInstance.languages.CompletionItemKind.Snippet,
          insertText: body,
          insertTextRules:
            monacoInstance.languages.CompletionItemInsertTextRule
              .InsertAsSnippet,
          documentation: description,
          detail: description,
          range,
          sortText: "0" + label,
        });
      });

      return { suggestions };
    },
  };

  monacoInstance.languages.registerCompletionItemProvider("javascript", provider);
  monacoInstance.languages.registerCompletionItemProvider("typescript", provider);
}

// ─── Register completions for Python ─────────────────────────────────────────
function registerPythonCompletions(monacoInstance: typeof monaco) {
  monacoInstance.languages.registerCompletionItemProvider("python", {
    triggerCharacters: [" ", ".", "\t"],
    provideCompletionItems: (model, position) => {
      const wordInfo = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: wordInfo.startColumn,
        endColumn: wordInfo.endColumn,
      };

      const suggestions: monaco.languages.CompletionItem[] = [];

      Object.entries(PYTHON_SNIPPETS).forEach(([label, { body, description }]) => {
        suggestions.push({
          label,
          kind: monacoInstance.languages.CompletionItemKind.Snippet,
          insertText: body,
          insertTextRules:
            monacoInstance.languages.CompletionItemInsertTextRule
              .InsertAsSnippet,
          documentation: description,
          detail: description,
          range,
          sortText: "0" + label,
        });
      });

      return { suggestions };
    },
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
let completionsRegistered = false;

export default function CodeEditor({
  language,
  value,
  onChange,
}: CodeEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;

    // Register completions only once globally
    if (!completionsRegistered) {
      registerHtmlCompletions(monacoInstance);
      registerCssCompletions(monacoInstance);
      registerJsCompletions(monacoInstance);
      registerPythonCompletions(monacoInstance);
      completionsRegistered = true;
    }

    // Custom Tab key: expand snippet if word before cursor matches a known snippet
    editor.addCommand(
      monacoInstance.KeyCode.Tab,
      () => {
        const model = editor.getModel();
        const position = editor.getPosition();
        if (!model || !position) return;

        const wordInfo = model.getWordUntilPosition(position);
        const word = wordInfo.word;

        let snippetMap: Record<string, { body: string }> = {};
        if (language === "html") snippetMap = HTML_SNIPPETS;
        else if (language === "css") snippetMap = CSS_SNIPPETS;
        else if (language === "javascript") snippetMap = JS_SNIPPETS;
        else if (language === "python") snippetMap = PYTHON_SNIPPETS;

        const snippet = snippetMap[word] || snippetMap[`<${word}>`];

        if (snippet && word) {
          // Delete the typed word first
          const range = new monacoInstance.Range(
            position.lineNumber,
            wordInfo.startColumn,
            position.lineNumber,
            wordInfo.endColumn
          );
          editor.executeEdits("", [{ range, text: "" }]);
          // Insert as snippet
          editor.trigger("", "editor.action.insertSnippet", {
            snippet: snippet.body,
          });
        } else {
          // Default tab behavior
          editor.trigger("keyboard", "tab", {});
        }
      },
      "!suggestWidgetVisible"
    );
  };

  return (
    <div className="h-full min-h-[400px] border rounded-md overflow-hidden flex flex-col">
      {/* Language badge */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1e1e1e] border-b border-white/10">
        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-white/10 text-white/70 uppercase tracking-widest">
          {language === "javascript" ? "JS" : language.toUpperCase()}
        </span>
        <span className="text-xs text-white/30">Tab для вставки сниппета · Ctrl+Space для подсказок</span>
      </div>

      <Editor
        height="100%"
        language={language}
        value={value}
        onChange={(val) => onChange(val || "")}
        theme="vs-dark"
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontLigatures: true,
          lineNumbers: "on",
          wordWrap: "on",
          automaticLayout: true,
          tabSize: 4,
          insertSpaces: true,
          scrollBeyondLastLine: false,

          // ─── Suggestions / Autocomplete ──────────────────────────
          suggestOnTriggerCharacters: true,
          quickSuggestions: {
            other: true,
            comments: false,
            strings: true,
          },
          quickSuggestionsDelay: 50,
          acceptSuggestionOnCommitCharacter: true,
          tabCompletion: "on",
          wordBasedSuggestions: "allDocuments",
          snippetSuggestions: "top",
          suggest: {
            insertMode: "replace",
            showSnippets: true,
            showKeywords: true,
            showFunctions: true,
            showVariables: true,
            showClasses: true,
            showModules: true,
            showProperties: true,
            showMethods: true,
            filterGraceful: true,
            localityBonus: true,
            preview: true,
            showStatusBar: true,
          },
          inlineSuggest: {
            enabled: true,
          },
          parameterHints: {
            enabled: true,
            cycle: true,
          },

          // ─── Code Formatting ─────────────────────────────────────
          formatOnPaste: true,
          formatOnType: true,

          // ─── Brackets & Pairs ────────────────────────────────────
          autoClosingBrackets: "always",
          autoClosingQuotes: "always",
          autoClosingDelete: "always",
          autoSurround: "languageDefined",
          matchBrackets: "always",
          bracketPairColorization: { enabled: true },

          // ─── Visual Enhancements ─────────────────────────────────
          renderLineHighlight: "all",
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          smoothScrolling: true,
          mouseWheelZoom: true,
          padding: { top: 8, bottom: 8 },

          // ─── Code Folding ─────────────────────────────────────────
          folding: true,
          foldingHighlight: true,
          showFoldingControls: "mouseover",

          // ─── Guides ───────────────────────────────────────────────
          guides: {
            bracketPairs: true,
            indentation: true,
          },

          // ─── Hover ────────────────────────────────────────────────
          hover: {
            enabled: true,
            delay: 300,
          },
        }}
      />
    </div>
  );
}
