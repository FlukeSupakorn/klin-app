import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="flex min-h-[calc(100vh-5rem)] w-full max-w-sm flex-col items-center justify-center gap-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
        <Sparkles className="h-7 w-7 text-primary" />
      </div>

      <div className="space-y-2">
        <h1 className="font-syne text-3xl font-black uppercase tracking-tight text-foreground">
          Set up <span className="text-primary">KLIN</span>
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          KLIN organizes your files automatically using a local AI model.
          This takes about 3 minutes.
        </p>
      </div>

      <Button onClick={onNext} className="h-11 w-full text-sm font-semibold">
        Get Started
      </Button>
    </div>
  );
}
