import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "QA Copilot",
  description: "Personal QA Productivity Workspace",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-100 text-gray-900">

        <nav className="bg-gray-900 text-white px-8 py-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-semibold tracking-wide">
              QA Copilot
            </h1>

            <Link href="/" className="hover:text-blue-300 transition">
              Test Plan
            </Link>

            <Link href="/bug" className="hover:text-red-300 transition">
              Bug Report
            </Link>

            <Link href="/retest" className="hover:text-purple-300 transition">
              Retest Assistant
            </Link>

            <Link href="/analyze" className="hover:text-red-300 transition">
              Log Analyzer
            </Link>

            <Link href="/automation" className="hover:text-green-300 transition">
              Automation
            </Link>

            <Link href="/standup" className="hover:text-indigo-300 transition">
              Standup
            </Link>

            <Link href="/vision" className="hover:text-purple-300 transition">
              Screenshot Bug
            </Link>

            <Link href="/regression" className="hover:text-orange-300 transition">
              Regression
            </Link>

            <Link href="/flows" className="hover:text-teal-300 transition">
              Flow Planner
            </Link>

            <Link href="/smoke" className="hover:text-indigo-300 transition">
              Smoke Checklist
            </Link>

            <Link href="/verify" className="hover:text-emerald-300 transition">
              QA Verify
            </Link>

          </div>
        </nav>

        <main className="max-w-5xl mx-auto p-8">
          {children}
        </main>

      </body>
    </html>
  );
}
