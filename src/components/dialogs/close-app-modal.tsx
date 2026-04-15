import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CloseAppModalProps {
  open: boolean;
  onMinimize: () => void;
  onQuit: () => void;
  onCancel: () => void;
}

export function CloseAppModal({ open, onMinimize, onQuit, onCancel }: CloseAppModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleMinimize = async () => {
    onMinimize();
  };

  const handleQuit = async () => {
    setIsLoading(true);
    onQuit();
  };

  const handleOpenChange = (newOpen: boolean) => {
    // When dialog closes (user clicks outside or presses Escape), call onCancel
    if (!newOpen) {
      onCancel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
