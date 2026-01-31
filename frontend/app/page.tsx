/**
 * @fileoverview Home page showcasing the template's features and tech stack.
 */

"use client";

import { ArrowRight, Code2, Plug, Sparkles, Type } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const REPO_URL =
  "https://github.com/siddharth-shringarpure/modern-nextjs-fastapi-template";

const API_URL = "http://localhost:8000";

const FEATURE_CARDS = [
  {
    title: "Typography",
    description: "Three fonts pre-configured",
    href: "https://fonts.google.com/",
    icon: Type,
    content: (
      <div className="space-y-1">
        <p className="font-sans">Sans — Geist Sans</p>
        <p className="font-mono">Mono — Geist Mono</p>
        <p className="font-serif">Serif — Instrument</p>
      </div>
    ),
  },
  {
    title: "Lucide Icons",
    description: "Ready to import icons",
    href: "https://lucide.dev/icons/",
    icon: Sparkles,
    content: "1000+ consistent, customisable icons.",
  },
  {
    title: "shadcn/ui",
    description: "Accessible components",
    href: "https://ui.shadcn.com/docs/components",
    icon: Code2,
    content: "Themeable, quick-install UI primitives.",
  },
] as const;

/** Standardised transition timing for animations. */
const TRANSITION = { duration: 0.5 };

/** Fade-in animation variant for staggered children. */
const FADE_IN = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

/** Stagger container for animating children sequentially. */
const STAGGER_CONTAINER = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

/**
 * Tests the backend connection by calling the /hello endpoint.
 * Displays a toast with the response or an error message.
 */
const testBackendConnection = (): void => {
  toast.promise(fetch(`${API_URL}/hello`).then((res) => res.json()), {
    loading: "Connecting to backend...",
    success: (data) => data.message,
    error: "Backend unreachable",
  });
};

const Home = (): React.JSX.Element => {
  return (
    <TooltipProvider>
      <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 sm:p-8 gap-8 sm:gap-12">
        {/* Hero */}
        <motion.div
          className="text-center space-y-3 sm:space-y-4 max-w-2xl w-full"
          initial="hidden"
          animate="visible"
          variants={STAGGER_CONTAINER}
        >
          <motion.h1
            className="text-3xl sm:text-4xl md:text-5xl font-serif tracking-tight"
            variants={FADE_IN}
            transition={TRANSITION}
          >
            Modern Next.js + FastAPI Template
          </motion.h1>
          <motion.p
            className="text-base sm:text-lg text-muted-foreground"
            variants={FADE_IN}
            transition={TRANSITION}
          >
            A clean, modern, full-stack template with Tailwind CSS, shadcn/ui,
            Lucide icons, and more.
          </motion.p>
        </motion.div>

        {/* Feature Cards */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 max-w-3xl w-full"
          initial="hidden"
          animate="visible"
          variants={STAGGER_CONTAINER}
        >
          {FEATURE_CARDS.map((card) => (
            <motion.a
              key={card.title}
              href={card.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
              variants={FADE_IN}
              transition={TRANSITION}
            >
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardHeader className="pb-3">
                  <card.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary mb-2" />
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    {card.title}
                    <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 opacity-50" />
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {card.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs sm:text-sm text-muted-foreground">
                  {card.content}
                </CardContent>
              </Card>
            </motion.a>
          ))}
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          className="flex flex-col sm:flex-row items-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...TRANSITION, delay: 0.4 }}
        >
          <Button size="lg" className="gap-2 w-full sm:w-auto" asChild>
            <Link href={REPO_URL} target="_blank" rel="noopener noreferrer">
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={testBackendConnection}
              >
                <Plug className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Test backend connection</p>
            </TooltipContent>
          </Tooltip>
        </motion.div>

        {/* Footer */}
        <motion.p
          className="text-xs text-muted-foreground font-mono text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...TRANSITION, delay: 0.6 }}
        >
          Built with Next.js 16, Tailwind CSS 4, shadcn/ui, and Motion
        </motion.p>
      </main>
    </TooltipProvider>
  );
};

export default Home;
