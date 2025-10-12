import React, { useState, useEffect } from 'react';
import { Order } from '../Entities/Order';
import { Product } from '../Entities/Product';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Card, CardContent } from './ui/card';
import { Plus, Minus, X } from 'lucide-react';

export default function EditOrderDialog({ order, isOpen, onClose, onSave }) {
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    order_type: 'emporter',
    delivery_address: '',
    pickup_time: '',
    notes: '',
    items: []
  });
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (order && isOpen) {
      setFormData({
        customer_name: order.customer_name || '',
        customer_phone: order.customer_phone || '',
        customer_email: order.customer_email || '',
        order_type: order.order_type || 'emporter',
        delivery_address: order.delivery_address || '',
        pickup_time: order.pickup_time || '',
        notes: order.notes || '',
        items: order.items || []
      });
    }
  }, [order, isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadProducts();
    }
  }, [isOpen]);

  const loadProducts = async () => {
    try {
      const allProducts = await Product.list();
      setProducts(allProducts);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const total_amount = formData.items.reduce((total, item) => {
        const product = products.find(p => p.name === item.product_name);
        return total + (product ? product.price * item.quantity : 0);
      }, 0);

      await Order.update(order.id, {
        ...formData,
        total_amount,
        items: formData.items
      });

      onSave();
      onClose();
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Erreur lors de la mise à jour de la commande');
    }

    setIsLoading(false);
  };

  const addItem = (productName) => {
    const existingItem = formData.items.find(item => item.product_name === productName);
    if (existingItem) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.map(item =>
          item.product_name === productName
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        items: [...prev.items, { product_name: productName, quantity: 1 }]
      }));
    }
  };

  const removeItem = (productName) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.product_name !== productName)
    }));
  };

  const updateQuantity = (productName, quantity) => {
    if (quantity <= 0) {
      removeItem(productName);
    } else {
      setFormData(prev => ({
        ...prev,
        items: prev.items.map(item =>
          item.product_name === productName
            ? { ...item, quantity }
            : item
        )
      }));
    }
  };

  const total = formData.items.reduce((sum, item) => {
    const product = products.find(p => p.name === item.product_name);
    return sum + (product ? product.price * item.quantity : 0);
  }, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier la commande #{order?.id.slice(-6)}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customer_name">Nom du client</Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="customer_phone">Téléphone</Label>
              <Input
                id="customer_phone"
                value={formData.customer_phone}
                onChange={(e) => setFormData(prev => ({ ...prev, customer_phone: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="customer_email">Email</Label>
              <Input
                id="customer_email"
                type="email"
                value={formData.customer_email}
                onChange={(e) => setFormData(prev => ({ ...prev, customer_email: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="order_type">Type de commande</Label>
              <Select
                value={formData.order_type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, order_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="emporter">À emporter</SelectItem>
                  <SelectItem value="livraison">Livraison</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.order_type === 'livraison' && (
              <div className="md:col-span-2">
                <Label htmlFor="delivery_address">Adresse de livraison</Label>
                <Input
                  id="delivery_address"
                  value={formData.delivery_address}
                  onChange={(e) => setFormData(prev => ({ ...prev, delivery_address: e.target.value }))}
                  required
                />
              </div>
            )}
            <div>
              <Label htmlFor="pickup_time">Heure de retrait</Label>
              <Input
                id="pickup_time"
                type="datetime-local"
                value={formData.pickup_time}
                onChange={(e) => setFormData(prev => ({ ...prev, pickup_time: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>

          <div>
            <Label>Articles</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
              {products.map(product => (
                <Card key={product.id} className="p-4">
                  <CardContent className="p-0">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold">{product.name}</p>
                        <p className="text-sm text-gray-600">{product.price} FCFA</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => addItem(product.name)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <Label>Articles sélectionnés</Label>
            <div className="space-y-2 mt-2">
              {formData.items.map(item => {
                const product = products.find(p => p.name === item.product_name);
                return (
                  <div key={item.product_name} className="flex items-center justify-between p-2 border rounded">
                    <span>{item.product_name}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(item.product_name, item.quantity - 1)}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(item.product_name, item.quantity + 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => removeItem(item.product_name)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-right">
              <p className="text-xl font-bold">Total: {total.toLocaleString()} FCFA</p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Mise à jour...' : 'Mettre à jour'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
