import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CloseAppModalProps {
  open: boolean;
  onMinimize: () => void;
  onQuit: () => void;
}

export function CloseAppModal({ open, onMinimize, onQuit }: CloseAppModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleMinimize = async () => {
    onMinimize();
  };

  const handleQuit = async () => {
    setIsLoading(true);
    onQuit();
  };

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <h2 className="text-lg font-semibold">Close Application</h2>
          <p className="text-sm text-muted-foreground">
            Would you like to minimize to tray or quit the application?
          </p>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={handleMinimize} disabled={isLoading}>
            Minimize to Tray
          </Button>
          <Button variant="destructive" onClick={handleQuit} disabled={isLoading}>
            {isLoading ? "Quitting..." : "Quit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
