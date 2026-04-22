import { motion } from "motion/react";
import { Github, Terminal, BookOpen, GitBranch, ShieldCheck, Cpu, ArrowRight, CheckCircle2, ChevronRight } from "lucide-react";

export default function App() {
  const repoUrl = "https://github.com/barretts/AgentHistoric";
  const docsUrl = `${repoUrl}/tree/main/docs`;
  const promptSystemUrl = `${repoUrl}/tree/main/prompt-system`;
  const scriptsUrl = `${repoUrl}/tree/main/scripts`;

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9] font-sans selection:bg-[#1f6feb] selection:text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-[#010409]/80 backdrop-blur-md border-b border-[#30363d]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 font-semibold text-white text-lg tracking-tight">
            <Github className="w-8 h-8" />
            <span>Agent Historic</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-[#8b949e]">
            <a href="#capabilities" className="hover:text-[#c9d1d9] transition-colors">Capabilities</a>
            <a href="#workflow" className="hover:text-[#c9d1d9] transition-colors">Workflow</a>
            <a href="#resources" className="hover:text-[#c9d1d9] transition-colors">Resources</a>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-white border border-[#30363d] bg-[#21262d] hover:bg-[#30363d] px-3 py-1.5 rounded-md transition-colors"
            >
              Star on GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 overflow-hidden bg-[#010409]">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-20 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-[#7ee787] to-[#8a2be2] blur-[100px] rounded-full mix-blend-screen"></div>
        </div>

        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 flex relative">
          {/* GitHub-style vertical line */}
          <div className="hidden md:flex flex-col items-center w-8 mr-8 relative z-10">
            <div className="h-16 w-[2px] bg-gradient-to-b from-transparent to-[#30363d]"></div>
            <div className="w-6 h-6 rounded-full border-[2px] border-[#8a2be2] flex items-center justify-center bg-[#0d1117] my-2">
              <div className="w-2 h-2 rounded-full bg-[#8a2be2] shadow-[0_0_10px_#8a2be2]"></div>
            </div>
            <div className="flex-grow w-[2px] bg-gradient-to-b from-[#30363d] via-[#30363d] to-transparent"></div>
          </div>

          <div className="pt-10 pb-24 relative z-10 w-full">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-2 mb-6"
            >
              <span className="px-3 py-1 rounded-full border border-[#30363d] text-[#8b949e] text-sm font-medium flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#8a2be2]" />
                Mixture-of-Experts Prompt System
              </span>
            </motion.div>
            
            <motion.h1 
              className="text-5xl sm:text-6xl md:text-8xl font-extrabold tracking-tight mb-6 text-white leading-[1.1]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              Multi-Editor AI <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7ee787] to-[#58a6ff]">
                Agent Routing
              </span>
            </motion.h1>
            
            <motion.p 
              className="text-xl md:text-2xl text-[#8b949e] mb-10 max-w-2xl leading-relaxed font-light"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Agent Historic is a prompt-system build and routing project for multi-editor AI workflows. It keeps expert behavior explicit, testable, and reproducible across generated rule targets.
            </motion.p>
            
            <motion.div 
              className="flex flex-col sm:flex-row items-start gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <a 
                href={docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white text-black px-6 py-3 rounded-md font-semibold hover:bg-gray-200 transition-colors text-lg"
              >
                Browse Docs
                <ChevronRight className="w-5 h-5" />
              </a>
              <a 
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#21262d] border border-[#30363d] text-white px-6 py-3 rounded-md font-semibold hover:bg-[#30363d] transition-colors text-lg"
              >
                <Terminal className="w-5 h-5 text-[#8b949e]" />
                Open Repository
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="capabilities" className="py-24 bg-[#0d1117] border-t border-[#30363d] relative overflow-hidden">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 flex relative">
          {/* GitHub-style vertical line */}
          <div className="hidden md:flex flex-col items-center w-8 mr-8 relative z-10">
            <div className="h-full w-[2px] bg-[#30363d]"></div>
          </div>

          <div className="w-full">
            <div className="mb-12">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-white">Core Capabilities</h2>
              <p className="text-[#8b949e] max-w-2xl text-lg">Project primitives for defining experts, routing prompts, rendering artifacts, and validating behavior.</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {[
                {
                  icon: <BookOpen className="w-6 h-6 text-[#ff7b72]" />,
                  title: "Expert Definitions",
                  description: "Maintain canonical expert behavior in JSON under prompt-system with explicit guardrails."
                },
                {
                  icon: <GitBranch className="w-6 h-6 text-[#7ee787]" />,
                  title: "Router-Centered Design",
                  description: "Route requests through a structured router and per-expert outputs for different IDE targets."
                },
                {
                  icon: <ShieldCheck className="w-6 h-6 text-[#d2a8ff]" />,
                  title: "Behavioral Guardrails",
                  description: "Capture failure modes and anti-over-corrections so generated prompts stay stable and safe."
                },
                {
                  icon: <CheckCircle2 className="w-6 h-6 text-[#58a6ff]" />,
                  title: "Build + Test Validation",
                  description: "Rebuild prompt artifacts and run unit/regression checks before shipping prompt changes."
                }
              ].map((feature, i) => (
                <motion.div 
                  key={i}
                  className="p-8 rounded-xl bg-[#161b22] border border-[#30363d] hover:border-[#8b949e] transition-colors relative overflow-hidden group"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-transparent via-[#30363d] to-transparent group-hover:via-[#58a6ff] transition-colors"></div>
                  <div className="w-12 h-12 rounded-lg bg-[#0d1117] border border-[#30363d] flex items-center justify-center mb-6 shadow-sm">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-white">{feature.title}</h3>
                  <p className="text-[#8b949e] leading-relaxed">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section id="workflow" className="py-24 bg-[#010409] border-t border-[#30363d]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 flex relative">
          {/* GitHub-style vertical line */}
          <div className="hidden md:flex flex-col items-center w-8 mr-8 relative z-10">
            <div className="h-16 w-[2px] bg-[#30363d]"></div>
            <div className="w-6 h-6 rounded-full border-[2px] border-[#7ee787] flex items-center justify-center bg-[#0d1117] my-2">
              <div className="w-2 h-2 rounded-full bg-[#7ee787] shadow-[0_0_10px_#7ee787]"></div>
            </div>
            <div className="flex-grow w-[2px] bg-gradient-to-b from-[#30363d] to-transparent"></div>
          </div>

          <div className="w-full grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6 text-white">Maintainer Workflow</h2>
              <p className="text-[#8b949e] mb-8 text-lg leading-relaxed">
                Keep the canonical prompt sources, rendered artifacts, and behavioral checks in lockstep with a short repeatable loop.
              </p>
              
              <ul className="space-y-6 mb-8">
                {[
                  "Clone the repository from GitHub",
                  "Install dependencies with npm install",
                  "Build prompt artifacts with npm run build:prompts",
                  "Run validation suites with npm run test:unit"
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-4 text-[#c9d1d9]">
                    <div className="mt-1 w-6 h-6 rounded-full bg-[#21262d] border border-[#30363d] flex items-center justify-center shrink-0">
                      <span className="text-[#58a6ff] text-xs font-bold">{i + 1}</span>
                    </div>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ul>
              
              <a 
                href={docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[#58a6ff] font-medium hover:underline transition-all"
              >
                Browse project docs <ArrowRight className="w-4 h-4" />
              </a>
            </div>
            
            <div className="relative mt-8 lg:mt-0">
              <div className="absolute -inset-0.5 bg-gradient-to-b from-[#30363d] to-transparent rounded-xl blur opacity-50"></div>
              <div className="relative rounded-xl bg-[#0d1117] border border-[#30363d] overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d] bg-[#161b22]">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                  </div>
                  <span className="text-xs text-[#8b949e] font-mono">bash</span>
                </div>
                <div className="p-6 font-mono text-sm text-[#e6edf3] overflow-x-auto leading-relaxed">
                  <div className="flex gap-4 mb-1">
                    <span className="text-[#8b949e] shrink-0">$</span>
                    <span>git clone {repoUrl}.git</span>
                  </div>
                  <div className="flex gap-4 mb-4">
                    <span className="text-[#8b949e] shrink-0">$</span>
                    <span>cd AgentHistoric</span>
                  </div>
                  <div className="flex gap-4 mb-1">
                    <span className="text-[#8b949e] shrink-0">$</span>
                    <span className="text-[#8b949e]"># Build generated prompt artifacts</span>
                  </div>
                  <div className="flex gap-4 mb-4">
                    <span className="text-[#8b949e] shrink-0">$</span>
                    <span>npm run build:prompts</span>
                  </div>
                  <div className="flex gap-4 mb-1">
                    <span className="text-[#8b949e] shrink-0">$</span>
                    <span className="text-[#8b949e]"># Validate behavior and structure</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-[#8b949e] shrink-0">$</span>
                    <span>npm run test:unit</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="resources" className="py-12 border-t border-[#30363d] bg-[#010409] text-center">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 flex flex-col items-center">
          <div className="flex items-center gap-2 font-semibold text-lg tracking-tight mb-4 text-white">
            <Github className="w-6 h-6" />
            <span>Agent Historic</span>
          </div>
          <p className="text-[#8b949e] text-sm mb-6 max-w-md">
            Canonical prompt-system source and render pipeline for multi-editor AI agent workflows.
          </p>
          <div className="flex items-center gap-6">
            <a href={repoUrl} className="text-[#8b949e] hover:text-[#58a6ff] transition-colors">
              GitHub Repository
            </a>
            <a href={promptSystemUrl} className="text-[#8b949e] hover:text-[#58a6ff] transition-colors">
              Prompt System
            </a>
            <a href={scriptsUrl} className="text-[#8b949e] hover:text-[#58a6ff] transition-colors">
              Build Scripts
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
