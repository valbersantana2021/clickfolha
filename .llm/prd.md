Aqui está o PRD completo e detalhado, estruturado para ser o guia definitivo de construção do seu SaaS, seguido pelo prompt otimizado para o Lovable.

# PRD — Conversor de Eventos da Folha (SaaS B2B)

## 0. Application Name
ClickFolha

## 1. Intent & Goal
O **Conversor de Eventos da Folha** é uma plataforma SaaS B2B projetada para automatizar a transformação de planilhas de RH (Excel) em arquivos CSV padronizados para importação em sistemas de folha de pagamento. 

O objetivo principal é eliminar o trabalho manual, repetitivo e propenso a erros de analistas de Departamento Pessoal (DP). O diferencial estratégico do produto é a sua arquitetura de **processamento 100% client-side** (garantindo total privacidade e compliance com a LGPD, já que os dados sensíveis não vão para o servidor) combinada com uma **estrutura de Sub-tenants**, permitindo que BPOs e escritórios de contabilidade gerenciem múltiplos clientes em uma única conta. O modelo de negócios é baseado em assinaturas recorrentes (SaaS) com limites de uso (layouts e conversões).

## 2. Audience & Roles
O sistema opera em uma arquitetura B2B multi-tenant com suporte a sub-tenants (clientes do BPO).

*   **Tenant Admin (Gestor do BPO / Dono da Conta):** Assina o plano, gerencia o faturamento (Stripe), cria Sub-tenants (seus clientes) e tem visão global do uso da plataforma e logs de auditoria.
*   **Tenant Operator (Analista de DP):** Realiza o trabalho operacional. Faz upload das planilhas, configura layouts no Wizard, valida os dados em tela e baixa os CSVs. Não tem acesso a faturamento.
*   **Sub-tenant (Entidade Lógica - Cliente do BPO):** Não é um usuário logável na V1, mas sim uma entidade organizacional. Cada Sub-tenant possui seus próprios layouts configurados e seu próprio histórico de conversões.

## 3. Core Flows

**Fluxo 1: Onboarding e Configuração Mágica (Wizard com Auto-Detect)**
1. Usuário faz login e cria um novo Sub-tenant (ex: "Cliente Padaria São João").
2. Inicia o cadastro de um novo Layout fazendo upload de uma planilha Excel de exemplo.
3. O sistema lê o Excel localmente e aciona o **Auto-Detect**: identifica abas, localiza a linha de cabeçalho e sugere o mapeamento de colunas (ex: sugere que a coluna "NUM. FUNC" é a Matrícula).
4. O usuário revisa as sugestões, ajusta regras específicas (ex: "Converter horas desta coluna") e salva. O sistema gera o `config_json` em background.

**Fluxo 2: Processamento Mensal Recorrente**
1. Usuário seleciona o Sub-tenant e o Layout desejado.
2. Faz upload da planilha do mês atual.
3. O motor de regras processa o arquivo no navegador em segundos.
4. Tela de Preview exibe os totais processados (Valor Total, Qtd de Eventos) e uma tabela com os primeiros 20 registros para conferência visual.
5. Usuário clica em "Baixar CSV".
6. O sistema dispara um log de metadados para o backend (Supabase) registrando a conversão (auditoria e contagem de uso) e libera o download.

## 4. Camada Pública
*   **Login / Cadastro:** Autenticação via e-mail/senha (Supabase Auth). Cadastro cria automaticamente o Tenant principal.
*   **Recuperação de Senha:** Fluxo padrão de envio de link para reset.
*   **Landing Page (Opcional no app builder):** Vitrine simples com proposta de valor, foco em privacidade (LGPD) e tabela de preços.

## 5. Camada Privada
*   **Dashboard Geral:** Visão do Tenant. Cards com total de conversões no mês, uso do limite do plano, atalho para "Nova Conversão" e lista das últimas atividades.
*   **Gestão de Sub-tenants (Clientes):** CRUD simples para o BPO cadastrar as empresas que ele atende. Estado vazio: "Você ainda não cadastrou nenhum cliente. Adicione seu primeiro cliente para começar."
*   **Área de Processamento (Workspace):** A tela principal. Dropzone para o arquivo `.xlsx`, seletores de Sub-tenant e Layout. Indicadores de progresso durante a leitura.
*   **Histórico e Auditoria:** Tabela com logs de todas as conversões realizadas. Colunas: Data, Operador, Sub-tenant, Layout, Nome do Arquivo, Status (Sucesso/Erro), Qtd Registros. Filtros por data e Sub-tenant.
*   **Configurações e Billing:** Gerenciamento da assinatura (integração Stripe Customer Portal), upgrade/downgrade de plano e convite de novos operadores para o Tenant.

## 6. Módulos Principais
*   **Motor de Regras Client-Side (Core):** Utiliza a biblioteca `SheetJS` para ler o Excel no navegador. Interpreta o `config_json` do layout para: encontrar cabeçalhos, ignorar linhas vazias, aplicar `padLeft` em matrículas, converter horas (Regex `Xhs Ymin` para decimal) e gerar eventos.
*   **Módulo Auto-Detect:** Algoritmo simples que varre a primeira linha não vazia do Excel buscando palavras-chave comuns (Matrícula, Codigo, Valor, Horas) para pré-preencher o formulário do Wizard, reduzindo o atrito de configuração.
*   **Gerador de CSV:** Formata os dados processados no padrão estrito de folha: `Cód.Empregado,Cód. Evento,Referência,Valor do Evento`. Adiciona linha de cabeçalho técnica (`01TC0006,,,`) e rodapé de totalização (`Z,Qtd,,ValorTotal`).
*   **Billing & Limites:** Middleware que verifica no Supabase se o Tenant atingiu o limite de conversões do mês antes de permitir um novo processamento.

## 7. Technical Requirements
*   **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui.
*   **Backend & Database:** Supabase (PostgreSQL).
*   **Autenticação:** Supabase Auth.
*   **Processamento de Arquivos:** `xlsx` (SheetJS) estritamente no client-side.
*   **Pagamentos:** Stripe (Checkout e Customer Portal).
*   **Modelo de Dados Essencial (Supabase):**
    *   `tenants`: id, name, stripe_customer_id, plan_id.
    *   `sub_tenants`: id, tenant_id, name.
    *   `layouts`: id, sub_tenant_id, name, config_json (regras mapeadas).
    *   `conversions_log`: id, tenant_id, sub_tenant_id, layout_id, file_name, records_count, total_value, status, created_at.
*   **Segurança:** Row Level Security (RLS) no Supabase garantindo que um Tenant jamais acesse dados (layouts/logs) de outro.

## 8. V1 Scope
*   Autenticação completa (Login/Sign up).
*   Criação da estrutura Tenant -> Sub-tenant.
*   Wizard de criação de Layout com Auto-Detect básico.
*   Motor de processamento client-side suportando regras de: Comissão (valor direto) e Hora Extra (conversão de texto para decimal).
*   Geração e download do CSV padronizado.
*   Gravação de log de auditoria (apenas metadados, sem dados pessoais) no Supabase.
*   Integração com Stripe para planos Starter e Professional.
*   Dashboard de consumo e histórico.

## 9. UX / Visual Direction
*   **Estilo:** Profissional, limpo, minimalista e confiável. Inspiração direta em interfaces como Stripe, Vercel e Linear.
*   **Cores:** Fundo claro (off-white), tipografia escura e nítida (Inter ou Geist), botões de ação primária em cores sólidas (Preto ou Azul corporativo). Suporte a Dark Mode.
*   **Feedback Visual:** Uso intensivo de Toasts (Sonner) para sucessos e erros. Skeleton loaders durante transições. Barra de progresso real durante a leitura do Excel.
*   **Densidade de Dados:** A tela de preview do CSV deve parecer uma tabela de dados profissional, compacta, facilitando a leitura rápida de números e matrículas.

## 10. Out of Scope
*   Dashboards avançados de inteligência de dados ou detecção de anomalias salariais.
*   Integração direta via API com sistemas de ERP (ex: Domínio, Alterdata).
*   Autenticação Multifator (MFA).
*   Permissões granulares complexas (ex: Operador que só vê um Sub-tenant específico).
*   Armazenamento do arquivo Excel ou CSV no servidor (proibido por design).