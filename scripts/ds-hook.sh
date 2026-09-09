#!/usr/bin/env bash
# PostToolUse hook: keep the Claude Design bundle in step with the app.
#
# Reads the hook payload on stdin. When the edited file is app-preview.html it
# regenerates design-system/ from the app's own stylesheet and, if any card
# actually changed, tells Claude to push the changed cards to Claude Design.
# The push itself needs the DesignSync tool, which only Claude can call - this
# hook does the deterministic half and hands over the rest.

set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

f="$(jq -r '.tool_input.file_path // .tool_response.filePath // empty' 2>/dev/null)"
case "$f" in
  *app-preview.html) ;;
  *) exit 0 ;;                    # nothing else feeds the design system
esac

out="$(cd "$ROOT" && python3 scripts/build-design-system.py --out design-system 2>&1)" || {
  # a broken generator must not block the edit, but must not fail silently either
  printf '{"systemMessage":"Design system build failed: %s"}\n' \
    "$(printf '%s' "$out" | tail -1 | sed 's/"/\\"/g')"
  exit 0
}

changed="$(printf '%s' "$out" | sed -n 's/^changed: //p')"
[ -z "$changed" ] && exit 0        # app changed but no card did

jq -cn --arg c "$changed" '{
  systemMessage: ("Design system rebuilt: " + $c),
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: ("The design system was regenerated from app-preview.html and these cards changed: "
      + $c
      + ". Push them to the Lonera Design System project (6a27b096-300e-4a43-ad92-73bfa8e65a69) with DesignSync "
      + "before ending the turn: finalize_plan with localDir set to the repo design-system directory, then "
      + "write_files with a localPath per changed card. Do not re-push unchanged cards.")
  }
}'
