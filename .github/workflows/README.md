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

## Vorhandene Workflows

| Datei | Projekt | Was es tut |
| --- | --- | --- |
| `joe-todo-apk.yml` | `software/joe-todo` | Analyse, Unit-Tests, Debug-APK als Artefakt |
