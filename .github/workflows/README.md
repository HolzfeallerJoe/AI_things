# Workflows

Dieses Repo ist eine Sammlung unabhaengiger Projekte (`software/*`,
`wrapper/*`, `skills/*`). GitHub Actions kennt aber nur ein
`.github/workflows/` fuer das ganze Repo, also muss jeder Workflow selbst
dafuer sorgen, dass er nicht bei fremden Aenderungen mitlaeuft.

## Regeln

1. **Ein Workflow je Projekt**, Dateiname `<projekt>-<zweck>.yml`
   (z. B. `joe-todo-apk.yml`).
2. **Immer ein `paths`-Filter** auf den Projektordner *und* auf die
   Workflow-Datei selbst — sonst baut ein Commit an einem anderen Projekt
   diesen hier mit:

   ```yaml
   on:
     push:
       branches: [main]
       paths:
         - 'software/mein-projekt/**'
         - '.github/workflows/mein-projekt-build.yml'
     pull_request:
       paths:
         - 'software/mein-projekt/**'
         - '.github/workflows/mein-projekt-build.yml'
   ```

   `paths` gilt nur fuer `push` und `pull_request`. `workflow_dispatch` und
   `schedule` haben keinen Filter und laufen immer, wenn sie ausgeloest
   werden — das ist so gewollt.
3. **`defaults.run.working-directory`** auf den Projektordner setzen, statt in
   jedem Schritt `cd` zu schreiben.
4. **`concurrency`-Gruppe mit dem Projektnamen im Schluessel**, damit sich
   Projekte nicht gegenseitig abbrechen.
5. **`name:` mit Projekt-Praefix**, damit die Actions-Uebersicht bei mehreren
   Projekten lesbar bleibt.
6. **Release-Tags als `<projekt>-v<version>`** (z. B. `joe-todo-v1.0.0+1`).
   Alle Projekte teilen sich eine Release-Liste, deshalb muss am Tag haengen,
   zu welchem Projekt und zu welcher Version ein Artefakt gehoert. Die Version
   kommt aus der Projektdatei (bei Flutter `pubspec.yaml`), nicht aus einem
   manuell gesetzten Tag. Releases nur von `main`, nicht aus Pull Requests.

## Vorhandene Workflows

| Datei | Projekt | Was es tut |
| --- | --- | --- |
| `joe-todo-apk.yml` | `software/joe-todo` | Analyse, Unit-Tests, Debug-APK als Artefakt und als Release `joe-todo-v<version>` |

## Releases

Ein Push auf `main` legt fuer das betroffene Projekt ein Release unter
`<projekt>-v<version>` an. Bleibt die Version in der Projektdatei gleich, wird
dasselbe Release ueberschrieben und der Tag auf den neuen Commit gesetzt — es
gibt also je Version genau ein Release mit dem jeweils aktuellen Stand. Soll
ein Stand dauerhaft erhalten bleiben, vorher die Versionsnummer anheben.

Debug-Builds sind als **Pre-Release** markiert, weil sie mit dem oeffentlichen
Debug-Keystore signiert sind.
