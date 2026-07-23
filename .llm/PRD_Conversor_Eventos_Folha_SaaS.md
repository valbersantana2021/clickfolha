# PRD — Conversor de Eventos da Folha
### Plataforma SaaS Multi-Tenant de Automação de Folha de Pagamento

**Versão:** 2.0 — Reestruturação Comercial
**Preparado para:** Valber Santana
**Data:** 22 de julho de 2026

---

## 0. Nota de Reestruturação — O que mudou e por quê

> **Diagnóstico:** o documento original descrevia uma ferramenta utilitária client-side (converte 1 planilha, roda no navegador, sem conta, sem cobrança, regras fixas para uma única empresa). Isso não é um SaaS comercial — é um script com interface. Este PRD reestrutura o produto para viabilizar venda recorrente multi-cliente.

Três decisões de arquitetura foram tomadas para esta versão e orientam todo o restante do documento:

- Regras de conversão deixam de ser hardcoded e passam a ser configuráveis por tenant (motor de regras) — permite vender para qualquer empresa de RH, não apenas para o layout de planilha original.
- A aplicação ganha backend em Supabase (autenticação, tenants, planos, histórico, auditoria). O processamento do arquivo continua ocorrendo no navegador — mantém a promessa de privacidade dos dados de folha — mas login, cobrança e limites de uso passam a existir de fato.
- Modelo de monetização é assinatura mensal por empresa (SaaS recorrente clássico), com limite de conversões e de layouts configurados por plano.

Consequência prática: o PRD original vira a especificação do "motor de conversão" (seções 8 e 9 deste documento) — ele é preservado quase integralmente como núcleo de processamento. Tudo o que envolve conta, plano, cobrança, configuração de regras e auditoria é adição desta versão.

---

## 1. Sumário Executivo

O Conversor de Eventos da Folha é uma plataforma SaaS que automatiza a conversão de planilhas de RH (Excel) em arquivos CSV prontos para importação em sistemas de folha de pagamento. Em vez de cada empresa depender de um analista de DP fazendo esse trabalho manualmente todo mês — ou de um desenvolvedor mantendo scripts avulsos por cliente — o produto oferece um motor de regras configurável: cada empresa cadastra o layout da sua planilha uma única vez, e a partir daí a conversão é feita em segundos, todo mês, sem intervenção manual.

O produto ataca um problema real e recorrente (processamento de folha é mensal, obrigatório, e propenso a erro manual), com potencial de venda para escritórios de contabilidade, departamentos de RH e BPOs de folha de pagamento que atendem múltiplos clientes com layouts de planilha diferentes.

---

## 2. Objetivo do Produto

Permitir que qualquer empresa ou escritório de contabilidade:

- cadastre seu layout de planilha de RH uma única vez, através de um assistente de configuração (sem código);
- faça upload mensal do arquivo Excel e receba o CSV validado em segundos;
- acompanhe histórico de conversões, valores processados e erros recorrentes;
- opere dentro de um plano pago, com controle de uso, e mantenha os dados de folha (sensíveis, LGPD) processados localmente no navegador.

---

## 3. ICP e Personas

| Persona | Perfil | Dor principal |
|---|---|---|
| Analista/Coordenador de DP | Empresa com 50–2.000 funcionários, folha própria | Gasta horas todo mês formatando planilha manualmente para importar na folha; erro gera reprocessamento e atraso de pagamento |
| Escritório de Contabilidade / BPO | Atende de 10 a 200 empresas-cliente, cada uma com layout de planilha próprio | Precisa manter regras diferentes por cliente; hoje isso é feito com macro de Excel ou script individual mantido por um dev interno |
| Gestor de RH (decisor de compra) | Aprova ferramentas que reduzem retrabalho da equipe | Precisa de auditoria e segurança — dado de folha é sensível e cai em LGPD |

Prioridade comercial: o BPO/escritório de contabilidade é o ICP mais forte, porque multiplica o valor por cliente atendido (um único assinante gera múltiplos "layouts configurados", justificando plano superior) — é o motor de expansão de receita (upsell natural por nº de clientes geridos).

---

## 4. Modelo de Negócio

### 4.1 Planos e Precificação

| Plano | Público | Inclui | Preço sugerido* |
|---|---|---|---|
| Starter | Empresa única | 1 layout configurado, até 30 conversões/mês, 1 usuário | R$ 149/mês |
| Professional | Escritório pequeno | Até 10 layouts (10 clientes), 300 conversões/mês, 5 usuários | R$ 490/mês |
| Business | BPO / contabilidade média-grande | Layouts ilimitados, conversões ilimitadas, usuários ilimitados, log de auditoria estendido, SLA de suporte | R$ 1.290/mês |

*Valores de referência para validação de mercado — devem ser testados com 10–15 conversas de venda antes de travar tabela pública. Não travar preço sem validação com o ICP prioritário (BPOs).

### 4.2 Métrica de Cobrança

Cobrança híbrida: valor fixo por plano + excedente por conversão acima do limite (evita undercharging de clientes de alto volume e dá previsibilidade para os demais). Motivo prático: sem isso, o Business vira teto artificial e você deixa dinheiro na mesa com contas grandes.

### 4.3 Trial e Ativação

Trial de 14 dias sem cartão, limitado a 1 layout e 15 conversões — suficiente para o cliente configurar seu layout real e validar em produção antes de pagar. Ativação (momento "aha") = primeira conversão bem-sucedida com CSV baixado.

---

## 5. Métricas de Sucesso

| Métrica | Definição | Meta inicial (6 meses) |
|---|---|---|
| Ativação | % de trials que completam 1ª conversão em 7 dias | ≥ 60% |
| Retenção mensal | % de tenants pagantes que convertem pelo menos 1x no mês | ≥ 85% |
| Churn | Cancelamentos / assinantes ativos no mês | ≤ 5% mensal |
| Tempo de configuração | Tempo médio para cadastrar 1 layout novo | ≤ 20 minutos |
| Taxa de erro de conversão | % de conversões que terminam em erro não tratado | ≤ 2% |

---

## 6. Arquitetura Geral

### 6.1 Princípio de Arquitetura

Processamento do arquivo (leitura do Excel, aplicação de regras, geração do CSV) continua ocorrendo 100% no navegador do usuário — o conteúdo da planilha de folha nunca trafega para o servidor. Isso preserva o diferencial de privacidade do PRD original e simplifica compliance LGPD. O que passa a existir no backend é apenas metadado: quem é o tenant, qual layout está configurado, quantas conversões foram feitas, e log de auditoria (nome do arquivo, timestamp, totais — nunca o conteúdo linha a linha).

### 6.2 Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Front-end | React 19, TypeScript (strict), Vite, TailwindCSS, shadcn/ui |
| Bibliotecas de processamento | SheetJS (xlsx), React Hook Form, Zod, Lucide React, Sonner, Framer Motion |
| Backend / Dados | Supabase (Postgres + Auth + Row Level Security + Storage para logs) |
| Billing | Stripe (assinatura, portal de cobrança, webhooks de status de plano) |
| Automação interna | N8N para: onboarding de novo tenant, alertas de falha de pagamento, e-mails transacionais |
| CRM / Nutrição | ActiveCampaign para funil de trial → pago e campanhas de reativação |
| Deploy | Vercel (front-end), Supabase Cloud (backend) |

### 6.3 Fluxo de Dados (alto nível)

```
Usuário → Login (Supabase Auth) → Seleciona Layout do Tenant
  → Upload do Excel (processado 100% no navegador via SheetJS)
  → Motor de Regras (configuração do tenant, buscada do Supabase)
  → Geração do CSV (client-side)
  → Log de metadados enviado ao Supabase (auditoria + contagem de uso)
  → Download do CSV
```

---

## 7. Modelo de Dados (Supabase)

Estrutura mínima de tabelas (Postgres/Supabase), com Row Level Security por `tenant_id`:

| Tabela | Campos principais |
|---|---|
| tenants | id, nome, plano_id, status_assinatura, stripe_customer_id, criado_em |
| users | id, tenant_id, nome, e-mail, papel (admin/operador), criado_em |
| layouts | id, tenant_id, nome_layout, config_json (mapeamento de abas/colunas/eventos), versao, ativo |
| conversoes | id, tenant_id, layout_id, usuario_id, nome_arquivo, qtd_registros, valor_total, status, timestamp |
| auditoria | id, tenant_id, conversao_id, evento (ex: "aba ausente"), detalhe, timestamp |
| planos | id, nome, limite_layouts, limite_conversoes_mes, preco_mensal |

O campo `config_json` em `layouts` é o coração da mudança de nicho para SaaS: substitui todo o hardcode de nomes de aba e códigos de evento do PRD original por um dado configurável. Ver seção 9.

---

## 8. Interface do Usuário

### 8.1 Telas Novas (não existiam no PRD original)

| Tela | Função |
|---|---|
| Login / Cadastro | Autenticação via Supabase Auth (e-mail+senha ou magic link). Cadastro cria tenant automaticamente. |
| Dashboard do Tenant | Visão geral: conversões do mês, uso vs. limite do plano, últimos erros, atalho para nova conversão. |
| Configuração de Layout (Wizard) | Assistente passo a passo: upload de uma planilha modelo → sistema sugere abas detectadas → usuário mapeia aba → linha de cabeçalho → colunas → código de evento correspondente. Sem escrever código. |
| Histórico de Conversões | Lista pesquisável de conversões passadas, com filtros por período, status e layout, e opção de re-download do CSV (se ainda em retenção) ou reprocessamento. |
| Billing / Plano | Tela de plano atual, uso do mês, upgrade/downgrade, portal de cobrança Stripe. |
| Administração de Usuários | Convite de usuários adicionais do mesmo tenant, definição de papel (admin/operador). |

### 8.2 Telas do Fluxo de Conversão (herdadas do PRD original, adaptadas)

**Header**
- Logo e nome da aplicação, indicador do tenant/empresa logada, alternador Light/Dark Mode.
- Layout moderno inspirado em Stripe, Linear e Vercel — mantido do original.

**Área Principal — Upload**
- Drag and drop central, aceita apenas `.xlsx`.
- Seletor de layout configurado (caso o tenant tenha mais de um cliente/layout cadastrado — cenário do BPO).
- Destaque visual ao arrastar arquivo; botão alternativo "Selecionar Arquivo".
- Após seleção, exibir: nome do arquivo, tamanho, data da última modificação.

**Processamento**
- Barra de progresso, spinner e status textual: "Lendo planilha..." → "Validando abas..." → "Processando registros..." → "Gerando CSV..." → "Finalizando..."

**Resumo**
- Cards com: funcionários encontrados, eventos gerados, valor total financeiro, total de horas convertidas, tempo de processamento.

**Preview**
- Primeiros 20 registros processados, colunas: Empregado, Evento, Referência, Valor — com busca e ordenação.

**Botões de Ação**
- Processar · Limpar · Baixar CSV · Novo Arquivo.

---

## 9. Motor de Regras Configurável (núcleo do produto)

> **Por que isso existe:** no PRD original, abas ("Comissão Salao", "Comissão Cozinha", "Hora extra"), posição do cabeçalho e códigos de evento (659, 330, 060, 905, 050, 061) estavam hardcoded no código-fonte. Isso trava o produto em um único cliente. O motor de regras move essa lógica para dado configurável por tenant.

### 9.1 Estrutura da Configuração (config_json por layout)

```json
{
  "abas_obrigatorias": ["Comissão Salao", "Comissão Cozinha", "Hora extra"],
  "abas": {
    "Comissão Salao": {
      "linha_cabecalho_marcador": "NUM. FUNC",
      "coluna_matricula": "NUM. FUNC",
      "formato_matricula": "padLeft(6)",
      "eventos": [
        { "coluna_origem": "VALOR A PAGAR", "codigo_evento": "659", "condicao": "> 0" },
        { "coluna_origem": "Vales a descontar", "codigo_evento": "330", "condicao": "> 0" }
      ]
    },
    "Hora extra": {
      "linha_cabecalho_fixa": 2,
      "limite_colunas": 7,
      "coluna_matricula": "Codigo",
      "formato_matricula": "padLeft(6)",
      "conversao_horas": { "formato_entrada": "Xhs Ymin", "formula": "horas + minutos/60" },
      "eventos": [
        { "coluna_origem": "HORAS EXTRA NORMAL", "codigo_evento": "060" },
        { "coluna_origem": "HORA EXTRA COM ADICIONAL NOTURNO", "codigo_evento": "905" },
        { "coluna_origem": "SÓ ADICIONAL NOTURNO", "codigo_evento": "050" },
        { "coluna_origem": "FERIADO", "codigo_evento": "061" }
      ]
    }
  }
}
```

Este JSON é gerado pelo Wizard de Configuração (seção 8.1) — o usuário nunca edita JSON manualmente na V1. O motor de processamento (`services/PayrollProcessor.ts`) lê esta configuração em tempo de execução em vez de ter as regras fixas no código.

### 9.2 Regras Herdadas do Layout Original (usadas como template pré-cadastrado)

O layout descrito no PRD original é preservado como "template de partida" oferecido no Wizard — reduz fricção para o primeiro cliente e serve de exemplo de configuração para novos tenants.

**Localização do Cabeçalho**
Percorrer as linhas até localizar o marcador configurado (ex.: "NUM. FUNC"). Essa linha é o cabeçalho. Alternativa: linha de cabeçalho fixa (ex.: aba Hora Extra, sempre linha 2), também configurável.

**Filtragem**
- Ignorar linhas onde a coluna de matrícula estiver vazia.

**Formatação de Matrícula**
- PadLeft configurável (padrão 6 dígitos). Exemplo: `370` → `000370`.

**Geração de Eventos**
- Para cada coluna de evento configurada: se valor > 0 (ou condição definida), gerar registro com o código de evento correspondente.

**Conversão de Horas**
- Valores em texto no formato "11hs 58min" extraídos via regex configurável (horas e minutos).
- Fórmula: horas + (minutos / 60). Exemplo: `11hs 58min` → `11.966667`.
- Gerar evento apenas quando o valor decimal resultante for maior que 0.

---

## 10. Regras de Exportação CSV

Estrutura de exportação preservada do PRD original — é o contrato de integração com o sistema de folha do cliente e não deve mudar sem necessidade, mas passa a ser parametrizável (nome do arquivo, linha inicial e cabeçalho variam por tenant, com estes valores como padrão).

**Configuração Padrão (herdada)**
- Nome do arquivo: `Eventos_Folha_Export.csv` (configurável por tenant).
- Codificação: UTF-8. Separador: vírgula.
- Linha inicial (registro de controle): `01TC0006,,,`
- Cabeçalho: `Cód.Empregado,Cód. Evento,Referência,Valor do Evento`

**Registros de Comissão (Salão / Cozinha)**
```
Formato: {Empregado},{Evento},,"{Valor}"
Exemplo: 000494,659,,"782,90"
```
- Referência sempre vazia; valor monetário na última coluna; vírgula como separador decimal; duas casas decimais; valor entre aspas.

**Registros de Hora Extra**
```
Formato: {Empregado},{Evento},"{Referência}",
Exemplo: 000370,060,"11,97",
```
- Valor decimal calculado vai na coluna Referência; última coluna permanece vazia; duas casas decimais; vírgula decimal; valor entre aspas.

**Rodapé**
```
Formato: Z,{QuantidadeRegistros},,"{ValorTotal}"
Exemplo: Z,145,,"84598,33"
```
- `QuantidadeRegistros` = total de eventos gerados na exportação.
- `ValorTotal` = somatório de valores de comissão, vales e referências numéricas de hora extra, sempre com duas casas decimais, vírgula decimal, entre aspas.

---

## 11. Segurança, Privacidade e Compliance

Dado de folha de pagamento é dado pessoal sensível sob a LGPD (remuneração, jornada, matrícula vinculada a pessoa física). Isso muda de categoria de risco assim que o produto passa a ter contas e histórico — precisa constar explicitamente no PRD, o original não tratava disso.

- O conteúdo da planilha (linhas, valores individuais de funcionário) nunca é enviado ao backend — permanece só no navegador durante o processamento, reforçando a postura de "privacy by design".
- O backend armazena apenas metadados agregados (totais, contagens, nome de arquivo, timestamp) — nunca dado de funcionário individual.
- Row Level Security no Supabase: cada tenant só acessa seus próprios dados (layouts, conversões, usuários).
- Autenticação obrigatória (Supabase Auth) com expiração de sessão e opção de MFA no plano Business.
- Log de auditoria imutável (quem processou o quê e quando) — requisito de compliance para clientes contábeis, que respondem por seus próprios clientes.
- Política de retenção: histórico de metadados mantido por 24 meses; nenhum arquivo Excel ou CSV é armazenado no servidor.
- Necessário publicar Política de Privacidade LGPD específica do produto antes do lançamento comercial (documento à parte).

---

## 12. Tratamento de Erros

Mensagens amigáveis via Toast, cobrindo — no mínimo — os casos:

- Arquivo inválido / formato não suportado.
- Planilha vazia.
- Aba obrigatória inexistente (informar exatamente qual aba falta, conforme layout configurado do tenant).
- Cabeçalho não encontrado.
- Nenhum registro encontrado.
- Erro durante leitura do Excel / erro na geração do CSV.
- Layout do tenant não configurado ou incompleto (caso novo, específico da versão SaaS).
- Limite de conversões do plano atingido — CTA de upgrade em vez de apenas bloquear (oportunidade de conversão de receita, não só erro).

---

## 13. Performance, Acessibilidade e Responsividade

### 13.1 Performance
- Processar milhares de linhas sem travamento perceptível na UI.
- `useMemo` e `useCallback` onde reduzem re-render mensurável; evitar otimização prematura sem perfil de gargalo real.
- Processamento em memória; geração do CSV via `Blob`.

### 13.2 Acessibilidade
- Navegação por teclado, ARIA Labels, contraste AA, foco visível, compatibilidade com leitores de tela.

### 13.3 Responsividade
- Compatível com desktop, tablet e mobile — uso mobile prioritário para consulta de histórico e status, não necessariamente para configurar layout (tarefa mais complexa, melhor em desktop).

---

## 14. Qualidade de Código e Arquitetura de Pastas

Toda regra de negócio permanece isolada em `services/` — nunca dentro de componentes React, princípio mantido do PRD original e reforçado pela necessidade de o motor de regras ser testável isoladamente.

```
src/
├── components/
├── pages/
├── layouts/
├── services/
│   ├── ExcelService.ts
│   ├── PayrollProcessor.ts   (agora orientado por config_json do tenant)
│   ├── RuleEngine.ts         (novo — interpreta config_json)
│   ├── CsvExporter.ts
│   ├── FileValidator.ts
│   └── HourConverter.ts
├── hooks/
├── utils/
├── lib/
│   └── supabaseClient.ts
├── types/
├── constants/
└── assets/
```

- TypeScript Strict Mode; princípios SOLID; Clean Code; funções puras no motor de regras; componentes reutilizáveis; tipagem completa; separação estrita entre UI e regra de negócio.

---

## 15. Analytics e Instrumentação

Sem instrumentação de uso não há como validar as métricas da seção 5 nem operar o modelo de cobrança híbrido da seção 4.2 — este item não existia no PRD original e é obrigatório para operação comercial.

- Evento: trial iniciado, layout configurado, conversão concluída, conversão com erro, upgrade de plano, cancelamento.
- Cada evento associado a `tenant_id`, para permitir corte de funil por segmento (empresa única vs. BPO).
- Painel interno (Power BI conectado ao Postgres do Supabase) para acompanhar MRR, churn, ativação e uso por plano — reaproveita stack já dominada, sem ferramenta nova.

---

## 16. Roadmap por Fases

| Fase | Escopo | Critério de saída |
|---|---|---|
| MVP | Login, 1 layout por tenant (o do PRD original como template fixo), upload, conversão, download, billing Stripe básico (Starter e Professional) | 1 cliente pagante real processando folha em produção por 2 ciclos mensais consecutivos |
| V2 | Wizard de configuração de layout (multi-layout), histórico completo, auditoria, plano Business, RLS refinado | 3+ tenants BPO configurando layouts próprios sem suporte manual |
| V3 | MFA, política de retenção configurável, exportação de auditoria para compliance, integrações via API para ERPs de folha | Cliente enterprise validando integração via API |

---

## 17. Riscos e Premissas em Aberto

- Premissa a validar: existe demanda de mercado suficiente em BPOs de folha para justificar CAC de aquisição — recomendo validar com 10 conversas de venda antes de investir no Wizard completo (V2).
- Risco: motor de regras genérico pode não cobrir 100% dos formatos de planilha de RH do mercado (variação é grande). Mitigação: começar com os 3 padrões de aba mais comuns identificados em pesquisa de mercado, não tentar cobrir tudo na V1.
- Risco: dependência de Excel como formato de entrada — clientes que já usam ERP de RH integrado podem não precisar do produto. ICP prioritário (seção 3) já filtra isso.
- Premissa: processamento client-side continua viável em planilhas de até dezenas de milhares de linhas no navegador — validar com teste de carga antes do MVP fechar escopo.

---

## 18. Critérios de Aceitação

- [x] Tenant consegue se cadastrar, autenticar e ter um tenant criado automaticamente.
- [x] Tenant consegue configurar (ou usar o template padrão) um layout de planilha sem intervenção de desenvolvedor.
- [x] Sistema aceita apenas arquivos `.xlsx` e valida as abas obrigatórias do layout configurado.
- [x] Sistema localiza corretamente os cabeçalhos conforme regra configurada (marcador ou linha fixa).
- [x] Sistema gera os eventos conforme as regras configuradas por tenant.
- [x] Sistema converte corretamente horas em texto para decimal.
- [x] Sistema gera o CSV exatamente no layout parametrizado, com rodapé de totais correto.
- [x] Sistema exibe resumo do processamento e preview dos primeiros 20 registros.
- [x] Conversão é registrada em log de auditoria com metadados agregados (nunca dado individual).
- [x] Sistema bloqueia ou avisa corretamente ao atingir limite do plano contratado.
- [x] Cobrança recorrente via Stripe funciona para upgrade, downgrade e cancelamento.
- [x] Aplicação funciona 100% no navegador para o processamento de arquivo, sem envio de conteúdo de planilha ao backend.
- [x] Projeto pronto para deploy na Vercel (front) e Supabase Cloud (backend), sem erros de compilação ou TypeScript.
