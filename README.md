# A Minha Equipa — Web v2

## Antes de abrir a nova interface

No Supabase executa primeiro:

`04_migracao_disponibilidade_eventos.sql`

Esse script:
- cria `evento_empenhados`;
- cria `v_evento_empenhados`;
- cria a função `consultar_disponibilidade(data, hora, ignorar_evento)`;
- protege a nova tabela com o teu UID/RLS.

## Novidades desta versão

### Consultar disponibilidade
Menu `Consultar disponibilidade`:
- escolhe uma data;
- opcionalmente escolhe uma hora;
- vê quem está disponível;
- vê quem está indisponível por ERASMUS;
- vê quem já está empenhado noutro evento;
- vê alertas de aula sem marcar automaticamente a pessoa como indisponível.

### Eventos
Ao criar ou editar um evento:
1. defines nome, data e hora;
2. podes filtrar candidatos por toda a equipa, curso ou ano;
3. carregas em `Ver disponibilidade`;
4. aparece cada pessoa com o estado atual e eventual alerta de aula;
5. marcas quem queres empenhar;
6. guardas.

Uma pessoa empenhada passa automaticamente a aparecer como indisponível para consultas que coincidam com esse evento.

### Regra atual
- ERASMUS => indisponível automático.
- Empenhamento noutro evento => indisponível automático.
- Aula => aviso, não indisponibilidade automática.
- Eventos sem hora de fim são tratados como duração de 1 hora na consulta de conflitos.

## Testar localmente

Na pasta:

```bash
python -m http.server 8080
```

Abrir:

`http://localhost:8080`

## GitHub Pages

Depois de testar, substitui no teu repositório:
- index.html
- styles.css
- app.js

O ficheiro SQL não precisa de ir para o site.


## Filtros e ordenação

Na página `Consultar disponibilidade`:

- clicar no título de qualquer coluna ordena essa coluna;
- clicar novamente inverte crescente/decrescente;
- existe um filtro individual por baixo de cada coluna;
- filtros podem ser combinados;
- o botão `Limpar filtros` repõe tudo;
- não é necessária qualquer alteração nova no Supabase.


## Pesquisa de pessoa nos constrangimentos

O campo Pessoa agora permite escrever nº de corpo ou nome e escolher a sugestão,
em vez de percorrer manualmente a lista inteira.

## Se aparecer "acesso negado"

Executa `06_fix_acesso_negado.sql` uma vez no SQL Editor do Supabase.
O problema era o trigger de histórico tentar gravar em `historico` com as
permissões do utilizador autenticado.


## V4 — Resumo e fichas individuais

Antes de usar esta versão, executa no Supabase:

`07_migracao_fichas_resumo.sql`

O resumo passa a mostrar:
- pessoas totais;
- 5.º e 6.º ano;
- pessoas por curso, distinguindo ramo (ex.: EXE · TM e GNR · TM);
- ENG 5.º;
- ENG 6.º;
- MED 5.º;
- raparigas;
- rapazes;
- sexo ainda por preencher.

A aplicação NÃO tenta inferir sexo a partir do nome.
Preenche `Feminino/Masculino` manualmente na ficha de cada pessoa.

Na página Equipa, clicar numa linha abre uma ficha individual com:
- idade;
- localidade;
- ramo/curso/ano/posto;
- nº de eventos em que foi empenhado;
- nº de constrangimentos;
- constrangimentos recentes;
- eventos em que participou.

Os campos Idade, Sexo e Localidade podem ser editados em `Editar ficha`.


## Ajuste v4.1 — Engenheiros

Os indicadores `Engenheiros · 5.º` e `Engenheiros · 6.º` contam agora:
- TM
- ENG
- SMAT

independentemente de o ramo ser EXE ou GNR.

`MED · 5.º` continua a contar todos os MED do 5.º ano, independentemente do ramo.


## V4.2 — Exportação de eventos

Na página Eventos, cada evento tem agora:

- `CSV` — descarrega a lista dos empenhados com:
  - nº de corpo
  - nome
  - posto
  - ano
  - ramo
  - curso
  - idade
  - localidade

- `PDF` — abre uma versão limpa da lista para imprimir.
  No diálogo do browser podes escolher `Guardar como PDF`.

Não é necessária qualquer alteração no Supabase para esta versão.


## Ajuste da exportação

A exportação inclui agora apenas:
- Nº Corpo
- Nome
- Posto
- Ano
- Ramo
- Curso


## V4.3 — Estado dos eventos

Executa primeiro `08_migracao_estado_eventos.sql` no Supabase.

Cada evento passa a ter estado:
- Automático
- Agendado
- Em curso
- Finalizado
- Cancelado

Quando está em `Automático`, a aplicação calcula:
- antes da hora de início -> Agendado;
- entre início e fim -> Em curso;
- depois do fim -> Finalizado.

Se o evento não tiver hora de fim, assume 1 hora de duração para o cálculo automático.

O estado pode ser substituído manualmente.

Eventos cancelados:
- continuam guardados no histórico/lista de eventos;
- não entram no contador de eventos futuros;
- não entram no número/lista de eventos participados na ficha individual.


## V5 — Horários completos

Antes de usar esta versão, executa no Supabase:

`09_migracao_horarios_completos.sql`

### O que mudou

Já não precisas de criar cada aula como se fosse um horário independente.

Agora crias **um horário completo**, por exemplo:

`5.º Ano Engenharia Militar — Turma A`

e dentro desse horário adicionas todos os blocos da semana:
- dia;
- hora de início;
- hora de fim;
- disciplina;
- tipo.

Só depois escolhes as pessoas às quais esse horário pertence e carregas em
`Guardar horário completo`.

A associação às pessoas é feita uma única vez para todo o horário.

### Importação rápida a partir do Excel

No editor do horário existe `Importar vários blocos de uma vez`.

Podes copiar linhas do Excel com as colunas:

`Dia | Início | Fim | Disciplina | Tipo`

Exemplo:

Segunda    13:30    14:30    EG       PRATICA
Terça      11:30    13:00    VC       TEORICA
Quarta     16:30    17:00    EBeta    OUTRA

Também aceita `;` como separador.

### Compatibilidade

Os horários antigos continuam a funcionar e continuam a ser considerados
na disponibilidade. Aparecem numa secção separada chamada `Blocos antigos`.


## V5.1 — Importação rápida corrigida

Executa primeiro:

`10_migracao_tipos_aula.sql`

Novos tipos:
- `TEORICA`
- `TEORICO_PRATICA`
- `PROBLEMAS`
- `LABORATORIO`
- `OUTRA`

Na importação rápida podes escrever:

`Terça 13:00 14:30 EG T`

ou:

`Quarta 15:30 17:00 OGC TP`

ou copiar diretamente do Excel por TAB.

Abreviaturas aceites:
- T = Teórica
- TP = Teórico-prática
- P / PB = Problemas
- L / LAB = Laboratório

Também continua a aceitar nomes completos.


## V5.2 — Constrangimentos com horas e decisão

Antes de usar esta versão executa:

`11_migracao_constrangimentos_horas_estados.sql`

### Horas opcionais

Cada constrangimento pode ter:
- data de início;
- hora de início opcional;
- data de fim;
- hora de fim opcional.

Sem horas, aplica-se ao dia inteiro.

Com horas, só influencia a disponibilidade durante esse período.

### Estados

- `IMPEDITIVO` — bloqueia a disponibilidade.
- `POR_CONFIRMAR` — aparece como `POR CONFIRMAR`, mas não como indisponível definitivo.
- `ACEITE` — bloqueia a disponibilidade.
- `NAO_ACEITE` — continua registado, mas não afeta a disponibilidade.

Assim um pedido pode começar como `POR_CONFIRMAR` e mais tarde ser editado
para `ACEITE` ou `NAO_ACEITE`.


## V5.3 — Um constrangimento para várias pessoas

Ao criar um constrangimento novo, podes agora selecionar várias pessoas.

Exemplo:
- Tipo: Treino de desporto
- Estado: Impeditivo
- Data: 20/10/2026
- Hora: 15:00–17:00
- Pessoas: 3 militares

Ao guardar, são criados automaticamente 3 registos iguais, um para cada pessoa.

Na edição continua a ser alterado apenas o registo individual daquela pessoa,
para poderes mais tarde aceitar/rejeitar ou corrigir uma pessoa sem mexer nas outras.

Não requer nova migração SQL.


## V5.4 — Ver horários

Na página Horários podes agora:

- `Ver` qualquer horário completo criado;
- ver a grelha semanal desse horário;
- ver também a tabela de blocos;
- ver as pessoas associadas ao horário;
- usar `Ver horário de pessoa`;
- pesquisar uma pessoa por nº, nome ou curso;
- ver o horário combinado dessa pessoa, juntando todos os horários que lhe estão atribuídos.

Não requer SQL novo.


## V5.5 — Filtros, ordenação e constrangimentos passados

### Constrangimentos
- filtros por Pessoa, Tipo, Estado, Início, Fim e Observação;
- ordenação ao clicar no título da coluna;
- botão `Ver` para expandir todos os detalhes do constrangimento;
- constrangimentos atuais/futuros ficam na tabela principal;
- constrangimentos passados ficam numa secção expansível no final da página.

### Equipa
- filtros individuais por todas as colunas;
- ordenação por Nº, Nome, Posto, Ano, Ramo, Curso, Idade e Localidade;
- botão `Limpar` para repor filtros.

Não requer SQL novo.


## V5.6 — Participantes detalhados e pessoas externas

Antes de usar esta versão executa:

`12_migracao_pessoas_externas.sql`

### Gestão de participantes dos eventos

O editor normal do evento continua a existir.

Foi adicionado o botão `Gerir participantes`, que abre uma janela grande só para participantes, com:
- Nº Corpo;
- Nome;
- Equipa ou Externo;
- Função;
- Ano / Curso;
- Estado de disponibilidade;
- Motivo da indisponibilidade;
- Aulas / alertas.

Também permite:
- pesquisar;
- filtrar pelo estado;
- mostrar só equipa ou só externos;
- selecionar de uma vez todos os disponíveis.

### Pessoas externas

Na página `Equipa` existe uma secção separada chamada `Pessoas externas à equipa`.

Podem:
- participar em eventos;
- ter horários;
- ter constrangimentos;
- aparecer na consulta de disponibilidade.

Não:
- aparecem na tabela principal da equipa;
- entram nas estatísticas do Resumo.

Funções disponíveis:
- CPel
- CBat
- CCA
- CACA
- Outra


## V5.6.1 — Correção crítica

Corrigido o erro `renderSchedules is not defined`.

A versão v5.6 perdeu acidentalmente algumas funções da interface ao juntar as alterações.
Esta versão repõe:
- Horários
- Eventos
- Histórico
- fichas individuais
- exportação CSV/PDF

e mantém:
- gestão detalhada de participantes
- pessoas externas
- funções CPel / CBat / CCA / CACA

Não requer SQL adicional além do `12_migracao_pessoas_externas.sql`.


## V5.7 — Disponibilidade manual por evento

Antes de usar esta versão executa:

`13_migracao_disponibilidade_manual_evento.sql`

Na janela grande `Gerir participantes`, cada pessoa tem agora uma coluna
`Decisão manual`.

Opções:
- Automático
- Disponível
- Indisponível
- Por confirmar

A disponibilidade automática continua a mostrar:
- horários/aulas;
- constrangimentos;
- conflitos com outros eventos.

Tu decides manualmente se esses alertas justificam ou não impedir a pessoa
de participar naquele evento.

A decisão manual:
- aplica-se apenas àquela pessoa naquele evento;
- não altera o horário nem o constrangimento original;
- pode ter um motivo;
- fica guardada quando guardas o evento.


## V5.8 — Filtros avançados da Equipa

Na página `Equipa` existe agora um filtro rápido por grupo.

`Engenheiros` inclui automaticamente:
- TM
- ENG
- SMAT

independentemente do ramo EXE/GNR.

Também podes escrever vários cursos no filtro `Curso`, separados por `;` ou `,`.

Exemplos:

`TM;ENG;SMAT`

`TM,ENG`

Não requer SQL novo.


## V5.9 — Eventos destinados a cursos

Executa primeiro:

`14_migracao_eventos_cursos.sql`

Ao criar ou editar um evento, em `Destinatários` podes escolher:

- Toda a equipa
- Curso(s) específico(s)
- Ano específico

Em `Curso(s) específico(s)` podes selecionar um ou vários cursos.

Os cursos distinguem ramo, por exemplo:
- EXE · TM
- GNR · TM
- EXE · ENG
- GNR · ENG

Depois de escolher os cursos:
- a lista pequena do editor mostra apenas pessoas desses cursos;
- `Gerir participantes` também mostra apenas pessoas desses cursos;
- pessoas fora dos cursos escolhidos não podem ficar empenhadas nesse evento;
- a escolha dos cursos fica guardada no evento.


## V5.10 — Filtros e ordenação de participantes

Na janela `Gerir participantes` foram adicionados:

### Filtros
- disponibilidade;
- ano;
- curso;
- equipa / externos;
- pesquisa livre.

O filtro Curso distingue ramo:
- EXE · TM
- GNR · TM
- etc.

Os filtros respeitam também os destinatários definidos no próprio evento.

### Ordenação
É possível ordenar por:
- Nº Corpo;
- Nome;
- Ano;
- Curso;
- Disponibilidade.

Também podes clicar diretamente nos cabeçalhos:
- Nº
- Nome
- Ano / Curso
- Disponibilidade

para alternar entre ascendente e descendente.

Não requer SQL novo.


## V5.11 — NIM e nova ordem da exportação

Executa primeiro:

`15_migracao_nim.sql`

Foi adicionado o campo `NIM` a todas as pessoas, incluindo pessoas externas.

O NIM:
- é opcional;
- quando preenchido tem de ter exatamente 8 algarismos.

A exportação dos empenhados passa a usar esta ordem:

`# | Ano | Posto | Nº Corpo | Nome | NIM | Ramo | Curso`


## V5.11.1 — NIM sem validação obrigatória

Foi removida a regra que obrigava o NIM a ter exatamente 8 algarismos.

O campo continua disponível para membros da equipa e pessoas externas, mas agora aceita qualquer valor de texto que queiras guardar.

Se já tinhas executado a migração anterior, executa novamente:

`15_migracao_nim.sql`

para remover a constraint da base de dados.


## V5.11.2 — Correção da exportação PDF

Corrigida a ordem das colunas no mapa de empenhamentos em PDF.

Ordem final:
`# | Ano | Posto | Nº Corpo | Nome | NIM | Ramo | Curso`

Não requer SQL novo.


## V5.12 — Ordenação do PDF com 3 critérios

Ao carregar em `PDF`, escolhes:
- critério principal;
- critério secundário;
- critério terciário.

Cada critério pode ser ascendente ou descendente.

Exemplo:
`Ano ↑ → Curso ↑ → Nº Corpo ↑`

Isto ordena primeiro por ano, dentro de cada ano por curso e dentro de cada curso por Nº Corpo.

Não requer SQL novo.


## V5.12.1 — Correção do estado automático dos eventos

Corrigido um erro na leitura das horas vindas do Supabase.

O Supabase pode devolver `16:00:00`, e a versão anterior acrescentava mais `:00`,
criando uma hora inválida. Isso fazia eventos futuros aparecerem como `Finalizado`.

Agora:
- antes da hora/data → Agendado
- durante o período → Em curso
- depois do fim → Finalizado
- estado manual continua a ter prioridade

Não requer SQL novo.


## V5.13 — Ordenação multi-critério na Disponibilidade

Os cabeçalhos da tabela `Consultar disponibilidade` passam a funcionar com vários critérios acumulados.

Exemplo:
1. clicar em `Nº` → ordena por Nº Corpo;
2. clicar em `Ano` → `Ano` passa a ser o critério principal e `Nº` fica como secundário.

Resultado:
- 5.º ano agrupado;
- dentro do 5.º ano, ordenado por Nº Corpo;
- depois 6.º ano;
- dentro do 6.º ano, novamente por Nº Corpo.

Os indicadores mostram também a prioridade:
- `↑1` / `↓1` = critério principal;
- `↑2` / `↓2` = critério secundário;
- etc.

Clicar novamente no critério principal alterna ascendente/descendente.

Não requer SQL novo.


## V5.14 — Ordenação estilo Excel em todas as áreas

A ordenação multi-critério foi estendida para todas as tabelas relevantes:

- Consultar disponibilidade
- Eventos
- Equipa
- Pessoas externas
- Constrangimentos atuais
- Constrangimentos passados
- Gerir participantes de um evento
- Tabela detalhada de um horário
- Histórico

Funcionamento:
1. clicas numa coluna — passa a critério principal;
2. clicas noutra — a nova passa a principal e a anterior fica como secundária;
3. continuas a clicar noutras colunas — os critérios anteriores são mantidos para desempate.

Exemplo:
- primeiro `Nº Corpo`;
- depois `Ano`;
- depois `Curso`.

Fica:
`Curso ↑1 → Ano ↑2 → Nº Corpo ↑3`.

Os indicadores `↑1`, `↑2`, `↑3` mostram a prioridade.

Se voltares a clicar no critério principal, alterna entre ascendente e descendente.

Não requer SQL novo.


## V5.15 — Grupo Engenheiros nos filtros de Curso

Sempre que existe filtro de `Curso`, foi adicionada a opção `Engenheiros`.

O grupo inclui:
- TM
- MAT
- ENG

Também é mantida compatibilidade com registos `SMAT` já existentes, que são tratados como engenharia.

Aplicado em:
- Consultar disponibilidade
- Equipa
- Gerir participantes de eventos

Nos filtros de texto da Disponibilidade e Equipa podes escrever/selecionar `Engenheiros`.
Também continua a ser possível escrever vários cursos separados por `;` ou `,`.

Não requer SQL novo.


## V5.16 — Resumo com equipa + pessoal com função

Alterações no Resumo:

- Os cartões superiores continuam a contar apenas membros da equipa.
- `Eventos futuros` mostra apenas eventos entre hoje e os próximos 7 dias.
- O gráfico `Pessoas por curso` passa a incluir pessoas externas com função.
- Verde = membros da equipa.
- Vermelho = pessoas externas/com função.
- Quando existe parte vermelha, aparecem à direita:
  - número verde da equipa;
  - número vermelho do pessoal com função;
  - total a preto.
- Quando não existe pessoal com função nesse curso, aparece apenas o total a preto.
- Foi removido o indicador `Sexo por preencher`.

O gráfico continua a separar Exército e GNR.

Não requer SQL novo.


## V5.16.1 — Correção dos números no gráfico do Resumo

Corrigido o espaço reservado à direita das barras.

Quando existem pessoas externas/com função, passam a aparecer corretamente:
- verde: nº de pessoas da equipa;
- vermelho: nº de pessoas externas/com função;
- preto: total.

Quando não existem pessoas externas/com função, continua a aparecer apenas o total a preto.

Não requer SQL novo.


## V5.17 — Novo símbolo e barra lateral fixa

- O símbolo `AE` foi substituído pela imagem fornecida.
- Foi adicionado também como favicon do site.
- A barra verde lateral fica sempre fixa.
- Apenas a zona branca principal faz scroll.
- Em ecrãs pequenos/mobile, o layout volta ao comportamento normal para não bloquear a navegação.

Não requer SQL novo.


## V5.17.1 — Correção crítica da barra lateral

Corrigido o bug da V5.17 em que a área branca ficava vazia.

Causa:
- a sidebar tinha sido retirada do fluxo do CSS Grid com `position: fixed`;
- o conteúdo principal caiu para a coluna estreita da sidebar e ficou escondido.

Agora:
- a barra verde permanece sempre visível;
- continua a ocupar a coluna própria do layout;
- só a zona branca faz scroll vertical;
- o novo ícone aparece também no login e como favicon.

Não requer SQL novo.


## V6.0 — QGApp com dois módulos

O login passa a abrir o ecrã principal `QGApp — Comando e Gestão de Operações`.

Existem dois módulos:

- `A Minha Equipa`: mantém a aplicação atual.
- `A Minha Turma`: inclui automaticamente todas as pessoas cujo curso é `TM`, independentemente de pertencerem à equipa ou serem externas.

A Minha Turma tem, nesta primeira versão:
- resumo próprio;
- contagens por ano e ramo;
- distinção entre pessoas da equipa e externas;
- lista completa de TM;
- pesquisa, filtros e ordenação multi-critério.

Os dois módulos usam o mesmo login e os mesmos registos de pessoas no Supabase.
Não requer SQL novo.


## V6.1 — Páginas separadas

A navegação passa a usar páginas HTML reais:

- `index.html` — Login + escolha de módulo
- `equipa.html` — A Minha Equipa
- `turma.html` — A Minha Turma

Isto faz com que o botão `Voltar` do browser funcione naturalmente:
`Equipa/Turma → voltar → escolha de módulos`.

A sessão Supabase é a mesma nas três páginas, por isso não é necessário iniciar sessão novamente ao trocar de módulo.

### A Minha Turma

A turma passa a incluir exclusivamente pessoas que cumpram simultaneamente:

- Curso = `TM`
- Ano = `6`

Inclui tanto pessoas da equipa como pessoas externas.

Não requer SQL novo.


## V6.2 — Fichas individuais na Turma

Na página `A Minha Turma`:

- cada linha da tabela passa a ser clicável;
- ao clicar abre a mesma ficha individual usada em `A Minha Equipa`;
- na versão aberta a partir da Turma não são mostrados os campos `Origem` e `Função`;
- as colunas `Origem` e `Função` foram removidas da tabela da Turma;
- os respetivos filtros também foram removidos.

A Turma continua limitada a `TM · 6.º ano`.

Não requer SQL novo.


## V6.3 — Turma: colunas removidas + horários TM 6.º ano

Na página `A Minha Turma`:

- as colunas `Origem` e `Função` foram removidas fisicamente da tabela;
- foi criada a nova aba `Horários`;
- essa aba reutiliza diretamente os horários já existentes no módulo Equipa;
- são mostrados automaticamente os modelos com nomes:
  - `6.º ANO TM_1`
  - `6.º ANO TM_2`
  - `6.º ANO TM_3`
  - `6.º ANO TM_4`
- o filtro tolera pequenas diferenças de espaços, hífens e o símbolo `º`;
- cada cartão permite abrir o horário completo na grelha semanal existente.

Os horários não são duplicados na base de dados: a Turma apresenta os mesmos registos já guardados no Supabase.

Não requer SQL novo.
