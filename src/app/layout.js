import "./globals.css";
import { Inter } from "next/font/google";
import NavBar from "@/components/NavBar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata = {
  title: "QA Copilot",
  description: "Personal QA Productivity Workspace",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("qa_theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme:dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased transition-colors duration-200">
        <NavBar />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 sm:p-8">
            {children}
          </div>
        </main>

        <footer className="max-w-6xl mx-auto px-6 pb-8 pt-2 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-600">QA Copilot &mdash; Personal QA Productivity Workspace</p>
        </footer>
      </body>
    </html>
  );
}
