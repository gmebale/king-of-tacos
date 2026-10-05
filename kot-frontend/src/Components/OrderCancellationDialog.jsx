import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';

export default function OrderCancellationDialog({ open, order, reasons, onOpenChange, onConfirm, isSubmitting = false, isAdmin = false }) {
  const [reasonId, setReasonId] = useState('');
  const [reasonText, setReasonText] = useState('');
  const selectedReason = reasons.find(reason => String(reason.id) === reasonId);
  const needsText = selectedReason?.code === 'other';

  useEffect(() => {
    if (open) {
      setReasonId('');
      setReasonText('');
    }
  }, [open, order?.id]);

  const submit = () => {
    if (!selectedReason || (needsText && reasonText.trim().length < 3)) return;
    onConfirm({ reasonId: selectedReason.id, reasonText: reasonText.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Annuler la commande</DialogTitle>
          <DialogDescription>
            {order ? `Commande #${order.order_code || order.id.slice(-6)} · ${Number(order.total_amount || 0).toLocaleString()} FCFA` : 'Sélectionnez le motif de l’annulation.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="order-cancel-reason">Motif obligatoire</label>
            <Select value={reasonId} onValueChange={setReasonId}>
              <SelectTrigger id="order-cancel-reason">
                <SelectValue placeholder="Choisir un motif" />
              </SelectTrigger>
              <SelectContent>
                {reasons.map(reason => <SelectItem key={reason.id} value={String(reason.id)}>{reason.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {needsText && (
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="order-cancel-details">Précisez le motif</label>
              <Textarea
                id="order-cancel-details"
                value={reasonText}
                onChange={event => setReasonText(event.target.value)}
                placeholder="Expliquez brièvement la raison de l’annulation…"
                maxLength={500}
                rows={4}
              />
            </div>
          )}

          {isAdmin && order?.payment_status === 'paid' && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900" role="alert">
              Cette commande est payée. L’annulation ne déclenche pas automatiquement un remboursement.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Retour</Button>
          <Button type="button" variant="destructive" onClick={submit} disabled={isSubmitting || !selectedReason || (needsText && reasonText.trim().length < 3)}>
            {isSubmitting ? 'Annulation…' : 'Confirmer l’annulation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
