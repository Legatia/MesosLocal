import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Animated gradient orbs */}
      <div className="gradient-orb orb-1" />
      <div className="gradient-orb orb-2" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-600 flex items-center justify-center font-bold text-lg">
            M
          </div>
          <span className="text-xl font-bold">MesosLocal</span>
        </div>
        <nav className="flex items-center gap-6">
          <a href="#how-it-works" className="text-slate-300 hover:text-white transition-colors">
            How it Works
          </a>
          <a href="#features" className="text-slate-300 hover:text-white transition-colors">
            Features
          </a>
          <Link href="/demo" className="btn-primary">
            Try Demo
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-8 pt-20 pb-32">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm mb-8">
            <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
            Built on Solana • Live on Devnet
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            The <span className="gradient-text">Role-Based</span>
            <br />Settlement Rail
          </h1>

          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            Enable crypto-native companies to pay logistics providers instantly with
            USDC-backed vouchers. Full compliance. No banking headaches.
          </p>

          <div className="flex items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <Link href="/demo" className="btn-primary text-lg">
              Launch Demo
            </Link>
            <a href="#waitlist" className="btn-secondary text-lg">
              Join Waitlist
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 mt-20 max-w-3xl mx-auto">
            <div className="glass-card p-6 text-center">
              <div className="text-3xl font-bold text-cyan-400">Real time data</div>
              <div className="text-slate-400 mt-1">USD to Local Fiat</div>
            </div>
            <div className="glass-card p-6 text-center">
              <div className="text-3xl font-bold text-cyan-400">&lt;1s</div>
              <div className="text-slate-400 mt-1">Settlement Time</div>
            </div>
            <div className="glass-card p-6 text-center">
              <div className="text-3xl font-bold text-cyan-400">100%</div>
              <div className="text-slate-400 mt-1">USDC Backed</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="relative z-10 py-20 px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            How It Works
          </h2>
          <p className="text-slate-400 text-center mb-16 max-w-2xl mx-auto">
            A simple 4-step flow from deposit to settlement
          </p>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                step: "1",
                title: "Deposit USDC",
                desc: "Client deposits USDC to the vault",
                icon: "💵",
              },
              {
                step: "2",
                title: "Mint voucher",
                desc: "Use real-time exchange rate USD:LOCAL",
                icon: "🪙",
              },
              {
                step: "3",
                title: "Pay Merchant",
                desc: "Transfer to whitelisted partner",
                icon: "✅",
              },
              {
                step: "4",
                title: "Settle",
                desc: "Merchant burns voucher, off ramp service sends fiat",
                icon: "🏦",
              },
            ].map((item) => (
              <div key={item.step} className="glass-card feature-card p-6 text-center">
                <div className="text-4xl mb-4">{item.icon}</div>
                <div className="text-cyan-400 text-sm font-medium mb-2">
                  Step {item.step}
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-slate-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 py-20 px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Why MesosLocal?
          </h2>
          <p className="text-slate-400 text-center mb-16 max-w-2xl mx-auto">
            Regulatory-compliant by design
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "No P2P Transfers",
                desc: "Whitelist enforcement blocks unauthorized transfers. Vouchers can only go to verified merchants.",
                icon: "🚫",
                color: "from-red-500 to-orange-500",
              },
              {
                title: "No Cash Out for Users",
                desc: "Users can only spend vouchers. No redemption to bank. This isn't e-money.",
                icon: "🔒",
                color: "from-purple-500 to-pink-500",
              },
              {
                title: "Merchant Settlement",
                desc: "Only verified B2B partners can convert vouchers back to USDC/Fiat.",
                icon: "✨",
                color: "from-cyan-500 to-blue-500",
              },
            ].map((item) => (
              <div key={item.title} className="glass-card feature-card p-8">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-2xl mb-4`}>
                  {item.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Waitlist Section */}
      <section id="waitlist" className="relative z-10 py-20 px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="glass-card p-12 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm mb-6">
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
              Early Access
            </div>

            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Join the <span className="gradient-text">Waitlist</span>
            </h2>
            <p className="text-slate-400 mb-8 max-w-xl mx-auto">
              Be the first to access MesosLocal when we launch. Perfect for logistics companies,
              freight forwarders, and cross-border B2B payments.
            </p>

            {/* Google Form Placeholder */}
            <a
              href="YOUR_GOOGLE_FORM_URL_HERE"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-lg inline-flex items-center gap-2 group"
            >
              <span>Request Early Access</span>
              <svg
                className="w-5 h-5 transition-transform group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>

            <p className="text-slate-500 text-sm mt-6">
              🔒 No spam. We'll only notify you when we launch.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-20 px-8">
        <div className="max-w-4xl mx-auto text-center glass-card p-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            See It In Action
          </h2>
          <p className="text-slate-400 mb-8 max-w-xl mx-auto">
            Try the interactive demo on Solana devnet. Deposit USDC, mint vouchers,
            and see the whitelist enforcement in real-time.
          </p>
          <Link href="/demo" className="btn-primary text-lg inline-block">
            Launch Demo →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-8 px-8 border-t border-white/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-slate-500 text-sm">
          <div>© 2024 MesosLocal. B2B Voucher System - Role-based access control.</div>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-white transition-colors">Docs</a>
            <a href="#" className="hover:text-white transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
