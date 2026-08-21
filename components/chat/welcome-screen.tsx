"use client";

import { Sparkles } from "lucide-react";

import { SuggestedActions, WELCOME_SUGGESTIONS } from "@/components/chat/suggested-actions";

interface WelcomeScreenProps {
  onSelectPrompt: (prompt: string) => void;
}

export function WelcomeScreen({ onSelectPrompt }: WelcomeScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-4 py-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="size-7" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold">به لیارا کوپایلوت خوش آمدید</h1>
        <p className="text-sm text-muted-foreground">
          دستیار هوشمند شما برای دیپلوی، دیتابیس، دامنه و رفع‌اشکال — بر پایه‌ی مستندات رسمی لیارا
        </p>
      </div>
      <SuggestedActions actions={WELCOME_SUGGESTIONS} onSelect={onSelectPrompt} className="w-full" />
    </div>
  );
}
