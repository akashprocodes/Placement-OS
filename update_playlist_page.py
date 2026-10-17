import re

with open("apps/web/src/app/(dashboard)/learning/playlist/[playlistId]/page.tsx", "r") as f:
    text = f.read()

# Update format duration function
duration_helpers = """
function formatDuration(seconds: number) {
  if (seconds === 0) return "0h";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatItemDuration(seconds: number | null | undefined) {
  if (seconds == null) return "--:--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
"""

if "function formatItemDuration" not in text:
    text = text.replace("import { notFound } from \"next/navigation\";", "import { notFound } from \"next/navigation\";\nimport { Clock } from \"lucide-react\";\n" + duration_helpers)


replacement_contents = """{/* Playlist Items */}
        <div className="flex flex-col gap-16 mt-16">
          <h2 className="text-h4 font-bold text-[#EAEFEF]">Playlist Contents</h2>
          
          <div className="flex flex-col gap-3 bg-[#BFC9D1]/5 border border-[#BFC9D1]/10 rounded-2xl p-4">
            {!playlist.items || playlist.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-24 text-center">
                <ListVideo className="w-12 h-12 text-[#BFC9D1] mb-4 opacity-50" />
                <h3 className="text-body-large font-bold text-[#EAEFEF] mb-2">No videos found</h3>
                <p className="text-sm text-[#BFC9D1] max-w-md mx-auto">This playlist is empty or the videos are unavailable.</p>
              </div>
            ) : (
              playlist.items.map((item) => (
                <Link 
                  href={`/learning/video/${item.video_id}`}
                  key={item.video_id}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-[#BFC9D1]/10 transition-colors border border-transparent hover:border-[#BFC9D1]/10"
                >
                  <div className="text-sm font-medium text-[#BFC9D1] w-6 text-center">{item.position + 1}</div>
                  <div className="relative w-32 aspect-video shrink-0 rounded-lg overflow-hidden border border-[#BFC9D1]/20 bg-[#25343F]">
                    <Image src={item.thumbnail_url} alt={item.title} fill className="object-cover" sizes="128px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-[#EAEFEF] text-sm line-clamp-2">{item.title}</h4>
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-[#BFC9D1]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatItemDuration(item.duration_seconds)}</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>"""

text = re.sub(r'\{\/\* Playlist Items \(Unavailable State\) \*\/\}.*?<\/div>.*?<\/div>', replacement_contents, text, flags=re.DOTALL)

cta_replacement = """<LearningPlanCTA 
            contentId={playlist.id}
            contentType="playlist"
            title={playlist.title}
            thumbnailUrl={playlist.thumbnailUrl}
            durationSeconds={playlist.total_duration_seconds}
            isAuthenticated={isAuthenticated}
          />"""

text = re.sub(r'<LearningPlanCTA[^>]+contentType="playlist"[^>]+/>', cta_replacement, text, flags=re.DOTALL)


sidebar_button_replacement = """{(!playlist.duration_available || playlist.total_duration_seconds === 0) && (
            <p className="text-xs text-center text-[#BFC9D1] mt-2">
              Playlist learning plans are disabled because some video durations are unavailable.
            </p>
          )}
          <a
            href={playlist.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 bg-transparent border border-[#BFC9D1]/20 hover:bg-[#BFC9D1]/10 text-[#EAEFEF] font-medium rounded-xl transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 mt-4"
          >
            Open in YouTube
          </a>"""

text = re.sub(r'<button\s*disabled\s*className="w-full py-12 px-16 bg-brand-primary/50 text-text-inverse/70 font-medium rounded-lg flex items-center justify-center gap-8 cursor-not-allowed"\s*>\s*Start Learning\s*</button>\s*<p className="text-caption text-center text-text-muted mt-4">\s*Playlist contents will become available once playlist synchronization is enabled.\s*</p>\s*<a\s*href=\{playlist.url\}\s*target="_blank"\s*rel="noopener noreferrer"\s*className="[^"]+"\s*>\s*Open in YouTube\s*</a>', sidebar_button_replacement, text, flags=re.DOTALL)

with open("apps/web/src/app/(dashboard)/learning/playlist/[playlistId]/page.tsx", "w") as f:
    f.write(text)
