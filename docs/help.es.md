# Manual de acdev

Cómo usar acdev desde la primera idea hasta un producto en producción, y
cómo migrar un proyecto que empezó con una versión anterior. Este archivo
es el espejo en español de [help.md](help.md).

## Contenido

1. [Qué es acdev y cómo funciona](#1-qué-es-acdev-y-cómo-funciona)
2. [Instalar, actualizar, verificar](#2-instalar-actualizar-verificar)
3. [El pipeline, etapa por etapa](#3-el-pipeline-etapa-por-etapa)
4. [Empezar un proyecto nuevo](#4-empezar-un-proyecto-nuevo)
5. [Adoptar un repositorio existente](#5-adoptar-un-repositorio-existente)
6. [El trabajo diario dentro de un proyecto](#6-el-trabajo-diario-dentro-de-un-proyecto)
7. [El guard](#7-el-guard)
8. [Producción: despliegues e incidentes](#8-producción-despliegues-e-incidentes)
9. [Comandos y archivos](#9-comandos-y-archivos)
10. [Actualizar desde 0.4](#10-actualizar-desde-04)
11. [Trabajar en acdev mismo](#11-trabajar-en-acdev-mismo)
12. [Preguntas frecuentes](#12-preguntas-frecuentes)

## 1. Qué es acdev y cómo funciona

acdev parte de que el modelo ya sabe planificar, probar, depurar y
revisar. Conserva lo que un modelo no puede hacer desde dentro de una
conversación:

- **Tus decisiones.** Qué es el producto, qué se entrega primero, cómo se
  ve y las elecciones caras de cambiar se conversan contigo y se cierran
  con una aprobación explícita. El resto lo decide el modelo y lo lista
  para que lo revises.
- **El estado en disco.** La etapa, el siguiente paso, el plan y el
  commit contienen todo lo que necesita el siguiente trabajo, así que un
  contexto se puede descartar en cualquier cierre sin perder nada.
- **Reglas duras en un hook.** Tres reglas se hacen cumplir con código,
  no con la memoria del modelo (sección 7).

Funciona con seis skills, dos hooks y una herramienta de línea de
comandos, `acdev`. Dos de las skills (`new-project`, `onboard`) son
comandos que escribes tú; el modelo nunca las inicia por su cuenta. Las
otras cuatro se activan cuando el trabajo coincide, y cada una es también
un comando con barra. Fuera de un proyecto que usa acdev, el plugin solo
añade a la sesión sus seis descripciones de una línea.

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

Actualizar, desde cualquier terminal donde `claude` esté en el PATH:

```
claude plugin marketplace update acnetcenter
claude plugin update acdev@acnetcenter
```

Después abre una sesión nueva; los plugins se cargan al iniciar la
sesión. Para verificar la carga, abre un proyecto que use acdev: la
sesión empieza con una línea `acdev project: stage ...` y una segunda
línea que nombra la CLI. En cualquier proyecto, `/acdev:status` responde.

Requisitos: Claude Code con plugins habilitados, Node.js 20 o superior en
el PATH y git dentro de cada proyecto. Sin Node las skills se cargan
igual desde sus descripciones, pero no hay línea de sesión ni CLI, y el
guard deja pasar todo.

## 3. El pipeline, etapa por etapa

| Etapa | Qué se produce | Qué la cierra |
|---|---|---|
| product | `docs/PRODUCT.md`: usuarios, propósito, modelo, flujos críticos, restricciones | Tu aprobación explícita del documento completo |
| mvp | `docs/MVP.md`: qué entra, qué queda fuera y a qué fase posterior pasa, criterios de éxito | Tu aprobación explícita |
| mockups | Una página HTML estática por pantalla del MVP con sus estados, `mockups/SPEC.md`, un inventario de pantallas posteriores | Tu aprobación, que congela el contrato visual |
| blueprint | Un ADR por decisión duradera (aquí se decide el stack), `docs/ROADMAP.md`, `CLAUDE.md`, los comandos de verificación, un runbook si despliega | Tu aceptación del paquete |
| build | El MVP por slices verticales, y después cambios, incidentes y fases posteriores | Tu orden de empezar; cada slice cierra verificado |

Un producto sin interfaz se salta los mockups. No existe código de
producto antes de la etapa build, y el guard lo deniega hasta entonces.

## 4. Empezar un proyecto nuevo

Ejecuta `/acdev:new-project` en un repositorio vacío. Abre con una sola
pregunta: qué quieres construir y para quién. Después, cuatro preguntas
cortas de intake (nombre, repositorio, idioma de la documentación, otros
agentes de código).

La entrevista se ajusta al tamaño del proyecto. Una herramienta personal
va por el camino corto: un borrador completo de `docs/PRODUCT.md` a
partir de tu idea, corregido en una o dos rondas. Un producto para vender,
o cualquier cosa multi-tenant, con pagos o con datos personales, va
sección por sección. En ambos casos cada sección se pega en el chat antes
de preguntarte por ella, y la puerta presenta el documento completo:
apruebas lo que has leído.

`docs/PRODUCT.md` sigue el esquema que las herramientas de diseño ya leen
(Platform, Stack, Users, Product Purpose, Positioning, Operating Context,
Capabilities and Constraints, Brand Commitments, Evidence on Hand,
Product Principles, Accessibility & Inclusion) y añade dos secciones de
las que deriva el resto del pipeline: `Model` (cómo se entrega y se
vende) y `Critical Flows` (los tres a cinco flujos que deben funcionar de
punta a punta). Si una herramienta de diseño ya escribió el archivo, se
completa; nunca se sobrescribe.

De ahí se recorta `docs/MVP.md`: la lista IN, la lista OUT agrupada por
la fase posterior a la que pasa cada elemento, y criterios de éxito como
hechos verificables. Si el recorte revela un hueco en PRODUCT.md, el
hueco se corrige allí primero.

## 5. Adoptar un repositorio existente

Ejecuta `/acdev:onboard`. Lee antes de escribir: cada hecho entra en
`docs/SITUATION.md` con su fuente (`[user]`, `[docs]`, `[code]`,
`[git]`), y lo que no se encuentra es un hueco declarado, nunca una
suposición. Tú confirmas el mapa; solo entonces propone qué añadir: un
documento de producto si no hay, un MVP solo si queda alcance sin
construir, ADRs para las decisiones que el código ya encarna, los
comandos de verificación que el repositorio ya ejecuta y la etapa en la
que el proyecto retoma. Los documentos y las convenciones existentes se
respetan; nada se reescribe sin mostrar el diff.

## 6. El trabajo diario dentro de un proyecto

Abre una sesión. Sus dos primeras líneas dicen la etapa y el siguiente
paso; `acdev status` imprime la foto completa en una sola llamada.

### Un slice

1. **Cortar**: vertical, observable por un usuario, de un día como
   máximo. El slice 1 es el esqueleto andante e incluye el despliegue y
   un ensayo de rollback.
2. **Planificar**: un archivo en `docs/plans/`, de 40 líneas como máximo,
   escrito justo antes de construir: objetivo, pasos de verificación y la
   tabla de decisiones que tomó el modelo.
3. **Construir**: primero un test que falla para ese comportamiento,
   después el código. Los tests corren con `acdev q`, que muestra solo
   las líneas de veredicto.
4. **Cerrar**: dos comandos, abajo.

### Un cambio, un bug, un arreglo pequeño

El proceso escala con el trabajo. Una errata o un ajuste de una línea sin
cambio de comportamiento no necesita plan. Un bug necesita su test que lo
reproduce. Una funcionalidad o un cambio de varios archivos lleva una
especificación corta en `docs/plans/`, en tus propios términos. Un cambio
en lo que hace el producto se confirma contigo primero, y `docs/PRODUCT.md`
o `docs/MVP.md` se enmienda en el mismo commit.

### El cierre

```
acdev close --check --plan docs/plans/<plan>.md
acdev close --slice "2: create invoice" --plan docs/plans/<plan>.md --next "slice 3: export" --changelog "Invoices can be created"
```

El primero lista los documentos que mencionan los archivos cambiados,
para corregirlos en el mismo commit. El segundo ejecuta los comandos de
verificación del proyecto y se niega si algo está en rojo; en verde
escribe la línea del CHANGELOG, marca el plan como entregado, escribe el
checkpoint y hace un solo commit.

### Mantener los contextos pequeños

La mayor parte de lo que cuesta una sesión larga es el contexto que relee
en cada turno. Después de un cierre, el slice está en disco: empieza el
siguiente en una sesión nueva (`/clear`). Retoma desde la línea de inicio
de sesión. Cambia el modelo también en ese punto, no a mitad de sesión,
porque un cambio relee toda la conversación sin caché.

### Construcción continua

Si lo pides explícitamente, el modelo construye la fase entera sin pausas
entre slices. Cada slice conserva su plan, sus tests y su cierre. La
corrida se detiene ante una decisión que te corresponde a ti, ante una
trampa que invalida el plan y en la salida de fase.

## 7. El guard

Un hook que viene con el plugin. No hace nada fuera de un proyecto con
`.acdev/state.md`, y no se instala nada en tu repositorio.

| Regla | Decisión | Alcance |
|---|---|---|
| Cero código de producto antes de build | deny | Escrituras fuera de docs, mockups, spikes y mecánica del repo mientras la etapa es anterior a `build` |
| Documentos aprobados | ask | `docs/PRODUCT.md`, `docs/MVP.md` y las páginas de mockups aprobadas, después de sus puertas; un ADR existente en build. Las páginas y los ADR nuevos son libres |
| Commit verificado | deny | En build, un `git commit` que cambia código sin una verificación en verde de ese código. Un commit solo de docs no la necesita |
| El estado del pipeline | deny | `.acdev/state.md` a mano; lo escribe `acdev checkpoint write`, que anuncia cada cambio de etapa |
| La configuración del guard | ask | `.acdev/guard.json`, desde build |

Claude Code no se detiene ante un `ask` de un hook en modo bypass, así que
donde ningún aviso puede llegarte el guard deniega y le indica al modelo
que haga la pregunta en el chat. Con tu sí explícito ejecuta `acdev allow
<ruta>`, que abre esa ruta durante 15 minutos; nunca abre código de
producto ni el estado del pipeline.

El lado del proyecto es un solo archivo:

```json
{
  "enabled": true,
  "verify": ["npm run lint", "npm test"],
  "allow_before_build": [],
  "protected": [],
  "receipt_ignore": []
}
```

`verify` lista los comandos que un cierre debe pasar, del más barato al
más caro. Las tres listas de globs adaptan las reglas a un repositorio
con sus propias convenciones. Para apagar el guard, pon `"enabled":
false` o la variable de entorno `ACDEV_GUARD=off`. Si el hook falla
internamente, permite la llamada.

## 8. Producción: despliegues e incidentes

Un proyecto que despliega tiene `docs/RUNBOOK.md` (el comando exacto de
rollback, bandas de control numéricas) y un script canario. Después de un
despliegue, el canario corre con `acdev q`; una entrega está hecha cuando
el canario está en verde, no cuando el comando de despliegue terminó bien.

En rojo, o ante cualquier incidente que empezó con una entrega: primero
el rollback, después el diagnóstico. Luego el incidente se convierte en
una especificación (`docs/plans/<fecha>-incident-<slug>.md`) antes de
programar ningún arreglo, y mientras esté abierta `acdev status` la pone
por delante de cualquier slice planificado. El arreglo es un slice
pequeño con su test que reproduce el fallo, y la especificación nombra
qué lo habría detectado.

Al final de cada fase hay una sola revisión de la fase completa:
`/security-review` sobre el diff de la fase, y la checklist de producción
sobre lo que la fase tocó. Un hallazgo de severidad alta bloquea la fase
hasta que se corrige o lo aceptas explícitamente.

## 9. Comandos y archivos

`acdev` funciona en la herramienta Bash de Claude. En PowerShell los mismos
comandos son `node "<carpeta del plugin>/scripts/acdev.mjs" <comando>`; la
línea de inicio de sesión imprime esa ruta.

| Comando | Qué hace |
|---|---|
| `acdev status` | Estado, checkpoint, planes abiertos, fase actual, guard, qué continúa |
| `acdev init` | La configuración del guard y la línea de `.gitignore` para el recibo |
| `acdev checkpoint write` / `read` | Escribe o lee el estado del pipeline |
| `acdev q -- <comando>` | Ejecuta un comando e imprime sus líneas de veredicto, no su log |
| `acdev verify` | Ejecuta los comandos de verificación y registra el recibo que un commit necesita |
| `acdev close --check` | Lo que el cierre necesita, sin hacer commit |
| `acdev close --slice ...` | Verificación, changelog, plan, checkpoint, un commit |
| `acdev allow <ruta...>` | Tras tu sí explícito: permite editar un documento aprobado durante 15 minutos |
| `acdev drift` | Documentos que mencionan los archivos cambiados |
| `acdev scaffold <plantilla> <destino>` | Copia una plantilla: `product`, `mvp`, `adr`, `runbook`, `incident`, `claude-md`, `mockups-inventory`, `canary` |
| `acdev mockup-spec --write` | La especificación por pantalla que lee el build |
| `acdev migrate [--apply]` | Migra un proyecto de una versión anterior; por defecto solo simula |

```
docs/PRODUCT.md  docs/MVP.md  docs/ROADMAP.md  docs/adr/  docs/plans/
mockups/  CLAUDE.md
.acdev/state.md  .acdev/checkpoints/  .acdev/guard.json
```

## 10. Actualizar desde 0.4

La versión 0.5.0 quitó la mayor parte de las instrucciones del plugin y
movió el guard al plugin. En cada proyecto, pídele a Claude que ejecute
estos dos comandos (`acdev` está en el PATH de la herramienta Bash de
Claude, no en el de PowerShell ni en el de tu propia terminal):

```
acdev migrate
acdev migrate --apply
```

El primero imprime lo que cambiaría. El segundo renombra `docs/VISION.md`
a `docs/PRODUCT.md` con `git mv` (el contenido se mueve tal cual),
actualiza las referencias al nombre anterior en `CLAUDE.md`, `AGENTS.md`
y `docs/` salvo los planes, renombra la etapa, y quita la copia del guard
y sus entradas de `.claude/settings.json`. No se hace ningún commit:
revisa `git diff` y después haz el commit. Un proyecto sin migrar sigue
funcionando, porque todos los lectores recurren al nombre anterior del
archivo; hasta entonces su copia vieja del guard sigue corriendo junto a
la del plugin.

El comando también lista lo que te deja a ti: las secciones antiguas del
documento movido, un `CLAUDE.md` que todavía nombra comandos eliminados y
las reglas de permiso que 0.4 añadió a `.claude/settings.json`. El primer
commit después de actualizar necesita un `acdev verify`, porque el recibo
cambió de formato.

## 11. Trabajar en acdev mismo

```
node --test
node scripts/lint-budgets.mjs
```

El lint hace cumplir los presupuestos de las skills, falla ante texto que
nombra algo eliminado, comprueba que este manual y su original en inglés
mantengan la misma estructura, y compara la tabla de skills del README
con el árbol. Una versión nueva necesita el número actualizado en
`.claude-plugin/plugin.json` y en `package.json`. Los casos de
evaluación en `evals/` corren con `claude plugin eval` en macOS, Linux o
WSL2; Windows nativo no tiene sandbox para ellos, así que ahí solo corren
sus fixtures, dentro de `node --test`.

## 12. Preguntas frecuentes

**¿Por qué hay tan pocas skills ahora?**

Porque los modelos actuales ya planifican, prueban, depuran y verifican
sin que se les diga cómo, y las instrucciones que lo detallan los hacen
sobre-verificar y cuestan tokens en cada carga. Quedó lo que el modelo no
puede aportar: tus decisiones, el estado y las reglas que un hook hace
cumplir.

**¿acdev sigue exigiendo los tests primero?**

Sí, como una regla con su motivo en el `CLAUDE.md` del proyecto: un cambio
de comportamiento empieza con un test que falla para ese comportamiento.
Es un test enfocado por comportamiento, no una suite por función.

**El guard denegó algo que yo quería. ¿Y ahora?**

O la etapa va por detrás de la realidad, y el pipeline la avanza en su
puerta contigo, o la acción no corresponde a esta etapa. Si la regla es
la que no encaja con tu repositorio, ajusta `.acdev/guard.json`.

**¿Puedo usarlo con otro plugin de diseño?**

Sí. `docs/PRODUCT.md` usa el esquema que esas herramientas leen, y la
etapa de mockups delega la dirección estética al plugin de diseño que
tengas instalado, subordinado al MVP y a la puerta de aprobación.

**¿Cómo mantengo barata una sesión?**

Cierra los slices con `acdev close`, empieza el siguiente en una sesión
nueva, ejecuta los tests con `acdev q` y cambia de modelo solo al inicio
de una sesión.
