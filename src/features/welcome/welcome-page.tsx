import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CloseAppController } from "@/components/dialogs/close-app-controller";
import { markWelcomeShownInSession } from "./welcome-guard";

export function WelcomePage() {
  const navigate = useNavigate();

  const handleStart = () => {
    markWelcomeShownInSession();
    navigate("/model-download", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background px-4">
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>

        <div className="max-w-sm space-y-2">
          <h1 className="font-syne text-3xl font-black uppercase tracking-tight text-foreground">
            Set up <span className="text-primary">KLIN</span>
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            KLIN organizes your files automatically using a local AI model.
            This takes about 3 minutes.
          </p>
        </div>

        <Button onClick={handleStart} className="h-11 w-full max-w-xs text-sm font-semibold">
          Get Started
        </Button>
      </div>
      <CloseAppController mode="quit-immediately" />
    </div>
  );
}
