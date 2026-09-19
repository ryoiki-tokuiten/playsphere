import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ShareModalProps {
  username: string;
  open: boolean;
  onClose: () => void;
}

export function ShareModal({ username, open, onClose }: ShareModalProps) {
  const { toast } = useToast();
  const cardUrl = `${window.location.origin}/share/${username}`;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="bg-[#0f0f0f] text-white border-[#2D221C] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Share Gaming Card</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6 p-4">
          <div className="bg-white p-4 rounded-xl shadow-lg">
            <QRCodeSVG value={cardUrl} size={180} level="H" includeMargin />
          </div>
          <Button
            onClick={async () => {
              await navigator.clipboard.writeText(cardUrl);
              toast({
                title: "Link Copied!",
                description: "Profile link copied to clipboard",
              });
            }}
            className="w-full bg-[#EC1146] hover:bg-[#EC1146]/90 text-white font-medium"
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy Profile Link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
