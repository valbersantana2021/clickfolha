# Fluxo de Processamento de Dados: Conversão de Folha de Pagamento

## 1. Inicialização e Estrutura Básica do Layout
*   O sistema cria o arquivo em memória e escreve as duas primeiras linhas obrigatórias do layout posicional.
*   **Linha 1:** A tag fixa do layout `01TC0006,,,`.
*   **Linha 2:** Os nomes das colunas exigidos: `Cód.Empregado,Cód. Evento,Referência,Valor do Evento`.
*   São iniciados dois contadores zerados: um para a **quantidade de registros** e outro para a **soma total de valores** (utilizados no rodapé).

## 2. Processamento das Abas Financeiras ("Comissão Cozinha" e "Comissão Salao")
O script executa um loop iterando sobre essas duas abas, aplicando as seguintes regras para cada uma:
*   **Busca Dinâmica do Cabeçalho:** O sistema varre as primeiras linhas até encontrar a célula com o texto `NUM. FUNC` e define essa linha como o ponto de partida dos dados.
*   **Filtro de Matrícula:** Ignora linhas em branco ou totais que não possuam um número de funcionário preenchido.
*   **Formatação (Padding):** Extrai o `NUM. FUNC`, converte para inteiro e preenche com zeros à esquerda até atingir 6 dígitos (ex: `198` vira `000198`).
*   **Extração do Evento 659 (Gorjeta):** 
    *   Lê a coluna `VALOR  A  PAGAR`.
    *   Se for maior que zero, adiciona o valor à soma total, converte a pontuação decimal de ponto para vírgula (ex: `1200.01` -> `"1200,01"`) e gera a linha deixando a coluna *Referência* vazia.
    *   *Formato gerado:* `000198,659,,"1200,01"`
*   **Extração do Evento 330 (Vales a descontar):**
    *   Lê a coluna `Vales a descontar` do mesmo funcionário.
    *   Se for maior que zero, aplica o mesmo tratamento matemático e gera uma nova linha.
    *   *Formato gerado:* `000198,330,,"50,00"`

## 3. Processamento da Aba de Horas Trabalhadas ("Hora extra")
Esta aba possui um tratamento focado em tempo (horas/minutos) convertidos para decimais:
*   **Fixação do Cabeçalho:** O script isola estritamente as 7 primeiras colunas, assumindo a linha de índice 1 (segunda linha real) como cabeçalho para evitar duplicidades de colunas calculadas na planilha.
*   **Filtro e Formatação:** Avalia a coluna `Codigo`, aplicando a mesma regra de preenchimento de 6 dígitos.
*   **Conversão de Tempo para Decimal (Regex):**
    *   Para cada coluna de evento (`HORAS  EXTRA NORMAL`, `FERIADO`, etc.), o sistema lê o texto bruto (ex: `"11hs 58min"`).
    *   Utiliza Expressões Regulares (Regex) para extrair os números.
    *   Calcula o valor centesimal: `Horas + (Minutos / 60)` (Ex: 11 + 58/60 = 11.97).
*   **Distribuição dos Eventos na Coluna Correta:**
    *   Mapeia o resultado de cada coluna para seu evento específico (060, 905, 050, 061).
    *   Adiciona o decimal à soma total geral.
    *   Aloca o resultado formatado com vírgula **dentro da coluna "Referência"**, deixando a última coluna (*Valor do Evento*) vazia.
    *   *Formato gerado:* `000370,060,"11,97",`

## 4. Fechamento e Geração do Rodapé (Z)
*   Após processar todas as abas, o sistema compila os contadores globais.
*   Formata a soma total (financeiro + horas decimais) para duas casas decimais com vírgula.
*   Gera a linha de totalização: `Z,{Total de Linhas Geradas},,"{Soma Total}"`.
*   *Formato gerado:* `Z,303,,"113775,21"`

## 5. Exportação
*   O arquivo final é consolidado na memória como texto e exportado com a codificação `UTF-8` no formato `.csv`, perfeitamente alinhado com o layout de integração da folha.