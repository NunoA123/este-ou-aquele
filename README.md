# Anel da Karolina ♡

Comparações par-a-par com ranking Elo. Ela vê duas fotos e escolhe uma.

O resultado útil nunca é "ganhou a número 7" — é a agregação por atributo: que
cor, que intensidade, que tamanho é que ela escolhe consistentemente. Isso
vê-se na vista de admin.

Na ronda 3 já não são anéis, são **pedras à venda**: 25 safiras verdes, cada
uma com a ficha do vendedor. É a ronda que fecha o assunto — o que sair daqui
é o que se leva ao ourives.

```
index.html      a app toda (marcação)
app.js          lógica: Elo, emparelhamento, sincronização, vista de admin
style.css       estilo
rings.json      ficha de cada pedra  ← gerado a partir do tools/pedras.csv
pedras/         fotos P01.jpg … P46.jpg (800×800)
arquivo-v1/     os 33 anéis da primeira versão (fotos soltas)
arquivo-v2/     os 57 anéis da ronda 1, na mão dela
arquivo-v3/     os 39 anéis da ronda 2
tools/
  pedras.csv    a ficha do vendedor, uma linha por pedra
  prep-stones.js normaliza as fotos para pedras/
  init-rings.js  varre pedras/ e confere contra a ficha
  crop-hands.js  recortava as fotos da mão (rondas 1 e 2, já arquivadas)
  Code.gs        backend Google Apps Script
```

Sem build, sem npm, sem dependências. Abrir o `index.html` através de um
servidor (o `fetch` do `rings.json` não funciona em `file://`):

```bash
python3 -m http.server 8000
```

---

## Versões

**v4 (actual, ronda 3): já não são anéis, são pedras.** 25 safiras verdes à
venda no The Natural Sapphire Company, cada uma com ficha: quilates,
milímetros, cor, intensidade, tratamento, origem e preço. Ela escolhe pela
foto e não vê nada disto; a ficha serve para a agregação do lado do dono —
é o que transforma "gosta desta" em "gosta de verdes médios de 1 a 2 quilates,
e isso custa X".

As fotos originais vêm de uma pasta do Google Drive e a ficha está em
`tools/pedras.csv`, que é de onde o `rings.json` é gerado.

Reset total em relação aos anéis: ids novos (`P01`–`P46`, do nome do ficheiro),
chave de `localStorage` nova (`ringduel:state:v6`), e nada de seeds — todas as
pedras partem de 1500. As rondas anteriores ficam em `arquivo-v1/` (33 anéis de
fotos soltas), `arquivo-v2/` (57 anéis na mão dela) e `arquivo-v3/` (os 39 da
ronda 2). As linhas delas continuam na Google Sheet; o admin ignora ids que já
não existem e conta-os à parte.

### Campos (vêm todos da ficha do vendedor)

| Campo | Valores |
|---|---|
| `color` | `green` `yellowish-green` `greenish-yellow` `parti` |
| `intensity` | `light` `medium` `intense` `vivid` `dark` |
| `size` | `small` (< 1 ct) `medium` (1–2,5 ct) `large` (> 2,5 ct) |
| `treatment` | `heat` (aquecida) `none` (sem tratamento) |
| `origin` | `madagascar` `montana` `ceylon` `kenya` `australia` |
| `price` | `budget` (< 500) `mid` (< 2000) `high` (< 5000) `premium` (5000+ USD) |

Cada pedra guarda ainda os valores exactos (`ct`, `mm`, `usd`, `item`) e uma
`note` com a ficha toda. O `item` é a referência do vendedor, para ires lá
buscá-la.

Três destes campos ela nunca vê, e são os mais interessantes:

- **`price`** diz quanto custa o gosto dela. As 25 pedras vão de 109 a 10 285
  dólares.
- **`treatment`** diz se ela distingue uma safira aquecida de uma por tratar.
  Estão 13 contra 12, quase meio a meio — se a preferência sair ao acaso, é
  porque não distingue, e isso poupa muito dinheiro.
- **`origin`** diz o mesmo quanto à proveniência (Montana custa mais).

---

## Adicionar ou substituir pedras

1. Pôr as fotos numa pasta, com o nome `pedra-NN.jpg`.
2. Normalizar:

   ```bash
   node tools/prep-stones.js "../Pedras"
   ```

   Corta ao quadrado pelo centro e reduz a 800×800. Não há recorte a inventar
   como havia nas fotos da mão: as fotos do vendedor já são a pedra ao centro
   sobre fundo liso. O que importa é ficarem **todas do mesmo tamanho**, senão
   a arena deixa de ser simétrica e ela escolhe a foto em vez da pedra. Uma
   pedra pequena continua pequena no cartão, e isso é informação verdadeira —
   o tamanho é um dos atributos a medir.

3. Acrescentar a linha ao `tools/pedras.csv` e voltar a gerar o `rings.json`.
   O `node tools/init-rings.js` confere que todas as pedras com foto têm ficha
   e ao contrário.


## Preencher o `rings.json`

Todos os campos são obrigatórios exceto `note`. O `note` é só para ti; nunca
aparece do lado dela.

| Campo     | Valores |
|-----------|---------|
| `cut`     | `round` `oval` `princess` `emerald` `pear` `marquise` `cushion` `radiant` `baguette` `hexagon` `trillion` `asscher` (forma da pedra central) |
| `setting` | `solitaire` `halo` `three-stone` `five-stone` `bezel` `cluster` `eternity` `toi-et-moi` |
| `side`    | `none` `round` `pear` `marquise` `trillion` `baguette` `mixed` `halo` (forma das pedras laterais) |
| `metal`   | `white-gold` `yellow-gold` `rose-gold` `platinum` `mixed` |
| `band`    | `thin` `medium` `thick` |
| `accent`  | `none` `pave-band` `engraved` `twisted` `split-shank` (o que está no aro) |
| `stone`   | `colorless` `green` `teal` `blue` `pink` (família de cor) — `sage` `mint` `milky` só existem no arquivo |
| `tone`    | `light` `medium` `dark` (quão escura é a pedra; `none` quando é incolor) |
| `vividness` | `vivid` `muted` (quão viva é a cor; `none` quando é incolor) |
| `size`    | `small` `medium` `large` (tamanho aparente da pedra central na foto) |
| `seed`    | opcional: Elo de partida, só nos repescados (ver abaixo) |

### Elo de partida dos repescados (`seed`)

Um anel novo entra a 1500. Os 14 repescados entram com o `seed` que vem no
`rings.json`, para não se deitar fora o que já se sabe deles.

O `seed` **não é** o Elo cru da ronda 1. Leva dois ajustes:

1. **Recentrado.** O Elo é relativo ao grupo onde foi ganho, e os repescados
   não são uma amostra ao calhas: são quase todos do topo, e a média deles era
   1544 contra 1500 do conjunto. Em cru, os 19 anéis novos começavam 44 pontos
   atrás sem terem respondido a nada — e como a fase 2 só joga na metade de
   cima, arriscavam-se a nem ser testados.
2. **Encolhido a metade.** Cada número saiu de 4 a 10 duelos contra um grupo de
   anéis que já não existe. O que se aproveita é a ordem entre eles, não a
   distância exacta.

Fica, por exemplo: R06 (era o 1.º) a 1532, R27 (7.º) a 1508, R33 (26.º) a 1479,
R34 (último) a 1417. A ordem da ronda 1 mantém-se, o espalhamento passa de
1377–1608 para 1417–1532.

Entram com **zero jogos**, por isso apanham o K mais alto e as respostas dela
desfazem depressa um seed que esteja errado. O `seed` é usado tanto no
telemóvel dela como no recálculo do admin, por isso os dois chegam ao mesmo
número — foi verificado com respostas simuladas, diferença zero.

Para desligar isto, apaga-se o campo `seed` do `rings.json` e todos voltam a
1500.

### As cores são medidas, não são a olho

Na ronda 1 havia `green`, `sage` e `mint`, e a fronteira entre eles era o meu
olho num dia bom. Isso não se aguenta: uma pedra escura e apagada tanto pode
sair `sage` como `green` conforme a luz da foto.

Na ronda 2 a cor sai de uma medição. Amostra-se um quadrado de 46px no centro
da pedra, deitam-se fora os pixels de metal, de diamante e de pele, e ficam
três números — matiz, saturação e luminosidade — que decidem três campos
independentes:

| Campo | Regra |
|---|---|
| `stone` | matiz ≥ 150° → `teal`; abaixo → `green` |
| `tone` | luminosidade < 0,30 → `dark`; até 0,45 → `medium`; acima → `light` |
| `vividness` | saturação (percentil 75) ≥ 0,20 → `vivid`; abaixo → `muted` |

Os três números de cada anel ficam na `note`, para se poder conferir. A
saturação usa o percentil 75 e não a mediana porque os brilhos das facetas
puxam a mediana para baixo e fazem qualquer pedra parecer apagada.

O que isto muda, na prática: o que eu tinha chamado `sage` é hoje
`green` + `muted`, e `mint` é `green` + `light` + `muted`. Os eixos passam a
ser independentes, por isso a agregação consegue dizer "ela prefere escuro" e
"ela prefere apagado" em separado, em vez de os misturar numa etiqueta só.

Casos em que a medição me desmentiu: R20, R22 e R26 pareciam-me teal escuro e
são verdes (matiz 108°, 106° e 142°). Fui ver as pedras ampliadas e a medição
tinha razão. O R26, a 142°, é o que está mais perto da fronteira.

Ficaram só quatro teals — R04, R07, R10 e R25 — e o R25 é o mais azul e o mais
claro de todos (198°, luminosidade 0,37).

O `side`, o `tone` e o `vividness` entraram na ronda 2: com tudo o resto fixo, são eles que
distinguem os anéis uns dos outros. O `metal` e o `band` ficaram com um valor
só (`yellow-gold`, `thin`) — não dizem nada nesta ronda, mas ficam para quando
voltar a haver variação.

O `profile` (altura da pedra) saiu no v2. Nas fotos de cima não se vê, e um
valor adivinhado estragava a agregação em vez de ajudar.

Valores fora destas listas são aceites mas dão aviso na consola do browser e
poluem a agregação. `node tools/init-rings.js` também os reporta.

**As classificações foram preenchidas a olho a partir das fotos.** As que
exigem mais juízo são `stone` (onde acaba `sage` e começa `green`) e `size`.
Vale a pena passar os olhos e corrigir: a agregação por atributo é tão boa
quanto esta tabela.

---

## Vista de admin

`.../index.html#/admin`, password no topo do `app.js` (`ADMIN_PASS`).
**Mudar a password antes de publicar.** É ofuscação, não segurança.

Mostra, por ordem de importância:

1. **Agregação por atributo** — Elo médio ponderado pelas respostas (duelos
   mais "nenhum dos dois"), por cada valor de cada campo. A vermelho ficam os
   valores com menos de 3 anéis ou menos de 10 respostas: pouco fiáveis, não
   tirar conclusões daí.
2. **Intransitividade no top 6** — ciclos A vence B, B vence C, C vence A. Um
   ciclo significa que naquele grupo não há preferência forte. É informação,
   não é um erro.
3. **Estado** — total de comparações, quantos "nenhum dos dois", jogos por
   anel, fase.
4. **Tabela de anéis** por Elo, com a coluna `nenhum` (quantas vezes o anel
   apanhou um "nenhum dos dois") e todos os atributos.

Botões: `Exportar JSON`, `Importar JSON`, `Ativar playoff`, `Reset total`.

O `Reset total` só apaga o `localStorage` **deste** dispositivo. A Google Sheet
mantém-se — é essa que manda quando está configurada.

### Fases

| Fase | Quando | O que faz |
|---|---|---|
| 1 | algum anel com menos de 3 aparições | aleatório, prioridade a quem apareceu menos — garante cobertura |
| 2 | todos com 3+ aparições | só a metade de cima da tabela, e só pares dentro de ±120 pontos de Elo |
| playoff | manual, ver abaixo | round-robin dos 6 primeiros, 15 confrontos, depois acaba |

**Aparições, não duelos.** Uma rejeição ("nenhum dos dois") conta para a
cobertura. Enquanto contavam só duelos, um anel rejeitado ficava com o
contador parado e a fase 1 voltava a pô-lo à frente da fila: o C17 apareceu 15
vezes, 11 delas para ser rejeitado, enquanto anéis do meio da tabela apareciam
3. O terço de baixo estava a levar 6,9 aparições por anel contra 4,6 do terço
de cima.

**A fase 2 joga-se só na metade de cima** (`focusIds`). Depois da cobertura,
ordenar os anéis que ela não quer não serve para nada — o que interessa é
saber qual é o primeiro. Sem o corte, a janela de ±120 punha o fundo da tabela
a jogar contra o fundo da tabela e ela lá ia rejeitar os dois outra vez.

O corte é por posição e é refeito a cada par: um anel que caia sai do sorteio,
mas se os de dentro forem perdendo pontos e passarem para trás dele, volta a
entrar. Um azar nos primeiros duelos não o elimina de vez. Dentro da janela, a
prioridade vai para os anéis que ela viu menos vezes, para o topo se ordenar
depressa em vez de repetir sempre os mesmos.

O grupo do playoff fica **congelado** quando o activas, senão os Elos mexem-se a
meio e o round-robin nunca fecha. Nenhum par se repete antes de a fase esgotar
todas as combinações possíveis. Os pares já vistos ficam guardados no
`localStorage` e aguentam que ela feche e volte a abrir a app. No v1 viviam só
em memória, e cada visita recomeçava o ciclo.

### Activar o playoff

A fase vive no `localStorage` do telemóvel **dela**, por isso não há botão no
admin que a active à distância. Activa-se com um link:

```
https://<user>.github.io/este-ou-aquele/#/playoff
```

Mandas-lhe esse link, ela abre, e o playoff arranca no telemóvel dela. O
endereço limpa-se sozinho a seguir, e o ecrã é igual ao do costume — ela não vê
nada de diferente.

Os 6 são congelados no momento em que ela abre, a partir da **folha** (que tem
tudo). Se a folha estiver inalcançável ou souber menos do que o telemóvel dela,
usa os Elos locais — nunca congela um top 6 a partir de dados vazios.

O botão `Ativar playoff` no admin não activa nada: mostra-te o top 6 actual e
copia-te o link para a área de transferência.

Não vale a pena antes de umas 100 comparações — abaixo disso o top 6 ainda é
ruído e estarias a fechar o assunto com os anéis errados. O admin avisa-te.

K = 32 abaixo de 5 jogos, 16 daí para cima.

---

## "Nenhum dos dois"

Ela rejeitou os dois anéis do par. Isso diz que cada um deles está abaixo da
fasquia dela, e não diz nada sobre qual dos dois é melhor.

Por isso nenhum ganha ao outro: **cada um perde contra um adversário
imaginário de 1500**, o anel médio. Quem já estava em baixo perde pouco, quem
estava no topo leva um corte a sério. Vale **metade** de uma derrota normal
(meio K) — foi uma rejeição, não uma comparação entre os dois.

- **Não conta como jogo.** Os jogos medem quantas vezes um anel foi
  *comparado*, e são isso que a fase 1 usa para garantir cobertura e o K usa
  para decidir se ainda está a assentar. As rejeições vão num contador à
  parte, o `neither`, que aparece na coluna `nenhum` do admin.
- **Conta como resposta** para o ecrã de pausa e pesa como um jogo na
  agregação por atributo.
- **Vai para a folha**, com `winner = "skip"`. O `Code.gs` não precisa de
  alterações; o admin recalcula a partir dessas linhas e chega exactamente ao
  mesmo que o telemóvel dela.
- **O par não volta a aparecer**, em fase nenhuma.
- **O `Anterior` desfaz**, incluindo devolver o par ao jogo — desde que a
  linha ainda não tenha ido para a folha. Se já foi, fica lá (é o mesmo que já
  acontecia com as escolhas normais).

Até Setembro de 2026 isto não acontecia: um "nenhum dos dois" não mexia no
Elo nem deixava linha nenhuma. Os pares que ela tinha saltado até aí estavam
guardados no telemóvel e entraram todos de uma vez, na primeira vez que abriu
a versão nova (`migrateSkips`, corre uma vez só). Foram para a folha com a
data desse dia, porque a data original perdeu-se.

---

## Sincronização

Ela joga no telemóvel dela, tu vês no teu. O `localStorage` sozinho não resolve
isso — daí a Google Sheet.

**Enquanto o `SYNC_URL` estiver vazio a app funciona na mesma**, só que os dados
ficam presos ao telemóvel onde ela jogou e o admin avisa que podem estar
incompletos.

Para ligar:

1. Criar uma Google Sheet nova. Primeira linha, exactamente estes cabeçalhos:

   ```
   timestamp | a | b | winner | elo_a | elo_b
   ```

2. Extensions → Apps Script. Colar o `tools/Code.gs`.
3. Deploy → New deployment → **Web app** → Execute as: **Me** → Who has access:
   **Anyone**.
4. Copiar o URL que acaba em `/exec` e colá-lo na constante `SYNC_URL` no topo
   do `app.js`.

Como funciona: as escolhas vão em lotes de 5, e também quando ela fecha o
browser ou chega ao ecrã de pausa. Se a rede falhar, ficam guardadas e vão no
lote seguinte — ela continua a jogar e não vê erro nenhum. O admin faz `GET` à
mesma folha e **recalcula os Elos do zero** a partir das linhas, por isso
funciona em qualquer dispositivo.

Se mudares o `Code.gs`, é preciso Deploy → Manage deployments → **New version**.
Senão o URL continua a servir a versão antiga.

---

## Exportar os dados

Admin → `Exportar JSON`. Sai um ficheiro com os anéis, todas as linhas de
histórico, os Elos calculados e o estado local. `Importar JSON` faz o caminho
inverso, para o `localStorage` deste dispositivo.

---

## Do lado dela

Duas fotos e mais nada. Sem pontuações, sem nomes, sem marcas, sem preços, sem
barras de progresso. `Nenhum dos dois` baixa o Elo dos dois anéis e tira o par
do jogo (ver acima). `Anterior` desfaz a última resposta, seja escolha ou
rejeição (uma só). No computador: `←` `→` escolhem, `↓` é o nenhum dos dois,
`backspace` desfaz.

Ao fim de 35 respostas aparece o ecrã de pausa. Não é enfeite: a partir daí a
qualidade das respostas cai e os dados ficam piores.

Os dois cartões da arena são pixel-a-pixel idênticos e o lado de cada anel é
sorteado em cada ronda. Se um lado fosse mais bonito que o outro ela escolhia o
lado e não o anel, e o exercício deixava de valer alguma coisa. Ao mexer no
CSS, manter isso.
