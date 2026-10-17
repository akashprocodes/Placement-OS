import re

with open("apps/web/src/app/(dashboard)/learning/playlist/[playlistId]/page.tsx", "r") as f:
    text = f.read()

replacement = """function formatItemDuration(seconds: number | null | undefined) {"""
text = re.sub(r'function formatDuration.*?return `\$\{m\}m`;\s*\}\s*function formatItemDuration\(seconds: number \| null \| undefined\) \{', replacement, text, flags=re.DOTALL)

with open("apps/web/src/app/(dashboard)/learning/playlist/[playlistId]/page.tsx", "w") as f:
    f.write(text)
