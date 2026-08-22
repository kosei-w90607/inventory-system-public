import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { commands } from "@/lib/bindings";
import type { Supplier } from "@/lib/bindings";
import { unwrapResult } from "@/lib/invoke";

export function CreateSupplierDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (supplier: Supplier) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (trimmed === "") {
      setError("取引先名を入力してください");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const supplier = await unwrapResult(commands.createSupplier(trimmed), {
        source: "commands",
        cmd: "create_supplier",
      });
      await onCreated(supplier);
      setName("");
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "取引先を追加できませんでした");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新しい取引先を追加</DialogTitle>
          <DialogDescription>メーカー名またはブランド名を入力してください。</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="price-revision-supplier-name">取引先名</Label>
          <Input
            id="price-revision-supplier-name"
            value={name}
            disabled={pending}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
          />
          {error !== null ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              onOpenChange(false);
            }}
          >
            キャンセル
          </Button>
          <Button type="button" disabled={pending} onClick={() => void submit()}>
            {pending ? "追加中" : error === null ? "追加する" : "再試行"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
