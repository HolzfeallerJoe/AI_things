# Software submodules

Every directory under `software/` is a separate git submodule of the `AI_things`
parent repo (see `../.gitmodules`). These rules apply to all of them.

## Keep the parent repo in sync after pushing a submodule

When you push commits in a submodule, also update its pointer in the `AI_things`
parent repo:

1. Make sure the submodule commit is pushed to the submodule's own origin first.
   Never point the parent at a commit that exists only locally.
2. In the parent repo root, stage only that submodule's path:
   `git add software/<name>`. Leave other modified submodules and files alone.
3. Commit with the parent's message style:
   `main: Advance <name> submodule to <short summary of the change>`.
4. Push the parent: `git push origin main`.

If the parent already has other unpushed commits, list them to the user before
pushing, because they will be pushed too.
