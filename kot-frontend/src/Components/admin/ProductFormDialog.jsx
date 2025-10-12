import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
}
from "../ui/dialog";
import { Button } from '../ui/button';
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { UploadFile } from "../../integrations/Core";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { Card } from "../ui/card";
import { CATEGORIES, CATEGORY_LABELS } from "../../utils/constants";

export default function ProductFormDialog({ open, onOpenChange, product, onSave }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    discount_percentage: 0,
    category: "tacos",
    image: "",
    stock: 0,
    stock_alert_threshold: 10,
    available: true
  });
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    if (product) {
      setFormData(product);
      setImagePreview(product.image);
    } else {
      setFormData({
        name: "",
        description: "",
        price: 0,
        discount_percentage: 0,
        category: "tacos",
        image: "",
        stock: 0,
        stock_alert_threshold: 5,
        available: true
      });
      setImagePreview(null);
    }
  }, [product, open]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await UploadFile({ file });
      setFormData({...formData, image: file_url});
      setImagePreview(file_url);
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Erreur lors du téléchargement de l'image");
    }
    setUploading(false);
  };

  const removeImage = () => {
    setFormData({...formData, image: ""});
    setImagePreview(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const finalPrice = formData.price * (1 - formData.discount_percentage / 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            {product ? "Modifier le produit" : "Nouveau produit"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>Photo du produit</Label>
            {imagePreview ? (
              <Card className="relative overflow-hidden">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-48 object-cover"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  onClick={removeImage}
                  className="absolute top-2 right-2 rounded-full"
                >
                  <X className="w-4 h-4" />
                </Button>
              </Card>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-amber-400 transition-colors bg-gray-50">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {uploading ? (
                    <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">Cliquez pour télécharger une image</p>
                      <p className="text-xs text-gray-400 mt-1">PNG, JPG jusqu'à 5MB</p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom du produit *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Ex: Tacos Poulet"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Catégorie *</Label>
              <Select
                onValueChange={(value) => setFormData({ ...formData, category: value })}
                value={formData.category || ""}
              >
                <SelectTrigger  className={`transition-all ${
                  formData.category ? "bg-amber-50 border-amber-300 text-amber-800" : "text-gray-500"
                }`}>
                  <SelectValue placeholder="Sélectionner une catégorie" displayValue={CATEGORY_LABELS[formData.category]} />

                </SelectTrigger>
                <SelectContent className={formData.category ? "bg-amber-50 border-amber-300" : ""}>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Décrivez votre produit..."
              rows={3}
            />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Prix (FCFA) *</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                placeholder="5000"
                required
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount">Réduction (%)</Label>
              <Input
                id="discount"
                type="number"
                value={formData.discount_percentage}
                onChange={(e) => setFormData({...formData, discount_percentage: parseFloat(e.target.value) || 0})}
                placeholder="0"
                min="0"
                max="100"
              />
            </div>

            <div className="space-y-2">
              <Label>Prix final</Label>
              <div className="h-10 px-3 rounded-lg bg-green-50 border-2 border-green-200 flex items-center">
                <span className="font-bold text-green-700">
                  {Math.round(finalPrice).toLocaleString()} FCFA
                </span>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stock">Stock *</Label>
              <Input
                id="stock"
                type="number"
                value={formData.stock}
                onChange={(e) => setFormData({...formData, stock: parseInt(e.target.value) || 0})}
                placeholder="50"
                required
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="threshold">Seuil d'alerte stock</Label>
              <Input
                id="threshold"
                type="number"
                value={formData.stock_alert_threshold}
                onChange={(e) => setFormData({...formData, stock_alert_threshold: parseInt(e.target.value) || 10})}
                placeholder="10"
                min="0"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <Label htmlFor="available" className="text-base font-semibold">
                Produit disponible à la vente
              </Label>
              <p className="text-sm text-gray-500">
                Activez pour rendre visible dans le menu client
              </p>
            </div>
            <Switch
              id="available"
              checked={formData.available}
              onCheckedChange={(checked) => setFormData({...formData, available: checked})}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-to-r from-yellow-400 to-amber-600 hover:from-yellow-500 hover:to-amber-700 text-white"
            >
              {product ? "Mettre à jour" : "Créer le produit"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}