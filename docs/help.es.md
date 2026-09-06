# Ayuda de acdev

Cómo funciona el plugin, cómo usarlo bien y las preguntas que surgen en
la práctica. El README es la visión general; esto es el manual. Todo lo
que sigue describe acdev 0.2.0. Este documento es el espejo en español
de `docs/help.md`; ambos se mantienen con la misma estructura y el lint
del repositorio falla cuando divergen.

Contenido:

1. [Qué es acdev y cómo se ejecuta](#1-qué-es-acdev-y-cómo-se-ejecuta)
2. [Instalar, actualizar, verificar](#2-instalar-actualizar-verificar)
3. [La pipeline, etapa por etapa](#3-la-pipeline-etapa-por-etapa)
4. [Un ejemplo completo: un SaaS de facturación desde cero](#4-un-ejemplo-completo-un-saas-de-facturación-desde-cero)
5. [Adoptar un repositorio existente](#5-adoptar-un-repositorio-existente)
6. [Trabajo diario dentro de un proyecto](#6-trabajo-diario-dentro-de-un-proyecto)
7. [El guard](#7-el-guard)
8. [El trinquete de lecciones](#8-el-trinquete-de-lecciones)
9. [Operar en producción](#9-operar-en-producción)
10. [Referencia de scripts y ficheros](#10-referencia-de-scripts-y-ficheros)
11. [Coste, presupuestos y qué se carga cuándo](#11-coste-presupuestos-y-qué-se-carga-cuándo)
12. [Trabajar sobre el propio acdev](#12-trabajar-sobre-el-propio-acdev)
13. [Preguntas frecuentes](#13-preguntas-frecuentes)

---

## 1. Qué es acdev y cómo se ejecuta

acdev es un plugin de Claude Code que lleva un proyecto de software desde
una idea hasta producción y lo mantiene funcionando después. Lo hace con
tres tipos de piezas:

- **Skills.** Veintidós conjuntos de instrucciones en markdown. Siete
  ejecutan la pipeline (`new-project`, `mockups`, `blueprint`, `onboard`,
  `build`, `ship`, `operate`), uno informa del estado (`status`), cinco
  gobiernan el proceso (`designing`, `planning`, `tdd`, `debugging`,
  `verifying`), ocho llevan el conocimiento de producción por capa
  (`layer-frontend`, `layer-api`, `layer-data`, `layer-auth`,
  `layer-security`, `layer-performance`, `layer-delivery`, `layer-cicd`),
  y un gateway (`using-acdev`) le dice al modelo cómo usar el resto. El
  cuerpo de un skill entra en contexto solo cuando se activa; solo su
  descripción de una línea está siempre presente.
- **Hooks.** Dos en el plugin: al arrancar la sesión se imprime el
  gateway en el contexto junto con la ruta de instalación del plugin; en
  cada prompt dentro de un proyecto que tiene `.acdev/state.md`, una
  línea nombra la etapa actual de la pipeline y las reglas de
  enrutamiento. acdev instala un hook más *dentro de cada proyecto*: el
  guard, que hace cumplir las reglas duras antes de que se ejecute una
  llamada a herramienta (sección 7).
- **Scripts.** El trabajo determinista nunca gasta contexto:
  `checkpoint.mjs` lee y escribe el estado de la pipeline, `lessons.mjs`
  promueve errores repetidos a reglas, `lint-budgets.mjs` vigila los
  presupuestos del propio plugin, `run-evals.mjs` comprueba enrutamiento
  y gates contra un modelo, y la línea de comandos del guard ejecuta la
  verificación y congela ficheros.

El principio de diseño detrás de todo: **cubrir solo el delta sobre
Claude Code nativo.** Plan mode, subagentes, worktrees, `/code-review`,
`/security-review` y `/rewind` se usan donde corresponde y nunca se
vuelven a enseñar. Lo que acdev añade es la disciplina de proceso, los
gates duros de aprobación, los checklists de producción por capa, el
enforcement determinista y la continuidad entre sesiones que un producto
real necesita.

Cómo transcurre una sesión, mecánicamente:

1. Arranca Claude Code. El hook SessionStart imprime el gateway: la regla
   de invocación, el mapa de skills, las reglas duras y `acdev plugin
   root: <ruta>`. Los skills de pipeline sustituyen esa ruta por
   `<plugin-root>` cuando ejecutan un script.
2. Escribes un prompt. Si el proyecto tiene `.acdev/state.md`, el hook
   UserPromptSubmit añade una línea: la etapa, "los skills de pipeline
   tienen prioridad sobre los de proceso" y la regla de duda.
3. El modelo contrasta tu prompt con las descripciones de los skills y el
   gateway. Si un skill encaja, su cuerpo se carga y se ejecuta. Si dos
   lecturas son plausibles, el gateway le dice que no elija en silencio,
   sino que ofrezca los comandos `/acdev:<nombre>` que encajan y te deje
   elegir.
4. Cada llamada a Edit, Write o Bash pasa primero por el guard del
   proyecto. La mayoría pasan en silencio; una denegación o una consulta
   vuelve con la razón y el comando que la resuelve.

## 2. Instalar, actualizar, verificar

Desde el marketplace de GitHub:

```
/plugin marketplace add acnetcenter/acdev
/plugin install acdev@acnetcenter
```

Desde un clon local (para desarrollo):

```
/plugin marketplace add C:\ruta\a\acdev
/plugin install acdev@acnetcenter
```

Actualizar, desde cualquier terminal donde `claude` esté en el PATH, o
desde dentro de una sesión con las mismas palabras tras una barra:

```
claude plugin marketplace update acnetcenter
claude plugin update acdev@acnetcenter
```

Después abre una sesión nueva; los plugins se cargan al arrancar.
Verifica la carga: el contexto de sesión impreso por el hook debe
contener `acdev plugin root:` terminando en la carpeta de la versión
instalada, y la línea `Pipeline:` del gateway debe listar `operate`.

Requisitos: Claude Code con plugins habilitados, Node.js 20 o superior en
el PATH, git dentro de cada proyecto. Sin Node los skills siguen
activándose por sus descripciones, pero no hay mapa del gateway, ni
línea de enrutamiento, ni checkpoints, ni lecciones, y el guard falla en
abierto.

## 3. La pipeline, etapa por etapa

Cinco etapas con gate llevan un proyecto a producción; el bucle operate
corre tras cada deploy. Cada etapa produce un artefacto que consume la
siguiente, y nada posterior reabre en silencio un artefacto aprobado.

| Etapa | Skill | Produce | Gate |
|---|---|---|---|
| 0. Intake | `new-project` (lo ejecuta el usuario) | Nombre del proyecto, repo, idioma de la documentación, solo Claude o multi-AI; el guard instalado; `.acdev/state.md` en `vision` | Una pregunta abierta, luego las preguntas de intake en un solo mensaje |
| 1. VISION | `new-project` | `docs/VISION.md`, siete secciones conversadas una a una | DURO: apruebas el documento completo, con estas palabras o equivalentes: "¿Apruebas este documento VISION?" |
| 2. MVP | `new-project` | `docs/MVP.md`: lista numerada de alcance trazable a los flujos de VISION, lista explícita de lo que queda fuera nombrando la fase a la que va cada punto, criterios de éxito verificables | DURO: aprobación explícita del documento completo |
| 3. Mockups | `mockups` | `mockups/`: una página HTML estática por pantalla del MVP, estados vacío/error/carga, cada flujo crítico recorrible; `docs/mockups-inventory.md` para las pantallas post-MVP | DURO: "¿Apruebas estos mockups?" La aprobación congela el contrato visual |
| 4. Blueprint | `blueprint` | ROADMAP con criterios de salida verificables; ARCHITECTURE, DATA-MODEL, SECURITY, UI-DESIGN, INTEGRATIONS, RUNBOOK según aplique; ADRs (aquí se decide el stack); spikes para dependencias no probadas; router `CLAUDE.md` y espejo `AGENTS.md`; mecánica del repo (`.gitignore`, `.env.example`, esqueleto de CI, `scripts/verify/`, canary); los comandos `verify` del guard | Revisas el paquete completo; después, una orden explícita y aparte de empezar a construir |
| 5. Build | `build` + `ship` | Software funcionando y desplegado por slices verticales; el slice 1 despliega y hace rollback | Por slice: gate de plan solo cuando existe una decisión user-challenge; `ship` cierra cada slice con verificación, comprobación de drift, changelog, lecciones, checkpoint, un commit; por fase: criterios de salida más un pase de seguridad |
| 6. Operate | `operate` | Evidencia del canary tras cada deploy; specs de incidente; correcciones del runbook | Rollback antes del diagnóstico en rojo; spec de incidente antes de cualquier fix |

Reglas que valen en todas las etapas:

- **VISION es la fuente de verdad.** Una contradicción encontrada en un
  documento hijo se corrige en VISION contigo, nunca se parchea en el
  hijo.
- **Cero código de producto antes de que se ordene build.** Mockups y
  spikes son dibujos y experimentos desechables, no producto. El guard
  deniega escrituras de producto hasta que `state.md` llega a `build`.
- **Regla de drift.** La realidad del repo gana. Un documento que se
  demuestra erróneo se corrige en el mismo commit que lo demostró, nunca
  "después".
- **Sin placeholders.** Un dato que falta se pregunta o se declara como
  hueco. `TBD` es un fallo.
- **Saltar por alcance.** Un proyecto sin UI se salta los mockups (se
  propone y se confirma contigo). Un stack conocido sin dependencias no
  probadas produce cero spikes. Un proyecto que no despliega no produce
  runbook.
- **Justo a tiempo.** Los planes de slice, los mockups post-MVP y las
  specs de fase se escriben cuando empieza ese slice o esa fase, nunca el
  día 0.
- **Idioma de la documentación.** Cada artefacto generado se escribe en
  el idioma elegido en el intake. Los ficheros de los skills son en
  inglés.

## 4. Un ejemplo completo: un SaaS de facturación desde cero

Los comandos son tuyos; todo lo demás lo hace el modelo bajo los skills.

**Intake.** Ejecutas `/acdev:new-project`. El modelo pregunta una sola
cosa: cuéntale, en pocas frases, qué quieres construir y para quién.
Respondes: "Una herramienta de facturación para autónomos en España;
crean facturas, las envían y ven quién ha pagado." Después hace las
cuatro preguntas de intake en un mensaje, con valores por defecto
derivados de tu respuesta: nombre (`facturalo`), repo nuevo, idioma de
la documentación (español), solo Claude o multi-AI. Instala el guard,
escribe `.acdev/state.md` en la etapa `vision` y pega la salida de
`status` del guard como evidencia.

**VISION.** El modelo recorre las siete secciones del cuestionario una a
una. Para cada una propone un borrador a partir de lo que ya dijiste, tú
lo corriges, y te muestra la sección tal como quedará en el documento.
Cuestiona las respuestas débiles: "autónomos" no es un mercado hasta que
digas quién no es cliente. Tras la sección 7 presenta el documento
completo y pide aprobación. Apruebas. Escribe `docs/VISION.md` en
español, avanza el estado a `mvp` y hace commit `docs: project vision`.
A partir de aquí, editar VISION hace que el guard pregunte primero.

**MVP.** Recorta la primera entrega a partir de la VISION aprobada:
funcionalidades dentro del alcance numeradas y trazadas a flujos de
VISION, funcionalidades fuera del alcance cada una con su fase,
criterios de éxito como hechos ("diez autónomos reales envían una
factura sin ayuda"). Si el recorte revela un hueco en VISION, se detiene
y arregla VISION contigo primero. Apruebas el MVP completo. El estado
pasa a `mockups`.

**Mockups.** Construye `mockups/index.html`, `invoice-list.html`,
`invoice-list-empty.html`, `invoice-detail.html`, `invoice-new.html`,
`settings.html` con un `styles.css` compartido, datos de ejemplo
realistas (nombres reales, importes reales, nunca lorem ipsum) y la
navegación mostrando dónde se engancharán los módulos de la fase 2.
Abres el índice en un navegador, pides dos rondas de correcciones
(`docs: mockups revision 1`, `... 2`) y apruebas. El conjunto queda
congelado; el estado pasa a `blueprint`.

**Blueprint.** Propone el conjunto de documentos con una razón de una
línea cada uno, y luego escribe ROADMAP (fase 1 = el MVP, con criterios
de salida que incluyen un rollback ensayado), ARCHITECTURE, DATA-MODEL
(columnas PII marcadas), SECURITY (matriz de permisos), UI-DESIGN
(tokens leídos de `styles.css`), RUNBOOK (URL de salud, comando exacto de
rollback, bandas numéricas) y los ADRs: stack, hosting, almacén de
datos, auth, tenencia, cumplimiento (pregunta qué jurisdicciones aplican;
nunca las asume por el dominio). Una decisión que depende de algo no
probado, digamos una API de sincronización bancaria, recibe un spike
acotado en tiempo con un criterio de éxito escrito antes de cualquier
código. Genera `CLAUDE.md` con reglas de oro derivadas del modelo ("cada
cambio de tabla demuestra el aislamiento entre tenants"),
`scripts/verify/` con probes concretos, `scripts/verify/canary.mjs`, el
esqueleto de CI, y rellena los comandos `verify` del guard. Ofrece una
revisión adversaria de diseño opcional. Revisas el paquete; hace commit,
avanza el estado a `build` y pregunta dos cosas: cambiar a un modelo más
barato para la construcción, y si construir todo el MVP sin pausas.
Espera tu orden explícita de empezar.

**Build.** Dices "empieza". El slice 1 es el walking skeleton: iniciar
sesión, ver una lista de facturas vacía, desplegado en staging por CI, y
un rollback hecho una vez con el comando del runbook. Su plan se escribe
justo a tiempo en `docs/plans/`, cada paso como objetivo + verificación,
decisiones clasificadas en una tabla de auditoría. Solo una decisión
user-challenge (¿facturas en borrador o no?) te interrumpe. El bucle es
TDD: test en rojo, verde mínimo, refactor. Las capas que pueden avanzar
por separado van a subagentes estrechos que reciben solo su skill de
capa y las líneas de ADR relevantes.

**Ship.** En el cierre: `node .claude/hooks/acdev-guard.mjs verify`
ejecuta las comprobaciones configuradas y registra el recibo; una
comprobación en rojo bloquea el cierre, sin excepciones. Comprobación de
drift en los docs que el slice tocó. Una línea de CHANGELOG que enlaza
el plan. Lecciones: cualquier error visto dos veces se convierte en una
regla en `CLAUDE.md`. Checkpoint con `--plan`. Un commit convencional
por slice, `feat: walking skeleton (slice 1)`; el guard lo permite porque
el recibo está verde y fresco. Cuando CI despliega, la comprobación de
release ejecuta el canary.

**Operate.** Tres semanas después aterriza un deploy y el canary informa
de dos sondas de salud fallidas. Según el runbook, el modelo hace
rollback primero, confirma que el canary está verde en la versión
restaurada y luego diagnostica. Escribe
`docs/plans/2026-10-02-incident-blank-pdfs.md` con síntoma, impacto,
cronología, causa raíz (una fuente que faltaba en la imagen de build), el
fix como pasos de objetivo + verificación, y prevención: una lección
registrada, una ruta smoke añadida al canary, la banda del runbook
corregida. El fix corre como mini-slice y cierra por `ship`.

## 5. Adoptar un repositorio existente

Ejecuta `/acdev:onboard` en el repo. El modelo lo inventaría antes de
escribir nada y produce `docs/SITUATION.md`, donde cada línea lleva su
etiqueta de fuente en orden de precedencia: `[user]` (lo que dijiste en
esta sesión, prevalece sobre todo), `[docs]`, `[code]`, `[git]`. Lo que
buscó y no encontró es un `[gap]` declarado, nunca una suposición. Tú
corriges el mapa; pide confirmación explícita de que el mapa es preciso
antes de proponer nada.

El plan de adopción ofrece entonces, solo donde aplica: VISION escrita
retroactivamente (conversada, no autogenerada a partir del mapa), MVP
solo si queda alcance sin construir que merezca un gate, ADRs marcados
"as-built" para decisiones que el código ya encarna, el estado inicial
de la pipeline en la etapa desde la que debes retomar, el guard (con
`verify` puesto a las comprobaciones que el repo ya ejecuta, y
`allow_before_build` o `receipt_ignore` para árboles generados o
vendorizados), y un RUNBOOK si el proyecto despliega y no tiene
equivalente. Las convenciones existentes ganan sobre los valores por
defecto de acdev; un doc existente nunca se reescribe sin mostrar el
diff.

## 6. Trabajo diario dentro de un proyecto

**Retomar.** Empieza cada sesión en un proyecto acdev con
`/acdev:status`. Lee `state.md`, el último checkpoint, la sección de la
fase actual del ROADMAP y los nombres de los planes abiertos (incidentes
primero), y responde "dónde estamos" en unos 2k tokens sin escanear el
código. Si el checkpoint discrepa del repo, informa de la diferencia y
confía en el repo.

**Un cambio que pides a mitad del build.** Cualquier cosa más allá de un
fix trivial es un mini-slice: la petición se captura como spec en
`docs/plans/YYYY-MM-DD-<tema>.md` con `status: active`, seguida de pasos
objetivo + verificación, y luego pasa por TDD, verificación y un cierre
completo de `ship`. Si el cambio altera lo que hace el producto, primero
van el gate user-challenge y la regla de drift de VISION/MVP. Si hay un
slice en curso, se aparca (stash o rama) para que el commit del
mini-slice contenga solo sus propios cambios.

**Un bug.** El skill `debugging` corre en orden: reproducir con el
comando y la salida exactos, leer el error real, escribir dos o tres
hipótesis ordenadas antes de editar nada, probar la más barata con
evidencia, arreglar la causa raíz, añadir el test de regresión. Antes de
tocar el código bajo un test que falla, congela el test (`freeze
<fichero> --reason "..."`): el test es la spec del fix, y un fix que
necesita cambiar el test es un cambio de spec, que es decisión tuya. La
causa raíz se registra como candidata a lección.

**Verificación.** Ninguna afirmación en verde sin salida de comando de
esta sesión, tomada después de la última edición. `verify` a través del
guard es la ejecución; su salida transmitida es la evidencia; el recibo
que escribe es contra lo que se comprueba `git commit`. Lo parcial se
informa como parcial.

**Clases de decisión.** Mecánica (una respuesta correcta: se decide en
silencio), gusto (varias válidas, baratas de revertir: se decide y se
lista en la tabla de auditoría), user-challenge (dinero, postura de
seguridad, forma del modelo de datos, comportamiento del producto,
dependencia de proveedor, jurisdicción: se pregunta, nunca se asume). En
caso de duda gana la clase superior.

**Build continuo.** Con tu aprobación explícita ("construye todo el MVP
sin parar"), `build` corre slice tras slice sin pausas. Los gates dentro
de cada slice no cambian; una decisión user-challenge o una trampa que
invalida el plan detiene la ejecución con un checkpoint `--blocked`. La
ejecución termina en la salida de fase, incluido el pase de seguridad.

**Cambio de modelo.** Las etapas de documentos merecen el modelo más
capaz. En el gate de blueprint se te avisa de que la construcción puede
correr en uno más barato; en el pase de seguridad de salida de fase se te
avisa de volver, porque cazar vulnerabilidades exige razonamiento
adversario.

**Salida de fase.** Tras el último slice de una fase: criterios de salida
comprobados contra lo construido, no contra la intención;
`/security-review` nativo sobre el diff de la fase, el pase OWASP de
`layer-security`, los probes de seguridad del proyecto; en la fase 1, el
rollback ensayado. Un hallazgo de severidad alta bloquea la fase salvo
que lo aceptes explícitamente. La siguiente fase empieza con su propio
gate de mockups.

## 7. El guard

El guard es un hook PreToolUse que vive en tu repo en
`.claude/hooks/acdev-guard.mjs`, cableado a través del
`.claude/settings.json` del proyecto y configurado por
`.acdev/guard.json`. Lee la etapa de `.acdev/state.md` y responde
`allow` (silencio), `ask` (confirmas tú) o `deny` (bloqueado, con la
razón) antes de que se ejecute una llamada a herramienta.

| Regla | Decisión | Cuándo |
|---|---|---|
| Cero código de producto antes de build | deny | Etapa anterior a `build` y la ruta está fuera de la lista permitida para esa etapa: siempre `docs/`, `.acdev/`, `.claude/`, markdown de raíz, `.gitignore`, `.env.example`; desde `mockups`, `mockups/`; desde `blueprint`, `spikes/`, `scripts/verify/`, ficheros de CI, manifiestos y configuraciones de herramientas |
| Documentos aprobados | ask | `docs/VISION.md` tras el gate de VISION, `docs/MVP.md` tras el gate de MVP, `mockups/` tras el gate de mockups, `docs/adr/` durante build |
| Rutas congeladas | deny | Lo que `freeze` registró, hasta `unfreeze` |
| Secretos | ask | `.env`, `.env.*` (ejemplos exentos), `*.pem`, `*.key` |
| Comandos destructivos | ask | Force push, `reset --hard`, `clean -f`, `checkout -- .`, borrado forzado de rama, stash drop, `rm -f`, `DROP`/`TRUNCATE` |
| Recibo de verificación | deny | En build, `git commit` sin un recibo verde y todavía ligado al árbol de código |
| Los ficheros del propio guard | ask | El hook, `.acdev/guard.json`, `.claude/settings.json` |

Los destinos de escritura por Bash (`>`, `>>`, `tee`, `cp`, `mv`,
`touch`, `sed -i`) pasan por la misma política que Edit y Write, así que
la regla de etapa no se esquiva con un heredoc. El parser es una
heurística; el gateway lleva la regla que cierra el resto: **una
denegación del guard es un gate, nunca un obstáculo que rodear.** O el
estado va por detrás de la realidad, y la pipeline lo avanza en su gate
contigo, o la acción es incorrecta.

Comandos:

```
node .claude/hooks/acdev-guard.mjs status
node .claude/hooks/acdev-guard.mjs verify
node .claude/hooks/acdev-guard.mjs freeze tests/invoices.test.ts src/legacy/** --reason "bug 42"
node .claude/hooks/acdev-guard.mjs unfreeze
```

`.acdev/guard.json`, con todas las claves opcionales:

```json
{
  "enabled": true,
  "verify": ["node scripts/verify/run.mjs", "npm test", "npm run lint"],
  "allow_before_build": ["prototype/**"],
  "protected": [{ "glob": "docs/domain/PRICING-MODEL.md", "after": "blueprint", "what": "the pricing rules" }],
  "receipt_ignore": ["vendor/**"]
}
```

El recibo (`.acdev/verify-receipt.json`, ignorado por git) guarda un
hash de `git diff HEAD` más los ficheros sin seguimiento, excluyendo
`docs/`, `mockups/`, `.acdev/` y el markdown. Así la contabilidad del
propio cierre (checkpoint, línea de CHANGELOG, correcciones de drift)
nunca lo invalida; cualquier edición de código sí, y el siguiente commit
se deniega hasta que `verify` vuelve a correr en verde.

Interruptores: `"enabled": false` en la configuración, o
`ACDEV_GUARD=off` en el entorno. El hook falla en abierto ante cualquier
error interno y escribe la razón en stderr; nunca puede tumbar una
sesión.

## 8. El trinquete de lecciones

Un error cometido dos veces en un repo se convierte en una regla en el
`CLAUDE.md` de ese repo, por script, para que la siguiente sesión la
herede.

```
node "<plugin-root>/scripts/lessons.mjs" list
node "<plugin-root>/scripts/lessons.mjs" add "Run migrations before the API tests" --source "slice 2"
node "<plugin-root>/scripts/lessons.mjs" add --id 1 --source "docs/plans/2026-10-02-incident-blank-pdfs.md"
node "<plugin-root>/scripts/lessons.mjs" promote --id 3
```

El ledger es `.acdev/lessons.md`, una tabla markdown comprometida en
git. Una primera ocurrencia es una candidata. `add --id N` sobre una
candidata es su segunda ocurrencia: el script añade una viñeta bajo
`## Lessons` en `CLAUDE.md` y, si el proyecto mantiene `AGENTS.md`, la
viñeta idéntica allí. Nadie edita esa sección a mano. Pasadas doce
lecciones promovidas, el script pide consolidación para que el router se
mantenga en una página.

`ship` lo ejecuta en cada cierre, `debugging` registra causas raíz,
`operate` registra incidentes (un incidente repetido de la misma clase
es una segunda ocurrencia por definición). Una lección promovida que se
puede comprobar mecánicamente recibe su comprobación en el mismo commit:
un test, un probe de `scripts/verify/`, una regla de lint, una ruta
smoke del canary. Una lección que solo existe como frase se olvidará una
tercera vez.

## 9. Operar en producción

`docs/RUNBOOK.md` es el contrato operativo, escrito en blueprint para
cualquier proyecto que despliega: mapa de servicio con endpoints de
salud, ruta de deploy y quién autoriza producción, el comando exacto de
rollback y su último ensayo, bandas de control numéricas (verde,
degradado, caído), las variables de entorno del canary, alertas,
escalado, el rescan de seguridad post-release. Una banda escrita en
prosa ("latencia aceptable") es un placeholder.

El canary, `scripts/verify/canary.mjs`, lee `CANARY_BASE_URL`,
`CANARY_HEALTH_PATH`, `CANARY_SMOKE_PATHS`, `CANARY_P95_BUDGET_MS`,
`CANARY_SAMPLES` y opcionalmente `CANARY_ERROR_RATE_CMD` con
`CANARY_ERROR_RATE_MAX`. Sondea la salud dos veces, golpea cada ruta
smoke el número de veces configurado, calcula el p95 y sale con 1 con una
línea por cada comprobación fallida.

`operate` corre cuando aterriza un deploy o producción se comporta mal:

1. Comprobación de release: ejecutar el canary, pegar las líneas
   decisivas. Verde cierra la release.
2. Rojo, o un incidente que empezó con una release: **rollback según el
   runbook antes de diagnosticar.** La única excepción es la cláusula
   "unsafe when" del propio runbook (una migración ya contraída, un
   efecto secundario irreversible); elegir ahí el camino hacia delante es
   decisión tuya.
3. Niveles según las bandas: degradado significa diagnóstico de solo
   lectura y una spec de incidente; caído significa rollback primero, y
   luego lo mismo.
4. Cada incidente se convierte en
   `docs/plans/YYYY-MM-DD-incident-<slug>.md` antes de codificar
   cualquier fix, luego corre como mini-slice de build y cierra por
   `ship`. La prevención es parte de la spec: lección, comprobación
   mecánica, correcciones del runbook.
5. Tras cada release a producción: `/security-review` sobre el diff de la
   release más la auditoría de dependencias del stack. Un hallazgo alto es
   un incidente.

Ningún cambio en producción a mano sin rastro documental: un valor de un
panel o un feature flag cambiado se registra en el runbook o en un ADR en
la misma sesión, o el siguiente deploy lo revierte en silencio.

## 10. Referencia de scripts y ficheros

| Ruta | Qué es |
|---|---|
| `<plugin-root>/scripts/checkpoint.mjs read` | Imprime `.acdev/state.md` y el último checkpoint |
| `<plugin-root>/scripts/checkpoint.mjs write --stage S --branch B --next T [--slice "n: nombre"] [--plan ruta] [--files a,b] [--blocked T] [--notes T] [--lang L]` | Escribe un checkpoint y actualiza el estado; `--stage` es uno de `intake`, `vision`, `mvp`, `mockups`, `blueprint`, `build`; `--lang` es persistente |
| `<plugin-root>/scripts/lessons.mjs` | `add`, `add --id`, `promote --id`, `list` (sección 8) |
| `.claude/hooks/acdev-guard.mjs` | `verify`, `status`, `freeze`, `unfreeze`; modo hook sin argumentos (sección 7) |
| `scripts/verify/*.mjs` | Un probe concreto por capa, generado en blueprint a partir del stub del plugin; exit 0 verificado, exit 1 violación, una línea de evidencia |
| `scripts/verify/canary.mjs` | La comprobación de release post-deploy (sección 9) |
| `.acdev/state.md` | `stage`, `updated`, `acdev_version`, `language`, `latest_checkpoint` |
| `.acdev/checkpoints/*.md` | Frontmatter: date, stage, branch, slice, plan, files_modified, next_step, blocked_on; hasta diez líneas de prosa |
| `.acdev/lessons.md` | El ledger de lecciones |
| `.acdev/guard.json` | Política del guard para este repo |
| `.acdev/freeze.json`, `.acdev/verify-receipt.json` | Estado de sesión, ignorado por git |
| `docs/plans/*.md` | Planes de slice, specs de cambio, specs de incidente; `status: active`, `shipped` o `abandoned`; nunca se mueven ni se borran |
| `docs/README.md` | El índice de docs, una línea por documento y por carpeta de serie |
| `CLAUDE.md`, `AGENTS.md` | Router de una página: reglas de oro, stack, lectura previa, verificación, lecciones, regla de drift |

Las plantillas que rellenan los skills viven en el plugin bajo
`shared/references/templates/` (VISION, MVP, ADR, checkpoint, estado,
índice de docs, router, runbook, incidente, hook y configuración del
guard, stubs de verify y canary, escáner de tells de diseño).

## 11. Coste, presupuestos y qué se carga cuándo

Coste fijo por sesión, medido desde el árbol y comprobado por el lint:
las veinte descripciones invocables por el modelo más el cuerpo del
gateway, unos 1,1k tokens. Dentro de un proyecto, una línea de
enrutamiento por prompt, unos 60 tokens. Los cuerpos de los skills se
cargan solo cuando el skill se activa; `references/` solo cuando un
cuerpo los señala; los scripts corren fuera del contexto.

Presupuestos, exigidos en CI: una descripción tiene como máximo 400
caracteres; un cuerpo menos de 500 líneas y 20.000 caracteres; el
fichero del gateway como máximo 1.600 caracteres. El lint también rechaza
emojis, vocabularios de activación solapados entre descripciones,
divergencia en el bloque que comparten los skills de capa, desacuerdo
entre manifiestos, y un README cuyas tablas o ledger se desvían del
árbol.

Consecuencias prácticas: los subagentes reciben solo los skills de capa
que toca su slice, nunca los ocho; `status` nunca escanea el repo; las
salidas nombran las secciones que importan en vez de pegar documentos
enteros.

## 12. Trabajar sobre el propio acdev

```
node --test                  # suite unitaria: hooks, checkpoint, lessons, guard, lint, runner de evals
node scripts/lint-budgets.mjs
npm run evals                # suites de routing y gates contra un modelo; bajo demanda, cuesta dinero
npm run evals -- --suite gates --filter operate
npm run evals -- --dry-run   # imprime los prompts construidos
npm run evals -- --ablate    # qué casos de gate responde un juez sin ningún contexto
```

Reglas de contribución: los presupuestos son límites duros; nada de
emojis en ningún sitio; inglés en skills, docs y commits; un commit que
añade o reformula una regla dura añade o actualiza su caso de gate en el
mismo commit; un fallo persistente de evals se arregla afinando el texto
o el caso, nunca ampliando `accept`. Los cambios del propio plugin siguen
las reglas que impone: un cambio no trivial recibe un plan en
`docs/plans/`, una línea de CHANGELOG y el registro de enmiendas de la
spec cuando cambia el diseño.

## 13. Preguntas frecuentes

**El guard denegó una escritura. ¿Qué hago?**
Lee la razón; nombra la regla y el comando que la resuelve. Si el
proyecto está en una etapa anterior a `build`, la escritura es código de
producto y la respuesta es terminar la etapa, no rodear la denegación. Si
el fichero está congelado, el arreglo es tocar el test, que es una
decisión que debes tomar explícitamente, y luego `unfreeze`. Si es un
commit sin recibo, ejecuta `verify`.

**¿Puede el modelo saltarse el guard con un heredoc de Bash?**
Las redirecciones, `tee`, `cp`, `mv`, `touch` y `sed -i` se analizan y
pasan por la misma política. Un comando suficientemente creativo aún
podría colarse ante un parser heurístico, y por eso el gateway y `build`
llevan la regla del lado del modelo de que una denegación es un gate. La
suite de evals tiene un caso para exactamente ese escenario.

**¿Cómo desactivo el guard en un proyecto?**
Pon `"enabled": false` en `.acdev/guard.json`, o exporta
`ACDEV_GUARD=off` durante una sesión. Editar la propia configuración
pregunta primero.

**`git commit` dice que el recibo está obsoleto pero solo cambié docs.**
Docs, mockups, `.acdev/` y markdown están excluidos de la huella.
Comprueba `status`: un recibo obsoleto significa que un fichero con
seguimiento que no es markdown, o un fichero sin seguimiento, cambió
después de la ejecución verde. Los árboles generados o vendorizados van
en `receipt_ignore`.

**Mi proyecto no tiene UI. ¿Tengo que dibujar mockups?**
No. Tras aprobar el MVP el modelo propone saltar a blueprint y te pide
confirmación. Un proyecto que nunca despliega donde lleguen usuarios
tampoco recibe runbook ni canary.

**Quiero cambiar VISION después de aprobarla.**
Está permitido y es esperable; es una decisión user-challenge. El guard
pregunta antes de la edición; confirmas; el cambio aterriza en el mismo
commit que lo que lo reveló, y los documentos derivados afectados se
vuelven a derivar. VISION nunca se parchea por fuera.

**¿Puedo escribir los docs en español (o en cualquier idioma)?**
Sí. El idioma de la documentación se elige en el intake y se guarda en
`state.md`; cada artefacto generado lo usa. Los ficheros de los skills y
los mensajes de commit siguen en inglés.

**El estado dice `mvp` pero el repo está claramente a mitad del build.**
`status` informa de la diferencia y confía en el repo. Arréglalo con un
checkpoint manual en la etapa correcta: `checkpoint.mjs write --stage
build ...`. No edites `state.md` a mano para pasar una denegación; eso es
lo único que la regla prohíbe.

**¿Qué es un fix trivial que se salta el fichero de plan?**
Una errata, un ajuste de una línea sin cambio de comportamiento. Sigue
recibiendo su línea de CHANGELOG en ship; la línea es su rastro. Todo lo
demás es un mini-slice con spec.

**¿En qué se diferencia el build continuo de dejarlo correr sin más?**
Se eliminan las pausas entre slices; nada más cambia. Cada slice sigue
recibiendo su plan, TDD, verificación y cierre completo de `ship`. Una
decisión user-challenge detiene la ejecución con un checkpoint
`--blocked`. Apruebas el modo continuo explícitamente; nunca se asume.

**¿Qué modelo debo usar?**
El más capaz para VISION, MVP, mockups, blueprint y el pase de seguridad
de salida de fase. La construcción contra documentos aprobados puede
correr con uno más barato; el gate de blueprint te recuerda el punto de
cambio.

**¿Puedo usar acdev con Codex, Cursor u otro agente?**
El plugin corre en Claude Code. Lo que deja en el repo es neutral
respecto al agente: `AGENTS.md` espeja `CLAUDE.md` cuando eliges multi-AI
en el intake, y la línea de comandos del guard, el script de lecciones y
el canary corren desde cualquier shell. El enforcement del hook del guard
en sí es de Claude Code.

**¿Puedo mantener superpowers instalado junto a acdev?**
No es recomendable. Dos hooks de arranque y dos skills de TDD o de
brainstorming compiten por el mismo prompt sin un ganador claro. acdev
destiló de superpowers los skills de proceso que necesitaba;
desinstálalo.

**Una lección se promovió con una redacción que no me gusta.**
Reformúlala como una consolidación, con el usuario, en un commit: la fila
del ledger en `.acdev/lessons.md`, la viñeta en `CLAUDE.md` y la viñeta
idéntica en `AGENTS.md`, todo junto. La regla de "nunca editar a mano"
existe para que la promoción siga siendo determinista y el espejo nunca
se desvíe, no para congelar la redacción; una consolidación que toca las
tres cosas a la vez conserva ambas garantías. El mismo movimiento
fusiona viñetas o mueve el detalle a un ADR cuando el script avisa
pasadas doce lecciones.

**El canary está rojo pero estoy seguro de que la release va bien.**
Haz rollback igualmente si el runbook no tiene cláusula unsafe-when; un
rollback ensayado cuesta minutos, y el diagnóstico ocurre sobre el
sistema restaurado. Si el que está mal es el canary, eso es drift:
corrige la banda o la ruta smoke en el runbook en el mismo commit, con
evidencia.

**¿Por qué la fase 1 exige un ensayo de rollback?**
Porque una pipeline que solo ha ido hacia delante no está probada donde
más importa. El walking skeleton despliega y hace rollback una vez
mientras el código es minúsculo; el ensayo se registra en el runbook con
su fecha.

**¿Dónde van los secretos?**
Nunca a través del agente. `.env.example` lista cada variable con un
comentario y sin valor; los valores reales viven en el almacén de
secretos de la plataforma por entorno, y el guard pregunta antes de que
se escriba cualquier fichero `.env`.

**¿Cuánto cuesta acdev por sesión?**
Unos 1,1k tokens fijos, medidos y vigilados por el lint. Los cuerpos de
los skills cuestan solo cuando se activan; el mayor está por debajo de
5k tokens. Los evals cuestan dinero real y corren solo bajo demanda.

**¿Cómo sé que un skill se activó?**
El modelo lo invoca antes de responder y su comportamiento sigue el
cuerpo: la entrevista de VISION pregunta sección a sección, `ship`
muestra la salida de verificación, `status` responde en pocas líneas.
Cuando dos skills encajan de forma plausible, el modelo ofrece los
comandos `/acdev:<nombre>` en vez de elegir; eso es la regla de duda
funcionando, no indecisión.

**Algo en acdev se comporta mal. ¿Dónde miro?**
`node --test` y `node scripts/lint-budgets.mjs` en el repo del plugin;
los hooks imprimen los fallos en stderr, visibles en la salida de
depuración de hooks de Claude Code; el `status` del guard muestra qué
cree que es el estado del proyecto. Un enrutamiento o un gate que falla
en la práctica es un caso para las suites de evals, añadido en el mismo
commit que el arreglo.
