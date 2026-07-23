# PRD — Design System "FluxoGov Landing" (Layout, Tipografia e Cores)

## 1. Visão Geral
Estilo "high-end tech-corporate": estética inspirada em Linear/Vercel adaptada para um produto
enterprise/governamental. Fundo escuro (com variante clara), grid rigoroso, bordas finas de baixo
contraste (hairline), glows radiais suaves e micro-interações discretas em hover.

## 2. Paleta de Cores

O tema é controlado por um objeto de paleta com **dois modos (dark/light)**, trocados via toggle e
persistidos em `localStorage`.

### 2.1 Modo Dark (padrão)
| Token       | Hex       | Uso                                              |
|-------------|-----------|---------------------------------------------------|
| `INK`       | `#0B0F19` | Fundo base da página                              |
| `INK_2`     | `#0f172a` | Superfície secundária (cards, header translúcido)  |
| `INK_3`     | `#0d1527` | Fundo de seções alternadas (tone-on-tone)          |
| `HAIRLINE`  | `#1c2740` | Bordas finas de 1px entre seções/cards             |
| `CREAM`     | `#E6ECF5` | Texto principal (títulos, corpo em destaque)       |
| `MUTED`     | `#7c8aa6` | Texto secundário, labels, parágrafos                |
| `ICE`       | `#8fb4ff` | Acento frio (ícones, dots, seções técnicas)         |
| `BRAND`     | `#2563EB` | Cor de marca / CTA primário                        |
| `BRAND_2`   | `#1e56e3` | Variante de marca (glows, gradientes, hover)        |

### 2.2 Modo Light
| Token       | Hex       | Uso                                     |
|-------------|-----------|------------------------------------------|
| `INK`       | `#F5F7FB` | Fundo base                               |
| `INK_2`     | `#FFFFFF` | Superfície secundária                    |
| `INK_3`     | `#EEF2F9` | Fundo alternado                          |
| `HAIRLINE`  | `#D5DEEC` | Bordas                                   |
| `CREAM`     | `#0B0F19` | Texto principal (invertido)              |
| `MUTED`     | `#5b6b85` | Texto secundário                         |
| `ICE`       | `#1e56e3` | Acento                                   |
| `BRAND`     | `#2563EB` | CTA primário (igual ao dark)             |
| `BRAND_2`   | `#1e56e3` | Variante de marca                        |

### 2.3 Cores de status/apoio (do design system global, `index.css`, em HSL)
| Token                  | HSL              | Uso                     |
|------------------------|------------------|-------------------------|
| `--primary`            | `210 100% 40%`   | Azul institucional      |
| `--secondary`          | `152 46% 33%`    | Verde                   |
| `--destructive`        | `0 72% 51%`      | Vermelho / erro         |
| `--status-andamento`   | `215 62% 26%`    | Status "em andamento"   |
| `--status-resolvido`   | `152 46% 33%`    | Status "resolvido"      |
| `--priority-alta`      | `4 82% 56%`      | Prioridade alta         |
| `--priority-media`     | `28 100% 50%`    | Prioridade média        |
| `--priority-baixa`     | `142 71% 45%`    | Prioridade baixa        |

**Regra de uso**: apenas UMA cor de destaque vibrante (`BRAND`) é usada nos CTAs, dots e realces;
todo o resto do fundo é tons de navy/slate em camadas (tone-on-tone), nunca cinza genérico.

## 3. Tipografia

### 3.1 Famílias
```css
--font-display: "Space Grotesk", "Inter", system-ui, sans-serif; /* títulos/headlines */
--font-sans:    "Inter", system-ui, sans-serif;                  /* corpo de texto */
--font-mono:    "JetBrains Mono", ui-monospace, monospace;       /* labels técnicos, badges, breadcrumbs */
```
Importadas via Google Fonts: `Space+Grotesk:wght@500;600;700`, `Inter:wght@400;500;600;700`,
`JetBrains+Mono:wght@400;500;700`.

Obs: o `index.css` global do projeto (usado fora da landing) usa `Inter` + `Playfair Display`
como par serif/sans para um tema "Luxury Minimal" — mas a **Landing especificamente** usa o trio
Space Grotesk / Inter / JetBrains Mono descrito acima.

### 3.2 Escala tipográfica (Landing)
| Elemento          | Fonte      | Tamanho                        | Peso | Line-height | Letter-spacing |
|-------------------|------------|---------------------------------|------|-------------|----------------|
| H1 (hero)         | Display    | `clamp(40px, 6.4vw, 88px)`      | 600  | 1.02        | -0.035em       |
| H2 (seção)        | Display    | `clamp(32px, 4.6vw, 64px)`      | 600  | 1.04        | -0.03em        |
| H3 (card title)   | Display    | 18px                             | 600  | —           | -0.01em        |
| Parágrafo hero    | Sans       | `clamp(16px, 1.3vw, 19px)`      | 400  | 1.55        | —              |
| Corpo/card        | Sans       | 14px                             | 400  | 1.55        | —              |
| Label técnico     | Mono       | 11px                             | 500  | —           | 0.14–0.2em (uppercase) |
| Nav/link          | Sans       | 14px                             | 400  | —           | —              |
| Botão (CTA)       | Display    | 14px                             | 600  | —           | 0.01em         |

Escala genérica do design system global (`index.css`): H1 2rem/600, H2 1.75rem/600, H3 1.25rem/600.

## 4. Layout e Grid

- **Container principal**: `max-width: 1280px`, `margin: 0 auto`, padding lateral de `24px`.
- **Header**: sticky, `top: 0`, fundo com blur (`backdrop-filter: blur(14px)`) e opacidade ~80%,
  borda inferior hairline de 1px.
- **Hero**: padding `100px 24px 120px`; grid de fundo pontilhado (`fg-grid-bg`, 64px x 64px) com
  máscara radial; 1–2 glows radiais desfocados (blur 90px) posicionados de forma assimétrica.
- **Trust strip** (logo abaixo do hero): `grid-template-columns: repeat(auto-fit, minmax(180px,1fr))`,
  gap 28px.
- **Grid de features ("bento")**: `grid-template-columns: repeat(3, 1fr)`, gap 16px — colapsa para
  1 coluna em mobile (`max-width: 768px`).
- **Seção "Plataforma/Filosofia"**: heading full-width + grid de 3 colunas de cards de suporte.
- **Footer**: `grid-template-columns: minmax(0,2fr) repeat(3, minmax(0,1fr))`, gap 40px (coluna de
  marca maior + 3 colunas de links), com barra inferior separada por borda hairline.
- **Breakpoint único de mobile**: `768px` (nav desktop ↔ hambúrguer; grids viram 1 coluna).
- **Border-radius padrão**: `14px` em cards, `8px` em botões/badge de marca, `999px` em pills.

## 5. Componentes-chave

- **Pill/badge** (`fg-pill`): borda hairline, fundo translúcido com blur, texto mono uppercase,
  dot pulsante na cor `BRAND` com glow (`box-shadow`).
- **CTA primário** (`fg-cta`): padding `14px 22px`, radius 8px, ícone seta que desliza
  `translateX(4px)` no hover; variante `ghost` é transparente com borda hairline.
- **Card de feature** (`fg-card`): fundo em gradiente vertical (`INK_2` → `INK`), borda hairline,
  radius 14px; no hover a borda vira `BRAND` a 40% de opacidade, eleva `-3px` e ganha sombra azul.
- **Section label** (`fg-section-label`): mono, uppercase, com um traço de 24px antes do texto,
  cor `ICE`.
- **Divisores** (`fg-divider`): linha de 1px em gradiente (transparente → hairline → transparente).
- **Marquee**: faixa de texto em loop horizontal infinito (40s), fundo `INK_3`, entre bordas hairline.
- **Contadores animados**: números do bloco "Indicadores" sobem com easing cúbico ao entrar em
  viewport (via `IntersectionObserver`).
- **Reveal on scroll**: todo bloco com `data-reveal` inicia com opacidade 0 e `translateY(18px)`,
  e anima para visível ao cruzar 12% do viewport.

## 6. Efeitos visuais
- **Grid técnico de fundo**: duas linhas gradiente (horizontal/vertical) formando quadriculado de
  64px, mascarado com um gradiente radial elíptico para suavizar as bordas.
- **Glows**: círculos com `filter: blur(90px)`, cor `BRAND_2` ou `ICE`, opacidade entre 0.08–0.18,
  posicionados de forma assimétrica atrás de blocos de texto.
- **Sombra de marca**: `box-shadow: 0 0 20px {BRAND_2}55` no logo/badge da marca.

## 7. Recomendações para reaplicar em outro projeto
1. Definir as duas paletas (dark/light) como CSS custom properties ou tokens Tailwind, mantendo a
   mesma nomenclatura semântica (`ink`, `ink-2`, `ink-3`, `hairline`, `cream`, `muted`, `ice`,
   `brand`, `brand-2`).
2. Importar as três famílias tipográficas (Space Grotesk, Inter, JetBrains Mono) e mapear
   `font-display` / `font-sans` / `font-mono` como utilities.
3. Replicar o container de 1280px com padding 24px e o breakpoint único de 768px para simplificar
   a responsividade.
4. Reutilizar os padrões de componente (pill, card com radius 14px, CTA com seta animada, section
   label mono) como base de um pequeno design kit antes de estilizar páginas novas.