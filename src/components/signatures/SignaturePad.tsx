import { useRef, useCallback } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "~/components/ui/Button";

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  width?: number;
  height?: number;
}

/**
 * Reusable signature capture component.
 * Scaffolded for Phase 2 order signoff / declarations.
 */
export function SignaturePad({ onSave, width = 500, height = 200 }: SignaturePadProps) {
  const sigRef = useRef<SignatureCanvas>(null);

  const handleClear = useCallback(() => {
    sigRef.current?.clear();
  }, []);

  const handleSave = useCallback(() => {
    if (sigRef.current && !sigRef.current.isEmpty()) {
      const dataUrl = sigRef.current.toDataURL("image/png");
      onSave(dataUrl);
    }
  }, [onSave]);

  return (
    <div className="space-y-3">
      <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white">
        <SignatureCanvas
          ref={sigRef}
          canvasProps={{
            width,
            height,
            className: "rounded-lg",
          }}
          penColor="#1e293b"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={handleClear}>
          Clear
        </Button>
        <Button variant="primary" size="sm" onClick={handleSave}>
          Save Signature
        </Button>
      </div>
    </div>
  );
}
