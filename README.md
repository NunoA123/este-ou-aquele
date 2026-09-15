# Anel da Karolina ♡

Comparações par-a-par de anéis com ranking Elo. Ela vê duas fotos e escolhe uma.
O resultado útil não é "ganhou o anel #7" — é a agregação por atributo: que
lapidação, que metal, que engaste, que espessura de aro é que ela escolhe
consistentemente. Isso vê-se na vista de admin.

```
index.html      a app toda (marcação)
app.js          lógica: Elo, emparelhamento, sincronização, vista de admin
style.css       estilo
rings.json      atributos de cada anel  ← preenchido à mão
aneis/          fotos A1.jpg … G57.jpg (800×800, recortes da mão dela)
arquivo-v1/     os 33 anéis da primeira versão (fotos soltas) e o rings.json deles
tools/
  crop-hands.js recorta as fotos da mão para aneis/
  init-rings.js script que varre aneis/ e gera o stub do rings.json
  Code.gs       backend Google Apps Script
```

Sem build, sem npm, sem dependências. Abrir o `index.html` através de um
servidor (o `fetch` do `rings.json` não funciona em `file://`):

```bash
python3 -m http.server 8000
```

---

## Versões

**v2 (actual)**: 57 anéis, todos na mesma foto da mão dela, gerados com IA.
Como a mão, o fundo e a luz são iguais em todas, a única coisa que muda entre
dois cartões é o anel. As fotos originais estão em `../Ring Sample/`. O nome
de cada ficheiro (`A1`, `D38`…) é o `id` do anel.

**v1**: 33 fotos soltas da internet, em `arquivo-v1/`. As 177 escolhas desse
período continuam na Google Sheet. O admin ignora-as porque os ids (`r01`…)
já não existem, e o estado no telemóvel dela recomeça do zero porque a chave
do `localStorage` passou a `ringduel:state:v2`.

---

## Adicionar ou substituir imagens

1. Gerar a foto nova a partir da **mesma foto da mão** e pô-la em
   `../Ring Sample/` com um nome novo (ex.: `G58.png`).
2. Recortar:

   ```bash
   node tools/crop-hands.js "../Ring Sample"
   ```

   Faz um quadrado de 820px com a mão e as quatro unhas, com o anel um pouco
   abaixo e à esquerda do centro, e grava `aneis/G58.jpg` a 800×800. A ideia é
   ela ver o anel como se olhasse para a própria mão. A foto inteira não
   serve, porque num cartão de telemóvel o anel ficava com uns 20px. O centro
   da pedra de cada foto está na tabela
   `CENTROS` do script. Uma foto nova usa o centro por omissão: abrir o
   recorte e, se o anel ficar descentrado, acrescentar a entrada e voltar a
   correr.

3. Correr o script para acrescentar a entrada ao `rings.json`:

   ```bash
   node tools/init-rings.js
   ```

   Não mexe no que já estiver preenchido. Só acrescenta as entradas novas, com
   os campos vazios, e no fim diz o que falta preencher.

Um anel novo entra a 1500 e o emparelhamento dá-lhe prioridade até ter jogos
suficientes, por isso pode entrar a meio sem estragar os dados.

> Se uma foto for muito diferente das outras — mão em vez de estúdio, fundo
> radicalmente distinto, marca de água grande — a escolha dela passa a ser sobre
> a foto e não sobre o anel. Vale a pena substituí-la.

---

## Preencher o `rings.json`

Todos os campos são obrigatórios exceto `note`. O `note` é só para ti; nunca
aparece do lado dela.

| Campo     | Valores |
|-----------|---------|
| `cut`     | `round` `oval` `princess` `emerald` `pear` `marquise` `cushion` `radiant` `baguette` (forma da pedra central) |
| `setting` | `solitaire` `halo` `three-stone` `five-stone` `bezel` `cluster` `eternity` `toi-et-moi` |
| `metal`   | `white-gold` `yellow-gold` `rose-gold` `platinum` `mixed` |
| `band`    | `thin` `medium` `thick` |
| `accent`  | `none` `pave-band` `engraved` `twisted` `split-shank` (o que está no aro) |
| `stone`   | `colorless` `green` `sage` `mint` `teal` `blue` `pink` `milky` (cor da pedra central) |
| `size`    | `small` `medium` `large` (tamanho aparente da pedra central na foto) |

Sobre os verdes, que são quase metade do conjunto:

- `green` é o verde esmeralda saturado, claro ou escuro.
- `sage` é o verde apagado, acinzentado ou oliva.
- `mint` é o verde claro.
- `teal` é o verde-azulado, a meio caminho entre `green` e `blue`.

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

1. **Agregação por atributo** — Elo médio ponderado pelos jogos, por cada valor
   de cada campo. A vermelho ficam os valores com menos de 3 anéis ou menos de
   10 jogos: pouco fiáveis, não tirar conclusões daí.
2. **Intransitividade no top 6** — ciclos A vence B, B vence C, C vence A. Um
   ciclo significa que naquele grupo não há preferência forte. É informação,
   não é um erro.
3. **Estado** — total de comparações, jogos por anel, pares saltados, fase.
4. **Tabela de anéis** por Elo, com todos os atributos.

Botões: `Exportar JSON`, `Importar JSON`, `Ativar playoff`, `Reset total`.

O `Reset total` só apaga o `localStorage` **deste** dispositivo. A Google Sheet
mantém-se — é essa que manda quando está configurada.

### Fases

| Fase | Quando | O que faz |
|---|---|---|
| 1 | algum anel com menos de 3 jogos | aleatório, prioridade a quem tem menos jogos — garante cobertura |
| 2 | todos com 3+ jogos | só pares dentro de ±120 pontos de Elo — é aqui que está a informação |
| playoff | manual, ver abaixo | round-robin dos 6 primeiros, 15 confrontos, depois acaba |

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
barras de progresso. `Nenhum dos dois` salta o par para sempre e não conta como
jogo. `Anterior` desfaz a última escolha (uma só). No computador: `←` `→`
escolhem, `↓` salta, `backspace` desfaz.

Ao fim de 35 escolhas aparece o ecrã de pausa. Não é enfeite: a partir daí a
qualidade das respostas cai e os dados ficam piores.

Os dois cartões da arena são pixel-a-pixel idênticos e o lado de cada anel é
sorteado em cada ronda. Se um lado fosse mais bonito que o outro ela escolhia o
lado e não o anel, e o exercício deixava de valer alguma coisa. Ao mexer no
CSS, manter isso.
