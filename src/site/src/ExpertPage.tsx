import {ArrowLeft, Github} from "lucide-react";
import {EXPERT_BIOS} from "./experts-data.generated";

type Props = {
  slug: string;
};

export default function ExpertPage({slug}: Props) {
  const bio = EXPERT_BIOS[slug];
  if (!bio) {
    return (
      <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9] flex items-center justify-center p-8">
        <div className="max-w-xl text-center">
          <h1 className="text-3xl font-bold text-white mb-3">Expert not found</h1>
          <p className="text-[#8b949e] mb-6">
            No autobiography is registered for <code className="text-[#ff7b72]">{slug}</code>.
          </p>
          <a href="/#team" className="inline-flex items-center gap-2 text-[#58a6ff] hover:underline">
            <ArrowLeft className="w-4 h-4" /> Back to the team
          </a>
        </div>
      </div>
    );
  }

  const repoUrl = "https://github.com/barretts/AgentHistoric";

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9] font-sans selection:bg-[#1f6feb] selection:text-white">
      <nav className="fixed top-0 w-full z-50 bg-[#010409]/80 backdrop-blur-md border-b border-[#30363d]">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 font-semibold text-white text-lg tracking-tight">
            <Github className="w-7 h-7" />
            <span>Agent Historic</span>
          </a>
          <div className="flex items-center gap-6 text-sm text-[#8b949e]">
            <a href="/#team" className="hover:text-[#c9d1d9] transition-colors inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Meet the team
            </a>
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-white border border-[#30363d] bg-[#21262d] hover:bg-[#30363d] px-3 py-1.5 rounded-md transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </nav>

      <header className="pt-28 pb-10 bg-[#010409] border-b border-[#30363d]">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 text-center">
          <span className="inline-block px-3 py-1 rounded-full border border-[#30363d] text-[#8b949e] text-sm mb-6">
            {bio.full}
          </span>
          <img
            src={bio.headshot}
            alt={`${bio.full} headshot`}
            loading="lazy"
            className="w-32 h-32 rounded-full object-cover border border-[#30363d] bg-[#0d1117] mx-auto mb-6"
          />
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-3">{bio.name}</h1>
          <p className="text-[#8b949e] text-lg">{bio.role}</p>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-12 grid lg:grid-cols-[1fr_280px] gap-10">
        <article
          className="expert-prose text-[#c9d1d9] leading-relaxed"
          dangerouslySetInnerHTML={{__html: bio.body}}
        />
        <aside className="space-y-4">
          <div className="p-6 rounded-xl bg-[#161b22] border border-[#30363d] text-sm">
            <h3 className="text-white font-semibold mb-3">Metadata</h3>
            {bio.grounding && (
              <p className="mb-2">
                <span className="text-[#8b949e]">Grounding:</span> {bio.grounding}
              </p>
            )}
            {bio.bestFor && (
              <p className="mb-2">
                <span className="text-[#8b949e]">Best For:</span> {bio.bestFor}
              </p>
            )}
            {bio.worksWith && (
              <p className="mb-2">
                <span className="text-[#8b949e]">Works With:</span> {bio.worksWith}
              </p>
            )}
            <a
              href="/#team"
              className="inline-flex items-center gap-2 text-[#58a6ff] hover:underline mt-3 text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Meet the Team
            </a>
          </div>
        </aside>
      </main>
    </div>
  );
}
